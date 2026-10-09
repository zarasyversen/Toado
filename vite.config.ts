import { defineConfig } from 'vite';

// Proxy /ollama to the local Ollama server so the browser avoids CORS setup.
// Phones reach Gemma the same way, through this server, so Ollama stays on localhost.
const proxy = {
  '/ollama': {
    target: 'http://localhost:11434',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/ollama/, ''),
  },
};

// Tailscale serve (https://<machine>.<tailnet>.ts.net) passes its own hostname through.
const allowedHosts = ['.ts.net'];

export default defineConfig({
  server: { proxy, allowedHosts },
  preview: { proxy, allowedHosts },
});
