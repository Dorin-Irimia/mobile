import React from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text, View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, FONTS, useResponsive, IS_IOS } from '../theme';

import HomeScreen from '../screens/HomeScreen';
import VehicleDetailScreen from '../screens/VehicleDetailScreen';
import AddVehicleScreen from '../screens/AddVehicleScreen';
import EditVehicleScreen from '../screens/EditVehicleScreen';
import DocumentsScreen from '../screens/DocumentsScreen';
import SignatureScreen from '../screens/SignatureScreen';
import CalendarScreen from '../screens/CalendarScreen';
import AddReminderScreen from '../screens/AddReminderScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import InvoicesScreen from '../screens/InvoicesScreen';
import AddInvoiceScreen from '../screens/AddInvoiceScreen';
import FuelLogScreen from '../screens/FuelLogScreen';
import AddFuelScreen from '../screens/AddFuelScreen';
import ServicesScreen from '../screens/ServicesScreen';
import AIChatScreen from '../screens/AIChatScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SearchScreen from '../screens/SearchScreen';
import CameraScreen from '../screens/CameraScreen';
import ServerConfigScreen from '../screens/ServerConfigScreen';
import FriendsScreen from '../screens/FriendsScreen';
import ShareVehicleScreen from '../screens/ShareVehicleScreen';
import EditInvoiceScreen from '../screens/EditInvoiceScreen';
import EditFuelScreen from '../screens/EditFuelScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function TabIcon({ emoji, label, focused, size = 22, labelSize = 10 }) {
  return (
    <View style={{ alignItems: 'center', paddingTop: 4, minWidth: 56 }}>
      <Text style={{ fontSize: size, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
      <Text
        style={{
          fontSize: labelSize,
          color: focused ? T.brand : T.ink4,
          fontWeight: focused ? FONTS.semibold : FONTS.regular,
          marginTop: 2,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

function MainTabs() {
  const insets = useSafeAreaInsets();
  const { isTablet } = useResponsive();
  const iconSize = isTablet ? 26 : 22;
  const labelSize = isTablet ? 12 : 10;
  const tabHeight = (isTablet ? 80 : 64) + Math.max(insets.bottom, IS_IOS ? 0 : 8);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: tabHeight,
          backgroundColor: '#fff',
          borderTopColor: T.line,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, IS_IOS ? 8 : 10),
        },
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" label="Acasă" focused={focused} size={iconSize} labelSize={labelSize} /> }}
      />
      <Tab.Screen
        name="Documents"
        component={DocumentsScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="📁" label="Documente" focused={focused} size={iconSize} labelSize={labelSize} /> }}
      />
      <Tab.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="📅" label="Calendar" focused={focused} size={iconSize} labelSize={labelSize} /> }}
      />
      <Tab.Screen
        name="Invoices"
        component={InvoicesScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🧾" label="Facturi" focused={focused} size={iconSize} labelSize={labelSize} /> }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="👤" label="Profil" focused={focused} size={iconSize} labelSize={labelSize} /> }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="VehicleDetail" component={VehicleDetailScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="AddVehicle" component={AddVehicleScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="EditVehicle" component={EditVehicleScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="DocumentsStack" component={DocumentsScreen} />
        <Stack.Screen name="InvoicesStack" component={InvoicesScreen} />
        <Stack.Screen name="FuelLogStack" component={FuelLogScreen} />
        <Stack.Screen name="Signature" component={SignatureScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="AddReminder" component={AddReminderScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="AddInvoice" component={AddInvoiceScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="FuelLog" component={FuelLogScreen} />
        <Stack.Screen name="AddFuel" component={AddFuelScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Services" component={ServicesScreen} />
        <Stack.Screen name="AIChat" component={AIChatScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Search" component={SearchScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Camera" component={CameraScreen} options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="ServerConfig" component={ServerConfigScreen} />
        <Stack.Screen name="Friends" component={FriendsScreen} />
        <Stack.Screen name="ShareVehicle" component={ShareVehicleScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="EditInvoice" component={EditInvoiceScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="EditFuel" component={EditFuelScreen} options={{ presentation: 'modal' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
