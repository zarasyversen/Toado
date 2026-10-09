import type { Plant, Task } from '../types';
import { areaOf } from '../garden';
import { daysSinceWatered } from '../log';
import { PAST_DAYS } from '../weather';
import { celsius, growing, profileOf, theNames, today, type RuleContext } from './context';

/** Rain at or above this today or tomorrow means outdoor watering can wait. */
const RAIN_COMING_MM = 5;

interface Due {
  plant: Plant;
  /** Undefined when nothing has been logged under cover, where rain can't help. */
  days: number | undefined;
  interval: number;
}

/** The plant's interval, shorter for pots (little soil) and on hot days. */
function intervalFor(ctx: RuleContext, plant: Plant, everyDays: number): number {
  const hot = today(ctx).tMax >= 25 ? 0.6 : 1;
  const pot = plant.inPot ? 0.5 : 1;
  return Math.max(1, Math.round(everyDays * hot * pot));
}

function due(ctx: RuleContext): Due[] {
  const rainComing = ctx.weather.forecast.slice(0, 2).some((d) => d.precip >= RAIN_COMING_MM);
  const result: Due[] = [];

  for (const plant of growing(ctx)) {
    const profile = profileOf(ctx, plant);
    const area = areaOf(ctx.garden, plant);
    const covered = area?.covered ?? false;
    if (!profile) continue;
    // Outdoors, dormant plants and plants about to get rain can wait.
    if (!covered && (!ctx.season.growingSeason || rainComing)) continue;

    let days = daysSinceWatered(plant, area, ctx.events, ctx.weather, ctx.now);
    // Outdoors, no log and no proper rain in the whole forecast history means at least that long.
    if (days === undefined && !covered) days = PAST_DAYS;
    const interval = intervalFor(ctx, plant, profile.waterEveryDays);
    if (days === undefined || days >= interval) result.push({ plant, days, interval });
  }
  return result;
}

function reasonFor(ctx: RuleContext, worst: Due): string {
  const hot = today(ctx).tMax >= 25 ? `, and it's ${celsius(today(ctx).tMax)} today` : '';
  if (worst.days === undefined) return `No watering logged yet${hot}.`;
  if (worst.days >= PAST_DAYS) return `No watering logged and no real rain for ${PAST_DAYS} days${hot}.`;
  return `${worst.days} days without water or real rain; they want it every ${worst.interval}${hot}.`;
}

/** How overdue, as a fraction past the interval; unknown counts as a little overdue. */
function overdue(d: Due): number {
  return d.days === undefined ? 0.5 : d.days / d.interval - 1;
}

/** One task per area, so the card says "water the berry bushes" once, not three times. */
export function wateringTasks(ctx: RuleContext): Task[] {
  const byArea = new Map<string, Due[]>();
  for (const d of due(ctx)) {
    const key = d.plant.areaId ?? d.plant.id;
    byArea.set(key, [...(byArea.get(key) ?? []), d]);
  }

  return [...byArea].map(([key, group]) => {
    const worst = group.reduce((a, b) => (overdue(b) > overdue(a) ? b : a));
    return {
      id: `water:${key}`,
      kind: 'water',
      title: `Water ${theNames(group.map((d) => d.plant))}`,
      reason: reasonFor(ctx, worst),
      priority: 50 + Math.min(30, Math.round(10 * overdue(worst))),
      plantIds: group.map((d) => d.plant.id),
      logAs: 'watered',
    };
  });
}
