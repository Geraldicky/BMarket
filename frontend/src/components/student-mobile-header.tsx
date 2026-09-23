import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { endpoints } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { colors, webTransition, makeStyles } from '@/constants/theme';
import { BrandLogo } from '@/components/brand-logo';

/**
 * Mobile counterpart of StudentDesktopHeader, shared by every student page on small screens.
 * Uses the same blue background and white foreground as the desktop header.
 * `back` adds a back arrow for pages opened on top of the tabs (detail pages, notifications, etc.).
 */
export function StudentMobileHeader({ back = false }: { back?: boolean }) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const user = useAuth(state => state.user);
  const notificationCount = useQuery({ queryKey: ['notification-count'], queryFn: endpoints.notificationCount, refetchInterval: 30000 });
  const unread = notificationCount.data?.count || 0;

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(student)/(tabs)');
  };

  return (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <View style={styles.inner}>
        <View style={styles.brandRow}>
          {back ? <Pressable accessibilityRole="button" accessibilityLabel="Kembali" hitSlop={8} onPress={goBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}><Ionicons name="chevron-back" size={22} color="#FFFFFF" /></Pressable> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Beranda" onPress={() => router.replace('/(student)/(tabs)')}>
            <BrandLogo style={styles.brandLogo} />
          </Pressable>
        </View>
        <View style={styles.actions}>
          <Pressable accessibilityLabel="Buat listing" onPress={() => router.push('/(student)/listing/form')} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><Ionicons name="add" size={20} color="#FFFFFF" /></Pressable>
          <Pressable accessibilityLabel="Tersimpan" onPress={() => router.push('/(student)/saved')} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><Ionicons name="heart-outline" size={19} color="#FFFFFF" /></Pressable>
          <Pressable accessibilityLabel="Notifikasi" onPress={() => router.push('/(student)/notifications')} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <Ionicons name={unread ? 'notifications' : 'notifications-outline'} size={19} color="#FFFFFF" />
            {unread ? <View style={styles.badge}><Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text></View> : null}
          </Pressable>
          <Pressable accessibilityLabel="Profil" onPress={() => router.push('/(student)/(tabs)/profile')} style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}><Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() || 'B'}</Text></Pressable>
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  header: { backgroundColor: colors.brand, zIndex: 1000 },
  inner: { height: 60, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  backButton: { width: 36, height: 36, marginLeft: -6, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  brandLogo: { width: 118, height: 38 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { position: 'relative', width: 38, height: 38, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,.18)', backgroundColor: 'rgba(0,0,0,.08)', alignItems: 'center', justifyContent: 'center', ...webTransition },
  badge: { position: 'absolute', right: -4, top: -4, minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: 8, backgroundColor: colors.badge, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFFFFF', fontFamily: 'PoppinsBold', fontSize: 8 },
  avatar: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'PoppinsBold', fontSize: 13, color: '#0B57B7' },
  pressed: { opacity: .75 },
}));
