import { describe, expect, it } from 'vitest';
import { candidateTasks, type RuleContext } from './index';
import { BUILT_IN_PROFILES } from '../plants';
import { demoGarden } from '../demo-garden';
import { logEvent } from '../log';
import type { DayWeather, Garden, GardenEvent, Task } from '../types';

const TODAY = '2026-07-15';
const now = new Date(`${TODAY}T08:00:00Z`);

function day(date: string, over: Partial<DayWeather> = {}): DayWeather {
  return { date, tMin: 12, tMax: 20, tMean: 16, precip: 0, gustMax: 20, uvMax: 5, sunshineHours: 3, ...over };
}

/** Past days all dry unless given; `today` and `tomorrow` override the forecast. */
function context(
  garden: Garden,
  opts: { today?: Partial<DayWeather>; tomorrow?: Partial<DayWeather>; pastRain?: number[]; events?: GardenEvent[]; date?: string } = {},
): RuleContext {
  const date = opts.date ?? TODAY;
  const past = (opts.pastRain ?? Array(14).fill(0)).map((mm, i, all) => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - (all.length - i));
    return day(d.toISOString().slice(0, 10), { precip: mm });
  });
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return {
    garden,
    events: opts.events ?? [],
    weather: {
      today: date,
      past,
      forecast: [day(date, opts.today), day(next.toISOString().slice(0, 10), opts.tomorrow)],
    },
    season: { season: 'summer', mean7: 16, growingSeason: true, daysToFirstFrost: 80 },
    profiles: BUILT_IN_PROFILES,
    now: opts.date ? new Date(`${opts.date}T08:00:00Z`) : now,
  };
}

function garden(): Garden {
  return {
    name: 'Test',
    place: { name: 'Forshaga', lat: 59.5, lon: 13.5 },
    pests: [],
    areas: [
      { id: 'gh', name: 'Greenhouse', kind: 'greenhouse', covered: true },
      { id: 'berries', name: 'Berry bushes', kind: 'bed', covered: false },
    ],
    plants: [
      { id: 'tom', name: 'Tomatoes', kind: 'vegetable', profileId: 'tomato', areaId: 'gh', status: 'growing' },
      { id: 'bb', name: 'Blueberries', kind: 'bush', profileId: 'highbush-blueberry', areaId: 'berries', status: 'growing' },
    ],
  };
}

const find = (tasks: Task[], id: string) => tasks.find((t) => t.id === id);
const ids = (tasks: Task[]) => tasks.map((t) => t.id);

describe('greenhouse', () => {
  it('opens on a hot day and closes before a cool night', () => {
    const tasks = candidateTasks(context(garden(), { today: { tMax: 27, sunshineHours: 10 }, tomorrow: { tMin: 7 } }));
    const open = find(tasks, 'greenhouse-open:gh')!;
    expect(open.title).toBe('Open the greenhouse this morning, close it by evening');
    expect(open.reason).toContain('27 °C');
    expect(open.reason).toContain('7 °C tonight');
    expect(open.logAs).toBe('greenhouse-opened');
  });

  it('opens on a mild but very sunny day too', () => {
    const tasks = candidateTasks(context(garden(), { today: { tMax: 17, sunshineHours: 11 } }));
    expect(ids(tasks)).toContain('greenhouse-open:gh');
  });

  it('stays quiet on a grey day, with auto vents, or with nothing growing inside', () => {
    expect(ids(candidateTasks(context(garden())))).not.toContain('greenhouse-open:gh');

    const vents = garden();
    vents.areas[0].autoVents = true;
    expect(ids(candidateTasks(context(vents, { today: { tMax: 28 } })))).not.toContain('greenhouse-open:gh');

    const empty = garden();
    empty.plants[0].status = 'finished';
    expect(ids(candidateTasks(context(empty, { today: { tMax: 28 } })))).not.toContain('greenhouse-open:gh');
  });

  it('reminds you to close it if it was left open and the night turns cold', () => {
    const events: GardenEvent[] = [];
    logEvent(events, 'greenhouse-opened', { areaId: 'gh' }, new Date(`${TODAY}T06:00:00Z`));
    const tasks = candidateTasks(context(garden(), { events, tomorrow: { tMin: 6 } }));
    expect(find(tasks, 'greenhouse-close:gh')?.logAs).toBe('greenhouse-closed');

    logEvent(events, 'greenhouse-closed', { areaId: 'gh' }, new Date(`${TODAY}T07:00:00Z`));
    expect(ids(candidateTasks(context(garden(), { events, tomorrow: { tMin: 6 } })))).not.toContain('greenhouse-close:gh');
  });
});

describe('frost', () => {
  it('protects tender plants and leaves hardy ones alone', () => {
    const tasks = candidateTasks(context(garden(), { tomorrow: { tMin: -2 } }));
    const frost = find(tasks, 'frost')!;
    expect(frost.plantIds).toEqual(['tom']);
    expect(frost.reason).toContain('−2 °C');
    expect(tasks[0]).toBe(frost);
  });

  it('lets the greenhouse buy a few degrees', () => {
    expect(ids(candidateTasks(context(garden(), { tomorrow: { tMin: 1 } })))).not.toContain('frost');
  });

  it('protects hardy plants in pots sooner', () => {
    const g = garden();
    g.plants[1].inPot = true;
    g.plants[1].areaId = undefined;
    const frost = find(candidateTasks(context(g, { tomorrow: { tMin: -27 } })), 'frost')!;
    expect(frost.plantIds).toContain('bb');
  });
});

describe('heat and wind', () => {
  it('says to water early on a hot day', () => {
    expect(find(candidateTasks(context(garden(), { today: { tMax: 31 } })), 'heat')?.title).toBe('Water early, before the heat');
  });

  it('warns about strong wind tomorrow', () => {
    const wind = find(candidateTasks(context(garden(), { tomorrow: { gustMax: 72 } })), 'wind')!;
    expect(wind.reason).toBe('Gusts up to 72 km/h tomorrow.');
    expect(wind.title).toContain('greenhouse');
  });
});

describe('watering', () => {
  it('flags plants that have gone too long without water', () => {
    const events: GardenEvent[] = [];
    logEvent(events, 'watered', { plantIds: ['bb'] }, new Date('2026-07-10T08:00:00Z'));
    logEvent(events, 'watered', { plantIds: ['tom'] }, new Date(`${TODAY}T07:00:00Z`));
    const tasks = candidateTasks(context(garden(), { events }));
    const water = find(tasks, 'water:berries')!;
    expect(water.title).toBe('Water the blueberries');
    expect(water.reason).toContain('5 days without water');
    expect(ids(tasks)).not.toContain('water:gh');
  });

  it('counts a proper rain as watering', () => {
    const rain = Array(14).fill(0);
    rain[13] = 12; // yesterday
    expect(ids(candidateTasks(context(garden(), { pastRain: rain })))).not.toContain('water:berries');
  });

  it('waits when rain is on the way, but not in the greenhouse', () => {
    const tasks = candidateTasks(context(garden(), { tomorrow: { precip: 15 } }));
    expect(ids(tasks)).not.toContain('water:berries');
    expect(find(tasks, 'water:gh')?.reason).toBe('No watering logged yet.');
  });

  it('waters more often on hot days', () => {
    const events: GardenEvent[] = [];
    logEvent(events, 'watered', { plantIds: ['bb'] }, new Date('2026-07-13T08:00:00Z'));
    expect(ids(candidateTasks(context(garden(), { events })))).not.toContain('water:berries');
    expect(ids(candidateTasks(context(garden(), { events, today: { tMax: 26 } })))).toContain('water:berries');
  });

  it('leaves dormant plants outdoors alone', () => {
    const ctx = context(garden());
    ctx.season = { ...ctx.season, growingSeason: false };
    expect(ids(candidateTasks(ctx))).not.toContain('water:berries');
  });
});

describe('seasonal care', () => {
  it('suggests jobs in their month, with the profile tip', () => {
    const tasks = candidateTasks(context(garden()));
    expect(find(tasks, 'harvest')?.title).toBe('Harvest the tomatoes and blueberries');
    expect(find(tasks, 'feed')?.reason).toBe('Give tomato feed weekly once the first fruits set.');
  });

  it('drops a job once it has been logged', () => {
    const events: GardenEvent[] = [];
    logEvent(events, 'fed', { plantIds: ['tom'] }, new Date('2026-07-10T08:00:00Z'));
    expect(ids(candidateTasks(context(garden(), { events })))).not.toContain('feed');
  });

  it('shifts the calendar by six months in the south', () => {
    const g = garden();
    g.place = { name: 'Hobart', lat: -42.9, lon: 147.3 };
    // January in Hobart is July in the north.
    const tasks = candidateTasks(context(g, { date: '2027-01-15' }));
    expect(find(tasks, 'harvest')?.plantIds).toEqual(['tom', 'bb']);
  });

  it('asks you to sow annuals again even after last year’s crop finished', () => {
    const g = garden();
    g.plants[0].status = 'finished';
    expect(find(candidateTasks(context(g, { date: '2027-03-10' })), 'sow')?.plantIds).toEqual(['tom']);
  });
});

describe('the demo garden in October', () => {
  const ctx = context(demoGarden(), { date: '2026-10-09', today: { tMax: 9 }, tomorrow: { tMin: -1 } });
  ctx.season = { season: 'autumn', mean7: 6, growingSeason: false, daysToFirstFrost: -5 };
  const tasks = candidateTasks(ctx);

  it('suggests clearing the finished beds and greenhouse', () => {
    expect(find(tasks, 'clear:greenhouse')?.title).toBe(
      'Clear the tomatoes, squash, cucumber, radishes and mild chili from the greenhouse',
    );
    expect(find(tasks, 'clear:collar-2')?.title).toBe('Clear the cabbage, peas and broccoli from the pallet collar 2');
  });

  it('harvests the Melonäpple and pears, and nothing needs frost cover', () => {
    expect(find(tasks, 'harvest')?.title).toBe('Harvest the Melonäpple and pear trees');
    expect(ids(tasks)).not.toContain('frost');
    expect(ids(tasks).filter((id) => id.startsWith('water'))).toEqual([]);
  });

  it('picks each apple variety in its own month', () => {
    const september = candidateTasks(context(demoGarden(), { date: '2026-09-10' }));
    expect(find(september, 'harvest')?.plantIds).toContain('apple-kanel');
    expect(find(september, 'harvest')?.plantIds).not.toContain('apple-melon');
  });

  it('keeps the rest of the apple profile for a variety', () => {
    const february = candidateTasks(context(demoGarden(), { date: '2027-02-10' }));
    expect(find(february, 'prune')?.plantIds).toEqual(expect.arrayContaining(['apple-melon', 'apple-kanel']));
  });

  it('stops asking once the greenhouse is cleared', () => {
    const events: GardenEvent[] = [];
    logEvent(events, 'cleared', { areaId: 'greenhouse' }, new Date('2026-10-09T10:00:00Z'));
    expect(ids(candidateTasks({ ...ctx, events }))).not.toContain('clear:greenhouse');
  });
});
