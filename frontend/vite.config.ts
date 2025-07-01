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
  },
})
