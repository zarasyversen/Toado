import type { Area, GardenEvent, Task } from '../types';
import { celsius, growing, today, tonightMin, type RuleContext } from './context';

/** Close the greenhouse in the evening when the night gets colder than this. */
const CLOSE_BELOW_C = 10;

/**
 * Sun heats a closed greenhouse far above the air outside, so a warm day, or a mild
 * one with lots of sun, means opening up in the morning.
 */
function heatsUp(tMax: number, sunshineHours: number): boolean {
  return tMax >= 22 || (tMax >= 16 && sunshineHours >= 8);
}

function lastDoorEvent(events: GardenEvent[], area: Area): GardenEvent | undefined {
  return events
    .filter((e) => e.areaId === area.id && (e.type === 'greenhouse-opened' || e.type === 'greenhouse-closed'))
    .reduce<GardenEvent | undefined>((latest, e) => (!latest || e.at > latest.at ? e : latest), undefined);
}

export function greenhouseTasks(ctx: RuleContext): Task[] {
  const day = today(ctx);
  const night = tonightMin(ctx);
  const tasks: Task[] = [];

  for (const area of ctx.garden.areas) {
    if (area.kind !== 'greenhouse' || area.autoVents) continue;
    if (!growing(ctx).some((p) => p.areaId === area.id)) continue;
    const name = area.name.toLowerCase();

    if (heatsUp(day.tMax, day.sunshineHours)) {
      const sun = day.sunshineHours >= 4 ? ` and ${Math.round(day.sunshineHours)} hours of sun` : '';
      const closeToo = night < CLOSE_BELOW_C;
      tasks.push({
        id: `greenhouse-open:${area.id}`,
        kind: 'greenhouse',
        title: closeToo ? `Open the ${name} this morning, close it by evening` : `Open the ${name} this morning`,
        reason:
          `Up to ${celsius(day.tMax)} outside${sun}; it gets much hotter inside.` +
          (closeToo ? ` Down to ${celsius(night)} tonight.` : ''),
        priority: day.tMax >= 27 ? 90 : 85,
        areaId: area.id,
        logAs: 'greenhouse-opened',
      });
    } else if (lastDoorEvent(ctx.events, area)?.type === 'greenhouse-opened' && night < CLOSE_BELOW_C) {
      tasks.push({
        id: `greenhouse-close:${area.id}`,
        kind: 'greenhouse',
        title: `Close the ${name} before evening`,
        reason: `It's still open, and it drops to ${celsius(night)} tonight.`,
        priority: 80,
        areaId: area.id,
        logAs: 'greenhouse-closed',
      });
    }
  }
  return tasks;
}
