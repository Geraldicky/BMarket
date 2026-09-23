import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs, router, useSegments } from 'expo-router';
import { useEffect, useState, type ComponentProps } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions, type ColorValue } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FeedbackDialog } from '@/components/ui';
import { colors, shadowSoft, webTransition, makeStyles, useColorScheme } from '@/constants/theme';
import { useAuth } from '@/store/auth';
import { BrandLogo } from '@/components/brand-logo';
import { UserAvatar } from '@/components/user-avatar';

type IconName = ComponentProps<typeof Ionicons>['name'];

type NavItem = { route: string; label: string; icon: IconName; segment?: string };
const navItems: NavItem[] = [
  { route: '/(admin)/(tabs)', label: 'Dashboard', icon: 'grid-outline' },
  { route: '/(admin)/(tabs)/products', label: 'Listing', icon: 'storefront-outline', segment: 'products' },
  { route: '/(admin)/(tabs)/moderation', label: 'Moderasi', icon: 'shield-checkmark-outline', segment: 'moderation' },
  { route: '/(admin)/(tabs)/users', label: 'Pengguna', icon: 'people-outline', segment: 'users' },
  { route: '/(admin)/(tabs)/disputes', label: 'Sengketa', icon: 'warning-outline', segment: 'disputes' },
  { route: '/(admin)/(tabs)/complaints', label: 'Riwayat', icon: 'flag-outline', segment: 'complaints' },
  { route: '/(admin)/(tabs)/settings', label: 'Pengaturan', icon: 'settings-outline', segment: 'settings' },
];

// Non-clickable Pressable areas (backdrop, menu panel) should not show the pointer cursor on web.
const defaultCursor = Platform.OS === 'web' ? ({ cursor: 'default' } as any) : {};

const SIDEBAR_WIDTH = 244;
const DRAWER_WIDTH = 264;

type TabBarIconProps = { focused: boolean; color: ColorValue; size: number };

const icon = (name: IconName) => function TabIcon({ color, size }: TabBarIconProps) {
  return <Ionicons name={name} size={size} color={color as string} />;
};

function Screens() {
  useColorScheme();
  return (
    <Tabs tabBar={() => null} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.surfaceMuted } }}>
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: icon('grid-outline') }} />
      <Tabs.Screen name="products" options={{ title: 'Listing', tabBarIcon: icon('storefront-outline') }} />
      <Tabs.Screen name="moderation" options={{ title: 'Moderasi', tabBarIcon: icon('shield-checkmark-outline') }} />
      <Tabs.Screen name="users" options={{ title: 'Pengguna', tabBarIcon: icon('people-outline') }} />
      <Tabs.Screen name="disputes" options={{ title: 'Sengketa', tabBarIcon: icon('warning-outline') }} />
      <Tabs.Screen name="complaints" options={{ title: 'Riwayat', tabBarIcon: icon('flag-outline') }} />
      <Tabs.Screen name="settings" options={{ title: 'Pengaturan', tabBarIcon: icon('settings-outline') }} />
    </Tabs>
  );
}

export default function AdminTabs() {
  const styles = useStyles();
  const width = useWindowDimensions().width;
  const desktop = width >= 1024;
  const mobile = width < 600;
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(desktop);
  // Sidebar starts open on desktop, closed (as a drawer) on smaller screens; re-sync when crossing the breakpoint.
  const [wasDesktop, setWasDesktop] = useState(desktop);
  if (wasDesktop !== desktop) {
    setWasDesktop(desktop);
    setOpen(desktop);
  }
  const segments = useSegments().map(String);
  const user = useAuth(state => state.user);
  const logout = useAuth(state => state.logout);
  const [profileOpen, setProfileOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const current = navItems.find(item => item.segment && segments.includes(item.segment))?.segment;

  const progress = useSharedValue(desktop ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(open ? 1 : 0, { duration: 260, easing: Easing.out(Easing.cubic) });
  }, [open, progress]);

  const inlineStyle = useAnimatedStyle(() => ({ width: progress.value * SIDEBAR_WIDTH, opacity: interpolate(progress.value, [0, .4, 1], [0, .6, 1]) }));
  const drawerStyle = useAnimatedStyle(() => ({ transform: [{ translateX: (progress.value - 1) * (DRAWER_WIDTH + 24) }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  const go = (item: NavItem) => {
    router.replace(item.route as any);
    if (!desktop) setOpen(false);
  };

  const sidebar = (
    <View style={[styles.sidebar, !desktop && styles.sidebarDrawer, !desktop && { paddingBottom: Math.max(insets.bottom, 24) }]}>
      <View style={styles.nav}>
        {navItems.map(item => {
          const active = item.segment ? current === item.segment : !current;
          return (
            <Pressable key={item.label} accessibilityRole="button" onPress={() => go(item)} style={({ pressed }) => [styles.navItem, active && styles.navItemActive, pressed && { opacity: .72 }]}>
              <Ionicons name={item.icon} size={21} color={active ? colors.primary : colors.muted} />
              <Text style={[styles.navText, active && styles.navTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <View style={[styles.header, mobile && styles.headerMobile, { paddingTop: insets.top, height: (mobile ? 60 : 68) + insets.top }]}>
        <View style={styles.brandRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={open ? 'Tutup menu' : 'Buka menu'}
            hitSlop={6}
            onPress={() => setOpen(value => !value)}
            style={({ pressed }) => [styles.burger, pressed && { opacity: .7 }]}
          >
            <Ionicons name={open && !desktop ? 'close' : 'menu'} size={24} color={colors.white} />
          </Pressable>
          <BrandLogo style={[styles.wordmark, mobile && styles.wordmarkMobile]} />
          {!mobile ? <View style={styles.consoleBadge}><Ionicons name="shield-checkmark" size={15} color={colors.white} /><Text style={styles.consoleText}>Admin Console</Text></View> : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Profil akun" onPress={() => setProfileOpen(true)} style={({ pressed }) => [styles.profile, pressed && { opacity: .75 }]}>
          <UserAvatar name={user?.name} avatarUrl={user?.avatarUrl} style={styles.avatar} textStyle={styles.avatarText} />
          {!mobile ? <View><Text style={styles.profileName}>{user?.name || 'Admin BMarket'}</Text><Text style={styles.profileRole}>Administrator</Text></View> : null}
          <Ionicons name={profileOpen ? 'chevron-up' : 'chevron-down'} size={16} color="rgba(255,255,255,.85)" />
        </Pressable>
      </View>
      <Modal visible={profileOpen} transparent animationType="fade" onRequestClose={() => setProfileOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setProfileOpen(false)}>
          <Pressable onPress={() => {}} style={[styles.menu, { top: (mobile ? 60 : 68) + insets.top + 6, right: mobile ? 12 : 20 }]}>
            <View style={styles.menuAccount}>
              <UserAvatar name={user?.name} avatarUrl={user?.avatarUrl} style={styles.menuAvatar} textStyle={styles.menuAvatarText} />
              <View style={styles.menuCopy}>
                <Text numberOfLines={1} style={styles.menuName}>{user?.name || 'Admin BMarket'}</Text>
                <Text numberOfLines={1} style={styles.menuEmail}>{user?.email || 'Akun administrator'}</Text>
                <View style={styles.menuRole}><Ionicons name="shield-checkmark" size={12} color={colors.primary} /><Text style={styles.menuRoleText}>Administrator</Text></View>
              </View>
            </View>
            <View style={styles.menuDivider} />
            <Text style={styles.menuHelp}>Keluar hanya mengakhiri sesi pada perangkat ini.</Text>
            <Pressable onPress={() => { setProfileOpen(false); setLogoutOpen(true); }} style={({ pressed }) => [styles.logout, pressed && { opacity: .65 }]}>
              <Ionicons name="log-out-outline" size={18} color={colors.danger} />
              <Text style={styles.logoutText}>Keluar dari admin</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
      <FeedbackDialog visible={logoutOpen} tone="warning" title="Keluar dari admin?" message="Sesi admin di perangkat ini akan diakhiri. Kamu perlu login kembali untuk mengakses dashboard admin." primaryLabel="Keluar" secondaryLabel="Batal" onClose={() => setLogoutOpen(false)} onSecondary={() => setLogoutOpen(false)} onPrimary={() => { setLogoutOpen(false); logout(); }} />
      <View style={styles.body}>
        {desktop ? <Animated.View style={[styles.sidebarInline, inlineStyle]}>{sidebar}</Animated.View> : null}
        <View style={styles.navigator}><Screens /></View>
        {!desktop ? (
          <View style={StyleSheet.absoluteFill} pointerEvents={open ? 'auto' : 'none'}>
            <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
              <Pressable accessibilityLabel="Tutup menu" onPress={() => setOpen(false)} style={StyleSheet.absoluteFill} />
            </Animated.View>
            <Animated.View style={[styles.drawer, drawerStyle]}>{sidebar}</Animated.View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  root: { flex: 1, backgroundColor: colors.surfaceMuted },
  header: { backgroundColor: colors.brand, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 10, ...shadowSoft },
  headerMobile: { paddingHorizontal: 12 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  burger: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.12)', ...webTransition },
  wordmark: { width: 146, height: 46 },
  wordmarkMobile: { width: 116, height: 38 },
  consoleBadge: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: 'rgba(255,255,255,.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,.12)' },
  consoleText: { color: colors.white, fontFamily: 'PoppinsSemiBold', fontSize: 12 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4, paddingLeft: 4, paddingRight: 8, borderRadius: 12, ...webTransition },
  menuBackdrop: { flex: 1, ...defaultCursor },
  menu: { ...defaultCursor, position: 'absolute', width: 300, maxWidth: '92%', padding: 16, gap: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, shadowColor: '#071727', shadowOpacity: .18, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  menuAccount: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuAvatar: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  menuAvatarText: { color: colors.primary, fontFamily: 'PoppinsBold', fontSize: 17 },
  menuCopy: { flex: 1, gap: 1 },
  menuName: { color: colors.text, fontFamily: 'PoppinsSemiBold', fontSize: 15 },
  menuEmail: { color: colors.muted, fontFamily: 'PoppinsRegular', fontSize: 12.5 },
  menuRole: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  menuRoleText: { color: colors.primary, fontFamily: 'PoppinsSemiBold', fontSize: 11.5 },
  menuDivider: { height: 1, backgroundColor: colors.border },
  menuHelp: { color: colors.muted, fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 18 },
  logout: { minHeight: 44, paddingHorizontal: 14, borderRadius: 11, borderWidth: 1, borderColor: colors.dangerBorder, backgroundColor: colors.dangerSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  logoutText: { color: colors.danger, fontFamily: 'PoppinsSemiBold', fontSize: 13 },
  avatar: { width: 39, height: 39, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primaryDark, fontFamily: 'PoppinsBold', fontSize: 14 },
  profileName: { color: colors.white, fontFamily: 'PoppinsSemiBold', fontSize: 13 },
  profileRole: { color: 'rgba(255,255,255,.72)', fontFamily: 'PoppinsRegular', fontSize: 11 },
  body: { flex: 1, flexDirection: 'row' },
  sidebar: { flex: 1, width: SIDEBAR_WIDTH, paddingHorizontal: 18, paddingVertical: 24, backgroundColor: colors.surface, borderRightWidth: 1, borderRightColor: colors.border },
  sidebarInline: { overflow: 'hidden' },
  sidebarDrawer: { width: '100%' },
  drawer: { position: 'absolute', top: 0, bottom: 0, left: 0, width: DRAWER_WIDTH, maxWidth: '82%', ...shadowSoft },
  backdrop: { backgroundColor: colors.overlay },
  nav: { gap: 8 },
  navItem: { minHeight: 50, paddingHorizontal: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  navItemActive: { backgroundColor: colors.primarySoft },
  navText: { color: colors.textSoft, fontFamily: 'PoppinsMedium', fontSize: 13 },
  navTextActive: { color: colors.primary, fontFamily: 'PoppinsSemiBold' },
  navigator: { flex: 1, minWidth: 0, backgroundColor: colors.surfaceMuted },
}));
