import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.romankuskowski.theatereditor',
  appName: 'Theater Editor',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: false,
    allowNavigation: ['https://fassandra.de/*', 'https://www.fassandra.de/*', 'wss://fassandra.de/*']
  }
};

export default config;
