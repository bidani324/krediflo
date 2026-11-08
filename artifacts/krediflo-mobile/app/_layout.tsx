import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { setBaseUrl } from '@workspace/api-client-react';
import { AuthProvider } from '@/context/AuthContext';
import { installCookieJar } from '@/lib/cookie-jar';
import colors from '@/constants/colors';

// Expo bundles run outside the web proxy — the generated API client needs an
// absolute URL to reach the shared API server.
const API_ORIGIN = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
setBaseUrl(API_ORIGIN);
// On iOS/Android, persist the session cookie across app restarts and attach
// it to every API request (no-op on web, where the browser handles cookies).
installCookieJar(API_ORIGIN);

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

const navyHeader = {
  headerStyle: { backgroundColor: colors.light.background },
  headerTintColor: colors.light.foreground,
  headerTitleStyle: { fontFamily: 'Inter_600SemiBold' as const },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.light.background },
};

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Back', ...navyHeader }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="login"
        options={{ title: 'Sign In', presentation: 'modal' }}
      />
      <Stack.Screen
        name="register"
        options={{ title: 'Create Account', presentation: 'modal' }}
      />
      <Stack.Screen name="apply" options={{ title: 'Apply for a Loan' }} />
      <Stack.Screen name="eligibility" options={{ title: 'Eligibility Check' }} />
      <Stack.Screen name="loan/[id]" options={{ title: 'Application' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <GestureHandlerRootView>
              <KeyboardProvider>
                <StatusBar style="light" />
                <RootLayoutNav />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
