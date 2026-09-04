import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '@/store/auth';

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
  const [fontsLoaded] = useFonts({
    PoppinsRegular: require('../../assets/fonts/Poppins-Regular.ttf'),
    PoppinsMedium: require('../../assets/fonts/Poppins-Medium.ttf'),
    PoppinsSemiBold: require('../../assets/fonts/Poppins-SemiBold.ttf'),
    PoppinsBold: require('../../assets/fonts/Poppins-Bold.ttf'),
  });
  const group = segments[0];

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

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
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
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
