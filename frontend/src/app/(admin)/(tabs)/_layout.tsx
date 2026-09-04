import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs, router, useSegments } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { colors, shadowSoft } from '@/constants/theme';
import { useAuth } from '@/store/auth';

type IconName = ComponentProps<typeof Ionicons>['name'];

type NavItem = { route: string; label: string; icon: IconName; segment?: string };
const navItems: NavItem[] = [
  { route: '/(admin)/(tabs)', label: 'Dashboard', icon: 'grid-outline' },
  { route: '/(admin)/(tabs)/moderation', label: 'Moderasi', icon: 'shield-checkmark-outline', segment: 'moderation' },
  { route: '/(admin)/(tabs)/users', label: 'Pengguna', icon: 'people-outline', segment: 'users' },
  { route: '/(admin)/(tabs)/disputes', label: 'Sengketa', icon: 'warning-outline', segment: 'disputes' },
  { route: '/(admin)/(tabs)/complaints', label: 'Riwayat', icon: 'flag-outline', segment: 'complaints' },
  { route: '/(admin)/(tabs)/settings', label: 'Pengaturan', icon: 'settings-outline', segment: 'settings' },
];

const icon = (name: IconName) => function TabIcon({ color, size }: { color: string; size: number }) {
  return <Ionicons name={name} size={size} color={color} />;
};

function Screens({ desktop }: { desktop: boolean }) {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.muted,
      tabBarIconStyle: { marginTop: 3 },
      tabBarLabelStyle: { fontFamily: 'PoppinsMedium', fontSize: 11.5 },
      tabBarStyle: desktop ? { display: 'none' } : { height: 74, paddingTop: 7, paddingBottom: 9, borderTopColor: colors.border, backgroundColor: colors.surface },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: icon('grid-outline') }} />
      <Tabs.Screen name="moderation" options={{ title: 'Moderasi', tabBarIcon: icon('shield-checkmark-outline') }} />
      <Tabs.Screen name="users" options={{ title: 'Pengguna', tabBarIcon: icon('people-outline') }} />
      <Tabs.Screen name="disputes" options={{ title: 'Sengketa', tabBarIcon: icon('warning-outline') }} />
      <Tabs.Screen name="complaints" options={{ title: 'Riwayat', tabBarIcon: icon('flag-outline') }} />
      <Tabs.Screen name="settings" options={{ title: 'Pengaturan', tabBarIcon: icon('settings-outline') }} />
    </Tabs>
  );
}

export default function AdminTabs() {
  const desktop = useWindowDimensions().width >= 1024;
  const segments = useSegments().map(String);
  const user = useAuth(state => state.user);
  const current = navItems.find(item => item.segment && segments.includes(item.segment))?.segment;
  const initial = user?.name?.trim()?.[0]?.toUpperCase() || 'A';

  if (!desktop) return <Screens desktop={false} />;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Text style={styles.wordmark}>BMarket</Text>
          <View style={styles.consoleBadge}><Ionicons name="shield-checkmark" size={15} color={colors.white} /><Text style={styles.consoleText}>Admin Console</Text></View>
        </View>
        <View style={styles.profile}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initial}</Text></View>
          <View><Text style={styles.profileName}>{user?.name || 'Admin BMarket'}</Text><Text style={styles.profileRole}>Administrator</Text></View>
        </View>
      </View>
      <View style={styles.body}>
        <View style={styles.sidebar}>
          <View style={styles.nav}>
            {navItems.map(item => {
              const active = item.segment ? current === item.segment : !current;
              return (
                <Pressable key={item.label} onPress={() => router.replace(item.route as any)} style={({ pressed }) => [styles.navItem, active && styles.navItemActive, pressed && { opacity: .72 }]}>
                  <Ionicons name={item.icon} size={21} color={active ? colors.primary : colors.muted} />
                  <Text style={[styles.navText, active && styles.navTextActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.sidebarCard}>
            <View style={styles.sidebarCardIcon}><Ionicons name="shield-checkmark-outline" size={23} color={colors.primary} /></View>
            <Text style={styles.sidebarCardTitle}>BMarket Admin</Text>
            <Text style={styles.sidebarCardText}>Kelola marketplace dengan aman dan efisien.</Text>
          </View>
        </View>
        <View style={styles.navigator}><Screens desktop /></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceMuted },
  header: { height: 68, backgroundColor: colors.primary, paddingHorizontal: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...shadowSoft },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  wordmark: { color: colors.white, fontFamily: 'PoppinsBold', fontSize: 24, letterSpacing: -.5 },
  consoleBadge: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: 'rgba(255,255,255,.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,.12)' },
  consoleText: { color: colors.white, fontFamily: 'PoppinsSemiBold', fontSize: 12 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 39, height: 39, borderRadius: 20, backgroundColor: '#EAF3FF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primaryDark, fontFamily: 'PoppinsBold', fontSize: 14 },
  profileName: { color: colors.white, fontFamily: 'PoppinsSemiBold', fontSize: 13 },
  profileRole: { color: 'rgba(255,255,255,.72)', fontFamily: 'PoppinsRegular', fontSize: 11 },
  body: { flex: 1, flexDirection: 'row' },
  sidebar: { width: 244, paddingHorizontal: 18, paddingVertical: 24, backgroundColor: colors.surface, borderRightWidth: 1, borderRightColor: colors.border, justifyContent: 'space-between' },
  nav: { gap: 6 },
  navItem: { minHeight: 48, paddingHorizontal: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  navItemActive: { backgroundColor: colors.primarySoft },
  navText: { color: colors.textSoft, fontFamily: 'PoppinsMedium', fontSize: 13 },
  navTextActive: { color: colors.primary, fontFamily: 'PoppinsSemiBold' },
  sidebarCard: { alignItems: 'center', padding: 18, borderRadius: 14, backgroundColor: '#F3F8FF', borderWidth: 1, borderColor: '#DDEBFB' },
  sidebarCardIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  sidebarCardTitle: { color: colors.text, fontFamily: 'PoppinsSemiBold', fontSize: 13 },
  sidebarCardText: { marginTop: 3, color: colors.muted, fontFamily: 'PoppinsRegular', fontSize: 11, lineHeight: 17, textAlign: 'center' },
  navigator: { flex: 1, minWidth: 0, backgroundColor: colors.surfaceMuted },
});
