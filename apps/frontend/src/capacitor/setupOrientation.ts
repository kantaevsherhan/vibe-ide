import { Capacitor } from '@capacitor/core';
import { ScreenOrientation } from '@capacitor/screen-orientation';

export async function setupOrientation() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await ScreenOrientation.lock({ orientation: 'landscape' });
  } catch (error) {
    console.warn('Failed to lock orientation', error);
  }
}
