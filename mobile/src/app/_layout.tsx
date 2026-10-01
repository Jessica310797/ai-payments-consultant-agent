import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { VisitProvider } from '../lib/store';
import { C } from '../lib/theme';

export default function Layout() {
  return (
    <SafeAreaProvider>
      <VisitProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: C.teal },
            headerTintColor: '#FFFFFF',
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: C.cream },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="capture" options={{ title: 'Statement' }} />
          <Stack.Screen name="check" options={{ title: 'Check the figures' }} />
          <Stack.Screen name="results" options={{ title: 'Results' }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        </Stack>
      </VisitProvider>
    </SafeAreaProvider>
  );
}
