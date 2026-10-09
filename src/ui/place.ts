import type { App } from '../app';
import type { Place } from '../types';
import { currentPlace, searchPlaces } from '../location';
import { h } from './dom';

/** The last search, so a redraw while you pick doesn't lose it. */
let last: { query: string; places?: Place[] } = { query: '' };

/** Search for a town, or use the device's location. */
export function placePicker(app: App, onPick?: () => void): HTMLElement {
  const pick = (place: Place) => {
    last = { query: '' };
    onPick?.();
    app.setPlace(place);
  };
  const results = h('ul', { class: 'places' });
  const status = h('p', { class: 'muted', role: 'status' });
  const input = h('input', {
    type: 'search', name: 'q', placeholder: 'Town or village', required: true, autocomplete: 'off', value: last.query,
    oninput: () => (last.query = input.value),
  });

  const show = (places: Place[]) => {
    last.places = places;
    results.replaceChildren(...places.map((p) =>
      h('li', null, h('button', { type: 'button', class: 'place', onclick: () => pick(p) },
        h('strong', null, p.name), h('span', { class: 'muted' }, [p.region, p.country].filter(Boolean).join(', '))))));
    status.textContent = places.length ? '' : 'No places found. Try a nearby town.';
  };

  const search = async (e: Event) => {
    e.preventDefault();
    status.textContent = 'Searching…';
    try {
      show(await searchPlaces(input.value.trim()));
    } catch (err) {
      status.textContent = err instanceof Error ? err.message : String(err);
    }
  };

  const locate = async () => {
    status.textContent = 'Finding you…';
    try {
      pick(await currentPlace());
    } catch (err) {
      status.textContent = `Couldn’t get your location: ${err instanceof Error ? err.message : err}`;
    }
  };

  if (last.places) show(last.places);
  return h('div', { class: 'place-picker' },
    h('form', { class: 'row', onsubmit: search }, input, h('button', { type: 'submit' }, 'Search')),
    h('button', { type: 'button', class: 'secondary', onclick: locate }, '📍 Use my location'),
    status,
    results,
  );
}
