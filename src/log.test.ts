import { describe, expect, it } from 'vitest';
import { daysSinceWatered, lastEvent, logEvent } from './log';
import type { Area, DayWeather, GardenEvent, Plant, Weather } from './types';

const now = new Date('2026-10-07T12:00:00Z');

/** Weather where yesterday is the last entry of `rain` (mm per past day, oldest first). */
function weather(rain: number[], todayRain = 0): Weather {
  const day = (date: string, precip: number): DayWeather => ({
    date, tMin: 5, tMax: 12, tMean: 8, precip, gustMax: 10, uvMax: 1, sunshineHours: 2,
  });
  return {
    today: '2026-10-07',
    past: rain.map((mm, i) => day(`2026-09-${String(20 + i).padStart(2, '0')}`, mm)),
    forecast: [day('2026-10-07', todayRain)],
  };
}

const garden: Area = { id: 'berries', name: 'Berries', kind: 'bed', covered: false };
const greenhouse: Area = { id: 'gh', name: 'Greenhouse', kind: 'greenhouse', covered: true };
const blueberry: Plant = { id: 'bb', name: 'Blueberry', kind: 'bush', areaId: 'berries', status: 'growing' };
const tomato: Plant = { id: 'tom', name: 'Tomato', kind: 'vegetable', areaId: 'gh', status: 'growing' };

describe('daysSinceWatered', () => {
  it('counts days since you watered the plant', () => {
    const events: GardenEvent[] = [];
    logEvent(events, 'watered', { plantIds: ['bb'] }, new Date('2026-10-02T08:00:00Z'));
    expect(daysSinceWatered(blueberry, garden, events, weather([0, 0, 0]), now)).toBe(5);
  });

  it('lets a proper rain reset the timer outdoors', () => {
    const events: GardenEvent[] = [];
    logEvent(events, 'watered', { plantIds: ['bb'] }, new Date('2026-10-01T08:00:00Z'));
    // 12 mm two days ago.
    expect(daysSinceWatered(blueberry, garden, events, weather([0, 12, 1]), now)).toBe(2);
  });

  it('ignores a light drizzle', () => {
    expect(daysSinceWatered(blueberry, garden, [], weather([3, 2, 1]), now)).toBeUndefined();
  });

  it('counts rain today as watered today', () => {
    expect(daysSinceWatered(blueberry, garden, [], weather([0, 0], 35), now)).toBe(0);
  });

  it('never counts rain in the greenhouse', () => {
    const events: GardenEvent[] = [];
    logEvent(events, 'watered', { areaId: 'gh' }, new Date('2026-10-04T08:00:00Z'));
    expect(daysSinceWatered(tomato, greenhouse, events, weather([20, 20, 20]), now)).toBe(3);
  });

  it('needs heavier rain for pots', () => {
    const potted = { ...blueberry, inPot: true };
    expect(daysSinceWatered(potted, garden, [], weather([0, 7, 0]), now)).toBeUndefined();
    expect(daysSinceWatered(potted, garden, [], weather([0, 15, 0]), now)).toBe(2);
  });
});

describe('lastEvent', () => {
  it('matches events logged for the whole area', () => {
    const events: GardenEvent[] = [];
    logEvent(events, 'watered', { plantIds: ['bb'] }, new Date('2026-10-01T08:00:00Z'));
    const latest = logEvent(events, 'watered', { areaId: 'berries' }, new Date('2026-10-05T08:00:00Z'));
    logEvent(events, 'pruned', { plantIds: ['bb'] }, new Date('2026-10-06T08:00:00Z'));
    expect(lastEvent(events, 'watered', blueberry)).toBe(latest);
  });
});
