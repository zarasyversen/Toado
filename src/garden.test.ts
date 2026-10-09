import { describe, expect, it } from 'vitest';
import { addPlant, exportGarden, importGarden, loadGarden, plantsIn, saveGarden } from './garden';
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

  it('rejects files that are not gardens', () => {
    expect(() => importGarden('{"hello": 1}')).toThrow('not a Toado garden');
  });
});
