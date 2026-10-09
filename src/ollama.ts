/** A thin client for a local Ollama server. Nothing here leaves the machine. */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  /** Photos for a vision model, base64 without the data: prefix. */
  images?: string[];
}

export interface OllamaOptions {
  /** The dev server proxies /ollama to http://localhost:11434 (see vite.config.ts). */
  baseUrl?: string;
  model?: string;
  fetch?: typeof fetch;
  signal?: AbortSignal;
}

export const DEFAULT_MODEL = import.meta.env.VITE_OLLAMA_MODEL ?? 'gemma4:26b';

function resolve(opts: OllamaOptions) {
  return {
    baseUrl: opts.baseUrl ?? '/ollama',
    model: opts.model ?? DEFAULT_MODEL,
    fetch: opts.fetch ?? globalThis.fetch.bind(globalThis),
  };
}

function request(opts: OllamaOptions, body: object): Promise<Response> {
  const { baseUrl, model, fetch } = resolve(opts);
  return fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // No thinking: short answers matter more here than long deliberation.
    body: JSON.stringify({ model, think: false, ...body }),
    signal: opts.signal,
  });
}

/** True when Ollama is up and the model is pulled. */
export async function modelReady(opts: OllamaOptions = {}): Promise<boolean> {
  const { baseUrl, model, fetch } = resolve(opts);
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: opts.signal });
    if (!res.ok) return false;
    const json: { models: { name: string }[] } = await res.json();
    return json.models.some((m) => m.name === model);
  } catch {
    return false;
  }
}

/** One reply, constrained by Ollama to match `schema`, parsed from JSON. */
export async function chatJson(
  messages: ChatMessage[],
  schema: object,
  opts: OllamaOptions = {},
): Promise<unknown> {
  const res = await request(opts, { messages, format: schema, stream: false, options: { temperature: 0.3 } });
  if (!res.ok) throw new Error(`Ollama request failed (${res.status})`);
  const json: { message: { content: string } } = await res.json();
  return JSON.parse(json.message.content);
}

/** A reply as it is written, one chunk of text at a time. */
export async function* chatStream(messages: ChatMessage[], opts: OllamaOptions = {}): AsyncGenerator<string> {
  const res = await request(opts, { messages, stream: true });
  if (!res.ok || !res.body) throw new Error(`Ollama request failed (${res.status})`);

  // Ollama streams one JSON object per line.
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split('\n');
    buffer = lines.pop()!;
    for (const line of lines) {
      if (!line.trim()) continue;
      const chunk: { message?: { content: string }; error?: string } = JSON.parse(line);
      if (chunk.error) throw new Error(chunk.error);
      if (chunk.message?.content) yield chunk.message.content;
    }
  }
}
