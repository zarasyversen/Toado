import type { Area, Garden, GardenEvent, Plant } from './types';
import { newId, readJson, writeJson, type KeyValueStore, defaultStore } from './storage';

const KEY = 'toado.garden';

export function emptyGarden(): Garden {
  return { name: 'My garden', pests: [], areas: [], plants: [] };
}

export function loadGarden(store: KeyValueStore | undefined = defaultStore()): Garden {
  return readJson(KEY, emptyGarden(), store);
}

export function saveGarden(garden: Garden, store: KeyValueStore | undefined = defaultStore()): void {
  writeJson(KEY, garden, store);
}

export function addArea(garden: Garden, area: Omit<Area, 'id'>): Area {
  const created = { ...area, id: newId() };
  garden.areas.push(created);
  return created;
}

export function addPlant(garden: Garden, plant: Omit<Plant, 'id'>): Plant {
  const created = { ...plant, id: newId() };
  garden.plants.push(created);
  return created;
}

export function updatePlant(garden: Garden, id: string, changes: Partial<Omit<Plant, 'id'>>): void {
  const plant = garden.plants.find((p) => p.id === id);
  if (plant) Object.assign(plant, changes);
}

export function removePlant(garden: Garden, id: string): void {
  garden.plants = garden.plants.filter((p) => p.id !== id);
}

export function plantsIn(garden: Garden, areaId: string): Plant[] {
  return garden.plants.filter((p) => p.areaId === areaId);
}

export function areaOf(garden: Garden, plant: Plant): Area | undefined {
  return garden.areas.find((a) => a.id === plant.areaId);
}

/** The garden and its log in one file, so moving devices keeps the history. */
export function exportGarden(garden: Garden, log: GardenEvent[] = []): string {
  return JSON.stringify({ ...garden, log }, null, 2);
}

export function importGarden(json: string): Garden {
  const { log: _log, ...parsed } = JSON.parse(json) as Partial<Garden> & { log?: unknown };
  if (!Array.isArray(parsed.plants) || !Array.isArray(parsed.areas)) {
    throw new Error('This file is not a Toado garden');
  }
  return { ...emptyGarden(), ...parsed } as Garden;
}

/** The log saved alongside an exported garden; older exports have none. */
export function importLog(json: string): GardenEvent[] {
  const { log } = JSON.parse(json) as { log?: unknown };
  return Array.isArray(log) ? (log as GardenEvent[]) : [];
}
