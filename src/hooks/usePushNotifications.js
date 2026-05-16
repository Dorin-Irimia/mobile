import { useEffect, useRef } from 'react';
import { Platform, AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import api from '../api/client';
import useStore from '../store';

// Handler pentru ce se întâmplă când o notificare ajunge:
// - Banner pe ecran (chiar dacă app e deschis)
// - Sunet
// - Badge pe iconița app
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function usePushNotifications(navigationRef) {
  const user = useStore(s => s.user);
  const notifListener = useRef(null);
  const responseListener = useRef(null);
  const registered = useRef(false);

  useEffect(() => {
    if (!user) return;
    if (registered.current) return;
    registered.current = true;

    setupNotificationChannel();
    registerToken();
    checkReminders();

    // Refresh notifications list when one arrives in foreground
    notifListener.current = Notifications.addNotificationReceivedListener(() => {
      useStore.getState().fetchNotifications?.();
    });

    // Navigate to relevant screen when user taps a push
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        const data = response?.notification?.request?.content?.data || {};
        const nav = navigationRef?.current;
        if (!nav) return;
        if (data.relatedType === 'Vehicle' && data.relatedId) {
          nav.navigate('VehicleDetail', { vehicleId: data.relatedId });
        } else if (data.relatedType === 'Friendship') {
          nav.navigate('Friends');
        } else if (data.relatedType === 'Document') {
          nav.navigate('Main', { screen: 'Documents' });
        } else {
          nav.navigate('Notifications');
        }
      } catch {
        try { navigationRef?.current?.navigate('Notifications'); } catch {}
      }
    });

    // Re-check reminders when app comes back to foreground
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkReminders();
        useStore.getState().fetchNotifications?.();
      }
    });

    return () => {
      notifListener.current?.remove();
      responseListener.current?.remove();
      appStateSub.remove();
      registered.current = false;
    };
  }, [user]);
}

async function setupNotificationChannel() {
  if (Platform.OS !== 'android') return;
  // Channel principal — HIGH importance pentru a apărea pe lock screen + popup
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Urbio Auto',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF6B1A',
    sound: 'default',
    enableVibrate: true,
    enableLights: true,
    showBadge: true,
    bypassDnd: false,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

async function registerToken() {
  // Push tokens funcționează doar pe device real
  if (!Device.isDevice) {
    console.warn('Push notifications skipped: not a real device');
    return;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowDisplayInCarPlay: false,
        allowCriticalAlerts: false,
        provideAppNotificationSettings: false,
        allowProvisional: false,
      },
    });
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.warn('Push permissions denied by user');
    return;
  }

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    const tokenOptions = projectId ? { projectId } : undefined;
    const tokenData = await Notifications.getExpoPushTokenAsync(tokenOptions);

    if (tokenData?.data) {
      await api.post('/notifications/register-token', { token: tokenData.data });
      console.log('Push token registered:', tokenData.data.slice(0, 30) + '...');
    }
  } catch (e) {
    // Pe Expo Go Android, push-urile nu funcționează din SDK 53+
    // Pe iOS Expo Go merge fără projectId, dar limitat
    console.warn('Push token registration skipped:', e?.message);
  }
}

async function checkReminders() {
  try {
    await api.post('/notifications/check-reminders');
  } catch {
    // Silently ignore — offline or server down
  }
}

/**
 * Trigger un notificare locală pentru testare (apare imediat pe device).
 * Utilă să verificăm că permisiunile și channel-ul sunt OK.
 */
export async function sendTestLocalNotification() {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🚗 Test notificare Urbio Auto',
        body: 'Dacă vezi asta, notificările locale funcționează!',
        sound: 'default',
        data: { test: true },
      },
      trigger: { seconds: 1 },
    });
    return true;
  } catch (e) {
    console.warn('Test notification failed:', e.message);
    return false;
  }
}
