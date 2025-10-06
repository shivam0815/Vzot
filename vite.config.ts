// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    target: 'es2018',
    cssCodeSplit: true,
    sourcemap: false,
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react')) return 'vendor-react';
            if (id.includes('framer-motion')) return 'vendor-motion';
            if (id.includes('chart.js')) return 'vendor-chart';
            if (id.includes('socket.io')) return 'vendor-socket';
            if (id.includes('lucide-react')) return 'vendor-icons';
            return 'vendor';
          }
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://nakodamobile.com/',
        changeOrigin: true,
        secure: true,
        rewrite: p => p,
      },
    },
  },
  define: { global: 'globalThis' },
  optimizeDeps: {
    include: ['react', 'react-dom'],
    exclude: ['chart.js', 'socket.io-client', 'framer-motion', 'lucide-react'],
  },
});
