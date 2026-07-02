import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

function isTabletViewport() {
  return Math.min(window.innerWidth, window.innerHeight) >= 768;
}

export async function initCapacitor() {
  if (!Capacitor.isNativePlatform()) return;

  await Promise.allSettled([
    StatusBar.setStyle({ style: Style.Dark }),
    StatusBar.setBackgroundColor({ color: '#1e1e1e' }),
    SplashScreen.hide()
  ]);

  const device = await Device.getInfo().catch(() => null);
  const tablet = isTabletViewport() || device?.model.toLowerCase().includes('ipad') || device?.model.toLowerCase().includes('tablet');

  await ScreenOrientation.lock({
    orientation: tablet ? 'landscape' : 'portrait'
  }).catch(() => undefined);
}
