import type { CareJob, CareOverrides, CareProfile, Garden, PlantKind, Task } from './types';
import type { RuleContext } from './rules';
import { hemisphere } from './climate';
import { celsius, tonightMin } from './rules/context';
import { wholeDaysBetween } from './log';
import { chatJson, chatStream, type ChatMessage, type OllamaOptions } from './ollama';

/*
 * What Gemma does, running locally through Ollama: it turns the rule engine's candidate
 * jobs into a short plan for today, writes care profiles for plants the app doesn't know,
 * and answers questions about the garden. The rules own the facts; Gemma owns the words.
 */

const CARE_JOBS: CareJob[] = ['prune', 'feed', 'mulch', 'sow', 'harvest'];
const PLANT_KINDS: PlantKind[] = ['tree', 'bush', 'perennial', 'vegetable', 'herb', 'flower'];

/** The most jobs a day's plan should hold, and how many candidates Gemma gets to pick from. */
const PLAN_MAX = 5;
const CANDIDATES_MAX = 12;

// ─── Describing the garden ─────────────────────────────────────────────────────

function plantLabel(p: Garden['plants'][number]): string {
  return p.variety ? `${p.name} "${p.variety}"` : p.name;
}

function plantsByArea(garden: Garden): string[] {
  const lines = garden.areas.map((area) => {
    const plants = garden.plants.filter((p) => p.areaId === area.id);
    const where = area.covered ? 'covered' : 'open ground';
    const notes = area.notes ? `; ${area.notes}` : '';
    const list = plants.map((p) => `${plantLabel(p)}${p.inPot ? ' in a pot' : ''} (${p.status})`).join(', ');
    return `- ${area.name} (${where}${notes}): ${list || 'nothing yet'}`;
  });
  const loose = garden.plants.filter((p) => !garden.areas.some((a) => a.id === p.areaId));
  if (loose.length) lines.push(`- Elsewhere: ${loose.map((p) => `${plantLabel(p)} (${p.status})`).join(', ')}`);
  return lines;
}

function recentLog(ctx: RuleContext): string[] {
  const names = new Map(ctx.garden.plants.map((p) => [p.id, plantLabel(p)]));
  const areas = new Map(ctx.garden.areas.map((a) => [a.id, a.name]));
  return ctx.events
    .filter((e) => wholeDaysBetween(e.at, ctx.now) < 7)
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((e) => {
      const what = [...(e.plantIds ?? []).map((id) => names.get(id)), e.areaId && areas.get(e.areaId)]
        .filter(Boolean)
        .join(', ');
      return `- ${e.at.slice(0, 10)} ${e.type}${what ? `: ${what}` : ''}${e.note ? ` (“${e.note}”)` : ''}`;
    });
}

/** Everything Gemma needs to know about this garden today, as plain text. */
export function describeGarden(ctx: RuleContext): string {
  const { garden, weather, season } = ctx;
  const place = garden.place;
  const where = place
    ? `${[place.name, place.region, place.country].filter(Boolean).join(', ')} (${Math.abs(place.lat).toFixed(1)}°${place.lat < 0 ? 'S' : 'N'})`
    : 'unknown location';
  const date = new Date(`${weather.today}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
  // Spell out tonight's low: a day's minimum falls in the early morning, which is easy to misread.
  const days = weather.forecast.slice(0, 2).map((d, i) =>
    `${i ? 'Tomorrow' : 'Today'}: up to ${celsius(d.tMax)}, ${d.precip.toFixed(0)} mm rain, ` +
    `gusts ${Math.round(d.gustMax)} km/h, ${Math.round(d.sunshineHours)} h sun.`,
  );
  days.splice(1, 0, `Tonight: down to ${celsius(tonightMin(ctx))}.`);
  const log = recentLog(ctx);

  return [
    `Garden: ${garden.name} in ${where}.${garden.soil ? ` Soil: ${garden.soil}.` : ''}` +
      (garden.pests.length ? ` Known pests: ${garden.pests.join(', ')}.` : ''),
    `Date: ${date}. Season: ${season.season}, 7-day mean ${celsius(season.mean7)}, ` +
      `${season.growingSeason ? 'inside' : 'outside'} the growing season.`,
    ...days,
    'Areas and plants:',
    ...plantsByArea(garden),
    log.length ? 'Logged in the last 7 days:' : 'Nothing logged in the last 7 days.',
    ...log,
  ].join('\n');
}

// ─── Today's plan ──────────────────────────────────────────────────────────────

export interface PlanItem {
  title: string;
  reason: string;
  /** The candidate tasks this item covers; marking it done logs each of them. */
  taskIds: string[];
}

export interface DayPlan {
  summary: string;
  items: PlanItem[];
  /** "rules" when Gemma wasn't reachable and the plan is the engine's own list. */
  source: 'gemma' | 'rules';
}

const PLAN_SYSTEM = `You are Toado, a friendly and practical garden helper. You plan today's outdoor jobs for one real garden.

You get a description of the garden and a list of candidate jobs. The candidates come from rules that already checked the weather forecast, the season, each plant's care calendar and the garden log, so trust them.

- Pick the 2–${PLAN_MAX} jobs that matter most today, in the order they should be done. Frost and greenhouse jobs are time-critical.
- You may merge closely related candidates into one job; list every id it covers.
- Title: a short instruction, at most 8 words, naming the actual plants.
- Reason: one plain sentence using only facts given to you. Never invent temperatures, dates, plants or events.
- Summary: one or two warm sentences about today in this garden, nudging the reader outside.`;

function planSchema(ids: string[]): object {
  return {
    type: 'object',
    properties: {
      summary: { type: 'string' },
      jobs: {
        type: 'array',
        maxItems: PLAN_MAX,
        items: {
          type: 'object',
          properties: {
            ids: { type: 'array', minItems: 1, items: { type: 'string', enum: ids } },
            title: { type: 'string' },
            reason: { type: 'string' },
          },
          required: ['ids', 'title', 'reason'],
        },
      },
    },
    required: ['summary', 'jobs'],
  };
}

function candidateLines(tasks: Task[]): string {
  return tasks.map((t) => `- id "${t.id}" (priority ${t.priority}): ${t.title}. ${t.reason}`).join('\n');
}

/**
 * Checks Gemma's plan against the candidates: unknown ids are dropped, a job can only
 * be used once, and the plan must keep at least one job.
 */
export function parsePlan(raw: unknown, tasks: Task[]): DayPlan {
  const known = new Set(tasks.map((t) => t.id));
  const used = new Set<string>();
  const json = raw as { summary?: unknown; jobs?: unknown };
  const jobs = Array.isArray(json?.jobs) ? json.jobs : [];

  const items: PlanItem[] = [];
  for (const job of jobs as { ids?: unknown; title?: unknown; reason?: unknown }[]) {
    if (typeof job?.title !== 'string' || !job.title.trim() || !Array.isArray(job.ids)) continue;
    const taskIds = job.ids.filter((id): id is string => typeof id === 'string' && known.has(id) && !used.has(id));
    if (!taskIds.length) continue;
    taskIds.forEach((id) => used.add(id));
    items.push({ title: job.title.trim(), reason: typeof job.reason === 'string' ? job.reason.trim() : '', taskIds });
  }
  if (!items.length) throw new Error('Gemma returned no usable jobs');
  return {
    summary: typeof json.summary === 'string' ? json.summary.trim() : '',
    items: items.slice(0, PLAN_MAX),
    source: 'gemma',
  };
}

/** The plan without Gemma: the engine's top jobs, as written by the rules. */
export function planFromRules(tasks: Task[]): DayPlan {
  return {
    summary: tasks.length ? '' : 'Nothing pressing today. A good day to just wander round and look.',
    items: tasks.slice(0, PLAN_MAX).map((t) => ({ title: t.title, reason: t.reason, taskIds: [t.id] })),
    source: 'rules',
  };
}

/** Today's plan from Gemma, or from the rules alone if Gemma is unavailable or confused. */
export async function planDay(ctx: RuleContext, tasks: Task[], opts: OllamaOptions = {}): Promise<DayPlan> {
  if (!tasks.length) return planFromRules(tasks);
  const candidates = tasks.slice(0, CANDIDATES_MAX);
  const messages: ChatMessage[] = [
    { role: 'system', content: PLAN_SYSTEM },
    { role: 'user', content: `${describeGarden(ctx)}\n\nCandidate jobs:\n${candidateLines(candidates)}` },
  ];
  try {
    return parsePlan(await chatJson(messages, planSchema(candidates.map((t) => t.id)), opts), candidates);
  } catch (err) {
    if (opts.signal?.aborted) throw err;
    return planFromRules(tasks);
  }
}

// ─── Care profiles for new plants ──────────────────────────────────────────────

const CARE_SYSTEM = `You are a careful horticulture reference. Given a plant, and maybe its variety, you describe how to care for it in one specific garden.

- kind: tree; bush (shrubs, berry bushes, roses); perennial (comes back every year, not woody); vegetable; herb; or flower (annual flowers).
- Months are numbers 1–12 for that garden's own location and climate. A job the plant never needs gets an empty list.
- If you know the variety, use its own timing (an early apple is picked earlier than a late one).
- If you are given a general profile for the plant, keep each value as it is unless this variety really differs.
- waterEveryDays: days between waterings for an established plant in open ground in dry weather.
- frostHardyTo: the lowest night temperature in °C it takes without protection (tender crops are above 0).
- Tips: at most one short, practical sentence per job, only where it adds something.`;

const monthList = { type: 'array', items: { type: 'integer', minimum: 1, maximum: 12 } };

const CARE_SCHEMA = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: PLANT_KINDS },
    waterEveryDays: { type: 'integer', minimum: 1, maximum: 60 },
    frostHardyTo: { type: 'number', minimum: -50, maximum: 15 },
    months: {
      type: 'object',
      properties: Object.fromEntries(CARE_JOBS.map((j) => [j, monthList])),
      required: CARE_JOBS,
    },
    tips: { type: 'object', properties: Object.fromEntries(CARE_JOBS.map((j) => [j, { type: 'string' }])) },
  },
  required: ['kind', 'waterEveryDays', 'frostHardyTo', 'months'],
};

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

/** The same point in the year on the other side of the equator (a shift both ways). */
function otherHemisphere(month: number): number {
  return ((month + 5) % 12) + 1;
}

/** A care profile from Gemma's answer, with every value checked and kept in range. */
export function parseCareProfile(raw: unknown, name: string, variety: string | undefined, south: boolean): CareProfile {
  const json = (raw ?? {}) as Record<string, unknown>;
  const rawMonths = (json.months ?? {}) as Record<string, unknown>;
  const rawTips = (json.tips ?? {}) as Record<string, unknown>;

  const months: CareProfile['months'] = {};
  const tips: CareProfile['tips'] = {};
  for (const job of CARE_JOBS) {
    const list = Array.isArray(rawMonths[job]) ? rawMonths[job] : [];
    const valid = list.filter((m): m is number => Number.isInteger(m) && m >= 1 && m <= 12);
    const northern = [...new Set(valid.map((m) => (south ? otherHemisphere(m) : m)))].sort((a, b) => a - b);
    if (northern.length) months[job] = northern;
    const tip = rawTips[job];
    if (typeof tip === 'string' && tip.trim()) tips[job] = tip.trim();
  }

  const label = variety ? `${name} ${variety}` : name;
  return {
    id: `custom-${label.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
    name: label,
    kind: PLANT_KINDS.includes(json.kind as PlantKind) ? (json.kind as PlantKind) : 'perennial',
    waterEveryDays: Math.round(clamp(json.waterEveryDays, 1, 60, 7)),
    frostHardyTo: Math.round(clamp(json.frostHardyTo, -50, 15, 0)),
    months,
    tips,
  };
}

/**
 * Ask Gemma how to care for a plant in this garden. The result is a suggestion for
 * you to review and edit before it's saved.
 */
export async function suggestCare(
  garden: Garden,
  plant: { name: string; variety?: string; /** The species profile, when the app has one. */ base?: CareProfile },
  opts: OllamaOptions = {},
): Promise<CareProfile> {
  const place = garden.place;
  const south = hemisphere(place?.lat ?? 0) === 'south';
  const where = place
    ? `${[place.name, place.region, place.country].filter(Boolean).join(', ')}, latitude ${place.lat.toFixed(1)}`
    : 'a temperate northern garden';
  const lines = [
    `Plant: ${plant.variety ? `${plant.name}, variety "${plant.variety}"` : plant.name}.`,
    `Garden: ${where}.${garden.soil ? ` Soil: ${garden.soil}.` : ''}`,
  ];
  if (plant.base) {
    // The base profile's months are northern; a southern garden sees them six months on.
    const { kind, waterEveryDays, frostHardyTo, tips } = plant.base;
    const months = Object.fromEntries(
      Object.entries(plant.base.months).map(([job, ms]) => [job, south ? ms.map(otherHemisphere) : ms]),
    );
    lines.push(`General profile for this plant: ${JSON.stringify({ kind, waterEveryDays, frostHardyTo, months, tips })}`);
  }
  const raw = await chatJson([{ role: 'system', content: CARE_SYSTEM }, { role: 'user', content: lines.join('\n') }], CARE_SCHEMA, opts);
  return parseCareProfile(raw, plant.name, plant.variety, south);
}

/**
 * Only what differs from the base profile, for a variety of a plant the app already
 * knows: a Melonäpple keeps the apple's watering and pruning but has its own harvest.
 */
export function overridesFrom(base: CareProfile, suggested: CareProfile): CareOverrides {
  const care: CareOverrides = {};
  if (suggested.waterEveryDays !== base.waterEveryDays) care.waterEveryDays = suggested.waterEveryDays;
  if (suggested.frostHardyTo !== base.frostHardyTo) care.frostHardyTo = suggested.frostHardyTo;
  for (const job of CARE_JOBS) {
    const was = base.months[job] ?? [];
    const now = suggested.months[job] ?? [];
    if (was.join() === now.join()) continue;
    (care.months ??= {})[job] = now;
    // A tip only travels with its job's new timing; otherwise the species tip stands.
    const tip = suggested.tips?.[job];
    if (tip) (care.tips ??= {})[job] = tip;
  }
  return care;
}

// ─── Ask the garden ────────────────────────────────────────────────────────────

const ASK_SYSTEM = `You are Toado, a friendly and practical garden helper who knows this one garden well.

Answer in under 120 words of plain text, no markdown. Be specific to this garden, its plants, its weather and its log. If you're not sure, say so rather than guessing. Where it fits, end with something to go and look at outside.`;

/** Gemma's answer about the garden, streamed as it is written. */
export function askGarden(
  ctx: RuleContext,
  tasks: Task[],
  question: string,
  history: ChatMessage[] = [],
  opts: OllamaOptions = {},
): AsyncGenerator<string> {
  const context = `${describeGarden(ctx)}\n\nJobs the rules suggest today:\n${candidateLines(tasks.slice(0, CANDIDATES_MAX)) || '- none'}`;
  return chatStream(
    [
      { role: 'system', content: `${ASK_SYSTEM}\n\n${context}` },
      ...history,
      { role: 'user', content: question },
    ],
    opts,
  );
}
