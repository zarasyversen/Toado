import { describe, expect, it } from 'vitest';
import { askGarden, describeGarden, overridesFrom, parseCareProfile, parsePlan, planDay, suggestCare } from './gemma';
import { chatStream } from './ollama';
import { candidateTasks, type RuleContext } from './rules';
import { BUILT_IN_PROFILES } from './plants';
import { demoGarden } from './demo-garden';
import { logEvent } from './log';
import type { DayWeather, GardenEvent } from './types';

function day(date: string, over: Partial<DayWeather> = {}): DayWeather {
  return { date, tMin: 2, tMax: 9, tMean: 6, precip: 0, gustMax: 20, uvMax: 1, sunshineHours: 3, ...over };
}

function context(events: GardenEvent[] = []): RuleContext {
  return {
    garden: demoGarden(),
    events,
    weather: { today: '2026-10-09', past: [], forecast: [day('2026-10-09'), day('2026-10-10', { tMin: -1 })] },
    season: { season: 'autumn', mean7: 6, growingSeason: false, daysToFirstFrost: -5 },
    profiles: BUILT_IN_PROFILES,
    now: new Date('2026-10-09T08:00:00Z'),
  };
}

/** A fetch that answers every chat with `reply` as the model's JSON, and records the bodies. */
function fakeOllama(reply: unknown) {
  const bodies: Record<string, any>[] = [];
  const fetch = (async (_url: string, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ message: { role: 'assistant', content: JSON.stringify(reply) } }));
  }) as typeof globalThis.fetch;
  return { fetch, bodies };
}

const offline = (async () => {
  throw new TypeError('fetch failed');
}) as typeof globalThis.fetch;

describe('describeGarden', () => {
  it('tells Gemma about the place, weather, plants and recent log', () => {
    const events: GardenEvent[] = [];
    logEvent(events, 'harvested', { plantIds: ['apple-kanel'], note: 'last of them' }, new Date('2026-10-05T10:00:00Z'));
    logEvent(events, 'watered', { plantIds: ['blueberry'] }, new Date('2026-09-01T10:00:00Z'));
    const text = describeGarden(context(events));

    expect(text).toContain('Forshaga, Värmland County, Sweden (59.5°N)');
    expect(text).toContain('Friday, 9 October 2026');
    expect(text).toContain('Today: up to 9 °C');
    expect(text).toContain('Tonight: down to −1 °C.');
    expect(text).toContain('Apple tree "Melonäpple" (growing)');
    expect(text).toContain('Greenhouse (covered; Season is over');
    expect(text).toContain('Known pests: deer.');
    expect(text).toContain('2026-10-05 harvested: Apple tree "Rysk gul kaneläpple" (“last of them”)');
    expect(text).not.toContain('2026-09-01');
  });
});

describe('the day plan', () => {
  const ctx = context();
  const tasks = candidateTasks(ctx);

  it('keeps only real, unused task ids', () => {
    const plan = parsePlan(
      {
        summary: 'A crisp day.',
        jobs: [
          { ids: ['harvest', 'made-up'], title: 'Pick the Melonäpple', reason: 'It is ready.' },
          { ids: ['harvest'], title: 'Pick them again', reason: 'Duplicate.' },
          { ids: ['clear:greenhouse'], title: ' Clear the greenhouse ', reason: 'Done for the year.' },
        ],
      },
      tasks,
    );
    expect(plan.items.map((i) => i.taskIds)).toEqual([['harvest'], ['clear:greenhouse']]);
    expect(plan.items[1].title).toBe('Clear the greenhouse');
  });

  it('rejects a plan with nothing usable in it', () => {
    expect(() => parsePlan({ summary: 'Hi', jobs: [{ ids: ['nope'], title: 'x', reason: '' }] }, tasks)).toThrow();
    expect(() => parsePlan('not json at all', tasks)).toThrow();
  });

  it('asks Gemma with only the candidate ids allowed', async () => {
    const { fetch, bodies } = fakeOllama({
      summary: 'Apples first.',
      jobs: [{ ids: ['harvest'], title: 'Pick the Melonäpple and pears', reason: 'Both are ripe in October.' }],
    });
    const plan = await planDay(ctx, tasks, { fetch });

    expect(plan).toMatchObject({ source: 'gemma', summary: 'Apples first.' });
    const allowed = bodies[0].format.properties.jobs.items.properties.ids.items.enum;
    expect(allowed).toEqual(tasks.map((t) => t.id));
    expect(bodies[0].think).toBe(false);
  });

  it('falls back to the rules when Ollama is down', async () => {
    const plan = await planDay(ctx, tasks, { fetch: offline });
    expect(plan.source).toBe('rules');
    expect(plan.items[0].title).toBe(tasks[0].title);
  });

  it("doesn't call Gemma on a day with nothing to do", async () => {
    const plan = await planDay(ctx, [], { fetch: offline });
    expect(plan.items).toEqual([]);
    expect(plan.summary).toContain('Nothing pressing');
  });
});

describe('care profiles from Gemma', () => {
  it('cleans up the values it gets back', () => {
    const profile = parseCareProfile(
      {
        kind: 'shrub',
        waterEveryDays: 0.2,
        frostHardyTo: -80,
        months: { prune: [2, 2, 13, 0, 1.5], harvest: [9, 8], sow: 'never' },
        tips: { prune: '  Thin it out. ', feed: '' },
      },
      'Japanese maple',
      undefined,
      false,
    );
    expect(profile).toEqual({
      id: 'custom-japanese-maple',
      name: 'Japanese maple',
      kind: 'perennial',
      waterEveryDays: 1,
      frostHardyTo: -50,
      months: { prune: [2], harvest: [8, 9] },
      tips: { prune: 'Thin it out.' },
    });
  });

  it('moves southern months onto the northern calendar the rules use', () => {
    // Harvest in March in Hobart is September in the north.
    const profile = parseCareProfile({ kind: 'tree', waterEveryDays: 14, frostHardyTo: -20, months: { harvest: [3] } }, 'Apple', undefined, true);
    expect(profile.months.harvest).toEqual([9]);
  });

  it('suggests a profile for a variety in this garden', async () => {
    const { fetch, bodies } = fakeOllama({
      kind: 'tree', waterEveryDays: 14, frostHardyTo: -35,
      months: { prune: [1, 2, 3], feed: [4], mulch: [4], sow: [], harvest: [10] },
      tips: { prune: 'Prune in winter.', harvest: 'Ready when the pips turn brown.' },
    });
    const base = BUILT_IN_PROFILES.apple;
    const profile = await suggestCare(demoGarden(), { name: 'Apple tree', variety: 'Melonäpple', base }, { fetch });

    expect(bodies[0].messages[1].content).toContain('variety "Melonäpple"');
    expect(bodies[0].messages[1].content).toContain('Forshaga, Värmland County, Sweden');
    expect(bodies[0].messages[1].content).toContain('General profile for this plant: {"kind":"tree"');
    expect(profile.id).toBe('custom-apple-tree-melonapple');
    // Only the harvest differs from the built-in apple, so that's all the plant needs to store.
    expect(overridesFrom(base, profile)).toEqual({
      months: { harvest: [10] },
      tips: { harvest: 'Ready when the pips turn brown.' },
    });
  });
});

describe('asking the garden', () => {
  it('sends a photo with the question, and the conversation before it', async () => {
    const bodies: Record<string, any>[] = [];
    const fetch = (async (_url: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response('{"message":{"content":"Looks like scab."}}\n');
    }) as typeof globalThis.fetch;
    const earlier = [
      { role: 'user' as const, content: 'Hello' },
      { role: 'assistant' as const, content: 'Hi!' },
    ];

    let text = '';
    for await (const part of askGarden(context(), [], { text: 'What are these spots?', photo: 'AAAA' }, earlier, { fetch })) text += part;

    expect(text).toBe('Looks like scab.');
    const messages = bodies[0].messages;
    expect(messages[0].content).toContain('When a photo comes with the question');
    expect(messages.slice(1, 3)).toEqual(earlier);
    expect(messages[3]).toEqual({ role: 'user', content: 'What are these spots?', images: ['AAAA'] });
  });
});

describe('chatStream', () => {
  it('yields text from lines split across network chunks', async () => {
    const chunks = ['{"message":{"content":"Rake the "}}\n{"message":{"con', 'tent":"leaves."}}\n{"done":true}\n'];
    const fetch = (async () =>
      new Response(new ReadableStream({
        start(c) {
          for (const chunk of chunks) c.enqueue(new TextEncoder().encode(chunk));
          c.close();
        },
      }))) as typeof globalThis.fetch;

    let text = '';
    for await (const part of chatStream([{ role: 'user', content: 'What now?' }], { fetch })) text += part;
    expect(text).toBe('Rake the leaves.');
  });
});
