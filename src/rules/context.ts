import type { CareOverrides, CareProfile, DayWeather, Garden, GardenEvent, Plant, SeasonInfo, Weather } from '../types';
import { hemisphere, otherHemisphere } from '../climate';

/** Everything a rule may look at. Rules are pure: same context, same tasks. */
export interface RuleContext {
  garden: Garden;
  events: GardenEvent[];
  weather: Weather;
  season: SeasonInfo;
  profiles: Record<string, CareProfile>;
  now: Date;
}

/** A profile with a plant's own overrides (say, its variety's harvest) on top. */
export function withOverrides(base: CareProfile, care: CareOverrides | undefined): CareProfile {
  if (!care) return base;
  return {
    ...base,
    ...care,
    months: { ...base.months, ...care.months },
    tips: { ...base.tips, ...care.tips },
  };
}

export function profileOf(ctx: Pick<RuleContext, 'profiles'>, plant: Plant): CareProfile | undefined {
  const base = plant.profileId ? ctx.profiles[plant.profileId] : undefined;
  return base && withOverrides(base, plant.care);
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
  return south ? otherHemisphere(month) : month;
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
