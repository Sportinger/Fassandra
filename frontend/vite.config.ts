import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';

// Check for SSL certificates in multiple locations
const sslPaths = [
  { key: './ssl/dev-key.pem', cert: './ssl/dev-cert.pem' },
  { key: './ssl/dev/key.pem', cert: './ssl/dev/cert.pem' },
  { key: '/app/ssl/dev/key.pem', cert: '/app/ssl/dev/cert.pem' }
];

let sslConfig = null;
for (const paths of sslPaths) {
  if (fs.existsSync(paths.key) && fs.existsSync(paths.cert)) {
    sslConfig = {
      key: fs.readFileSync(paths.key),
      cert: fs.readFileSync(paths.cert),
    };
    break;
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), VitePWA({ registerType: 'autoUpdate' })],
  server: {
    port: 8080,     // Standard port for hot reload
    host: true,     // Allow access from host to container
    allowedHosts: process.env.VITE_APP_DOMAIN ? [process.env.VITE_APP_DOMAIN] : ['localhost', '192.168.2.111'],
    // Always use HTTPS for consistency with production
    https: sslConfig || {
      key: fs.readFileSync('/app/ssl/dev/key.pem'),
      cert: fs.readFileSync('/app/ssl/dev/cert.pem'),
    },
    watch: {
      usePolling: true,  // Docker-safe file watching
      interval: 500,     // Polling interval (ms)
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
