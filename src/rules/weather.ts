import type { Plant, Task } from '../types';
import { areaOf } from '../garden';
import { celsius, growing, profileOf, theNames, today, tonightMin, type RuleContext } from './context';

const HEAT_C = 28;
const GALE_KMH = 60;

/**
 * The night temperature a plant needs protecting below. An unheated greenhouse buys a
 * few degrees; a pot leaves the roots of hardy plants exposed, so they need help sooner.
 */
function protectBelow(ctx: RuleContext, plant: Plant, hardyTo: number): number {
  const covered = areaOf(ctx.garden, plant)?.covered ? 3 : 0;
  const potted = plant.inPot && hardyTo < 0 ? 5 : 0;
  return hardyTo - covered + potted;
}

function frost(ctx: RuleContext): Task[] {
  const night = tonightMin(ctx);
  const atRisk = growing(ctx).filter((plant) => {
    const profile = profileOf(ctx, plant);
    return profile && night < protectBelow(ctx, plant, profile.frostHardyTo);
  });
  if (!atRisk.length) return [];
  return [{
    id: 'frost',
    kind: 'frost',
    title: `Protect ${theNames(atRisk)} from frost tonight`,
    reason: `Down to ${celsius(night)} tonight. Cover them with fleece, or bring pots inside.`,
    priority: 95,
    plantIds: atRisk.map((p) => p.id),
    logAs: 'protected',
  }];
}

function heat(ctx: RuleContext): Task[] {
  const day = today(ctx);
  const outside = growing(ctx).filter((p) => !areaOf(ctx.garden, p)?.covered);
  if (day.tMax < HEAT_C || !outside.length) return [];
  const pots = outside.some((p) => p.inPot);
  return [{
    id: 'heat',
    kind: 'heat',
    title: pots ? 'Water early and move pots into the shade' : 'Water early, before the heat',
    reason: `Up to ${celsius(day.tMax)} today. Morning water reaches the roots instead of the air.`,
    priority: 70,
    plantIds: outside.map((p) => p.id),
    logAs: 'watered',
  }];
}

function wind(ctx: RuleContext): Task[] {
  const days = ctx.weather.forecast.slice(0, 2);
  const worst = days.reduce((a, b) => (b.gustMax > a.gustMax ? b : a));
  if (worst.gustMax < GALE_KMH || !growing(ctx).length) return [];
  const when = worst === days[0] ? 'today' : 'tomorrow';
  const greenhouse = ctx.garden.areas.some((a) => a.kind === 'greenhouse');
  return [{
    id: 'wind',
    kind: 'wind',
    title: greenhouse ? 'Stake tall plants and shut the greenhouse' : 'Stake tall plants and tie things down',
    reason: `Gusts up to ${Math.round(worst.gustMax)} km/h ${when}.`,
    priority: 75,
  }];
}

export function weatherTasks(ctx: RuleContext): Task[] {
  return [...frost(ctx), ...heat(ctx), ...wind(ctx)];
}
