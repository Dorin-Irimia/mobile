import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import api from '../api/client';
import useStore from '../store';

// Show notifications when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
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

    // Navigate to Notifications screen when user taps a push
    responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {
      try { navigationRef?.current?.navigate('Notifications'); } catch {}
    });

    return () => {
      notifListener.current?.remove();
      responseListener.current?.remove();
      registered.current = false;
    };
  }, [user]);
}

async function setupNotificationChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Urbio Auto',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#3B82F6',
    sound: 'default',
  });
}

async function registerToken() {
  // Push tokens only work on real devices
  if (!Device.isDevice) return;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;

  try {
    // projectId comes from app.json / EAS config
    const { default: Constants } = await import('expo-constants');
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );

    if (tokenData?.data) {
      await api.post('/notifications/register-token', { token: tokenData.data });
    }
  } catch (e) {
    // Non-fatal: app works fine without push tokens
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
