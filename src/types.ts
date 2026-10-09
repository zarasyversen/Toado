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
  /** Greenhouse vents that open by themselves, so no daily open/close reminders. */
  autoVents?: boolean;
  notes?: string;
}

export type PlantKind = 'tree' | 'bush' | 'perennial' | 'vegetable' | 'herb' | 'flower';
export type PlantStatus = 'growing' | 'finished';

export interface Plant {
  id: string;
  name: string;
  kind: PlantKind;
  /** Key into the care profiles, e.g. "apple". */
  profileId?: string;
  /** The cultivar, e.g. "Melonäpple". Shown instead of the name when set. */
  variety?: string;
  /** Where this plant differs from its profile, e.g. a later harvest for this variety. */
  care?: CareOverrides;
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
  | 'mulched'
  | 'sown'
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

export type CareJob = 'prune' | 'feed' | 'mulch' | 'sow' | 'harvest';

export interface CareProfile {
  id: string;
  name: string;
  kind: PlantKind;
  /** Days between waterings in dry weather, in open ground. */
  waterEveryDays: number;
  /** Protect it when the night gets colder than this (°C). */
  frostHardyTo: number;
  /** Months (1–12) for each job, as in a temperate northern garden. */
  months: Partial<Record<CareJob, number[]>>;
  tips?: Partial<Record<CareJob, string>>;
}

export type CareOverrides = Partial<Pick<CareProfile, 'waterEveryDays' | 'frostHardyTo' | 'months' | 'tips'>>;

export type TaskKind = 'greenhouse' | 'frost' | 'heat' | 'wind' | 'water' | 'clear' | CareJob;

export interface Task {
  /** Stable across days, e.g. "water:berries", so a "done" tap can be matched. */
  id: string;
  kind: TaskKind;
  title: string;
  reason: string;
  /** 0–100; frost tonight beats pruning. */
  priority: number;
  plantIds?: string[];
  areaId?: string;
  /** The event to log when the task is marked done. */
  logAs?: EventType;
}
