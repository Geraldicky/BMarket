import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { endpoints } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { colors, webTransition, makeStyles } from '@/constants/theme';
import { BrandLogo } from '@/components/brand-logo';
import { UserAvatar } from '@/components/user-avatar';

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
          <Pressable accessibilityRole="button" accessibilityLabel="Beranda" onPress={() => router.replace('/(student)/(tabs)')} style={styles.brandButton}>
            <BrandLogo style={styles.brandLogo} />
          </Pressable>
        </View>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel={unread ? `Notifikasi, ${unread} belum dibaca` : 'Notifikasi'} onPress={() => router.push('/(student)/notifications')} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <Ionicons name={unread ? 'notifications' : 'notifications-outline'} size={19} color="#FFFFFF" />
            {unread ? <View style={styles.badge}><Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text></View> : null}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Buka profil" onPress={() => router.push('/(student)/(tabs)/profile')} style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}><UserAvatar name={user?.name} avatarUrl={user?.avatarUrl} style={styles.avatar} textStyle={styles.avatarText} /></Pressable>
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  header: { backgroundColor: colors.brand, zIndex: 1000 },
  inner: { height: 60, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  backButton: { width: 44, height: 44, marginLeft: -6, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  brandButton: { minHeight: 44, justifyContent: 'center' },
  brandLogo: { width: 118, height: 38 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { position: 'relative', width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,.18)', backgroundColor: 'rgba(0,0,0,.08)', alignItems: 'center', justifyContent: 'center', ...webTransition },
  badge: { position: 'absolute', right: -4, top: -4, minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: 8, backgroundColor: colors.badge, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFFFFF', fontFamily: 'PoppinsBold', fontSize: 8 },
  avatarButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 11, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'PoppinsBold', fontSize: 13, color: '#0B57B7' },
  pressed: { opacity: .75 },
}));
