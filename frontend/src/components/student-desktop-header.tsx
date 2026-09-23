import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { router, usePathname } from 'expo-router';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { endpoints } from '@/lib/api';
import { FeedbackDialog, money } from '@/components/ui';
import { useAuth } from '@/store/auth';
import { colors, webTransition, makeStyles } from '@/constants/theme';
import { BrandLogo } from '@/components/brand-logo';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// Searching and filtering live on the "Cari listing" tab, so the header has no search box.
// Pesan and Profil are reached from the chat icon and profile avatar in the header, not the navbar.
const navItems: Record<string, { label: string; outline: IconName; filled: IconName; href: string }> = {
  index: { label: 'Beranda', outline: 'home-outline', filled: 'home', href: '/(student)/(tabs)' },
  search: { label: 'Cari listing', outline: 'search-outline', filled: 'search', href: '/(student)/(tabs)/search' },
  sell: { label: 'Etalase saya', outline: 'storefront-outline', filled: 'storefront', href: '/(student)/(tabs)/sell' },
  transactions: { label: 'Transaksi', outline: 'receipt-outline', filled: 'receipt', href: '/(student)/(tabs)/transactions' },
};

function MenuRow({ icon, label, badge, onPress, danger }: { icon: IconName; label: string; badge?: string | number; onPress: () => void; danger?: boolean }) {
  const styles = useStyles();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}>
      <Ionicons name={icon} size={19} color={danger ? colors.heart : colors.textSoft} />
      <Text style={[styles.menuRowText, danger && styles.menuRowDanger]}>{label}</Text>
      {badge !== undefined ? <View style={styles.menuBadge}><Text style={styles.menuBadgeText}>{badge}</Text></View> : null}
      <Ionicons name="chevron-forward" size={14} color={colors.muted} />
    </Pressable>
  );
}

export function StudentDesktopHeader() {
  const styles = useStyles();
  const pathname = usePathname();
  const user = useAuth(state => state.user);
  const logout = useAuth(state => state.logout);
  const { width } = useWindowDimensions();
  const compactDesktop = width < 1180;
  const notificationCount = useQuery({ queryKey: ['notification-count'], queryFn: endpoints.notificationCount, refetchInterval: 30000 });
  const unread = notificationCount.data?.count || 0;
  const [profileOpen, setProfileOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const balance = useQuery({ queryKey: ['header-balance'], queryFn: endpoints.balance, enabled: profileOpen, staleTime: 30000 });
  const buyerTransactions = useQuery({ queryKey: ['header-buyer-transactions'], queryFn: () => endpoints.transactions('buyer'), enabled: profileOpen, staleTime: 30000 });

  // The profile menu opens on click only (no hover), and the avatar itself no longer links to the profile page.
  const closeProfile = () => setProfileOpen(false);
  const go = (href: string) => {
    closeProfile();
    router.push(href as never);
  };

  const isActive = (name: string) => {
    if (name === 'index') return pathname === '/' || pathname === '' || pathname.endsWith('/(tabs)') || (pathname.includes('/listing/') && !pathname.includes('/listing/form')) || pathname.includes('/seller/');
    if (name === 'search') return pathname.includes('/search');
    if (name === 'sell') return pathname.includes('/sell') || pathname.includes('/listing/form');
    if (name === 'transactions') return pathname.includes('/transactions') || pathname.includes('/transaction/');
    return false;
  };

  const purchases = buyerTransactions.data || [];
  const pendingPayment = purchases.filter(item => item.status === 'PENDING').length;
  const inProcess = purchases.filter(item => ['PAID', 'CONFIRMED'].includes(item.status)).length;
  const completed = purchases.filter(item => item.status === 'COMPLETED').length;

  return (
    <View style={styles.header}>
      <View style={[styles.headerMain, compactDesktop && styles.headerMainCompact]}>
        <Pressable onPress={() => router.replace('/(student)/(tabs)')} style={[styles.brand, compactDesktop && styles.brandCompact]}>
          <BrandLogo style={styles.brandWordmark} />
        </Pressable>

        <View style={styles.headerActions}>
          <Pressable onPress={() => router.push('/(student)/listing/form')} style={({ pressed }) => [styles.sellButton, pressed && styles.headerPress]}>
            <Ionicons name="add" size={17} color="#FFFFFF" />
            <Text style={styles.sellButtonText}>{compactDesktop ? 'Jual' : 'Buat Listing'}</Text>
          </Pressable>
          <Pressable accessibilityLabel="Pesan" onPress={() => router.push('/(student)/(tabs)/chats')} style={({ pressed }) => [styles.iconButton, pressed && styles.headerPress]}>
            <Ionicons name="chatbubble-ellipses-outline" size={19} color="#FFFFFF" />
          </Pressable>
          <Pressable accessibilityLabel="Tersimpan" onPress={() => router.push('/(student)/saved')} style={({ pressed }) => [styles.iconButton, pressed && styles.headerPress]}>
            <Ionicons name="heart-outline" size={20} color="#FFFFFF" />
          </Pressable>
          <Pressable accessibilityLabel="Notifikasi" onPress={() => router.push('/(student)/notifications')} style={({ pressed }) => [styles.iconButton, pressed && styles.headerPress]}>
            <Ionicons name={unread ? 'notifications' : 'notifications-outline'} size={20} color="#FFFFFF" />
            {unread ? <View style={styles.notificationBadge}><Text style={styles.notificationBadgeText}>{unread > 9 ? '9+' : unread}</Text></View> : null}
          </Pressable>

          <View style={styles.profileMenuWrap}>
            {profileOpen ? <Pressable accessibilityLabel="Tutup menu profil" onPress={closeProfile} style={styles.profileBackdrop} /> : null}
            <Pressable
              accessibilityLabel={profileOpen ? 'Tutup menu profil' : 'Buka menu profil'}
              accessibilityState={{ expanded: profileOpen }}
              onPress={() => setProfileOpen(open => !open)}
              style={({ pressed }) => [styles.profile, profileOpen && styles.profileActive, pressed && styles.profilePressed]}
            >
              <View style={styles.avatar}><Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() || 'B'}</Text></View>
              {!compactDesktop ? <View style={styles.profileCopy}><Text numberOfLines={1} style={styles.name}>{user?.name || 'Binusian'}</Text><Text style={styles.verified}>Terverifikasi</Text></View> : null}
              <Ionicons name={profileOpen ? 'chevron-up' : 'chevron-down'} size={13} color="#C7D7EA" />
            </Pressable>

            {profileOpen ? (
              <View style={styles.profileMenu}>
                <View style={styles.menuIdentity}>
                  <View style={styles.menuAvatar}><Text style={styles.menuAvatarText}>{user?.name?.[0]?.toUpperCase() || 'B'}</Text></View>
                  <View style={styles.menuIdentityCopy}>
                    <View style={styles.menuNameRow}><Text numberOfLines={1} style={styles.menuName}>{user?.name || 'Binusian'}</Text></View>
                    <Text numberOfLines={1} style={styles.menuEmail}>{user?.email || 'Akun BINUS terverifikasi'}</Text>
                  </View>
                </View>

                <View style={styles.walletGrid}>
                  <Pressable onPress={() => go('/(student)/wallet')} style={styles.walletCell}>
                    <View style={[styles.walletIcon, { backgroundColor: colors.warningSoft }]}><Ionicons name="wallet-outline" size={18} color={colors.warning} /></View>
                    <Text style={styles.walletLabel}>Saldo</Text>
                    <Text style={styles.walletValue}>{money(balance.data?.balance ?? user?.balance)}</Text>
                  </Pressable>
                  <View style={styles.walletDivider} />
                  <Pressable onPress={() => go('/(student)/(tabs)/transactions')} style={styles.walletCell}>
                    <View style={[styles.walletIcon, { backgroundColor: colors.primarySoft }]}><Ionicons name="lock-closed-outline" size={17} color={colors.primary} /></View>
                    <Text style={styles.walletLabel}>Escrow</Text>
                    <Text style={styles.walletValue}>{money(balance.data?.escrow ?? user?.escrow)}</Text>
                  </Pressable>
                </View>

                <View style={styles.purchaseSection}>
                  <View style={styles.purchaseHead}><Text style={styles.purchaseTitle}>Riwayat Pembelian</Text><Pressable onPress={() => go('/(student)/(tabs)/transactions')}><Text style={styles.purchaseLink}>Lihat Semua</Text></Pressable></View>
                  <View style={styles.purchaseGrid}>
                    {[
                      ['card-outline', 'Menunggu\nPembayaran', pendingPayment],
                      ['cube-outline', 'Dalam\nProses', inProcess],
                      ['checkmark-done-outline', 'Selesai', completed],
                    ].map(([icon, label, count]) => (
                      <Pressable key={String(label)} onPress={() => go('/(student)/(tabs)/transactions')} style={styles.purchaseItem}>
                        <View style={styles.purchaseIconWrap}><Ionicons name={icon as IconName} size={20} color={colors.primary} />{Number(count) > 0 ? <View style={styles.purchaseCount}><Text style={styles.purchaseCountText}>{count}</Text></View> : null}</View>
                        <Text style={styles.purchaseItemText}>{String(label)}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.menuLinks}>
                  <MenuRow icon="settings-outline" label="Pengaturan Profil" onPress={() => go('/(student)/(tabs)/profile')} />
                  <MenuRow icon="log-out-outline" label="Keluar" danger onPress={() => { closeProfile(); setLogoutOpen(true); }} />
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.marketNav}>
        <View style={[styles.marketNavInner, compactDesktop && styles.headerMainCompact]}>
          <View style={styles.primaryTabs}>
            {Object.entries(navItems).map(([name, item]) => {
              const active = isActive(name);
              return (
                <Pressable key={name} onPress={() => router.push(item.href as never)} style={({ pressed }) => [styles.primaryTab, active && styles.primaryTabActive, pressed && styles.navPressed]}>
                  <Ionicons name={active ? item.filled : item.outline} size={15} color={active ? '#FFFFFF' : '#BFD4EE'} />
                  <Text style={[styles.primaryTabText, active && styles.primaryTabTextActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      <FeedbackDialog
        visible={logoutOpen}
        tone="warning"
        title="Keluar dari BMarket?"
        message="Sesi di perangkat ini akan diakhiri. Kamu bisa login kembali kapan saja dengan akun BINUS-mu."
        primaryLabel="Keluar"
        secondaryLabel="Batal"
        onClose={() => setLogoutOpen(false)}
        onSecondary={() => setLogoutOpen(false)}
        onPrimary={async () => { setLogoutOpen(false); await logout(); router.replace('/(auth)/login'); }}
      />
    </View>
  );
}

const useStyles = makeStyles(() => ({
  header: { zIndex: 1000, backgroundColor: colors.brand, position: 'sticky' as never, top: 0 },
  headerMain: { width: '100%', maxWidth: 1280, height: 72, alignSelf: 'center', paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 18, zIndex: 1001 },
  headerMainCompact: { paddingHorizontal: 18 },
  brand: { width: 146, justifyContent: 'center' },
  brandCompact: { width: 122 },
  brandWordmark: { width: 150, height: 48 },
  headerActions: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 12, zIndex: 1100 },
  sellButton: { height: 40, borderRadius: 9, paddingHorizontal: 14, backgroundColor: colors.brandRaised, borderWidth: 1, borderColor: colors.primaryBorderStrong, flexDirection: 'row', alignItems: 'center', gap: 6, ...webTransition },
  sellButtonText: { fontFamily: 'PoppinsSemiBold', fontSize: 12, color: '#FFFFFF' },
  iconButton: { width: 40, height: 40, borderRadius: 9, borderWidth: 1, borderColor: 'rgba(255,255,255,.18)', backgroundColor: 'rgba(0,0,0,.08)', alignItems: 'center', justifyContent: 'center', ...webTransition },
  headerPress: { opacity: .74, transform: [{ scale: .95 }] },
  profileMenuWrap: { position: 'relative', zIndex: 1200 },
  // Transparent full-viewport layer behind the open menu; clicking it closes the menu.
  profileBackdrop: { position: 'fixed' as never, top: 0, right: 0, bottom: 0, left: 0, zIndex: 1250, ...({ cursor: 'default' } as any) },
  profile: { minHeight: 42, maxWidth: 190, borderRadius: 9, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 3, paddingRight: 7 },
  profileActive: { backgroundColor: 'rgba(0,0,0,.12)' },
  profilePressed: { opacity: .82 },
  avatar: { width: 36, height: 36, borderRadius: 9, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'PoppinsBold', fontSize: 13, color: '#0B57B7' },
  profileCopy: { maxWidth: 96 },
  name: { fontFamily: 'PoppinsSemiBold', fontSize: 12, color: '#FFFFFF' },
  verified: { fontFamily: 'PoppinsRegular', fontSize: 10, color: '#AEE8D4' },
  profileMenu: { position: 'absolute', top: 43, right: 0, width: 390, overflow: 'hidden', borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, shadowColor: '#0D243B', shadowOpacity: .18, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 18, zIndex: 1300 },
  menuIdentity: { minHeight: 90, paddingHorizontal: 18, paddingVertical: 14, backgroundColor: colors.brandDeep, flexDirection: 'row', alignItems: 'center', gap: 13 },
  menuAvatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: '#FFFFFF', backgroundColor: '#E9F3FF', alignItems: 'center', justifyContent: 'center' },
  menuAvatarText: { fontFamily: 'PoppinsBold', fontSize: 21, color: '#0B57B7' },
  menuIdentityCopy: { flex: 1, minWidth: 0 },
  menuNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  menuName: { maxWidth: 230, fontFamily: 'PoppinsBold', fontSize: 16, color: '#FFFFFF' },
  menuEmail: { marginTop: 3, fontFamily: 'PoppinsRegular', fontSize: 10.5, color: '#B9CBE0' },
  walletGrid: { minHeight: 82, marginHorizontal: 14, marginTop: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'stretch' },
  walletCell: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center' },
  walletDivider: { width: 1, backgroundColor: colors.border },
  walletIcon: { width: 29, height: 29, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  walletLabel: { fontFamily: 'PoppinsRegular', fontSize: 10.5, color: colors.muted },
  walletValue: { marginTop: 1, fontFamily: 'PoppinsSemiBold', fontSize: 12, color: colors.text },
  purchaseSection: { marginTop: 13, paddingHorizontal: 14, paddingBottom: 12 },
  purchaseHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 },
  purchaseTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 12.5, color: colors.text },
  purchaseLink: { fontFamily: 'PoppinsSemiBold', fontSize: 11, color: colors.primary },
  purchaseGrid: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, flexDirection: 'row', overflow: 'hidden' },
  purchaseItem: { minHeight: 72, flex: 1, paddingHorizontal: 7, paddingVertical: 8, borderRightWidth: 1, borderRightColor: colors.border, alignItems: 'center', justifyContent: 'center', gap: 5 },
  purchaseIconWrap: { position: 'relative' },
  purchaseCount: { position: 'absolute', right: -11, top: -7, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3, backgroundColor: colors.badge, alignItems: 'center', justifyContent: 'center' },
  purchaseCountText: { fontFamily: 'PoppinsBold', fontSize: 8.5, color: '#FFFFFF' },
  purchaseItemText: { textAlign: 'center', fontFamily: 'PoppinsRegular', fontSize: 9.5, lineHeight: 13, color: colors.textSoft },
  menuLinks: { borderTopWidth: 1, borderTopColor: colors.border },
  menuRow: { minHeight: 48, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1, borderBottomColor: colors.border },
  menuRowPressed: { backgroundColor: colors.surfaceMuted },
  menuRowText: { flex: 1, fontFamily: 'PoppinsMedium', fontSize: 11.5, color: colors.text },
  menuRowDanger: { color: colors.danger },
  menuBadge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  menuBadgeText: { fontFamily: 'PoppinsSemiBold', fontSize: 9.5, color: colors.primary },
  marketNav: { height: 42, backgroundColor: colors.brandDeep, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,.10)', zIndex: 900 },
  marketNavInner: { width: '100%', maxWidth: 1280, height: '100%', alignSelf: 'center', paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 16 },
  primaryTabs: { height: '100%', flexDirection: 'row', alignItems: 'center' },
  primaryTab: { height: '100%', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderBottomWidth: 2, borderBottomColor: 'transparent', ...webTransition },
  primaryTabActive: { backgroundColor: 'rgba(255,255,255,.07)', borderBottomColor: '#7DBBFF' },
  primaryTabText: { fontFamily: 'PoppinsMedium', fontSize: 11.5, color: '#BFD4EE' },
  primaryTabTextActive: { fontFamily: 'PoppinsSemiBold', color: '#FFFFFF' },
  navPressed: { backgroundColor: 'rgba(255,255,255,.12)', transform: [{ translateY: 1 }] },
  notificationBadge: { position: 'absolute', right: -4, top: -5, minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 8, backgroundColor: colors.badge, alignItems: 'center', justifyContent: 'center' },
  notificationBadgeText: { fontFamily: 'PoppinsBold', fontSize: 9, color: '#FFFFFF' },
}));
