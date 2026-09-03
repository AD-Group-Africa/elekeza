import type { CapacitorConfig } from '@capacitor/cli';

// In production the app loads the hosted frontend; set CAPACITOR_SERVER_URL to
// the production URL at build time. Without it, Capacitor serves the local
// webDir (development builds only).
const serverUrl = process.env.CAPACITOR_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'com.elekeza.app',
  appName: 'Elekeza',
  webDir: 'out',
  server: serverUrl
    ? {
        url: serverUrl,
        cleartext: false,
      }
    : undefined,
};

export default config;
