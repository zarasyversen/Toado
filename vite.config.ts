import { defineConfig, type ProxyOptions } from 'vite';

// Proxy /ollama to the local Ollama server so the browser avoids CORS setup.
// Phones reach Gemma the same way, through this server, so Ollama stays on localhost.
const proxy: Record<string, ProxyOptions> = {
  '/ollama': {
    target: 'http://localhost:11434',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/ollama/, ''),
    // Ollama turns away browser requests from origins other than localhost, such as the
    // Tailscale address. Requests only get here through this server, so vouch for them.
    headers: { origin: 'http://localhost:11434' },
  },
};

// Tailscale serve (https://<machine>.<tailnet>.ts.net) passes its own hostname through.
const allowedHosts = ['.ts.net'];

export default defineConfig({
  server: { proxy, allowedHosts },
  preview: { proxy, allowedHosts },
});
