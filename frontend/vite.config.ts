import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), VitePWA({ registerType: 'autoUpdate' })],
  server: {
    port: 8081,     // Using port 8081 for consistency
    host: true,     // erlaubt Zugriff vom Host auf den Container
    allowedHosts: process.env.VITE_APP_DOMAIN ? [process.env.VITE_APP_DOMAIN] : ['localhost'],
    https: {
      key: fs.readFileSync('./ssl/dev-key.pem'),
      cert: fs.readFileSync('./ssl/dev-cert.pem'),
    },
    watch: {
      usePolling: true,  // Docker-sicheres File-Watching
      interval: 500,     // optional: Polling-Intervall (ms)
    },
    // Proxy API requests to backend in development mode
    // Use Docker service name for container-to-container communication
    // Fallback to network IP for development outside Docker
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://backend:3001',
        changeOrigin: true,
        secure: false,
        ws: true, // Enable WebSocket proxying for real-time collaboration
        configure: (proxy, _options) => {
          proxy.on('proxyReqWs', (_proxyReq, req, _socket) => {
            console.log('WebSocket proxy request:', req.url);
          });
          proxy.on('error', (err, _req, _res) => {
            console.log('Proxy error:', err);
          });
        },
      },
      '/login': {
        target: process.env.VITE_BACKEND_URL || 'http://backend:3001',
        changeOrigin: true,
        secure: false,
      },
      '/register': {
        target: process.env.VITE_BACKEND_URL || 'http://backend:3001',
        changeOrigin: true,
        secure: false,
      },
      '/health': {
        target: process.env.VITE_BACKEND_URL || 'http://backend:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
