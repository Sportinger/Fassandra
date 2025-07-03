import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), VitePWA({ registerType: 'autoUpdate' })],
  server: {
    port: 8080,     // oder dein gewünschter Port
    host: true,     // erlaubt Zugriff vom Host auf den Container
    allowedHosts: process.env.VITE_APP_DOMAIN ? [process.env.VITE_APP_DOMAIN] : ['localhost'],
    watch: {
      usePolling: true,  // Docker-sicheres File-Watching
      interval: 500,     // optional: Polling-Intervall (ms)
    },
    // Proxy API requests to backend in development mode
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        ws: true, // Enable WebSocket proxying
      },
      '/login': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/register': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/health': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
