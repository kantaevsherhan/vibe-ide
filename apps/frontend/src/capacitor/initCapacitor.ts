import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

export async function initCapacitor() {
  if (!Capacitor.isNativePlatform()) return;

  await Promise.allSettled([
    StatusBar.setStyle({ style: Style.Dark }),
    StatusBar.setBackgroundColor({ color: '#1e1e1e' }),
    SplashScreen.hide()
  ]);
}
