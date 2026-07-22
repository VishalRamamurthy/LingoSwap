import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { HistoryProvider } from "@/contexts/HistoryContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { setBaseUrl } from "@workspace/api-client-react";

// Bootstrap i18n before anything renders. This import is a side-effect that
// calls i18n.init() synchronously using the device locale as the initial language.
import i18n, { LANG_STORAGE_KEY } from "@/lib/i18n";

const apiBaseUrl = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

// Store the base URL so AuthContext can reach it without importing the
// generated client (auth calls need to capture the session token from body).
(globalThis as unknown as { __apiBaseUrl: string }).__apiBaseUrl = apiBaseUrl;

// Set base URL for API calls through the generated client.
setBaseUrl(apiBaseUrl);

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

// ─── Auth guard ─────────────────────────────────────────────────────────────
function AuthGate({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (state.status === "loading") return;

    const inAuthGroup = segments[0] === "(auth)";

    if (state.status === "unauthenticated" && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (state.status === "authenticated" && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [state.status, segments, router]);

  return <>{children}</>;
}

// ─── Navigation ─────────────────────────────────────────────────────────────
function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />
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

  // Restore persisted UI language on first mount. i18n was already
  // initialised with the device locale; this overrides with the user's choice.
  useEffect(() => {
    AsyncStorage.getItem(LANG_STORAGE_KEY).then((stored) => {
      if (stored && stored !== i18n.language) {
        i18n.changeLanguage(stored).catch(() => {});
      }
    });
  }, []);

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
            <HistoryProvider>
              <GestureHandlerRootView>
                <KeyboardProvider>
                  <AuthGate>
                    <RootLayoutNav />
                  </AuthGate>
                </KeyboardProvider>
              </GestureHandlerRootView>
            </HistoryProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
