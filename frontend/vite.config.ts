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
    // Use network IP for backend when available to support network access
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://192.168.2.111:3001',
        changeOrigin: true,
        secure: false,
        ws: true, // Enable WebSocket proxying
      },
      '/login': {
        target: process.env.VITE_BACKEND_URL || 'http://192.168.2.111:3001',
        changeOrigin: true,
        secure: false,
      },
      '/register': {
        target: process.env.VITE_BACKEND_URL || 'http://192.168.2.111:3001',
        changeOrigin: true,
        secure: false,
      },
      '/health': {
        target: process.env.VITE_BACKEND_URL || 'http://192.168.2.111:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
