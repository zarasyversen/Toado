import type { FrostDates, Hemisphere, Place, Season, SeasonInfo, Weather } from './types';
import { readJson, writeJson } from './storage';

/**
 * Air temperature (2 m) at or below which we count a frost night. Ground frost on grass
 * and low plants already happens around +2 °C air, and the gridded history smooths out
 * the coldest nights, so 0 °C gives frost dates weeks too optimistic.
 */
export const FROST_C = 2;

export function hemisphere(lat: number): Hemisphere {
  return lat < 0 ? 'south' : 'north';
}

/** The same point in the year on the other side of the equator (the shift works both ways). */
export function otherHemisphere(month: number): number {
  return ((month + 5) % 12) + 1;
}

const DAY_MS = 86_400_000;

/**
 * Day of the growing year, 0-based. The northern growing year starts on 1 Jan; the
 * southern one on 1 Jul, so a southern spring frost in October sorts before an April one.
 * Dates are mapped onto a non-leap year so the same date always gets the same number.
 */
export function seasonDay(date: string, hemi: Hemisphere): number {
  const md = date.slice(5) === '02-29' ? '02-28' : date.slice(5);
  const t = Date.UTC(2001, Number(md.slice(0, 2)) - 1, Number(md.slice(3)));
  const start = Date.UTC(2001, hemi === 'north' ? 0 : 6, 1);
  const day = Math.round((t - start) / DAY_MS);
  return day < 0 ? day + 365 : day;
}

function seasonDayToMonthDay(day: number, hemi: Hemisphere): string {
  const start = Date.UTC(2001, hemi === 'north' ? 0 : 6, 1);
  return new Date(start + day * DAY_MS).toISOString().slice(5, 10);
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/** Midsummer in season days; frosts before it are spring frosts, after it autumn frosts. */
const MIDSUMMER = 196;

/**
 * Median last spring frost and first autumn frost from daily minimum temperatures.
 * Only complete growing years are used.
 */
export function frostDatesFrom(
  days: { date: string; tMin: number | null }[],
  hemi: Hemisphere,
): FrostDates | undefined {
  const years = new Map<string, { last?: number; first?: number; count: number }>();
  for (const { date, tMin } of days) {
    if (tMin === null || Number.isNaN(tMin)) continue;
    const sd = seasonDay(date, hemi);
    const d = new Date(`${date}T00:00:00Z`);
    const seasonYear =
      hemi === 'north' || d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
    const key = String(seasonYear);
    const y = years.get(key) ?? { count: 0 };
    y.count++;
    if (tMin <= FROST_C) {
      if (sd < MIDSUMMER) y.last = Math.max(y.last ?? -1, sd);
      else if (y.first === undefined) y.first = sd;
    }
    years.set(key, y);
  }
  const complete = [...years.values()].filter((y) => y.count >= 360);
  const lasts = complete.map((y) => y.last).filter((v): v is number => v !== undefined);
  const firsts = complete.map((y) => y.first).filter((v): v is number => v !== undefined);
  if (!lasts.length || !firsts.length) return undefined; // e.g. a frost-free climate
  return {
    lastSpringFrost: seasonDayToMonthDay(median(lasts), hemi),
    firstAutumnFrost: seasonDayToMonthDay(median(firsts), hemi),
    yearsUsed: complete.length,
  };
}

export async function fetchFrostDates(place: Place, years = 10): Promise<FrostDates | undefined> {
  const cacheKey = `toado.frost.${place.lat.toFixed(2)},${place.lon.toFixed(2)}`;
  const cached = readJson<FrostDates | null>(cacheKey, null);
  if (cached) return cached;

  const end = new Date().getUTCFullYear() - 1;
  const url = new URL('https://archive-api.open-meteo.com/v1/archive');
  url.search = new URLSearchParams({
    latitude: String(place.lat),
    longitude: String(place.lon),
    // One extra year at the start so southern growing years are complete.
    start_date: `${end - years}-01-01`,
    end_date: `${end}-12-31`,
    daily: 'temperature_2m_min',
    timezone: 'auto',
  }).toString();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Climate history request failed (${res.status})`);
  const json: { daily: { time: string[]; temperature_2m_min: (number | null)[] } } =
    await res.json();
  const days = json.daily.time.map((date, i) => ({ date, tMin: json.daily.temperature_2m_min[i] }));
  const frost = frostDatesFrom(days, hemisphere(place.lat));
  if (frost) writeJson(cacheKey, frost);
  return frost;
}

/** Summer can't start before 1 May or last past the autumn equinox (1 Nov / 23 Mar in the south). */
const SUMMER_EARLIEST = 120;
const AUTUMN_EQUINOX = 265;

/**
 * Season from the weather, anchored to the calendar. Loosely after the Swedish SMHI
 * definition: winter when the 7-day mean is at or below 0 °C, summer at 10 °C or above,
 * otherwise spring or autumn by which half of the growing year we're in. A warm week in
 * October is still autumn for a gardener, so summer is limited to May–September.
 */
export function seasonFor(
  weather: Weather,
  lat: number,
  frost?: FrostDates,
): SeasonInfo {
  const hemi = hemisphere(lat);
  const recent = [...weather.past.slice(-6), weather.forecast[0]].filter(Boolean);
  const mean7 = recent.reduce((sum, d) => sum + d.tMean, 0) / recent.length;
  const today = seasonDay(weather.today, hemi);

  let season: Season;
  if (mean7 <= 0) season = 'winter';
  else if (mean7 >= 10 && today >= SUMMER_EARLIEST && today < AUTUMN_EQUINOX) season = 'summer';
  else season = today < MIDSUMMER ? 'spring' : 'autumn';

  let growingSeason = mean7 > 5;
  let daysToFirstFrost = NaN;
  if (frost) {
    const year = weather.today.slice(0, 4);
    const last = seasonDay(`${year}-${frost.lastSpringFrost}`, hemi);
    const first = seasonDay(`${year}-${frost.firstAutumnFrost}`, hemi);
    growingSeason = today > last && today < first;
    daysToFirstFrost = first - today;
  }
  return { season, mean7: Math.round(mean7 * 10) / 10, growingSeason, daysToFirstFrost };
}
