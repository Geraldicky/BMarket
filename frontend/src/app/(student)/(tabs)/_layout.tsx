import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, shadowSoft, webTransition, makeStyles, useColorScheme } from '@/constants/theme';
import { StudentDesktopHeader } from '@/components/student-desktop-header';
import { StudentMobileHeader } from '@/components/student-mobile-header';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

const items: Record<string, { label: string; shortLabel: string; outline: IconName; filled: IconName }> = {
  index: { label: 'Beranda', shortLabel: 'Beranda', outline: 'home-outline', filled: 'home' },
  search: { label: 'Cari listing', shortLabel: 'Cari', outline: 'search-outline', filled: 'search' },
  sell: { label: 'Etalase saya', shortLabel: 'Jual', outline: 'storefront-outline', filled: 'storefront' },
  transactions: { label: 'Transaksi', shortLabel: 'Transaksi', outline: 'receipt-outline', filled: 'receipt' },
  chats: { label: 'Pesan', shortLabel: 'Pesan', outline: 'chatbubble-outline', filled: 'chatbubble' },
  profile: { label: 'Profil', shortLabel: 'Profil', outline: 'person-outline', filled: 'person' },
};

function MobileTabBar({ state, navigation }: TabBarProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const narrow = useWindowDimensions().width < 380;
  const open = (route: (typeof state.routes)[number], index: number) => {
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!event.defaultPrevented && state.index !== index) navigation.navigate(route.name, route.params);
  };

  return (
    <View style={[styles.mobileDock, { paddingBottom: Math.max(insets.bottom, 12) }]}>
    <View style={styles.mobileBar}>
      {state.routes.map((route, index) => {
        const item = items[route.name];
        const active = state.index === index;
        return (
          <Pressable key={route.key} accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{ selected: active }} onPress={() => open(route, index)} style={({ pressed }) => [styles.mobileItem, pressed && styles.mobileItemPressed]}>
            <View style={[styles.iconShell, active && styles.iconShellActive]}>
              <Ionicons name={active ? item.filled : item.outline} size={narrow ? 20 : 22} color={active ? colors.primary : colors.muted} />
            </View>
            <Text numberOfLines={1} style={[styles.mobileLabel, narrow && styles.mobileLabelNarrow, active && styles.mobileLabelActive]}>{item.shortLabel}</Text>
          </Pressable>
        );
      })}
    </View>
    </View>
  );
}

function AppTabBar(props: TabBarProps) {
  const desktop = useWindowDimensions().width >= 960;
  return desktop ? null : <MobileTabBar {...props} />;
}

export default function StudentTabs() {
  useColorScheme();
  const desktop = useWindowDimensions().width >= 960;
  return (
    <Tabs
      // "history" makes back from a tab return to the tab the user came from, not always Beranda.
      backBehavior="history"
      tabBar={props => <AppTabBar {...props} />}
      screenOptions={{ headerShown: true, header: () => desktop ? <StudentDesktopHeader /> : <StudentMobileHeader />, sceneStyle: { backgroundColor: colors.background } }}
    >
      <Tabs.Screen name="index" options={{ title: 'Beranda' }} />
      <Tabs.Screen name="search" options={{ title: 'Cari listing' }} />
      <Tabs.Screen name="sell" options={{ title: 'Etalase saya' }} />
      <Tabs.Screen name="transactions" options={{ title: 'Transaksi' }} />
      <Tabs.Screen name="chats" options={{ title: 'Pesan' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
    </Tabs>
  );
}

const useStyles = makeStyles(() => ({
  mobileDock: { paddingHorizontal: 12, paddingTop: 8, backgroundColor: colors.background },
  mobileBar: { height: 64, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, ...shadowSoft },
  mobileItem: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: 14, ...webTransition },
  mobileItemPressed: { opacity: .72, transform: [{ scale: .96 }] },
  iconShell: { width: 38, height: 29, borderRadius: 10, alignItems: 'center', justifyContent: 'center', ...webTransition },
  iconShellActive: { backgroundColor: colors.primarySoft, transform: [{ translateY: -1 }] },
  mobileLabel: { fontFamily: 'PoppinsMedium', fontSize: 10.25, color: colors.muted },
  mobileLabelNarrow: { fontSize: 9 },
  mobileLabelActive: { color: colors.primary, fontFamily: 'PoppinsSemiBold' },
}));
