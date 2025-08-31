import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';

// Development-specific Vite configuration with HTTPS for audio features
export default defineConfig(() => {
  
  // Temporarily disable HTTPS for testing
  const useHttps = false;
  const disableHMR = process.env.IOS_NO_HMR === '1' || process.env.VITE_NO_HMR === '1';
  const hmrHost = process.env.VITE_HMR_HOST || undefined; // e.g., '192.168.1.42'
  
  let httpsConfig: any = false;
  if (useHttps) {
    const sslPath = '/app/ssl/dev';
    if (fs.existsSync(`${sslPath}/key.pem`) && fs.existsSync(`${sslPath}/cert.pem`)) {
      httpsConfig = {
        key: fs.readFileSync(`${sslPath}/key.pem`),
        cert: fs.readFileSync(`${sslPath}/cert.pem`),
      };
    }
  }
  
  return {
    plugins: [
      react(),
      // Disable PWA SW during development to avoid iOS reload loops
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: { enabled: false },
      }),
    ],
    server: {
      port: 8080,
      host: '0.0.0.0', // Allow external connections
      https: httpsConfig, // Enable HTTPS only when useHttps is true
      watch: {
        usePolling: true, // Required for Docker
        interval: 500,
      },
      hmr: disableHMR ? false : {
        // HMR configuration for Docker / LAN iOS
        host: hmrHost, // optionally override hostname for iPhone Safari
        port: 8080,
        clientPort: 8080, // Explicitly set client port for Docker
        timeout: 60000, // Increase timeout for stability
      },
      proxy: {
        '/api': {
          target: process.env.VITE_BACKEND_URL || 'http://backend:3000',
          changeOrigin: true,
          secure: false,
          ws: true, // Enable WebSocket proxying for collaboration
          configure: (proxy) => {
            proxy.on('proxyRes', (proxyRes: any, _req: any, res: any) => {
              // Forward cookies from backend, ensuring secure flag is preserved
              const setCookieHeader = proxyRes.headers['set-cookie'];
              if (setCookieHeader) {
                // The cookies already have secure flag from backend
                res.setHeader('set-cookie', setCookieHeader);
              }
            });
            proxy.on('upgrade', (req: any, socket: any, head: any) => {
              // Handle WebSocket upgrade for collaboration
              console.log('[Vite Proxy] WebSocket upgrade request:', req.url);
            });
          }
        },
        '/login': {
          target: process.env.VITE_BACKEND_URL || 'http://backend:3000',
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on('proxyRes', (proxyRes: any, _req: any, res: any) => {
              const setCookieHeader = proxyRes.headers['set-cookie'];
              if (setCookieHeader) {
                res.setHeader('set-cookie', setCookieHeader);
              }
            });
          }
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
