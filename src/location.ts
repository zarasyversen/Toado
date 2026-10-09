import type { Place } from './types';

interface GeocodingResult {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
}

export function parseGeocoding(json: { results?: GeocodingResult[] }): Place[] {
  return (json.results ?? []).map((r) => ({
    name: r.name,
    lat: r.latitude,
    lon: r.longitude,
    country: r.country,
    region: r.admin1,
  }));
}

export async function searchPlaces(query: string): Promise<Place[]> {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.search = new URLSearchParams({ name: query, count: '5', language: 'en' }).toString();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Place search failed (${res.status})`);
  return parseGeocoding(await res.json());
}

export function currentPlace(): Promise<Place> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation is not available'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ name: 'My garden', lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(new Error(err.message)),
      { timeout: 10_000 },
    );
  });
}
