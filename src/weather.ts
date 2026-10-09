import type { DayWeather, Place, Weather } from './types';

const DAILY = [
  'temperature_2m_max',
  'temperature_2m_min',
  'temperature_2m_mean',
  'precipitation_sum',
  'wind_gusts_10m_max',
  'uv_index_max',
  'sunshine_duration',
] as const;

type DailyJson = { time: string[] } & Record<(typeof DAILY)[number], (number | null)[]>;

export const PAST_DAYS = 14;

export function parseForecast(json: { daily: DailyJson }, today: string): Weather {
  const d = json.daily;
  const days: DayWeather[] = d.time.map((date, i) => ({
    date,
    tMin: d.temperature_2m_min[i] ?? NaN,
    tMax: d.temperature_2m_max[i] ?? NaN,
    tMean: d.temperature_2m_mean[i] ?? NaN,
    precip: d.precipitation_sum[i] ?? 0,
    gustMax: d.wind_gusts_10m_max[i] ?? 0,
    uvMax: d.uv_index_max[i] ?? 0,
    sunshineHours: (d.sunshine_duration[i] ?? 0) / 3600,
  }));
  return {
    today,
    past: days.filter((day) => day.date < today),
    forecast: days.filter((day) => day.date >= today),
  };
}

/** Today's date in the garden's own time zone, as YYYY-MM-DD. */
export function localDate(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);
}

export async function fetchWeather(place: Place): Promise<Weather> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: String(place.lat),
    longitude: String(place.lon),
    daily: DAILY.join(','),
    past_days: String(PAST_DAYS),
    forecast_days: '7',
    timezone: 'auto',
  }).toString();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather request failed (${res.status})`);
  const json = await res.json();
  return parseForecast(json, localDate(json.timezone));
}

/** Days since the last day with at least `minMm` of rain, counting today as 0. */
export function daysSinceRain(weather: Weather, minMm = 5): number | undefined {
  const todayRain = weather.forecast[0]?.date === weather.today ? weather.forecast[0] : undefined;
  if (todayRain && todayRain.precip >= minMm) return 0;
  for (let i = weather.past.length - 1; i >= 0; i--) {
    if (weather.past[i].precip >= minMm) return weather.past.length - i;
  }
  return undefined;
}
