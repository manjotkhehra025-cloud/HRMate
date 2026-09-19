import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_TARGET = process.env.API_TARGET || 'http://127.0.0.1:8787';

// Mobile-first SPA. Hash routing is used client side, so no history fallback is needed.
export default defineConfig({
  root: 'web',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    allowedHosts: true,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true, ws: false },
      '/uploads': { target: API_TARGET, changeOrigin: true }
    }
  },
  preview: { host: '0.0.0.0', port: 5173, allowedHosts: true },
  build: { outDir: '../dist', emptyOutDir: true, sourcemap: false, chunkSizeWarningLimit: 1600 }
});
