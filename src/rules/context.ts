import type { CareProfile, DayWeather, Garden, GardenEvent, Plant, SeasonInfo, Weather } from '../types';
import { hemisphere } from '../climate';

/** Everything a rule may look at. Rules are pure: same context, same tasks. */
export interface RuleContext {
  garden: Garden;
  events: GardenEvent[];
  weather: Weather;
  season: SeasonInfo;
  profiles: Record<string, CareProfile>;
  now: Date;
}

/** The plant's care profile, with its own overrides (say, its variety's harvest) on top. */
export function profileOf(ctx: RuleContext, plant: Plant): CareProfile | undefined {
  const base = plant.profileId ? ctx.profiles[plant.profileId] : undefined;
  if (!base || !plant.care) return base;
  return {
    ...base,
    ...plant.care,
    months: { ...base.months, ...plant.care.months },
    tips: { ...base.tips, ...plant.care.tips },
  };
}

export function growing(ctx: RuleContext): Plant[] {
  return ctx.garden.plants.filter((p) => p.status === 'growing');
}

export function today(ctx: RuleContext): DayWeather {
  return ctx.weather.forecast[0];
}

/** Tomorrow's minimum, which falls in the coming night. */
export function tonightMin(ctx: RuleContext): number {
  return (ctx.weather.forecast[1] ?? ctx.weather.forecast[0]).tMin;
}

/** The calendar month (1–12) as a northern garden would see it. */
export function gardenMonth(ctx: RuleContext): number {
  const month = Number(ctx.weather.today.slice(5, 7));
  const south = hemisphere(ctx.garden.place?.lat ?? 0) === 'south';
  return south ? ((month + 5) % 12) + 1 : month;
}

export function celsius(t: number): string {
  return `${Math.round(t)} °C`.replace('-', '−');
}

/** "a", "a and b", "a, b and c". */
export function listOf(items: string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

/** How a plant reads mid-sentence: its variety as written, otherwise "pear trees". */
function nameOf(plant: Plant): string {
  return plant.variety ?? plant.name.charAt(0).toLowerCase() + plant.name.slice(1);
}

/** Plant names without repeats: "the Melonäpple and pear trees". */
export function theNames(plants: Plant[]): string {
  const names = [...new Set(plants.map(nameOf))];
  return `the ${listOf(names)}`;
}
