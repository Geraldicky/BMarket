import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Tabs, usePathname } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { colors } from '@/constants/theme';
import { useAuth } from '@/store/auth';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

const items: Record<string, { label: string; shortLabel: string; outline: IconName; filled: IconName; href: string }> = {
  index: { label: 'Beranda', shortLabel: 'Beranda', outline: 'home-outline', filled: 'home', href: '/(student)/(tabs)' },
  sell: { label: 'Etalase saya', shortLabel: 'Jual', outline: 'storefront-outline', filled: 'storefront', href: '/(student)/(tabs)/sell' },
  transactions: { label: 'Transaksi', shortLabel: 'Transaksi', outline: 'receipt-outline', filled: 'receipt', href: '/(student)/(tabs)/transactions' },
  chats: { label: 'Pesan', shortLabel: 'Pesan', outline: 'chatbubble-outline', filled: 'chatbubble', href: '/(student)/(tabs)/chats' },
  profile: { label: 'Profil', shortLabel: 'Profil', outline: 'person-outline', filled: 'person', href: '/(student)/(tabs)/profile' },
};

function MobileTabBar({ state, navigation }: TabBarProps) {
  const open = (route: (typeof state.routes)[number], index: number) => {
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!event.defaultPrevented && state.index !== index) navigation.navigate(route.name, route.params);
  };

  return (
    <View style={styles.mobileBar}>
      {state.routes.map((route, index) => {
        const item = items[route.name];
        const active = state.index === index;
        return (
          <Pressable key={route.key} onPress={() => open(route, index)} style={styles.mobileItem}>
            <Ionicons name={active ? item.filled : item.outline} size={24} color={active ? colors.primary : colors.muted} />
            <Text style={[styles.mobileLabel, active && styles.mobileLabelActive]}>{item.shortLabel}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function AppTabBar(props: TabBarProps) {
  const desktop = useWindowDimensions().width >= 960;
  return desktop ? null : <MobileTabBar {...props} />;
}

function DesktopHeader() {
  const pathname = usePathname();
  const user = useAuth(state => state.user);
  const { width } = useWindowDimensions();
  const compactDesktop = width < 1180;
  const navItems = Object.entries(items);

  const isActive = (name: string) => {
    if (name === 'index') return pathname === '/' || pathname === '';
    return pathname.includes(`/${name}`);
  };

  return (
    <View style={styles.header}>
      <View style={[styles.headerMain, compactDesktop && styles.headerMainCompact]}>
        <Pressable onPress={() => router.replace('/(student)/(tabs)')} style={[styles.brand, compactDesktop && styles.brandCompact]}>
          <Image source={require('../../../../assets/images/bmarket-icon.png')} style={styles.logo} />
          <View>
            <Text style={styles.brandName}>BMarket</Text>
            <Text style={styles.brandCaption}>BINUS MARKETPLACE</Text>
          </View>
        </Pressable>

        <Pressable onPress={() => router.replace('/(student)/(tabs)')} style={styles.search}>
          <Ionicons name="search-outline" size={19} color={colors.muted} />
          <Text numberOfLines={1} style={styles.searchText}>{compactDesktop ? 'Cari kebutuhan kampus' : 'Cari barang, jasa, atau kebutuhan kampus'}</Text>
          <View style={styles.shortcut}><Text style={styles.shortcutText}>Ctrl K</Text></View>
        </Pressable>

        <View style={styles.headerActions}>
          <Pressable onPress={() => router.push('/(student)/listing/form')} style={styles.sellButton}>
            <Ionicons name="add" size={18} color={colors.white} />
            <Text style={styles.sellButtonText}>{compactDesktop ? 'Jual' : 'Buat listing'}</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/(student)/(tabs)/chats')} style={styles.iconButton}>
            <Ionicons name="chatbubble-ellipses-outline" size={19} color={colors.textSoft} />
          </Pressable>
          <Pressable style={styles.iconButton}>
            <Ionicons name="notifications-outline" size={20} color={colors.textSoft} />
            <View style={styles.dot} />
          </Pressable>
          <Pressable onPress={() => router.push('/(student)/(tabs)/profile')} style={styles.profile}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() || 'B'}</Text></View>
            {!compactDesktop ? <View style={styles.profileCopy}>
              <Text numberOfLines={1} style={styles.name}>{user?.name || 'Binusian'}</Text>
              <Text style={styles.verified}>Terverifikasi</Text>
            </View> : null}
            <Ionicons name="chevron-down" size={13} color={colors.muted} />
          </Pressable>
        </View>
      </View>

      <View style={styles.navBar}>
        <View style={[styles.navInner, compactDesktop && styles.navInnerCompact]}>
          {navItems.map(([name, item]) => {
            const active = isActive(name);
            return (
              <Pressable key={name} onPress={() => router.push(item.href as never)} style={[styles.navItem, active && styles.navItemActive]}>
                <Ionicons name={active ? item.filled : item.outline} size={18} color={active ? colors.primary : colors.textSoft} />
                <Text style={[styles.navText, active && styles.navTextActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
          <View style={styles.navSpacer} />
          {!compactDesktop ? <View style={styles.communityBadge}>
            <Ionicons name="shield-checkmark-outline" size={15} color={colors.success} />
            <Text style={styles.communityText}>Khusus komunitas BINUS</Text>
          </View> : null}
        </View>
      </View>
    </View>
  );
}

export default function StudentTabs() {
  const desktop = useWindowDimensions().width >= 960;
  return (
    <Tabs
      tabBar={props => <AppTabBar {...props} />}
      screenOptions={{
        headerShown: desktop,
        header: () => <DesktopHeader />,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Beranda' }} />
      <Tabs.Screen name="sell" options={{ title: 'Etalase saya' }} />
      <Tabs.Screen name="transactions" options={{ title: 'Transaksi' }} />
      <Tabs.Screen name="chats" options={{ title: 'Pesan' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerMain: { width: '100%', maxWidth: 1440, height: 78, alignSelf: 'center', paddingHorizontal: 32, flexDirection: 'row', alignItems: 'center', gap: 26 },
  headerMainCompact: { paddingHorizontal: 20, gap: 16 },
  brand: { width: 205, flexDirection: 'row', alignItems: 'center', gap: 11 },
  brandCompact: { width: 158 },
  logo: { width: 43, height: 43, resizeMode: 'contain' },
  brandName: { fontFamily: 'PoppinsBold', fontSize: 20, lineHeight: 24, color: colors.text },
  brandCaption: { fontFamily: 'PoppinsSemiBold', fontSize: 10, letterSpacing: .65, color: colors.muted },
  search: { minWidth: 210, maxWidth: 680, flex: 1, height: 48, borderRadius: 11, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceMuted, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchText: { flex: 1, fontFamily: 'PoppinsRegular', fontSize: 13, color: colors.muted },
  shortcut: { borderRadius: 5, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 7, paddingVertical: 3 },
  shortcutText: { fontFamily: 'PoppinsMedium', fontSize: 10, color: colors.muted },
  headerActions: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 10 },
  sellButton: { height: 44, borderRadius: 10, paddingHorizontal: 16, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', gap: 7 },
  sellButtonText: { fontFamily: 'PoppinsSemiBold', fontSize: 12, color: colors.white },
  iconButton: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', right: 7, top: 7, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.danger },
  profile: { maxWidth: 180, flexDirection: 'row', alignItems: 'center', gap: 9, paddingLeft: 2 },
  avatar: { width: 40, height: 40, borderRadius: 11, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'PoppinsBold', fontSize: 14, color: colors.primary },
  profileCopy: { maxWidth: 98 },
  name: { fontFamily: 'PoppinsSemiBold', fontSize: 12, color: colors.text },
  verified: { fontFamily: 'PoppinsRegular', fontSize: 10, color: colors.success },
  navBar: { height: 50, borderTopWidth: 1, borderTopColor: '#EEF2F5' },
  navInner: { width: '100%', maxWidth: 1440, height: '100%', alignSelf: 'center', paddingHorizontal: 32, flexDirection: 'row', alignItems: 'center', gap: 5 },
  navInnerCompact: { paddingHorizontal: 20 },
  navItem: { height: 50, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  navItemActive: { borderBottomColor: colors.primary },
  navText: { fontFamily: 'PoppinsMedium', fontSize: 12, color: colors.textSoft },
  navTextActive: { fontFamily: 'PoppinsSemiBold', color: colors.primary },
  navSpacer: { flex: 1 },
  communityBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  communityText: { fontFamily: 'PoppinsMedium', fontSize: 11, color: colors.textSoft },
  mobileBar: { height: 78, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', paddingBottom: 9, paddingTop: 8 },
  mobileItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  mobileLabel: { fontFamily: 'PoppinsMedium', fontSize: 11, color: colors.muted },
  mobileLabelActive: { color: colors.primary, fontFamily: 'PoppinsSemiBold' },
});
