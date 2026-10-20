import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../lib/auth';
import { DataProvider } from '../lib/data';
import { VisitProvider } from '../lib/store';
import { C, F } from '../lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function Layout() {
  const [loaded, error] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  // If the fonts fail to load, carry on with the system font rather than blocking the app.
  if (!loaded && !error) return null;
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <DataProvider>
          <VisitProvider>
            <StatusBar style="dark" />
            <Routes />
          </VisitProvider>
        </DataProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

/** Signed-out users only see the login and invite screens; signed-in users only see the app. */
function Routes() {
  const { status } = useAuth();
  useEffect(() => {
    if (status !== 'checking') SplashScreen.hideAsync().catch(() => undefined);
  }, [status]);
  if (status === 'checking') return null;
  const signedIn = status === 'signedIn';
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: C.bg },
        headerShadowVisible: false,
        headerTintColor: C.brand,
        headerTitleStyle: { fontFamily: F.semibold, color: C.ink },
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: C.bg },
      }}
    >
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Home' }} />
        <Stack.Screen name="costs" options={{ title: 'Payment costs' }} />
        <Stack.Screen name="drivers" options={{ title: 'Cost drivers' }} />
        <Stack.Screen name="finding/[id]" options={{ title: 'Finding' }} />
        <Stack.Screen name="change/[id]" options={{ title: 'Change' }} />
        <Stack.Screen name="actions" options={{ title: 'Recommended actions' }} />
        <Stack.Screen name="action/[id]" options={{ title: 'Action' }} />
        <Stack.Screen name="upload" options={{ title: 'Upload data' }} />
        <Stack.Screen name="statements" options={{ title: 'Statement checks' }} />
        <Stack.Screen name="search" options={{ title: 'Search' }} />
        <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
        <Stack.Screen name="account" options={{ title: 'Account' }} />
        <Stack.Screen name="capture" options={{ title: 'Statement' }} />
        <Stack.Screen name="check" options={{ title: 'Check the figures' }} />
        <Stack.Screen name="results" options={{ title: '1 October impact' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack.Protected>
    </Stack>
  );
}
