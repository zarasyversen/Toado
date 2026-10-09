import type { App } from '../app';
import type { EventType, GardenEvent } from '../types';
import { formData, h } from './dom';

const LABELS: Record<EventType, [string, string]> = {
  watered: ['💧', 'Watered'],
  'greenhouse-opened': ['🪟', 'Opened the greenhouse'],
  'greenhouse-closed': ['🪟', 'Closed the greenhouse'],
  pruned: ['✂️', 'Pruned'],
  fed: ['🪴', 'Fed'],
  mulched: ['🍂', 'Mulched'],
  sown: ['🌱', 'Sowed'],
  harvested: ['🧺', 'Harvested'],
  cleared: ['🧹', 'Cleared'],
  protected: ['❄️', 'Protected from frost'],
  note: ['📝', 'Note'],
};

function what(app: App, event: GardenEvent): string {
  const plants = (event.plantIds ?? [])
    .map((id) => app.garden.plants.find((p) => p.id === id))
    .map((p) => p && (p.variety ?? p.name))
    .filter(Boolean);
  const area = event.areaId && app.garden.areas.find((a) => a.id === event.areaId)?.name;
  return [...new Set([...plants, area].filter(Boolean))].join(', ');
}

function dayHeading(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

function entry(app: App, event: GardenEvent): HTMLElement {
  const [icon, label] = LABELS[event.type];
  const subject = what(app, event);
  const time = new Date(event.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return h('li', { class: 'entry' },
    h('span', { class: 'job-icon', 'aria-hidden': 'true' }, icon),
    h('div', { class: 'job-text' },
      h('div', null, event.type === 'note' ? event.note : label, subject && h('span', { class: 'muted' }, ` · ${subject}`)),
      event.type !== 'note' && event.note && h('div', { class: 'job-reason' }, event.note),
    ),
    h('time', { class: 'muted', datetime: event.at }, time),
    h('button', {
      class: 'link', 'aria-label': `Delete this entry: ${label}`,
      onclick: () => confirm('Delete this log entry?') && app.removeEvent(event.id),
    }, '×'),
  );
}

export function logView(app: App): HTMLElement {
  const events = [...app.events].sort((a, b) => b.at.localeCompare(a.at));
  const days = new Map<string, GardenEvent[]>();
  for (const e of events) {
    const day = dayHeading(e.at);
    days.set(day, [...(days.get(day) ?? []), e]);
  }

  return h('div', { class: 'stack' },
    h('section', { class: 'card' },
      h('h1', null, 'Garden log'),
      h('p', { class: 'muted' }, 'Everything you’ve done, and what you noticed. Toado and Gemma read it to plan.'),
      h('form', {
        class: 'stack',
        onsubmit: (e: Event) => {
          e.preventDefault();
          const data = formData(e.target as HTMLFormElement);
          if (data.note.trim()) app.addNote(data.note.trim(), data.plant ? [data.plant] : undefined);
        },
      },
        h('textarea', { name: 'note', rows: 2, required: true, placeholder: 'Blueberry leaves turning red. First frost on the lawn.' }),
        h('div', { class: 'row' },
          h('select', { name: 'plant', 'aria-label': 'About which plant' },
            h('option', { value: '' }, 'The whole garden'),
            app.garden.plants.map((p) => h('option', { value: p.id }, p.variety ?? p.name))),
          h('button', { type: 'submit' }, 'Add note'),
        ),
      ),
    ),
    events.length
      ? [...days].map(([day, list]) => h('section', { class: 'card' }, h('h2', null, day), h('ul', { class: 'entries' }, list.map((e) => entry(app, e)))))
      : h('p', { class: 'muted center' }, 'Nothing logged yet. Tick off a job on the Today screen and it shows up here.'),
  );
}
