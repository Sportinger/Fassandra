import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';

// Check for SSL certificates in multiple locations (only in development)
let sslConfig = null;
if (process.env.NODE_ENV !== 'production') {
  const sslPaths = [
    { key: './ssl/private/server.key', cert: './ssl/certs/server.crt' },
    { key: './ssl/dev-key.pem', cert: './ssl/dev-cert.pem' },
    { key: './ssl/dev/key.pem', cert: './ssl/dev/cert.pem' },
    { key: '/app/ssl/dev/key.pem', cert: '/app/ssl/dev/cert.pem' }
  ];

  for (const paths of sslPaths) {
    if (fs.existsSync(paths.key) && fs.existsSync(paths.cert)) {
      sslConfig = {
        key: fs.readFileSync(paths.key),
        cert: fs.readFileSync(paths.cert),
      };
      break;
    }
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');
  
  // Use .env.android file when mode is 'android'
  if (mode === 'android') {
    Object.assign(process.env, loadEnv('android', process.cwd(), ''));
  }

  return {
    plugins: [react(), VitePWA({ registerType: 'autoUpdate' })],
    server: {
    port: 8080,     // Standard port for hot reload
    host: true,     // Allow access from host to container
    allowedHosts: process.env.VITE_APP_DOMAIN ? [process.env.VITE_APP_DOMAIN] : ['localhost', '192.168.2.111'],
    // Only use HTTPS in development mode
    https: process.env.NODE_ENV !== 'production' ? sslConfig : false,
    watch: {
      usePolling: true,  // Docker-safe file watching
      interval: 500,     // Polling interval (ms)
    },
    // Proxy API requests to backend in development mode
    // Use backend container name for Docker networking
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://backend:3000',
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
        target: process.env.VITE_BACKEND_URL || 'http://backend:3000',
        changeOrigin: true,
        secure: false,
      },
      '/register': {
        target: process.env.VITE_BACKEND_URL || 'http://backend:3000',
        changeOrigin: true,
        secure: false,
      },
      '/logout': {
        target: process.env.VITE_BACKEND_URL || 'http://backend:3000',
        changeOrigin: true,
        secure: false,
      },
      '/health': {
        target: process.env.VITE_BACKEND_URL || 'http://backend:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  };
});
