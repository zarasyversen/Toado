import './style.css';

const MODEL = import.meta.env.VITE_OLLAMA_MODEL ?? 'gemma4:26b';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <header class="brand">
    <span class="brand-name">🐸 Toado</span>
    <span class="brand-tagline">garden to-dos, toad-ally local</span>
  </header>
  <main class="card">
    <h1>Today in your garden</h1>
    <p id="status">Checking for the local model…</p>
  </main>
`;

// Temporary smoke check: confirm the Ollama proxy and model are reachable.
fetch('/ollama/api/tags')
  .then((r) => r.json())
  .then((data: { models: { name: string }[] }) => {
    const found = data.models.some((m) => m.name === MODEL);
    document.querySelector('#status')!.textContent = found
      ? `${MODEL} is ready, running locally.`
      : `Ollama is running, but ${MODEL} isn't pulled.`;
  })
  .catch(() => {
    document.querySelector('#status')!.textContent = 'Ollama is not running.';
  });
