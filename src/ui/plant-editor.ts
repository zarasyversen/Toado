import type { App } from '../app';
import { profilesFor } from '../app';
import type { CareJob, CareProfile, Plant, PlantKind, PlantStatus } from '../types';
import { hemisphere, otherHemisphere } from '../climate';
import { profileOf } from '../rules/context';
import { overridesFrom, suggestCare } from '../gemma';
import { newId } from '../storage';
import { field, h } from './dom';

const KINDS: PlantKind[] = ['tree', 'bush', 'perennial', 'vegetable', 'herb', 'flower'];
const JOBS: CareJob[] = ['sow', 'prune', 'feed', 'mulch', 'harvest'];
const MONTH_LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

interface Draft {
  plant: Plant;
  isNew: boolean;
  /** The plant's care as it will apply: its profile with its own overrides on top. */
  care?: CareProfile;
  asking: boolean;
  message?: string;
}

/** The plant being added or edited; kept here so a redraw doesn't lose your typing. */
let draft: Draft | undefined;

export function editing(): boolean {
  return draft !== undefined;
}

export function startEditing(app: App, plant?: Plant, areaId?: string): void {
  const copy: Plant = plant
    ? structuredClone(plant)
    : { id: newId(), name: '', kind: 'perennial', status: 'growing', areaId };
  // A copy: the editor changes it freely, and the shared profile stays untouched until Save.
  const care = profileOf({ profiles: profilesFor(app.garden) }, copy);
  draft = { plant: copy, isNew: !plant, care: care && structuredClone(care), asking: false };
  app.render();
}

function close(app: App): void {
  draft = undefined;
  app.render();
}

function save(app: App): void {
  const d = draft!;
  const { plant } = d;
  plant.name = plant.name.trim();
  plant.variety = plant.variety?.trim() || undefined;
  if (!plant.name) {
    d.message = 'Give the plant a name.';
    return app.render();
  }

  const base = plant.profileId ? profilesFor(app.garden)[plant.profileId] : undefined;
  if (base && d.care) {
    // Store only what differs from the species, so fixes to the built-in profile still apply.
    const care = overridesFrom(base, d.care);
    plant.care = Object.keys(care).length ? care : undefined;
  } else if (d.care) {
    // A plant the app doesn't know: its care becomes a profile of its own.
    const profile = { ...d.care, id: d.care.id.startsWith('custom-') ? d.care.id : `custom-${newId()}`, kind: plant.kind };
    app.garden.profiles = [...(app.garden.profiles ?? []).filter((p) => p.id !== profile.id), profile];
    plant.profileId = profile.id;
    plant.care = undefined;
  }

  const i = app.garden.plants.findIndex((p) => p.id === plant.id);
  if (i >= 0) app.garden.plants[i] = plant;
  else app.garden.plants.push(plant);
  draft = undefined;
  app.save();
}

function remove(app: App): void {
  const { plant } = draft!;
  if (!confirm(`Remove ${plant.variety ?? plant.name} from your garden? Its log entries stay.`)) return;
  app.garden.plants = app.garden.plants.filter((p) => p.id !== plant.id);
  draft = undefined;
  app.save();
}

async function askGemma(app: App): Promise<void> {
  const d = draft!;
  if (!d.plant.name.trim()) {
    d.message = 'Type the plant’s name first.';
    return app.render();
  }
  const species = d.plant.profileId ? profilesFor(app.garden)[d.plant.profileId] : undefined;
  // Start Gemma from the care as it stands now, so months you set yourself aren't lost.
  const base = d.care ?? species;
  d.asking = true;
  d.message = undefined;
  app.render();
  try {
    const suggested = await suggestCare(app.garden, { name: d.plant.name.trim(), variety: d.plant.variety?.trim(), base });
    if (draft !== d) return; // closed while Gemma was thinking
    d.care = suggested;
    if (!species) d.plant.kind = suggested.kind;
    d.message = 'Gemma’s suggestion is filled in below. Check it against what you know, then save.';
  } catch {
    d.message = 'Couldn’t reach Gemma. Is Ollama running?';
  } finally {
    d.asking = false;
    app.render();
  }
}

function careGrid(app: App, care: CareProfile): HTMLElement {
  const south = hemisphere(app.garden.place?.lat ?? 0) === 'south';
  // Months are stored on the northern calendar; show them as they fall in this garden.
  const stored = (local: number) => (south ? otherHemisphere(local) : local);

  const toggle = (job: CareJob, local: number) => {
    const month = stored(local);
    const months = care.months[job] ?? [];
    const next = months.includes(month) ? months.filter((m) => m !== month) : [...months, month].sort((a, b) => a - b);
    care.months = { ...care.months, [job]: next };
    app.render();
  };

  return h('table', { class: 'months' },
    h('thead', null, h('tr', null, h('th', null, ''), MONTH_LETTERS.map((l, i) => h('th', { title: MONTH_NAMES[i] }, l)))),
    h('tbody', null, JOBS.map((job) => h('tr', null,
      h('th', { scope: 'row' }, job),
      MONTH_LETTERS.map((_, i) => {
        const on = care.months[job]?.includes(stored(i + 1)) ?? false;
        return h('td', null, h('button', {
          type: 'button',
          class: on ? 'month on' : 'month',
          'aria-pressed': String(on),
          'aria-label': `${job} in ${MONTH_NAMES[i]}`,
          onclick: () => toggle(job, i + 1),
        }));
      }),
    ))),
  );
}

function careSection(app: App, d: Draft): HTMLElement {
  const care = d.care;
  const gemmaButton = h('button', {
    type: 'button', class: 'secondary', disabled: d.asking || app.gemma === 'missing',
    onclick: () => askGemma(app),
  }, d.asking ? 'Gemma is thinking…' : d.plant.variety ? '✨ Ask Gemma about this variety' : '✨ Ask Gemma how to care for it');

  if (!care) {
    return h('fieldset', { class: 'care' },
      h('legend', null, 'Care'),
      h('p', { class: 'muted' }, 'Pick a plant type above, or ask Gemma to suggest care for this plant.'),
      gemmaButton,
    );
  }
  const tips = Object.entries(care.tips ?? {});
  return h('fieldset', { class: 'care' },
    h('legend', null, 'Care'),
    h('div', { class: 'row' },
      field('Water every', h('input', {
        type: 'number', name: 'waterEveryDays', min: 1, max: 60, value: care.waterEveryDays,
        oninput: (e: Event) => (care.waterEveryDays = Number((e.target as HTMLInputElement).value) || 1),
      }), 'days, in dry weather'),
      field('Protect below', h('input', {
        type: 'number', name: 'frostHardyTo', min: -50, max: 15, value: care.frostHardyTo,
        oninput: (e: Event) => (care.frostHardyTo = Number((e.target as HTMLInputElement).value)),
      }), '°C at night'),
    ),
    h('p', { class: 'field-label' }, 'When to do what (tap to change)'),
    careGrid(app, care),
    tips.length > 0 && h('ul', { class: 'tips' }, tips.map(([job, tip]) => h('li', null, h('strong', null, `${job}: `), tip))),
    gemmaButton,
  );
}

export function plantEditor(app: App): HTMLElement {
  const d = draft!;
  const { plant } = d;
  const profiles = Object.values(profilesFor(app.garden)).sort((a, b) => a.name.localeCompare(b.name));

  const pickProfile = (id: string) => {
    plant.profileId = id || undefined;
    const profile = id ? profilesFor(app.garden)[id] : undefined;
    d.care = profile && structuredClone(profile);
    if (profile) plant.kind = profile.kind;
    plant.care = undefined;
    app.render();
  };

  return h('form', { class: 'card editor', onsubmit: (e: Event) => { e.preventDefault(); save(app); } },
    h('h1', null, d.isNew ? 'Add a plant' : `Edit ${plant.variety ?? plant.name}`),
    field('Name', h('input', {
      name: 'name', value: plant.name, required: true, placeholder: 'Apple tree',
      oninput: (e: Event) => (plant.name = (e.target as HTMLInputElement).value),
    })),
    field('Variety', h('input', {
      name: 'variety', value: plant.variety ?? '', placeholder: 'Melonäpple (optional)',
      oninput: (e: Event) => (plant.variety = (e.target as HTMLInputElement).value),
    }), 'The more exact, the better Gemma’s timing.'),
    field('Plant type', h('select', { onchange: (e: Event) => pickProfile((e.target as HTMLSelectElement).value) },
      h('option', { value: '' }, 'Not in the list'),
      profiles.map((p) => h('option', { value: p.id, selected: p.id === plant.profileId }, p.name)),
    )),
    h('div', { class: 'row' },
      field('Kind', h('select', { onchange: (e: Event) => (plant.kind = (e.target as HTMLSelectElement).value as PlantKind) },
        KINDS.map((k) => h('option', { value: k, selected: k === plant.kind }, k)))),
      field('Where', h('select', { onchange: (e: Event) => (plant.areaId = (e.target as HTMLSelectElement).value || undefined) },
        h('option', { value: '' }, 'Elsewhere'),
        app.garden.areas.map((a) => h('option', { value: a.id, selected: a.id === plant.areaId }, a.name)))),
    ),
    h('div', { class: 'row' },
      h('label', { class: 'check' }, h('input', {
        type: 'checkbox', checked: plant.inPot ?? false,
        onchange: (e: Event) => (plant.inPot = (e.target as HTMLInputElement).checked || undefined),
      }), 'In a pot'),
      field('Status', h('select', { onchange: (e: Event) => (plant.status = (e.target as HTMLSelectElement).value as PlantStatus) },
        h('option', { value: 'growing', selected: plant.status === 'growing' }, 'Growing'),
        h('option', { value: 'finished', selected: plant.status === 'finished' }, 'Finished for the season'))),
    ),
    careSection(app, d),
    d.message && h('p', { class: 'message', role: 'status' }, d.message),
    h('div', { class: 'row actions' },
      h('button', { type: 'submit' }, 'Save'),
      h('button', { type: 'button', class: 'secondary', onclick: () => close(app) }, 'Cancel'),
      !d.isNew && h('button', { type: 'button', class: 'danger', onclick: () => remove(app) }, 'Remove'),
    ),
  );
}
