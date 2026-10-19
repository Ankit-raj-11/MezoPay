import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.mezo.pay',
  appName: 'MezoPay',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
