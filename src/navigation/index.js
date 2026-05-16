import React from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useStore from '../store';
import { T, FONTS, useResponsive, IS_IOS } from '../theme';

export const navigationRef = createNavigationContainerRef();

// Vehicle screens
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

// Household screens
import ModeSelectorScreen from '../screens/ModeSelectorScreen';
import HouseholdHomeScreen from '../screens/HouseholdHomeScreen';
import HouseholdExpensesScreen from '../screens/HouseholdExpensesScreen';
import HouseholdIncomesScreen from '../screens/HouseholdIncomesScreen';
import HouseholdCalendarScreen from '../screens/HouseholdCalendarScreen';
import AddHouseholdScreen from '../screens/AddHouseholdScreen';
import AddHouseholdExpenseScreen from '../screens/AddHouseholdExpenseScreen';
import AddHouseholdIncomeScreen from '../screens/AddHouseholdIncomeScreen';
import AddHouseholdEventScreen from '../screens/AddHouseholdEventScreen';
import ShareHouseholdScreen from '../screens/ShareHouseholdScreen';
import CustomCategoriesScreen from '../screens/CustomCategoriesScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function TabIcon({ emoji, label, focused, size = 22, labelSize = 10 }) {
  return (
    <View style={{ alignItems: 'center', paddingTop: 4, minWidth: 56 }}>
      <Text style={{ fontSize: size, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
      <Text style={{
        fontSize: labelSize, color: focused ? T.brand : T.ink4,
        fontWeight: focused ? FONTS.semibold : FONTS.regular, marginTop: 2,
      }} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function useTabBarStyle() {
  const insets = useSafeAreaInsets();
  const { isTablet } = useResponsive();
  const tabHeight = (isTablet ? 80 : 64) + Math.max(insets.bottom, IS_IOS ? 0 : 8);
  return {
    iconSize: isTablet ? 26 : 22,
    labelSize: isTablet ? 12 : 10,
    tabBarStyle: {
      height: tabHeight,
      backgroundColor: '#fff',
      borderTopColor: T.line,
      paddingTop: 6,
      paddingBottom: Math.max(insets.bottom, IS_IOS ? 8 : 10),
    },
  };
}

function VehicleTabs() {
  const { iconSize, labelSize, tabBarStyle } = useTabBarStyle();
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarStyle, tabBarShowLabel: false }}>
      <Tab.Screen name="Home" component={HomeScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" label="Acasă" focused={focused} size={iconSize} labelSize={labelSize} /> }} />
      <Tab.Screen name="Documents" component={DocumentsScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="📁" label="Documente" focused={focused} size={iconSize} labelSize={labelSize} /> }} />
      <Tab.Screen name="Calendar" component={CalendarScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="📅" label="Calendar" focused={focused} size={iconSize} labelSize={labelSize} /> }} />
      <Tab.Screen name="Invoices" component={InvoicesScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🧾" label="Facturi" focused={focused} size={iconSize} labelSize={labelSize} /> }} />
      <Tab.Screen name="Profile" component={ProfileScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="👤" label="Profil" focused={focused} size={iconSize} labelSize={labelSize} /> }} />
    </Tab.Navigator>
  );
}

function HouseholdTabs() {
  const { iconSize, labelSize, tabBarStyle } = useTabBarStyle();
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarStyle, tabBarShowLabel: false }}>
      <Tab.Screen name="HouseholdHome" component={HouseholdHomeScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" label="Casă" focused={focused} size={iconSize} labelSize={labelSize} /> }} />
      <Tab.Screen name="HouseholdExpenses" component={HouseholdExpensesScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="💸" label="Cheltuieli" focused={focused} size={iconSize} labelSize={labelSize} /> }} />
      <Tab.Screen name="HouseholdIncomes" component={HouseholdIncomesScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="💰" label="Venituri" focused={focused} size={iconSize} labelSize={labelSize} /> }} />
      <Tab.Screen name="HouseholdCalendar" component={HouseholdCalendarScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="📅" label="Calendar" focused={focused} size={iconSize} labelSize={labelSize} /> }} />
      <Tab.Screen name="HouseholdProfile" component={ProfileScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="👤" label="Profil" focused={focused} size={iconSize} labelSize={labelSize} /> }} />
    </Tab.Navigator>
  );
}

function ModeGate() {
  const appMode = useStore(s => s.appMode);
  if (!appMode) return <ModeSelectorScreen />;
  if (appMode === 'household') return <HouseholdTabs />;
  return <VehicleTabs />;
}

export default function AppNavigator() {
  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={ModeGate} />
        {/* Vehicle */}
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
        {/* Household */}
        <Stack.Screen name="AddHousehold" component={AddHouseholdScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="EditHousehold" component={AddHouseholdScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="AddHouseholdExpense" component={AddHouseholdExpenseScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="AddHouseholdIncome" component={AddHouseholdIncomeScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="AddHouseholdEvent" component={AddHouseholdEventScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="ShareHousehold" component={ShareHouseholdScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="CustomCategories" component={CustomCategoriesScreen} options={{ presentation: 'modal' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
