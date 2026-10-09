import { describe, expect, it } from 'vitest';
import { frostDatesFrom, hemisphere, seasonDay, seasonFor } from './climate';
import type { DayWeather, Weather } from './types';

const DAY_MS = 86_400_000;

/** A year of daily minimums: frosty before `lastFrost` and after `firstFrost`, mild between. */
function year(y: number, lastFrost: string, firstFrost: string) {
  const days: { date: string; tMin: number }[] = [];
  for (let t = Date.UTC(y, 0, 1); t < Date.UTC(y + 1, 0, 1); t += DAY_MS) {
    const date = new Date(t).toISOString().slice(0, 10);
    const md = date.slice(5);
    days.push({ date, tMin: md <= lastFrost || md >= firstFrost ? -2 : 8 });
  }
  return days;
}

function weatherWithMean(today: string, mean: number): Weather {
  const day = (date: string): DayWeather => ({
    date, tMin: mean - 4, tMax: mean + 4, tMean: mean, precip: 0, gustMax: 10, uvMax: 1, sunshineHours: 2,
  });
  return { today, past: Array.from({ length: 6 }, (_, i) => day(`past-${i}`)), forecast: [day(today)] };
}

describe('seasonDay', () => {
  it('counts from 1 Jan in the north and 1 Jul in the south', () => {
    expect(seasonDay('2026-01-01', 'north')).toBe(0);
    expect(seasonDay('2026-07-01', 'south')).toBe(0);
    expect(seasonDay('2026-06-30', 'south')).toBe(364);
  });

  it('picks the hemisphere from latitude', () => {
    expect(hemisphere(59.5)).toBe('north');
    expect(hemisphere(-37.8)).toBe('south');
  });
});

describe('frostDatesFrom', () => {
  it('takes the median last and first frost across years (north)', () => {
    const days = [
      ...year(2023, '05-10', '09-25'),
      ...year(2024, '05-14', '09-20'),
      ...year(2025, '05-20', '10-02'),
    ];
    expect(frostDatesFrom(days, 'north')).toEqual({
      lastSpringFrost: '05-14',
      firstAutumnFrost: '09-25',
      yearsUsed: 3,
    });
  });

  it('handles southern growing years that cross new year', () => {
    // Southern frosts happen in the middle of the calendar year.
    const days: { date: string; tMin: number }[] = [];
    for (let t = Date.UTC(2023, 6, 1); t < Date.UTC(2025, 6, 1); t += DAY_MS) {
      const date = new Date(t).toISOString().slice(0, 10);
      const md = date.slice(5);
      const frosty = (md >= '07-01' && md <= '09-15') || (md >= '05-01' && md <= '06-30');
      days.push({ date, tMin: frosty ? -1 : 9 });
    }
    expect(frostDatesFrom(days, 'south')).toEqual({
      lastSpringFrost: '09-15',
      firstAutumnFrost: '05-01',
      yearsUsed: 2,
    });
  });

  it('returns undefined for a frost-free climate', () => {
    const days = year(2024, '00-00', '99-99');
    expect(frostDatesFrom(days, 'north')).toBeUndefined();
  });
});

describe('seasonFor', () => {
  const frost = { lastSpringFrost: '05-14', firstAutumnFrost: '09-25', yearsUsed: 10 };

  it('says autumn in Forshaga in early October', () => {
    const info = seasonFor(weatherWithMean('2026-10-07', 7), 59.5, frost);
    expect(info.season).toBe('autumn');
    expect(info.growingSeason).toBe(false);
    expect(info.daysToFirstFrost).toBeLessThan(0);
  });

  it('says spring for the same temperatures in April', () => {
    expect(seasonFor(weatherWithMean('2026-04-20', 7), 59.5, frost).season).toBe('spring');
  });

  it('keeps a warm October week in autumn and a warm April week in spring', () => {
    expect(seasonFor(weatherWithMean('2026-10-07', 12), 59.5, frost).season).toBe('autumn');
    expect(seasonFor(weatherWithMean('2026-04-25', 12), 59.5, frost).season).toBe('spring');
    expect(seasonFor(weatherWithMean('2026-06-10', 12), 59.5, frost).season).toBe('summer');
  });

  it('goes by temperature for summer and winter', () => {
    expect(seasonFor(weatherWithMean('2026-09-01', 14), 59.5, frost).season).toBe('summer');
    expect(seasonFor(weatherWithMean('2026-11-20', -3), 59.5, frost).season).toBe('winter');
  });

  it('flips the halves in the southern hemisphere', () => {
    expect(seasonFor(weatherWithMean('2026-04-20', 7), -37.8).season).toBe('autumn');
    expect(seasonFor(weatherWithMean('2026-10-07', 7), -37.8).season).toBe('spring');
  });

  it('is in the growing season between the frost dates', () => {
    const info = seasonFor(weatherWithMean('2026-07-01', 16), 59.5, frost);
    expect(info.growingSeason).toBe(true);
    expect(info.daysToFirstFrost).toBe(86);
  });
});
