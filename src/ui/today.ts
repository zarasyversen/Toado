import type { App, Pretend } from '../app';
import type { Task, TaskKind } from '../types';
import type { PlanItem } from '../gemma';
import { celsius, tonightMin } from '../rules/context';
import { demoGarden } from '../demo-garden';
import { h } from './dom';
import { placePicker } from './place';
import { changePlace } from './garden';
import { emptyGarden } from '../garden';

export const KIND_ICON: Record<TaskKind, string> = {
  frost: '❄️', greenhouse: '🪟', heat: '☀️', wind: '💨', water: '💧',
  harvest: '🧺', sow: '🌱', prune: '✂️', feed: '🪴', mulch: '🍂', clear: '🧹',
};

function iconFor(app: App, taskIds: string[]): string {
  const task = app.plan?.tasks.find((t) => t.id === taskIds[0]) ?? app.tasks.find((t) => t.id === taskIds[0]);
  return task ? KIND_ICON[task.kind] : '🌿';
}

function welcome(app: App): HTMLElement {
  return h('section', { class: 'card welcome' },
    h('h1', null, 'Welcome to your garden'),
    h('p', null, 'Toado looks at your plants, the season and today’s weather, and gives you a few jobs to do outside. Start with where your garden is.'),
    placePicker(app),
    h('p', { class: 'muted' }, 'Just looking? ',
      h('button', { class: 'link', onclick: () => app.replaceGarden(demoGarden(), []) }, 'Try the demo garden in Forshaga, Sweden')),
  );
}

function weatherStrip(app: App): HTMLElement {
  const today = app.weather!.forecast[0];
  const date = new Date(`${app.weather!.today}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  });
  const season = app.season!;
  return h('header', { class: 'day' },
    h('div', { class: 'day-date' }, date),
    h('div', { class: 'day-place' },
      h('button', { class: 'link', 'aria-label': `${app.garden.place!.name}: change location`, onclick: () => changePlace(app) },
        '📍 ', app.garden.place!.name),
      ' · ', season.season,
      season.growingSeason ? ' · growing season' : ''),
    h('ul', { class: 'chips', 'aria-label': 'Weather' },
      h('li', null, '☀️ up to ', celsius(today.tMax)),
      h('li', { class: tonightMin(app.ctx!) <= 0 ? 'chip-cold' : '' }, '🌙 down to ', celsius(tonightMin(app.ctx!))),
      h('li', null, '💧 ', today.precip.toFixed(0), ' mm'),
      h('li', null, '💨 ', Math.round(today.gustMax), ' km/h'),
    ),
  );
}

function jobRow(app: App, item: { title: string; reason: string; taskIds: string[] }): HTMLElement {
  const done = app.isDone(item.taskIds);
  return h('li', { class: done ? 'job done' : 'job' },
    h('span', { class: 'job-icon', 'aria-hidden': 'true' }, iconFor(app, item.taskIds)),
    h('div', { class: 'job-text' },
      h('div', { class: 'job-title' }, item.title),
      item.reason && h('div', { class: 'job-reason' }, item.reason),
    ),
    h('button', {
      class: done ? 'tick ticked' : 'tick',
      'aria-label': done ? `${item.title}: done` : `Mark “${item.title}” done`,
      'aria-pressed': String(done),
      disabled: done,
      onclick: () => app.markDone(item.taskIds),
    }, done ? '✓' : ''),
  );
}

function sourceLine(app: App): HTMLElement {
  const plan = app.plan!.plan;
  const text = app.planning
    ? 'Gemma is writing today’s plan…'
    : plan.source === 'gemma'
      ? `Planned by ${app.model}, running on this computer.`
      : app.tasks.length
        ? 'Gemma isn’t running, so this is the rules’ own list.'
        : '';
  return h('footer', { class: 'source' },
    h('span', null, text),
    app.tasks.length > 0 && !app.planning &&
      h('button', { class: 'link', onclick: () => { app.ensurePlan(true); app.render(); } }, 'Plan again'),
  );
}

function others(app: App, planned: PlanItem[]): HTMLElement | false {
  const inPlan = new Set(planned.flatMap((i) => i.taskIds));
  const rest = app.tasks.filter((t: Task) => !inPlan.has(t.id));
  if (!rest.length) return false;
  return h('details', { class: 'card more' },
    h('summary', null, `${rest.length} more thing${rest.length > 1 ? 's' : ''} you could do`),
    h('ul', { class: 'jobs' }, rest.map((t) => jobRow(app, { title: t.title, reason: t.reason, taskIds: [t.id] }))),
  );
}

function pretendControl(app: App): HTMLElement {
  const options: [Pretend, string][] = [['real', 'Real weather'], ['hot', 'Hot sunny day'], ['frost', 'Frost tonight']];
  return h('label', { class: 'pretend' }, 'Dev: ',
    h('select', { onchange: (e: Event) => app.setPretend((e.target as HTMLSelectElement).value as Pretend) },
      options.map(([value, label]) => h('option', { value, selected: app.pretend === value }, label))),
  );
}

export function todayView(app: App): HTMLElement {
  if (!app.garden.place) return welcome(app);
  if (app.error) {
    return h('section', { class: 'card' },
      h('h1', null, 'No weather right now'),
      h('p', null, `Toado couldn’t fetch the forecast (${app.error}).`),
      h('button', { onclick: () => app.loadWeather() }, 'Try again'));
  }
  if (!app.plan || !app.weather) return h('section', { class: 'card' }, h('p', { class: 'muted' }, 'Checking the weather…'));

  const { plan } = app.plan;
  const allDone = plan.items.length > 0 && plan.items.every((i) => app.isDone(i.taskIds));
  return h('div', { class: 'stack' },
    app.garden.demo && h('aside', { class: 'demo-banner' },
      h('span', null, 'You’re looking at the demo garden in Forshaga.'),
      h('button', { class: 'small', onclick: () => app.replaceGarden(emptyGarden(), []) }, 'Start your own garden'),
    ),
    h('section', { class: 'card today' },
      weatherStrip(app),
      h('h1', null, 'Today in your garden'),
      plan.summary && h('p', { class: 'summary' }, plan.summary),
      plan.items.length
        ? h('ul', { class: 'jobs' }, plan.items.map((item) => jobRow(app, item)))
        : !plan.summary && h('p', { class: 'summary' }, 'Nothing pressing today. A good day to just wander round and look.'),
      allDone && h('p', { class: 'all-done' }, '🐸 All done. Nice work out there.'),
      sourceLine(app),
    ),
    others(app, plan.items),
    import.meta.env.DEV && pretendControl(app),
  );
}
