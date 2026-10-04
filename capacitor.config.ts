import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'local.focusspace.mobile',
  appName: 'Tuniko',
  webDir: process.env.FOCUSSPACE_PLATFORM === 'android' ? 'dist/android' : 'dist/ios',
  ios: { contentInset: 'never' },
  android: { allowMixedContent: false },
};
export default config;
