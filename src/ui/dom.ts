/**
 * A tiny element builder. Text always goes in as text, never as HTML, so nothing
 * Gemma writes (or you type) can inject markup.
 */
type Child = Node | string | number | false | null | undefined | Child[];
type Attrs = Record<string, unknown>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs | null = null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (key === 'class') {
      el.className = String(value);
    } else if (key in el && typeof value !== 'string') {
      (el as unknown as Record<string, unknown>)[key] = value; // checked, value, disabled…
    } else {
      el.setAttribute(key, value === true ? '' : String(value));
    }
  }
  append(el, children);
  return el;
}

function append(parent: Node, children: Child[]): void {
  for (const child of children) {
    if (child === false || child === null || child === undefined) continue;
    if (Array.isArray(child)) append(parent, child);
    else parent.appendChild(typeof child === 'object' ? child : document.createTextNode(String(child)));
  }
}

/** A labelled form field. */
export function field(label: string, input: HTMLElement, hint?: string): HTMLLabelElement {
  return h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), input, hint && h('small', null, hint));
}

export function formData(form: HTMLFormElement): Record<string, string> {
  return Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, String(v)]));
}
