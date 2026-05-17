import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  View,
  KeyboardAvoidingView,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AppNavigator, { navigationRef } from './src/navigation';
import AuthScreen from './src/screens/AuthScreen';
import useStore from './src/store';
import NetworkBadge from './src/components/NetworkBadge';
import { useNetworkMonitor } from './src/hooks/useNetwork';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import { loadApiUrl } from './src/api/client';
import { T } from './src/theme';
import {
  useFonts as usePlusJakarta,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  BricolageGrotesque_500Medium,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
} from '@expo-google-fonts/bricolage-grotesque';

function AppContent() {
  const { user, restoreAuth } = useStore();
  const [loading, setLoading] = useState(true);
  useNetworkMonitor();
  usePushNotifications(navigationRef);

  const [fontsLoaded] = usePlusJakarta({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    BricolageGrotesque_500Medium,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
  });

  useEffect(() => {
    loadApiUrl().then(() => restoreAuth()).finally(() => setLoading(false));
  }, []);

  if (loading || !fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: T.bg }}>
        <ActivityIndicator size="large" color={T.brand} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      enabled={Platform.OS === 'ios'}
    >
      <StatusBar style="dark" backgroundColor={T.brand} translucent={Platform.OS === 'android'} />
      {user ? <AppNavigator /> : <AuthScreen />}
      <NetworkBadge />
    </KeyboardAvoidingView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}
