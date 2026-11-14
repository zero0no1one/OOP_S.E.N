import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  esbuild: { jsx: 'automatic' },
  server: {
    host: '127.0.0.1',
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:8080' },
  },
});
