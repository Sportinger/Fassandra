import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.romankuskowski.theatereditor',
  appName: 'Theater Editor',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: false,
    allowNavigation: ['https://mylayer.org/*', 'https://www.mylayer.org/*', 'wss://mylayer.org/*']
  }
};

export default config;
