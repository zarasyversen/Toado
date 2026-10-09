import type { App } from '../app';
import type { ChatMessage } from '../ollama';
import { askGarden } from '../gemma';
import { h } from './dom';
import { photoUrl, shrinkPhoto } from './photo';

const STARTERS = [
  'Should I cover anything tonight?',
  'What can I sow this month?',
  'What should I do before winter?',
];

const PHOTO_QUESTION = 'What can you see in this photo?';

/** The conversation lives here so it survives redraws; it's gone when the tab closes. */
const history: ChatMessage[] = [];
let answering = false;
/** The bubble the current answer streams into, replaced on each redraw. */
let live: HTMLElement | undefined;
/** A photo waiting to go with the next question. */
let photo: string | undefined;
let photoError: string | undefined;

async function ask(app: App, typed: string): Promise<void> {
  const ctx = app.ctx;
  const text = typed.trim() || (photo ? PHOTO_QUESTION : '');
  if (!ctx || answering || !text) return;
  const question = { text, photo };
  const earlier = history.slice();
  history.push(
    { role: 'user', content: text, images: photo ? [photo] : undefined },
    { role: 'assistant', content: '' },
  );
  const reply = history.at(-1)!;
  photo = photoError = undefined;
  answering = true;
  app.render();
  try {
    for await (const chunk of askGarden(ctx, app.tasks, question, earlier)) {
      reply.content += chunk;
      if (live) live.textContent = reply.content;
    }
  } catch {
    reply.content ||= 'I couldn’t reach Gemma. Is Ollama running?';
  } finally {
    answering = false;
    app.render();
  }
}

async function pickPhoto(app: App, input: HTMLInputElement): Promise<void> {
  const file = input.files?.[0];
  if (!file) return;
  try {
    photo = await shrinkPhoto(file);
    photoError = undefined;
  } catch {
    photo = undefined;
    photoError = 'That photo couldn’t be opened. Try a JPEG or PNG.';
  }
  app.render();
}

function bubble(m: ChatMessage, streaming: boolean, waiting: string): HTMLElement {
  const text = h('span', null, m.content || (streaming ? waiting : ''));
  if (streaming) live = text;
  return h('div', { class: `bubble ${m.role}` },
    m.images?.map((img) => h('img', { class: 'bubble-photo', src: photoUrl(img), alt: 'Your photo' })),
    text,
  );
}

export function askView(app: App): HTMLElement {
  const ready = app.ctx !== undefined && app.gemma !== 'missing';
  const input = h('input', {
    name: 'q', autocomplete: 'off', disabled: !ready || answering,
    placeholder: photo ? 'Ask about this photo' : 'Ask about your garden', 'aria-label': 'Your question',
  });
  live = undefined;

  // Looking at a photo takes Gemma a while before the first word; say so.
  const waiting = history.at(-2)?.images ? 'Looking at your photo…' : '…';
  const bubbles = history.map((m, i) => bubble(m, answering && i === history.length - 1, waiting));

  const camera = h('label', { class: `button secondary icon${!ready || answering ? ' disabled' : ''}`, title: 'Add a photo' },
    h('input', {
      type: 'file', accept: 'image/*', class: 'visually-hidden', 'aria-label': 'Add a photo',
      disabled: !ready || answering,
      onchange: (e: Event) => pickPhoto(app, e.target as HTMLInputElement),
    }),
    h('span', { 'aria-hidden': 'true' }, '📷'),
  );

  return h('section', { class: 'card ask' },
    h('h1', null, 'Ask the garden'),
    h('p', { class: 'muted' }, ready
      ? `Gemma knows your plants, your log and this week’s weather. Add a photo of a leaf or a fruit and it’ll have a look. It runs on your own computer, so your questions and photos stay at home.`
      : app.ctx ? 'Start Ollama on your computer to ask questions.' : 'Set up your garden first, so Gemma has something to go on.'),
    h('div', { class: 'conversation', 'aria-live': 'polite' }, bubbles),
    !history.length && ready && h('div', { class: 'row wrap' },
      STARTERS.map((q) => h('button', { class: 'secondary small', onclick: () => ask(app, q) }, q))),
    photo && h('div', { class: 'pending-photo' },
      h('img', { src: photoUrl(photo), alt: 'Photo to send with your question' }),
      h('button', {
        type: 'button', class: 'secondary small',
        onclick: () => { photo = undefined; app.render(); },
      }, 'Remove photo'),
    ),
    photoError && h('p', { class: 'message', role: 'status' }, photoError),
    h('form', {
      class: 'row',
      onsubmit: (e: Event) => {
        e.preventDefault();
        void ask(app, input.value);
      },
    }, camera, input, h('button', { type: 'submit', disabled: !ready || answering }, 'Ask')),
  );
}
