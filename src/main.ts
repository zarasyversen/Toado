import './style.css';
import { App, type Tab } from './app';
import { h } from './ui/dom';
import { todayView } from './ui/today';
import { gardenView } from './ui/garden';
import { logView } from './ui/log';
import { askView } from './ui/ask';

const TABS: [Tab, string, string][] = [
  ['today', '🌤️', 'Today'],
  ['garden', '🌳', 'Garden'],
  ['log', '📓', 'Log'],
  ['ask', '💬', 'Ask'],
];

const VIEWS: Record<Tab, (app: App) => HTMLElement> = {
  today: todayView,
  garden: gardenView,
  log: logView,
  ask: askView,
};

const root = document.querySelector<HTMLDivElement>('#app')!;
const app = new App(render);

type TextField = HTMLInputElement | HTMLTextAreaElement;

/**
 * The field you're typing in, if any. Redraws replace the whole page (Gemma finishing a
 * plan triggers one), so this lets render() put your text, focus and cursor back.
 */
function typing(): { name: string; value: string; start: number | null; end: number | null } | undefined {
  const el = document.activeElement;
  if (!(el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && el.type !== 'checkbox'))) return;
  if (!el.name || !root.contains(el)) return;
  return { name: el.name, value: el.value, start: el.selectionStart, end: el.selectionEnd };
}

// A submitted form is done with its text; don't carry it into the next redraw.
root.addEventListener('submit', () => (document.activeElement as HTMLElement | null)?.blur(), true);

function render(): void {
  const field = typing();
  root.replaceChildren(
    h('header', { class: 'brand' },
      h('span', { class: 'brand-name' }, '🐸 Toado'),
      h('span', { class: 'brand-tagline' }, 'your little garden helper'),
    ),
    h('main', { id: 'main' }, VIEWS[app.tab](app)),
    h('nav', { class: 'tabs', 'aria-label': 'Sections' },
      TABS.map(([tab, icon, label]) => h('button', {
        class: 'tab',
        'aria-current': app.tab === tab ? 'page' : undefined,
        onclick: () => {
          app.tab = tab;
          render();
          window.scrollTo(0, 0);
        },
      }, h('span', { 'aria-hidden': 'true' }, icon), label)),
    ),
  );
  const again = field && root.querySelector<TextField>(`[name="${CSS.escape(field.name)}"]`);
  if (field && again) {
    again.value = field.value;
    again.focus();
    try {
      again.setSelectionRange(field.start, field.end);
    } catch {
      // Number inputs have no selection.
    }
  }
}

void app.start();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  void navigator.serviceWorker.register('/sw.js');
}
