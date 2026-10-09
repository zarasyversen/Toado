import type { Area, EventType, GardenEvent, Plant, Weather } from './types';
import { daysSinceRain } from './weather';
import { defaultStore, newId, readJson, writeJson, type KeyValueStore } from './storage';

const KEY = 'toado.log';

export function loadLog(store: KeyValueStore | undefined = defaultStore()): GardenEvent[] {
  return readJson<GardenEvent[]>(KEY, [], store);
}

export function saveLog(events: GardenEvent[], store: KeyValueStore | undefined = defaultStore()): void {
  writeJson(KEY, events, store);
}

export function logEvent(
  events: GardenEvent[],
  type: EventType,
  details: Omit<GardenEvent, 'id' | 'at' | 'type'> = {},
  at = new Date(),
): GardenEvent {
  const event = { id: newId(), at: at.toISOString(), type, ...details };
  events.push(event);
  return event;
}

function touches(event: GardenEvent, plant: Plant): boolean {
  return (
    event.plantIds?.includes(plant.id) === true ||
    (event.areaId !== undefined && event.areaId === plant.areaId)
  );
}

export function lastEvent(events: GardenEvent[], type: EventType, plant: Plant): GardenEvent | undefined {
  let latest: GardenEvent | undefined;
  for (const e of events) {
    if (e.type === type && touches(e, plant) && (!latest || e.at > latest.at)) latest = e;
  }
  return latest;
}

const DAY_MS = 86_400_000;

function wholeDaysBetween(fromIso: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(fromIso).getTime()) / DAY_MS));
}

/**
 * Days since the plant last got water, from you or from the sky. Rain doesn't count
 * under cover (greenhouse) and only half counts for pots, which dry out fast.
 * Undefined means we have no record of it ever being watered.
 */
export function daysSinceWatered(
  plant: Plant,
  area: Area | undefined,
  events: GardenEvent[],
  weather: Weather | undefined,
  now = new Date(),
): number | undefined {
  const watered = lastEvent(events, 'watered', plant);
  const byHand = watered ? wholeDaysBetween(watered.at, now) : undefined;
  const covered = area?.covered ?? false;
  const byRain = !covered && weather ? daysSinceRain(weather, plant.inPot ? 10 : 5) : undefined;
  if (byHand === undefined) return byRain;
  if (byRain === undefined) return byHand;
  return Math.min(byHand, byRain);
}
