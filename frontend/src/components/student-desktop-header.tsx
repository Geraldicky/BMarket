import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { router, useGlobalSearchParams, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { endpoints } from '@/lib/api';
import { FeedbackDialog, money } from '@/components/ui';
import { useAuth } from '@/store/auth';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const navItems: Record<string, { label: string; outline: IconName; filled: IconName; href: string }> = {
  index: { label: 'Beranda', outline: 'home-outline', filled: 'home', href: '/(student)/(tabs)' },
  sell: { label: 'Etalase saya', outline: 'storefront-outline', filled: 'storefront', href: '/(student)/(tabs)/sell' },
  transactions: { label: 'Transaksi', outline: 'receipt-outline', filled: 'receipt', href: '/(student)/(tabs)/transactions' },
  chats: { label: 'Pesan', outline: 'chatbubble-outline', filled: 'chatbubble', href: '/(student)/(tabs)/chats' },
  profile: { label: 'Profil', outline: 'person-outline', filled: 'person', href: '/(student)/(tabs)/profile' },
};


const popularSearches = ['Laptop', 'Buku kuliah', 'Jasa desain', 'Kalkulator', 'iPad'];
const searchCategories = [
  { label: 'Elektronik', value: 'ELECTRONICS', icon: 'phone-portrait-outline' as IconName },
  { label: 'Buku', value: 'BOOKS', icon: 'book-outline' as IconName },
  { label: 'Fashion', value: 'FASHION', icon: 'shirt-outline' as IconName },
  { label: 'Makanan', value: 'FOOD', icon: 'fast-food-outline' as IconName },
  { label: 'Jasa Mahasiswa', value: 'SERVICES', icon: 'construct-outline' as IconName },
  { label: 'Olahraga', value: 'SPORTS', icon: 'basketball-outline' as IconName },
];

type SearchChoice =
  | { key: string; type: 'listing'; label: string; caption: string; id: string }
  | { key: string; type: 'category'; label: string; caption: string; category: string; icon: IconName }
  | { key: string; type: 'query'; label: string; caption: string };

function MenuRow({ icon, label, badge, onPress, danger }: { icon: IconName; label: string; badge?: string | number; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}>
      <Ionicons name={icon} size={19} color={danger ? '#E5485D' : '#4C5D70'} />
      <Text style={[styles.menuRowText, danger && styles.menuRowDanger]}>{label}</Text>
      {badge !== undefined ? <View style={styles.menuBadge}><Text style={styles.menuBadgeText}>{badge}</Text></View> : null}
      <Ionicons name="chevron-forward" size={14} color="#A1ADBB" />
    </Pressable>
  );
}

export function StudentDesktopHeader() {
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ q?: string }>();
  const user = useAuth(state => state.user);
  const logout = useAuth(state => state.logout);
  const { width } = useWindowDimensions();
  const compactDesktop = width < 1180;
  const notificationCount = useQuery({ queryKey: ['notification-count'], queryFn: endpoints.notificationCount, refetchInterval: 30000 });
  const unread = notificationCount.data?.count || 0;
  const currentQuery = typeof params.q === 'string' ? params.q : '';
  const [searchValue, setSearchValue] = useState(currentQuery);
  const [searchOpen, setSearchOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [profileOpen, setProfileOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<TextInput>(null);

  const balance = useQuery({ queryKey: ['header-balance'], queryFn: endpoints.balance, enabled: profileOpen, staleTime: 30000 });
  const buyerTransactions = useQuery({ queryKey: ['header-buyer-transactions'], queryFn: () => endpoints.transactions('buyer'), enabled: profileOpen, staleTime: 30000 });
  const wishlist = useQuery({ queryKey: ['header-wishlist'], queryFn: endpoints.wishlist, enabled: profileOpen, staleTime: 30000 });
  const suggestionQuery = useQuery({
    queryKey: ['header-search-suggestions', searchValue.trim()],
    queryFn: () => endpoints.listings({ keyword: searchValue.trim(), page: 1, limit: 5, sort: 'newest' }),
    enabled: searchOpen && searchValue.trim().length >= 2,
    staleTime: 20000,
  });

  useEffect(() => setSearchValue(currentQuery), [currentQuery]);
  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    try {
      const stored = JSON.parse(localStorage.getItem('bmarket-recent-searches') || '[]');
      if (Array.isArray(stored)) setRecentSearches(stored.filter(item => typeof item === 'string').slice(0, 6));
    } catch { setRecentSearches([]); }
  }, []);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handler = (event: any) => {
      if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
        searchInputRef.current?.focus();
      }
      if (event.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
        searchInputRef.current?.blur();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [searchOpen]);
  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (searchCloseTimer.current) clearTimeout(searchCloseTimer.current);
  }, []);

  const openProfile = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setProfileOpen(true);
  };
  const scheduleCloseProfile = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setProfileOpen(false), 140);
  };
  const closeProfile = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setProfileOpen(false);
  };
  const go = (href: string) => {
    closeProfile();
    router.push(href as never);
  };

  const saveRecentSearch = (query: string) => {
    const clean = query.trim();
    if (!clean) return;
    const next = [clean, ...recentSearches.filter(item => item.toLowerCase() !== clean.toLowerCase())].slice(0, 6);
    setRecentSearches(next);
    if (typeof localStorage !== 'undefined') localStorage.setItem('bmarket-recent-searches', JSON.stringify(next));
  };
  const openSearch = () => {
    if (searchCloseTimer.current) clearTimeout(searchCloseTimer.current);
    setSearchOpen(true);
  };
  const scheduleCloseSearch = () => {
    if (searchCloseTimer.current) clearTimeout(searchCloseTimer.current);
    searchCloseTimer.current = setTimeout(() => { setSearchOpen(false); setActiveSuggestion(-1); }, 150);
  };
  const submitSearch = (override?: string) => {
    const q = (override ?? searchValue).trim();
    if (q) saveRecentSearch(q);
    setSearchValue(q);
    setSearchOpen(false);
    setActiveSuggestion(-1);
    router.replace({ pathname: '/(student)/(tabs)', params: q ? { q } : {} } as never);
  };
  const clearSearch = () => {
    setSearchValue('');
    setActiveSuggestion(-1);
    setSearchOpen(true);
    router.replace('/(student)/(tabs)');
    searchInputRef.current?.focus();
  };
  const clearRecent = () => {
    setRecentSearches([]);
    if (typeof localStorage !== 'undefined') localStorage.removeItem('bmarket-recent-searches');
  };

  const isActive = (name: string) => {
    if (name === 'index') return pathname === '/' || pathname === '' || pathname.endsWith('/(tabs)') || (pathname.includes('/listing/') && !pathname.includes('/listing/form')) || pathname.includes('/seller/');
    if (name === 'chats') return pathname.includes('/chats') || pathname.includes('/chat/');
    if (name === 'sell') return pathname.includes('/sell') || pathname.includes('/listing/form');
    if (name === 'transactions') return pathname.includes('/transactions') || pathname.includes('/transaction/');
    if (name === 'profile') return pathname.includes('/profile') || pathname.includes('/wallet') || pathname.includes('/notifications') || pathname.includes('/saved');
    return false;
  };

  const purchases = buyerTransactions.data || [];
  const pendingPayment = purchases.filter(item => item.status === 'PENDING').length;
  const inProcess = purchases.filter(item => ['PAID', 'CONFIRMED'].includes(item.status)).length;
  const completed = purchases.filter(item => item.status === 'COMPLETED').length;
  const wishlistCount = wishlist.data?.length || 0;
  const suggestionListings = suggestionQuery.data?.data || [];
  const categoryMatches = searchValue.trim().length >= 1
    ? searchCategories.filter(item => item.label.toLowerCase().includes(searchValue.trim().toLowerCase())).slice(0, 3)
    : [];
  const keyboardChoices: SearchChoice[] = searchValue.trim()
    ? [
        ...suggestionListings.map(item => ({ key: `listing-${item.id}`, type: 'listing' as const, label: item.title, caption: money(item.price), id: item.id })),
        ...categoryMatches.map(item => ({ key: `category-${item.value}`, type: 'category' as const, label: item.label, caption: 'Kategori', category: item.value, icon: item.icon })),
      ]
    : [...recentSearches, ...popularSearches.filter(item => !recentSearches.includes(item))].slice(0, 8).map(item => ({ key: `query-${item}`, type: 'query' as const, label: item, caption: 'Pencarian' }));

  const chooseSearchChoice = (choice: SearchChoice) => {
    if (choice.type === 'listing') {
      saveRecentSearch(choice.label);
      setSearchOpen(false);
      router.push({ pathname: '/(student)/listing/[id]', params: { id: choice.id } } as never);
      return;
    }
    if (choice.type === 'category') {
      saveRecentSearch(choice.label);
      setSearchOpen(false);
      router.replace({ pathname: '/(student)/(tabs)', params: { category: choice.category } } as never);
      return;
    }
    submitSearch(choice.label);
  };

  const handleSearchKey = (event: any) => {
    const key = event.nativeEvent?.key;
    if (!searchOpen && (key === 'ArrowDown' || key === 'ArrowUp')) setSearchOpen(true);
    if (key === 'ArrowDown') {
      event.preventDefault?.();
      setActiveSuggestion(current => Math.min(current + 1, keyboardChoices.length - 1));
    } else if (key === 'ArrowUp') {
      event.preventDefault?.();
      setActiveSuggestion(current => Math.max(current - 1, 0));
    } else if (key === 'Enter' && activeSuggestion >= 0 && keyboardChoices[activeSuggestion]) {
      event.preventDefault?.();
      chooseSearchChoice(keyboardChoices[activeSuggestion]);
    } else if (key === 'Escape') {
      setSearchOpen(false);
      setActiveSuggestion(-1);
    }
  };

  return (
    <View style={styles.header}>
      <View style={[styles.headerMain, compactDesktop && styles.headerMainCompact]}>
        <Pressable onPress={() => router.replace('/(student)/(tabs)')} style={[styles.brand, compactDesktop && styles.brandCompact]}>
          <Text style={styles.brandWordmark}>BMarket</Text>
        </Pressable>

        <View
          style={styles.searchWrap}
          {...({ onPointerEnter: openSearch, onPointerLeave: scheduleCloseSearch } as any)}
        >
          <View style={[styles.search, searchOpen && styles.searchFocused]}>
            <Ionicons name="search-outline" size={18} color="#71839A" />
            <TextInput
              ref={searchInputRef}
              value={searchValue}
              onChangeText={value => { setSearchValue(value); setActiveSuggestion(-1); openSearch(); }}
              onFocus={openSearch}
              onBlur={scheduleCloseSearch}
              onKeyPress={handleSearchKey}
              onSubmitEditing={() => activeSuggestion >= 0 && keyboardChoices[activeSuggestion] ? chooseSearchChoice(keyboardChoices[activeSuggestion]) : submitSearch()}
              placeholder="Cari barang, jasa, atau kebutuhan kampus"
              placeholderTextColor="#7B8CA1"
              returnKeyType="search"
              style={styles.searchInput}
            />
            {searchValue ? <Pressable accessibilityLabel="Hapus pencarian" onPress={clearSearch} style={styles.clearSearch}><Ionicons name="close" size={16} color="#71839A" /></Pressable> : null}
            {!compactDesktop ? <View style={styles.shortcutKey}><Text style={styles.shortcutKeyText}>Ctrl K</Text></View> : null}
            <Pressable onPress={() => submitSearch()} style={styles.searchAction}>
              <Ionicons name="search" size={16} color="#FFFFFF" />
            </Pressable>
          </View>

          {searchOpen ? <View style={styles.searchDropdown}>
            {!searchValue.trim() ? <>
              {recentSearches.length ? <View style={styles.searchSection}>
                <View style={styles.searchSectionHead}><Text style={styles.searchSectionTitle}>Pencarian terakhir</Text><Pressable onPress={clearRecent}><Text style={styles.searchSectionAction}>Hapus semua</Text></Pressable></View>
                <View style={styles.searchChipRow}>{recentSearches.map((item, index) => <Pressable key={item} onPress={() => submitSearch(item)} style={[styles.searchChip, activeSuggestion === index && styles.searchChoiceActive]}><Ionicons name="time-outline" size={14} color="#71839A" /><Text style={styles.searchChipText}>{item}</Text></Pressable>)}</View>
              </View> : null}
              <View style={styles.searchSection}>
                <Text style={styles.searchSectionTitle}>Pencarian populer</Text>
                <View style={styles.searchChipRow}>{popularSearches.map(item => <Pressable key={item} onPress={() => submitSearch(item)} style={styles.searchChip}><Ionicons name="trending-up-outline" size={14} color="#1769C2" /><Text style={styles.searchChipText}>{item}</Text></Pressable>)}</View>
              </View>
            </> : <>
              <View style={styles.searchSectionHead}><Text style={styles.searchSectionTitle}>Hasil cepat</Text><Pressable onPress={() => submitSearch()}><Text style={styles.searchSectionAction}>Lihat semua</Text></Pressable></View>
              {suggestionQuery.isFetching ? <View style={styles.searchLoading}><Text style={styles.searchLoadingText}>Mencari listing…</Text></View> : null}
              {!suggestionQuery.isFetching && !suggestionListings.length && !categoryMatches.length ? <View style={styles.searchEmpty}><Ionicons name="search-outline" size={20} color="#94A1B1" /><Text style={styles.searchEmptyText}>Tidak ada saran cepat. Tekan Enter untuk mencari “{searchValue.trim()}”.</Text></View> : null}
              {suggestionListings.map((item, index) => <Pressable key={item.id} onPress={() => chooseSearchChoice({ key: `listing-${item.id}`, type: 'listing', label: item.title, caption: money(item.price), id: item.id })} style={[styles.searchChoice, activeSuggestion === index && styles.searchChoiceActive]}><View style={styles.searchChoiceIcon}><Ionicons name="cube-outline" size={17} color="#1769C2" /></View><View style={styles.searchChoiceCopy}><Text numberOfLines={1} style={styles.searchChoiceLabel}>{item.title}</Text><Text style={styles.searchChoiceCaption}>{money(item.price)} · {item.category}</Text></View><Ionicons name="arrow-forward" size={14} color="#9AA8B7" /></Pressable>)}
              {categoryMatches.map((item, offset) => { const index = suggestionListings.length + offset; return <Pressable key={item.value} onPress={() => chooseSearchChoice({ key: `category-${item.value}`, type: 'category', label: item.label, caption: 'Kategori', category: item.value, icon: item.icon })} style={[styles.searchChoice, activeSuggestion === index && styles.searchChoiceActive]}><View style={[styles.searchChoiceIcon, styles.searchChoiceIconCategory]}><Ionicons name={item.icon} size={17} color="#7C5AC7" /></View><View style={styles.searchChoiceCopy}><Text style={styles.searchChoiceLabel}>{item.label}</Text><Text style={styles.searchChoiceCaption}>Jelajahi kategori</Text></View><Ionicons name="chevron-forward" size={14} color="#9AA8B7" /></Pressable>; })}
            </>}
          </View> : null}
        </View>

        <View style={styles.headerActions}>
          <Pressable onPress={() => router.push('/(student)/listing/form')} style={styles.sellButton}>
            <Ionicons name="add" size={17} color="#FFFFFF" />
            <Text style={styles.sellButtonText}>{compactDesktop ? 'Jual' : 'Buat Listing'}</Text>
          </Pressable>
          <Pressable accessibilityLabel="Pesan" onPress={() => router.push('/(student)/(tabs)/chats')} style={styles.iconButton}>
            <Ionicons name="chatbubble-ellipses-outline" size={19} color="#FFFFFF" />
          </Pressable>
          <Pressable accessibilityLabel="Tersimpan" onPress={() => router.push('/(student)/saved')} style={styles.iconButton}>
            <Ionicons name="heart-outline" size={20} color="#FFFFFF" />
          </Pressable>
          <Pressable accessibilityLabel="Notifikasi" onPress={() => router.push('/(student)/notifications')} style={styles.iconButton}>
            <Ionicons name={unread ? 'notifications' : 'notifications-outline'} size={20} color="#FFFFFF" />
            {unread ? <View style={styles.notificationBadge}><Text style={styles.notificationBadgeText}>{unread > 9 ? '9+' : unread}</Text></View> : null}
          </Pressable>

          <View
            style={styles.profileMenuWrap}
            {...({ onPointerEnter: openProfile, onPointerLeave: scheduleCloseProfile } as any)}
          >
            <Pressable
              accessibilityLabel="Buka profil saya"
              onPress={() => { closeProfile(); router.push('/(student)/(tabs)/profile'); }}
              style={({ pressed }) => [styles.profile, profileOpen && styles.profileActive, pressed && styles.profilePressed]}
            >
              <View style={styles.avatar}><Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() || 'B'}</Text></View>
              {!compactDesktop ? <View style={styles.profileCopy}><Text numberOfLines={1} style={styles.name}>{user?.name || 'Binusian'}</Text><Text style={styles.verified}>Terverifikasi</Text></View> : null}
              <Ionicons name="chevron-down" size={13} color="#C7D7EA" />
            </Pressable>

            {profileOpen ? (
              <View
                style={styles.profileMenu}
                {...({ onPointerEnter: openProfile, onPointerLeave: scheduleCloseProfile } as any)}
              >
                <View style={styles.menuIdentity}>
                  <View style={styles.menuAvatar}><Text style={styles.menuAvatarText}>{user?.name?.[0]?.toUpperCase() || 'B'}</Text></View>
                  <View style={styles.menuIdentityCopy}>
                    <View style={styles.menuNameRow}><Text numberOfLines={1} style={styles.menuName}>{user?.name || 'Binusian'}</Text><Ionicons name="create-outline" size={16} color="#FFFFFF" /></View>
                    <Text numberOfLines={1} style={styles.menuEmail}>{user?.email || 'Akun BINUS terverifikasi'}</Text>
                  </View>
                </View>

                <View style={styles.walletGrid}>
                  <Pressable onPress={() => go('/(student)/wallet')} style={styles.walletCell}>
                    <View style={[styles.walletIcon, { backgroundColor: '#FFF0C7' }]}><Ionicons name="wallet-outline" size={18} color="#C88500" /></View>
                    <Text style={styles.walletLabel}>Saldo</Text>
                    <Text style={styles.walletValue}>{money(balance.data?.balance ?? user?.balance)}</Text>
                  </Pressable>
                  <View style={styles.walletDivider} />
                  <Pressable onPress={() => go('/(student)/(tabs)/transactions')} style={styles.walletCell}>
                    <View style={[styles.walletIcon, { backgroundColor: '#E8F3FF' }]}><Ionicons name="lock-closed-outline" size={17} color="#1676E8" /></View>
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
                        <View style={styles.purchaseIconWrap}><Ionicons name={icon as IconName} size={20} color="#126DE0" />{Number(count) > 0 ? <View style={styles.purchaseCount}><Text style={styles.purchaseCountText}>{count}</Text></View> : null}</View>
                        <Text style={styles.purchaseItemText}>{String(label)}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.menuLinks}>
                  <MenuRow icon="heart-outline" label="Produk Favorit" badge={wishlistCount || undefined} onPress={() => go('/(student)/saved')} />
                  <MenuRow icon="mail-outline" label="Kotak Pesan" onPress={() => go('/(student)/(tabs)/chats')} />
                  <MenuRow icon="shield-checkmark-outline" label="Kendala Pesanan" onPress={() => go('/(student)/(tabs)/transactions')} />
                  <MenuRow icon="notifications-outline" label="Notifikasi" badge={unread || undefined} onPress={() => go('/(student)/notifications')} />
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

const styles = StyleSheet.create({
  header: { zIndex: 1000, backgroundColor: '#0B57B7', position: 'sticky' as never, top: 0 },
  headerMain: { width: '100%', maxWidth: 1280, height: 72, alignSelf: 'center', paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 18, zIndex: 1001 },
  headerMainCompact: { paddingHorizontal: 18 },
  brand: { width: 146, justifyContent: 'center' },
  brandCompact: { width: 122 },
  brandWordmark: { fontFamily: 'PoppinsBold', fontSize: 27, lineHeight: 32, color: '#FFFFFF', letterSpacing: -.5 },
  searchWrap: { minWidth: 280, maxWidth: 620, flex: 1, position: 'relative', zIndex: 1250 },
  search: { width: '100%', height: 42, borderRadius: 9, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'transparent', paddingLeft: 13, paddingRight: 5, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchFocused: { borderColor: '#8FC2FF', shadowColor: '#062F61', shadowOpacity: .18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  searchInput: { flex: 1, height: '100%', fontFamily: 'PoppinsRegular', fontSize: 12.5, color: '#162131', outlineStyle: 'none' } as never,
  clearSearch: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  shortcutKey: { minWidth: 45, height: 24, paddingHorizontal: 7, borderRadius: 5, borderWidth: 1, borderColor: '#DFE5EC', backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' },
  shortcutKeyText: { fontFamily: 'PoppinsMedium', fontSize: 9.5, color: '#718096' },
  searchAction: { width: 36, height: 32, borderRadius: 7, backgroundColor: '#114B91', alignItems: 'center', justifyContent: 'center' },
  searchDropdown: { position: 'absolute', top: 47, left: 0, right: 0, maxHeight: 430, overflow: 'hidden', borderRadius: 10, borderWidth: 1, borderColor: '#D6DEE8', backgroundColor: '#FFFFFF', shadowColor: '#0D243B', shadowOpacity: .20, shadowRadius: 18, shadowOffset: { width: 0, height: 9 }, elevation: 20, zIndex: 1400 },
  searchSection: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' },
  searchSectionHead: { minHeight: 36, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#EEF2F6' },
  searchSectionTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 11.5, color: '#253447' },
  searchSectionAction: { fontFamily: 'PoppinsSemiBold', fontSize: 10.5, color: '#1769C2' },
  searchChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 9 },
  searchChip: { minHeight: 32, paddingHorizontal: 10, borderRadius: 7, borderWidth: 1, borderColor: '#E0E6ED', backgroundColor: '#FAFBFC', flexDirection: 'row', alignItems: 'center', gap: 6 },
  searchChipText: { fontFamily: 'PoppinsMedium', fontSize: 10.5, color: '#4E6074' },
  searchChoice: { minHeight: 54, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' },
  searchChoiceActive: { backgroundColor: '#EDF5FF' },
  searchChoiceIcon: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#EAF3FF', alignItems: 'center', justifyContent: 'center' },
  searchChoiceIconCategory: { backgroundColor: '#F4EEFF' },
  searchChoiceCopy: { flex: 1, minWidth: 0 },
  searchChoiceLabel: { fontFamily: 'PoppinsSemiBold', fontSize: 11.5, color: '#223247' },
  searchChoiceCaption: { marginTop: 1, fontFamily: 'PoppinsRegular', fontSize: 9.8, color: '#8492A3' },
  searchLoading: { minHeight: 54, alignItems: 'center', justifyContent: 'center' },
  searchLoadingText: { fontFamily: 'PoppinsRegular', fontSize: 10.5, color: '#7C8B9C' },
  searchEmpty: { minHeight: 78, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchEmptyText: { flex: 1, fontFamily: 'PoppinsRegular', fontSize: 10.5, lineHeight: 16, color: '#7B899A' },
  headerActions: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 1100 },
  sellButton: { height: 40, borderRadius: 8, paddingHorizontal: 14, backgroundColor: '#1676E8', borderWidth: 1, borderColor: '#4A9AF2', flexDirection: 'row', alignItems: 'center', gap: 6 },
  sellButtonText: { fontFamily: 'PoppinsSemiBold', fontSize: 12, color: '#FFFFFF' },
  iconButton: { width: 40, height: 40, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,.22)', backgroundColor: 'rgba(0,0,0,.10)', alignItems: 'center', justifyContent: 'center' },
  profileMenuWrap: { position: 'relative', zIndex: 1200 },
  profile: { minHeight: 42, maxWidth: 190, borderRadius: 9, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 3, paddingRight: 7 },
  profileActive: { backgroundColor: 'rgba(0,0,0,.12)' },
  profilePressed: { opacity: .82 },
  avatar: { width: 36, height: 36, borderRadius: 9, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'PoppinsBold', fontSize: 13, color: '#0B57B7' },
  profileCopy: { maxWidth: 96 },
  name: { fontFamily: 'PoppinsSemiBold', fontSize: 12, color: '#FFFFFF' },
  verified: { fontFamily: 'PoppinsRegular', fontSize: 10, color: '#AEE8D4' },
  profileMenu: { position: 'absolute', top: 43, right: 0, width: 390, overflow: 'hidden', borderRadius: 10, borderWidth: 1, borderColor: '#D5DEE9', backgroundColor: '#FFFFFF', shadowColor: '#0D243B', shadowOpacity: .18, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 18, zIndex: 1300 },
  menuIdentity: { minHeight: 90, paddingHorizontal: 18, paddingVertical: 14, backgroundColor: '#123C69', flexDirection: 'row', alignItems: 'center', gap: 13 },
  menuAvatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: '#FFFFFF', backgroundColor: '#E9F3FF', alignItems: 'center', justifyContent: 'center' },
  menuAvatarText: { fontFamily: 'PoppinsBold', fontSize: 21, color: '#0B57B7' },
  menuIdentityCopy: { flex: 1, minWidth: 0 },
  menuNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  menuName: { maxWidth: 230, fontFamily: 'PoppinsBold', fontSize: 16, color: '#FFFFFF' },
  menuEmail: { marginTop: 3, fontFamily: 'PoppinsRegular', fontSize: 10.5, color: '#B9CBE0' },
  walletGrid: { minHeight: 82, marginHorizontal: 14, marginTop: 12, borderRadius: 8, borderWidth: 1, borderColor: '#D9E1EA', flexDirection: 'row', alignItems: 'stretch' },
  walletCell: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center' },
  walletDivider: { width: 1, backgroundColor: '#E1E7EE' },
  walletIcon: { width: 29, height: 29, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  walletLabel: { fontFamily: 'PoppinsRegular', fontSize: 10.5, color: '#748396' },
  walletValue: { marginTop: 1, fontFamily: 'PoppinsSemiBold', fontSize: 12, color: '#172334' },
  purchaseSection: { marginTop: 13, paddingHorizontal: 14, paddingBottom: 12 },
  purchaseHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 },
  purchaseTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 12.5, color: '#182434' },
  purchaseLink: { fontFamily: 'PoppinsSemiBold', fontSize: 11, color: '#1676E8' },
  purchaseGrid: { borderWidth: 1, borderColor: '#E1E7EE', borderRadius: 8, flexDirection: 'row', overflow: 'hidden' },
  purchaseItem: { minHeight: 72, flex: 1, paddingHorizontal: 7, paddingVertical: 8, borderRightWidth: 1, borderRightColor: '#E1E7EE', alignItems: 'center', justifyContent: 'center', gap: 5 },
  purchaseIconWrap: { position: 'relative' },
  purchaseCount: { position: 'absolute', right: -11, top: -7, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3, backgroundColor: '#F04E5E', alignItems: 'center', justifyContent: 'center' },
  purchaseCountText: { fontFamily: 'PoppinsBold', fontSize: 8.5, color: '#FFFFFF' },
  purchaseItemText: { textAlign: 'center', fontFamily: 'PoppinsRegular', fontSize: 9.5, lineHeight: 13, color: '#445467' },
  menuLinks: { borderTopWidth: 1, borderTopColor: '#E4E9EF' },
  menuRow: { minHeight: 48, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1, borderBottomColor: '#EDF1F5' },
  menuRowPressed: { backgroundColor: '#F5F8FB' },
  menuRowText: { flex: 1, fontFamily: 'PoppinsMedium', fontSize: 11.5, color: '#314154' },
  menuRowDanger: { color: '#D84154' },
  menuBadge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: '#EAF3FF', alignItems: 'center', justifyContent: 'center' },
  menuBadgeText: { fontFamily: 'PoppinsSemiBold', fontSize: 9.5, color: '#0B67D8' },
  marketNav: { height: 42, backgroundColor: '#073B7C', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,.10)', zIndex: 900 },
  marketNavInner: { width: '100%', maxWidth: 1280, height: '100%', alignSelf: 'center', paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 16 },
  primaryTabs: { height: '100%', flexDirection: 'row', alignItems: 'center' },
  primaryTab: { height: '100%', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 5, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  primaryTabActive: { backgroundColor: 'rgba(255,255,255,.08)', borderBottomColor: '#62A8FF' },
  primaryTabText: { fontFamily: 'PoppinsMedium', fontSize: 11.5, color: '#BFD4EE' },
  primaryTabTextActive: { fontFamily: 'PoppinsSemiBold', color: '#FFFFFF' },
  navPressed: { backgroundColor: 'rgba(255,255,255,.12)' },
  notificationBadge: { position: 'absolute', right: -4, top: -5, minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 8, backgroundColor: '#F04E5E', alignItems: 'center', justifyContent: 'center' },
  notificationBadgeText: { fontFamily: 'PoppinsBold', fontSize: 9, color: '#FFFFFF' },
});
