import { describe, expect, it } from 'vitest';
import { daysSinceRain, localDate, parseForecast } from './weather';

// Trimmed from a real Open-Meteo response for Forshaga, 7 Oct 2026.
const forshaga = {
  daily: {
    time: ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08'],
    temperature_2m_max: [17.2, 15.5, 12.4, 7.8],
    temperature_2m_min: [12.0, 6.4, 0.0, 4.0],
    temperature_2m_mean: [14.7, 11.9, 6.1, 6.4],
    precipitation_sum: [1.7, 0.0, 0.5, 34.9],
    wind_gusts_10m_max: [50.8, 49.0, 17.6, 47.5],
    uv_index_max: [1.6, 2.45, 2.35, 0.2],
    sunshine_duration: [3600, 7200, 0, null],
  },
};

describe('parseForecast', () => {
  const w = parseForecast(forshaga, '2026-10-07');

  it('splits past days from today and the forecast', () => {
    expect(w.past.map((d) => d.date)).toEqual(['2026-10-05', '2026-10-06']);
    expect(w.forecast.map((d) => d.date)).toEqual(['2026-10-07', '2026-10-08']);
  });

  it('converts units and fills gaps', () => {
    expect(w.past[1].sunshineHours).toBe(2);
    expect(w.forecast[1]).toMatchObject({ precip: 34.9, tMin: 4.0, sunshineHours: 0 });
  });

  it('finds no proper rain in the last days', () => {
    expect(daysSinceRain(w)).toBeUndefined();
  });
});

describe('localDate', () => {
  it('uses the garden time zone, not UTC', () => {
    expect(localDate('Europe/Stockholm', new Date('2026-10-07T23:30:00Z'))).toBe('2026-10-08');
  });
});
