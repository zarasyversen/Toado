export interface Place {
  name: string;
  lat: number;
  lon: number;
  country?: string;
  region?: string;
}

export type Hemisphere = 'north' | 'south';

export interface DayWeather {
  date: string; // YYYY-MM-DD, local to the garden
  tMin: number;
  tMax: number;
  tMean: number;
  precip: number; // mm
  gustMax: number; // km/h
  uvMax: number;
  sunshineHours: number;
}

export interface Weather {
  today: string;
  /** Past days (oldest first), excluding today. */
  past: DayWeather[];
  /** Today and the coming days. */
  forecast: DayWeather[];
}

export interface FrostDates {
  /** Median day-of-season of the last spring frost and first autumn frost. */
  lastSpringFrost: string; // MM-DD
  firstAutumnFrost: string; // MM-DD
  yearsUsed: number;
}

export type Season = 'winter' | 'spring' | 'summer' | 'autumn';

export interface SeasonInfo {
  season: Season;
  mean7: number;
  growingSeason: boolean;
  /** Negative when the median first frost has already passed. */
  daysToFirstFrost: number;
}

export type AreaKind = 'greenhouse' | 'raised-bed' | 'bed' | 'orchard' | 'lawn' | 'pots';

export interface Area {
  id: string;
  name: string;
  kind: AreaKind;
  /** A covered area gets no rain, so rain never counts as watering there. */
  covered: boolean;
  notes?: string;
}

export type PlantKind = 'tree' | 'bush' | 'perennial' | 'vegetable' | 'herb' | 'flower';
export type PlantStatus = 'growing' | 'finished';

export interface Plant {
  id: string;
  name: string;
  kind: PlantKind;
  /** Key into the care profiles (step 3), e.g. "apple". */
  profileId?: string;
  areaId?: string;
  inPot?: boolean;
  count?: number;
  /** "finished" means the season is over and it should be cleared away. */
  status: PlantStatus;
  notes?: string;
}

export interface Garden {
  name: string;
  place?: Place;
  soil?: string;
  /** Known problems, e.g. "deer". */
  pests: string[];
  areas: Area[];
  plants: Plant[];
}

export type EventType =
  | 'watered'
  | 'greenhouse-opened'
  | 'greenhouse-closed'
  | 'pruned'
  | 'fed'
  | 'harvested'
  | 'cleared'
  | 'protected'
  | 'note';

export interface GardenEvent {
  id: string;
  at: string; // ISO timestamp
  type: EventType;
  plantIds?: string[];
  areaId?: string;
  note?: string;
}
