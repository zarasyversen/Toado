/** The bit of the Web Storage API we use, so tests can pass an in-memory store. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function defaultStore(): KeyValueStore | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function readJson<T>(key: string, fallback: T, store = defaultStore()): T {
  try {
    const raw = store?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown, store = defaultStore()): void {
  try {
    store?.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be full or blocked (private mode); the app still works for this visit.
  }
}

export function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
}

export function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}
