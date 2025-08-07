import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';

// Development-specific Vite configuration with HTTPS for audio features
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  // Use SSL certificates generated in Docker container
  let httpsConfig = false;
  const sslPath = '/app/ssl/dev';
  if (fs.existsSync(`${sslPath}/key.pem`) && fs.existsSync(`${sslPath}/cert.pem`)) {
    httpsConfig = {
      key: fs.readFileSync(`${sslPath}/key.pem`),
      cert: fs.readFileSync(`${sslPath}/cert.pem`),
    };
  }
  
  return {
    plugins: [react(), VitePWA({ registerType: 'autoUpdate' })],
    server: {
      port: 8080,
      host: '0.0.0.0', // Allow external connections
      https: httpsConfig, // Enable HTTPS with self-signed certificates
      watch: {
        usePolling: true, // Required for Docker
        interval: 500,
      },
      hmr: {
        protocol: 'wss', // Use secure WebSocket for HMR with HTTPS
        host: '192.168.2.111',
        port: 8080,
      },
      proxy: {
        '/api': {
          target: process.env.VITE_BACKEND_URL || 'http://backend:3000',
          changeOrigin: true,
          secure: false,
          ws: true,
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