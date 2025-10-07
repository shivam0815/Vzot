// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    target: 'es2018',
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://nakodamobile.com/',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  define: { global: 'globalThis' },
});
