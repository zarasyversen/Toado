import { defineConfig } from 'vite';

// Proxy /ollama to the local Ollama server so the browser avoids CORS setup.
export default defineConfig({
  server: {
    proxy: {
      '/ollama': {
        target: 'http://localhost:11434',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ollama/, ''),
      },
    },
  },
});
