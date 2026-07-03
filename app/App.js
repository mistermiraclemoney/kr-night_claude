import React from 'react';
import { Text, View, ActivityIndicator } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { AppProvider, useApp } from './src/store';
import { C } from './src/theme';

import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import SocialScreen from './src/screens/SocialScreen';
import HotNowScreen from './src/screens/HotNowScreen';
import GameScreen from './src/screens/GameScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import VenueDetailScreen from './src/screens/VenueDetailScreen';
import LoungeScreen from './src/screens/LoungeScreen';
import DMScreen from './src/screens/DMScreen';
import QRPassScreen from './src/screens/QRPassScreen';
import OwnerScreen from './src/screens/OwnerScreen';
import ScannerScreen from './src/screens/ScannerScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const icons = { Home: '🌃', Social: '💬', HotNow: '🔥', Game: '🎲', Profile: '👤' };

function Tabs() {
  const { t } = useApp();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: C.card, borderTopColor: C.border },
        tabBarActiveTintColor: C.pink,
        tabBarInactiveTintColor: C.sub,
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{icons[route.name]}</Text>
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: t('tab_home') }} />
      <Tab.Screen name="Social" component={SocialScreen} options={{ title: t('tab_social') }} />
      <Tab.Screen name="HotNow" component={HotNowScreen} options={{ title: t('tab_hotnow') }} />
      <Tab.Screen name="Game" component={GameScreen} options={{ title: t('tab_game') }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: t('tab_profile') }} />
    </Tab.Navigator>
  );
}

function Root() {
  const { ready, user } = useApp();
  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 40 }}>🌃</Text>
        <ActivityIndicator color={C.pink} style={{ marginTop: 16 }} />
      </View>
    );
  }
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: C.bg },
        headerTintColor: C.text,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      {!user ? (
        <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
      ) : (
        <>
          <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
          <Stack.Screen name="VenueDetail" component={VenueDetailScreen} options={{ title: '' }} />
          <Stack.Screen name="Lounge" component={LoungeScreen} options={{ title: 'Lounge' }} />
          <Stack.Screen name="DM" component={DMScreen} options={{ title: '' }} />
          <Stack.Screen name="QRPass" component={QRPassScreen} options={{ title: 'QR Pass' }} />
          <Stack.Screen name="Owner" component={OwnerScreen} options={{ title: 'Owner' }} />
          <Stack.Screen name="Scanner" component={ScannerScreen} options={{ title: 'Scan' }} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <NavigationContainer theme={{ ...DarkTheme, colors: { ...DarkTheme.colors, background: C.bg, card: C.card, primary: C.pink } }}>
          <StatusBar style="light" />
          <Root />
        </NavigationContainer>
      </AppProvider>
    </SafeAreaProvider>
  );
}
