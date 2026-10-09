import type { App } from '../app';
import type { Area, AreaKind, Plant } from '../types';
import { addArea, emptyGarden, exportGarden, importGarden, importLog } from '../garden';
import { lastEvent, logEvent, wholeDaysBetween } from '../log';
import { demoGarden } from '../demo-garden';
import { field, formData, h } from './dom';
import { placePicker } from './place';
import { editing, plantEditor, startEditing } from './plant-editor';

const AREA_KINDS: [AreaKind, string][] = [
  ['bed', 'Bed'], ['raised-bed', 'Raised bed'], ['greenhouse', 'Greenhouse'],
  ['orchard', 'Orchard'], ['lawn', 'Lawn'], ['pots', 'Pots'],
];

let changingPlace = false;

/** Open the Garden screen with the place picker showing. */
export function changePlace(app: App): void {
  changingPlace = true;
  app.tab = 'garden';
  app.render();
  window.scrollTo(0, 0);
}

function lastWatered(app: App, plant: Plant): string {
  const event = lastEvent(app.events, 'watered', plant);
  if (!event) return '';
  const days = wholeDaysBetween(event.at, new Date());
  return days === 0 ? 'watered today' : days === 1 ? 'watered yesterday' : `watered ${days} days ago`;
}

function plantRow(app: App, plant: Plant): HTMLElement {
  const meta = [
    plant.variety && plant.name,
    plant.inPot && 'in a pot',
    plant.status === 'finished' ? 'finished' : lastWatered(app, plant),
  ].filter(Boolean).join(' · ');
  return h('li', { class: plant.status === 'finished' ? 'plant finished' : 'plant' },
    h('button', { class: 'plant-name', onclick: () => startEditing(app, plant) },
      h('strong', null, plant.variety ?? plant.name), meta && h('span', { class: 'muted' }, meta)),
    plant.status === 'growing' && h('button', {
      class: 'small secondary',
      'aria-label': `Log watering for ${plant.variety ?? plant.name}`,
      onclick: () => {
        logEvent(app.events, 'watered', { plantIds: [plant.id] });
        app.save();
      },
    }, '💧 Watered'),
  );
}

function areaCard(app: App, area: Area | undefined, plants: Plant[]): HTMLElement {
  const kind = area?.kind.replace('-', ' ');
  // "Orchard · orchard" says nothing twice; only show the kind when the name doesn't.
  const tags = area
    ? [!area.name.toLowerCase().includes(kind!) && kind, area.covered && 'covered', area.autoVents && 'auto vents'].filter(Boolean)
    : [];
  return h('section', { class: 'card area' },
    h('header', { class: 'area-head' },
      h('h2', null, area?.name ?? 'Elsewhere'),
      tags.length > 0 && h('span', { class: 'muted' }, tags.join(' · ')),
      area && !plants.length && h('button', {
        class: 'link', 'aria-label': `Remove ${area.name}`,
        onclick: () => {
          app.garden.areas = app.garden.areas.filter((a) => a.id !== area.id);
          app.save();
        },
      }, 'Remove'),
    ),
    area?.notes && h('p', { class: 'muted' }, area.notes),
    plants.length ? h('ul', { class: 'plants' }, plants.map((p) => plantRow(app, p))) : h('p', { class: 'muted' }, 'Nothing planted here yet.'),
    h('button', { class: 'link', onclick: () => startEditing(app, undefined, area?.id) }, '+ Add a plant'),
  );
}

function newAreaForm(app: App): HTMLElement {
  const covered = h('input', { type: 'checkbox', name: 'covered' });
  const kind = h('select', {
    name: 'kind',
    // A greenhouse keeps the rain off; everything else gets it.
    onchange: () => (covered.checked = kind.value === 'greenhouse'),
  }, AREA_KINDS.map(([value, label]) => h('option', { value }, label)));

  return h('details', { class: 'card' },
    h('summary', null, 'Add a bed, greenhouse or other area'),
    h('form', {
      class: 'stack',
      onsubmit: (e: Event) => {
        e.preventDefault();
        const data = formData(e.target as HTMLFormElement);
        addArea(app.garden, {
          name: data.name.trim(),
          kind: data.kind as AreaKind,
          covered: data.covered === 'on',
          autoVents: data.autoVents === 'on' || undefined,
        });
        app.save();
      },
    },
      field('Name', h('input', { name: 'name', required: true, placeholder: 'Vegetable bed' })),
      field('Kind', kind),
      h('label', { class: 'check' }, covered, 'Covered (no rain gets in)'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'autoVents' }), 'Vents open by themselves'),
      h('button', { type: 'submit' }, 'Add area'),
    ),
  );
}

function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  h('a', { href: url, download: name }).click();
  URL.revokeObjectURL(url);
}

function dataCard(app: App): HTMLElement {
  const file = h('input', {
    type: 'file', accept: 'application/json,.json', hidden: true,
    onchange: async () => {
      const chosen = file.files?.[0];
      if (!chosen) return;
      try {
        const json = await chosen.text();
        app.replaceGarden(importGarden(json), importLog(json));
      } catch (err) {
        alert(err instanceof Error ? err.message : String(err));
      }
    },
  });
  return h('details', { class: 'card' },
    h('summary', null, 'Your data'),
    h('p', { class: 'muted' }, 'Everything is stored in this browser only. Export your garden and log to keep a copy or move them to another device.'),
    h('div', { class: 'row wrap' },
      h('button', { class: 'secondary', onclick: () => download('toado-garden.json', exportGarden(app.garden, app.events)) }, 'Export garden'),
      h('button', { class: 'secondary', onclick: () => file.click() }, 'Import garden'),
      h('button', { class: 'secondary', onclick: () => confirm('Replace your garden and log with the demo garden?') && app.replaceGarden(demoGarden(), []) }, 'Load demo garden'),
      h('button', { class: 'danger', onclick: () => confirm('Delete your garden and its whole log?') && app.replaceGarden(emptyGarden(), []) }, 'Start over'),
    ),
    file,
  );
}

export function gardenView(app: App): HTMLElement {
  if (editing()) return plantEditor(app);
  const { garden } = app;
  const loose = garden.plants.filter((p) => !garden.areas.some((a) => a.id === p.areaId));
  const place = garden.place;

  return h('div', { class: 'stack' },
    h('section', { class: 'card' },
      h('h1', null, garden.name),
      place && !changingPlace
        ? h('p', null, '📍 ', [place.name, place.region, place.country].filter(Boolean).join(', '), ' ',
          h('button', { class: 'link', onclick: () => { changingPlace = true; app.render(); } }, 'Change'))
        : placePicker(app, () => (changingPlace = false)),
      changingPlace && place && h('button', { class: 'link', onclick: () => { changingPlace = false; app.render(); } }, 'Keep ' + place.name),
    ),
    garden.areas.map((area) => areaCard(app, area, garden.plants.filter((p) => p.areaId === area.id))),
    (loose.length > 0 || !garden.areas.length) && areaCard(app, undefined, loose),
    newAreaForm(app),
    dataCard(app),
  );
}
