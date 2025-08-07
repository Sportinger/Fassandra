import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Development-specific Vite configuration without HTTPS
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react(), VitePWA({ registerType: 'autoUpdate' })],
    server: {
      port: 8080,
      host: '0.0.0.0', // Allow external connections
      // Disable HTTPS for development to avoid certificate issues
      https: false,
      watch: {
        usePolling: true, // Required for Docker
        interval: 500,
      },
      hmr: {
        protocol: 'ws', // Use WebSocket for HMR
        host: '192.168.2.111',
        port: 8080,
      },
      proxy: {
        '/api': {
          target: process.env.VITE_BACKEND_URL || 'http://backend:8089',
          changeOrigin: true,
          secure: false,
          ws: true,
        },
        '/login': {
          target: process.env.VITE_BACKEND_URL || 'http://backend:8089',
          changeOrigin: true,
          secure: false,
        },
        '/register': {
          target: process.env.VITE_BACKEND_URL || 'http://backend:8089',
          changeOrigin: true,
          secure: false,
        },
        '/logout': {
          target: process.env.VITE_BACKEND_URL || 'http://backend:8089',
          changeOrigin: true,
          secure: false,
        },
        '/health': {
          target: process.env.VITE_BACKEND_URL || 'http://backend:8089',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});