import { describe, expect, it } from 'vitest';
import { addPlant, exportGarden, importGarden, importLog, loadGarden, plantsIn, saveGarden } from './garden';
import { logEvent } from './log';
import type { GardenEvent } from './types';
import { demoGarden } from './demo-garden';
import { memoryStore } from './storage';

describe('garden storage', () => {
  it('starts empty and round-trips through storage', () => {
    const store = memoryStore();
    const garden = loadGarden(store);
    expect(garden.plants).toEqual([]);

    addPlant(garden, { name: 'Gooseberry', kind: 'bush', status: 'growing' });
    saveGarden(garden, store);
    expect(loadGarden(store).plants.map((p) => p.name)).toEqual(['Gooseberry']);
  });

  it('exports and imports the demo garden', () => {
    const garden = importGarden(exportGarden(demoGarden()));
    expect(plantsIn(garden, 'collar-2').map((p) => p.name)).toEqual(['Cabbage', 'Peas', 'Broccoli']);
    expect(garden.pests).toEqual(['deer']);
  });

  it('carries the log in the export, and keeps it out of the garden', () => {
    const log: GardenEvent[] = [];
    logEvent(log, 'watered', { plantIds: ['blueberry'] });
    const json = exportGarden(demoGarden(), log);
    expect(importLog(json)).toEqual(log);
    expect('log' in importGarden(json)).toBe(false);
    expect(importLog(exportGarden(demoGarden()))).toEqual([]);
  });

  it('rejects files that are not gardens', () => {
    expect(() => importGarden('{"hello": 1}')).toThrow('not a Toado garden');
  });
});
