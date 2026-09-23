import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '@/store/auth';
import { palettes, useThemeStore } from '@/constants/theme';
import { FontAssets } from '@/lib/assets';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
    mutations: { retry: 0 },
  },
});

function NavigationGate() {
  const router = useRouter();
  const segments = useSegments();
  const { user, hydrated, bootstrap } = useAuth();
  const scheme = useThemeStore(state => state.scheme);
  const hydrateTheme = useThemeStore(state => state.hydrate);
  const [fontsLoaded] = useFonts(FontAssets);
  const group = segments[0];
  const palette = palettes[scheme];

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // Load the saved Light / Dark / System preference (native storage is async).
  useEffect(() => {
    hydrateTheme();
  }, [hydrateTheme]);

  // On web, paint the page behind the app and native form controls in the active theme.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.style.colorScheme = scheme;
    document.body.style.backgroundColor = palette.background;
  }, [palette.background, scheme]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const id = 'bmarket-input-focus-reset';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      input, textarea {
        outline: none !important;
        box-shadow: none;
      }
      input:focus, input:focus-visible,
      textarea:focus, textarea:focus-visible {
        outline: none !important;
        box-shadow: none !important;
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  useEffect(() => {
    if (!hydrated || !fontsLoaded) return;

    SplashScreen.hideAsync();
    if (!user && group !== '(auth)') {
      router.replace('/(auth)/login');
    } else if (user?.role === 'ADMIN' && group !== '(admin)') {
      router.replace('/(admin)/(tabs)');
    } else if (user?.role === 'STUDENT' && group !== '(student)') {
      router.replace('/(student)/(tabs)');
    }
  }, [fontsLoaded, group, hydrated, router, user]);

  useEffect(() => {
    if (hydrated && !user) queryClient.clear();
  }, [hydrated, user]);

  const redirectPending =
    (!user && group !== '(auth)') ||
    (user?.role === 'ADMIN' && group !== '(admin)') ||
    (user?.role === 'STUDENT' && group !== '(student)');

  if (!hydrated || !fontsLoaded || redirectPending) return null;

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.background } }} />
    </>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <NavigationGate />
    </QueryClientProvider>
  );
}
