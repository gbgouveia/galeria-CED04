import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// No GitHub Pages o site fica em https://gbgouveia.github.io/galeria-CED04/
// BASE_PATH permite publicar em outro caminho sem alterar o código.
const REPO_BASE = '/galeria-CED04/';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? process.env.BASE_PATH || REPO_BASE : '/',
  plugins: [react()],
  worker: { format: 'es' },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1600,
  },
}));
