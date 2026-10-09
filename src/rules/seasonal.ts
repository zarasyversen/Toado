import type { CareJob, EventType, Plant, Task } from '../types';
import { lastEvent, wholeDaysBetween } from '../log';
import { gardenMonth, growing, profileOf, theNames, type RuleContext } from './context';

interface JobRule {
  verb: string;
  logAs: EventType;
  /** Logging the job this recently counts as done for now. */
  doneForDays: number;
  priority: number;
}

const JOBS: Record<CareJob, JobRule> = {
  harvest: { verb: 'Harvest', logAs: 'harvested', doneForDays: 3, priority: 45 },
  sow: { verb: 'Sow', logAs: 'sown', doneForDays: 30, priority: 35 },
  prune: { verb: 'Prune', logAs: 'pruned', doneForDays: 60, priority: 30 },
  feed: { verb: 'Feed', logAs: 'fed', doneForDays: 14, priority: 30 },
  mulch: { verb: 'Mulch', logAs: 'mulched', doneForDays: 60, priority: 25 },
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

/** Finished crops stay on the to-do list until cleared away, within this many days. */
const CLEARED_FOR_DAYS = 180;

function doneRecently(ctx: RuleContext, plant: Plant, type: EventType, days: number): boolean {
  const event = lastEvent(ctx.events, type, plant);
  return event !== undefined && wholeDaysBetween(event.at, ctx.now) < days;
}

/** Plants whose care calendar has this job in the current month. */
function inWindow(ctx: RuleContext, job: CareJob): Plant[] {
  const month = gardenMonth(ctx);
  // Annuals get sown again each year, so sowing doesn't need the plant to be growing.
  const candidates = job === 'sow' ? ctx.garden.plants : growing(ctx);
  return candidates.filter((plant) => {
    const profile = profileOf(ctx, plant);
    return (
      profile?.months[job]?.includes(month) &&
      !doneRecently(ctx, plant, JOBS[job].logAs, JOBS[job].doneForDays)
    );
  });
}

function careTasks(ctx: RuleContext): Task[] {
  return (Object.keys(JOBS) as CareJob[]).flatMap((job) => {
    const plants = inWindow(ctx, job);
    if (!plants.length) return [];
    const tips = [...new Set(plants.map((p) => profileOf(ctx, p)?.tips?.[job]).filter(Boolean))];
    const month = MONTHS[Number(ctx.weather.today.slice(5, 7)) - 1];
    return [{
      id: job,
      kind: job,
      title: `${JOBS[job].verb} ${theNames(plants)}`,
      reason: tips.length ? tips.join(' ') : `${month} is the time for it.`,
      priority: JOBS[job].priority,
      plantIds: plants.map((p) => p.id),
      logAs: JOBS[job].logAs,
    }];
  });
}

/** One task per area with finished crops that haven't been cleared away. */
function clearTasks(ctx: RuleContext): Task[] {
  const finished = ctx.garden.plants.filter(
    (p) => p.status === 'finished' && !doneRecently(ctx, p, 'cleared', CLEARED_FOR_DAYS),
  );
  const byArea = new Map<string | undefined, Plant[]>();
  for (const p of finished) byArea.set(p.areaId, [...(byArea.get(p.areaId) ?? []), p]);

  return [...byArea].map(([areaId, plants]) => {
    const area = ctx.garden.areas.find((a) => a.id === areaId);
    return {
      id: `clear:${areaId ?? plants[0].id}`,
      kind: 'clear',
      title: `Clear ${theNames(plants)}${area ? ` from the ${area.name.toLowerCase()}` : ''}`,
      reason: 'Their season is over. Compost the healthy leaves so pests have nowhere to overwinter.',
      priority: 35,
      plantIds: plants.map((p) => p.id),
      areaId,
      logAs: 'cleared',
    };
  });
}

export function seasonalTasks(ctx: RuleContext): Task[] {
  return [...careTasks(ctx), ...clearTasks(ctx)];
}
