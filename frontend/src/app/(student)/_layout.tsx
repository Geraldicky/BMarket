import { Stack } from 'expo-router';
import { useWindowDimensions } from 'react-native';
import { colors } from '@/constants/theme';
import { StudentDesktopHeader } from '@/components/student-desktop-header';

export default function StudentLayout() {
  const desktop = useWindowDimensions().width >= 960;

  const mobileOptions = {
    headerTintColor: colors.text,
    headerTitleStyle: { fontFamily: 'PoppinsSemiBold' as const },
    headerShadowVisible: false,
    headerStyle: { backgroundColor: colors.background },
    contentStyle: { backgroundColor: colors.background },
  };

  const desktopOptions = {
    headerShown: true,
    header: () => <StudentDesktopHeader />,
    headerShadowVisible: false,
    animation: 'none' as const,
    contentStyle: { backgroundColor: colors.background },
  };

  const title = (text: string) => desktop ? {} : { title: text };

  return (
    <Stack screenOptions={desktop ? desktopOptions : mobileOptions}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="listing/[id]" options={title('Detail listing')} />
      <Stack.Screen name="listing/form" options={title('Kelola listing')} />
      <Stack.Screen name="transaction/[id]" options={title('Detail transaksi')} />
      <Stack.Screen name="seller/[id]" options={title('Profil seller')} />
      <Stack.Screen name="chat/[id]" options={title('Percakapan')} />
      <Stack.Screen name="profile/edit" options={title('Edit profil')} />
      <Stack.Screen name="report" options={title('Laporkan')} />
      <Stack.Screen name="saved" options={title('Tersimpan')} />
      <Stack.Screen name="notifications" options={title('Notifikasi')} />
      <Stack.Screen name="wallet" options={title('Riwayat saldo')} />
    </Stack>
  );
}
