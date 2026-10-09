import type { CareProfile, FrostDates, Garden, GardenEvent, Place, SeasonInfo, Task, Weather } from './types';
import { loadGarden, saveGarden } from './garden';
import { loadLog, logEvent, saveLog } from './log';
import { fetchWeather } from './weather';
import { fetchFrostDates, seasonFor } from './climate';
import { candidateTasks, type RuleContext } from './rules';
import { BUILT_IN_PROFILES } from './plants';
import { planDay, planFromRules, type DayPlan } from './gemma';
import { DEFAULT_MODEL, modelReady } from './ollama';
import { readJson, writeJson } from './storage';

export type Tab = 'today' | 'garden' | 'log' | 'ask';

/** Dev-only weather overrides, to see the greenhouse and frost rules without waiting for them. */
export type Pretend = 'real' | 'hot' | 'frost';

/** Today's plan, kept for the day so reopening the app doesn't ask Gemma again. */
export interface PlanCache {
  key: string;
  /** The candidates the plan was made from, so done taps know what to log. */
  tasks: Task[];
  plan: DayPlan;
  done: string[];
}

const PLAN_KEY = 'toado.plan';

export function profilesFor(garden: Garden): Record<string, CareProfile> {
  return { ...BUILT_IN_PROFILES, ...Object.fromEntries((garden.profiles ?? []).map((p) => [p.id, p])) };
}

function pretendWeather(weather: Weather, pretend: Pretend): Weather {
  if (pretend === 'real') return weather;
  const [today, tomorrow, ...rest] = weather.forecast;
  const hot = pretend === 'hot';
  return {
    ...weather,
    forecast: [
      { ...today, ...(hot ? { tMax: 29, sunshineHours: 11, uvMax: 7, precip: 0 } : { tMax: 5 }) },
      { ...tomorrow, tMin: hot ? 8 : -4 },
      ...rest,
    ],
  };
}

export class App {
  garden: Garden = loadGarden();
  events: GardenEvent[] = loadLog();
  tab: Tab = 'today';
  pretend: Pretend = 'real';

  realWeather?: Weather;
  weather?: Weather;
  frost?: FrostDates;
  season?: SeasonInfo;
  tasks: Task[] = [];
  plan?: PlanCache;

  gemma: 'checking' | 'ready' | 'missing' = 'checking';
  readonly model = DEFAULT_MODEL;
  loading = false;
  planning = false;
  error?: string;

  /** Bumped per weather request, so a slow answer for an old place can't win. */
  private weatherRequest = 0;

  constructor(private readonly onChange: () => void) {}

  render(): void {
    this.onChange();
  }

  async start(): Promise<void> {
    void modelReady().then((ok) => {
      this.gemma = ok ? 'ready' : 'missing';
      this.render();
    });
    await this.loadWeather();
  }

  get ctx(): RuleContext | undefined {
    if (!this.weather || !this.season) return undefined;
    return {
      garden: this.garden,
      events: this.events,
      weather: this.weather,
      season: this.season,
      profiles: profilesFor(this.garden),
      now: new Date(),
    };
  }

  async loadWeather(): Promise<void> {
    const place = this.garden.place;
    const request = ++this.weatherRequest;
    if (!place) {
      // No place, no forecast: drop everything computed for the previous garden.
      this.realWeather = this.weather = this.season = this.frost = undefined;
      this.tasks = [];
      this.plan = undefined;
      return this.render();
    }
    this.loading = true;
    this.error = undefined;
    this.render();
    try {
      const [weather, frost] = await Promise.all([
        fetchWeather(place),
        // Frost history is a nice-to-have; the season falls back to temperatures alone.
        fetchFrostDates(place).catch(() => undefined),
      ]);
      if (request !== this.weatherRequest) return;
      this.realWeather = weather;
      this.frost = frost;
      this.recompute();
    } catch (err) {
      if (request === this.weatherRequest) this.error = err instanceof Error ? err.message : String(err);
    } finally {
      if (request === this.weatherRequest) {
        this.loading = false;
        this.render();
      }
    }
  }

  /** Rerun the rules after anything changes: the garden, the log, or the weather. */
  recompute(): void {
    if (!this.realWeather || !this.garden.place) return;
    this.weather = pretendWeather(this.realWeather, this.pretend);
    this.season = seasonFor(this.weather, this.garden.place.lat, this.frost);
    this.tasks = candidateTasks(this.ctx!);
    this.ensurePlan();
  }

  /**
   * Keep today's plan unless it's a new day or a job turned up that the plan never saw.
   * The rules' list shows at once; Gemma's version replaces it when it arrives.
   */
  ensurePlan(force = false): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const key = `${ctx.weather.today}:${this.pretend}`;
    const stored = !this.plan;
    const cached = this.plan ?? readJson<PlanCache | null>(PLAN_KEY, null) ?? undefined;
    // A stored rules-only plan means Gemma was down (or the tab closed mid-plan): try again.
    const retryGemma = stored && cached?.plan.source === 'rules' && this.tasks.length > 0;
    const fresh =
      cached?.key === key && !retryGemma && this.tasks.every((t) => cached.tasks.some((c) => c.id === t.id));
    if (fresh && !force) {
      this.plan = cached;
      return;
    }

    const plan: PlanCache = {
      key,
      tasks: this.tasks,
      plan: planFromRules(this.tasks),
      // Ticks belong to the day, whichever weather the plan was made for.
      done: cached?.key.split(':')[0] === ctx.weather.today ? cached.done : [],
    };
    this.plan = plan;
    this.savePlan();
    if (!this.tasks.length) return;

    this.planning = true;
    void planDay(ctx, this.tasks)
      .then((result) => {
        if (this.plan !== plan) return; // a newer plan has started since
        plan.plan = result;
        if (result.source === 'gemma') this.gemma = 'ready';
        this.savePlan();
      })
      .finally(() => {
        if (this.plan === plan) this.planning = false;
        this.render();
      });
  }

  private savePlan(): void {
    if (this.plan) writeJson(PLAN_KEY, this.plan);
  }

  isDone(taskIds: string[]): boolean {
    return taskIds.every((id) => this.plan?.done.includes(id));
  }

  /** Log each job as done, so the rules can see it (watered today, pruned this winter…). */
  markDone(taskIds: string[]): void {
    const known = [...(this.plan?.tasks ?? []), ...this.tasks];
    for (const id of taskIds) {
      const task = known.find((t) => t.id === id);
      if (!task || this.plan?.done.includes(id)) continue;
      logEvent(this.events, task.logAs ?? 'note', {
        plantIds: task.plantIds,
        areaId: task.areaId,
        note: task.logAs ? undefined : `Done: ${task.title}`,
      });
      // Sowing starts a new round of an annual.
      if (task.logAs === 'sown') {
        for (const plant of this.garden.plants) if (task.plantIds?.includes(plant.id)) plant.status = 'growing';
      }
      this.plan?.done.push(id);
    }
    this.save();
  }

  addNote(note: string, plantIds?: string[]): void {
    logEvent(this.events, 'note', { note, plantIds: plantIds?.length ? plantIds : undefined });
    this.save();
  }

  removeEvent(id: string): void {
    this.events = this.events.filter((e) => e.id !== id);
    this.save();
  }

  /** Save the garden and log, rerun the rules and redraw. */
  save(): void {
    saveGarden(this.garden);
    saveLog(this.events);
    this.savePlan();
    this.recompute();
    this.render();
  }

  setPlace(place: Place): void {
    this.garden.place = place;
    this.plan = undefined;
    writeJson(PLAN_KEY, null);
    saveGarden(this.garden);
    void this.loadWeather();
  }

  replaceGarden(garden: Garden, events: GardenEvent[] = this.events): void {
    this.garden = garden;
    this.events = events;
    this.plan = undefined;
    writeJson(PLAN_KEY, null);
    saveGarden(garden);
    saveLog(events);
    void this.loadWeather();
  }

  setPretend(pretend: Pretend): void {
    this.pretend = pretend;
    this.plan = undefined;
    this.recompute();
    this.render();
  }
}
