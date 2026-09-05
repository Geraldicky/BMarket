import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/constants/theme';
import { StudentDesktopHeader } from '@/components/student-desktop-header';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

const items: Record<string, { label: string; shortLabel: string; outline: IconName; filled: IconName }> = {
  index: { label: 'Beranda', shortLabel: 'Beranda', outline: 'home-outline', filled: 'home' },
  sell: { label: 'Etalase saya', shortLabel: 'Jual', outline: 'storefront-outline', filled: 'storefront' },
  transactions: { label: 'Transaksi', shortLabel: 'Transaksi', outline: 'receipt-outline', filled: 'receipt' },
  chats: { label: 'Pesan', shortLabel: 'Pesan', outline: 'chatbubble-outline', filled: 'chatbubble' },
  profile: { label: 'Profil', shortLabel: 'Profil', outline: 'person-outline', filled: 'person' },
};

function MobileTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const narrow = useWindowDimensions().width < 380;
  const open = (route: (typeof state.routes)[number], index: number) => {
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!event.defaultPrevented && state.index !== index) navigation.navigate(route.name, route.params);
  };

  return (
    <View style={[styles.mobileBar, { height: 62 + insets.bottom, paddingBottom: Math.max(insets.bottom, 6) }]}>
      {state.routes.map((route, index) => {
        const item = items[route.name];
        const active = state.index === index;
        return (
          <Pressable key={route.key} onPress={() => open(route, index)} style={styles.mobileItem}>
            <Ionicons name={active ? item.filled : item.outline} size={narrow ? 21 : 23} color={active ? colors.primary : colors.muted} />
            <Text numberOfLines={1} style={[styles.mobileLabel, narrow && styles.mobileLabelNarrow, active && styles.mobileLabelActive]}>{item.shortLabel}</Text>
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

export default function StudentTabs() {
  const desktop = useWindowDimensions().width >= 960;
  return (
    <Tabs
      tabBar={props => <AppTabBar {...props} />}
      screenOptions={{ headerShown: desktop, header: () => <StudentDesktopHeader />, sceneStyle: { backgroundColor: colors.background } }}
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
  mobileBar: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', paddingTop: 7 },
  mobileItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  mobileLabel: { fontFamily: 'PoppinsMedium', fontSize: 10.5, color: colors.muted },
  mobileLabelNarrow: { fontSize: 9.2 },
  mobileLabelActive: { color: colors.primary, fontFamily: 'PoppinsSemiBold' },
});
