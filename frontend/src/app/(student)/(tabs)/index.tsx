import Ionicons from '@expo/vector-icons/Ionicons';
import { useDeferredValue, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { endpoints, errorMessage } from '@/lib/api';
import { Empty, ErrorState, Screen, Skeleton } from '@/components/ui';
import { ListingCard } from '@/components/listing-card';
import { colors, layout, shadowSoft, webTransition } from '@/constants/theme';
import { useAuth } from '@/store/auth';
import type { Listing, ListingMode } from '@/types';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const categories = [
  { value: 'Semua', label: 'Semua', icon: 'grid-outline' as IconName, tint: '#EAF3FF', color: '#1769C2' },
  { value: 'ELECTRONICS', label: 'Elektronik', icon: 'game-controller-outline' as IconName, tint: '#EEF1FF', color: '#5569D8' },
  { value: 'BOOKS', label: 'Buku', icon: 'book-outline' as IconName, tint: '#FFF3E7', color: '#D97816' },
  { value: 'FASHION', label: 'Fashion', icon: 'shirt-outline' as IconName, tint: '#F7EEFF', color: '#9A59CF' },
  { value: 'FOOD', label: 'Makanan', icon: 'fast-food-outline' as IconName, tint: '#FFF0EE', color: '#D65B50' },
  { value: 'SERVICES', label: 'Jasa', icon: 'construct-outline' as IconName, tint: '#EAF8F4', color: '#17846C' },
  { value: 'SPORTS', label: 'Olahraga', icon: 'basketball-outline' as IconName, tint: '#FFF7DF', color: '#C58A16' },
  { value: 'OTHER', label: 'Lainnya', icon: 'apps-outline' as IconName, tint: '#F0F3F6', color: '#68798C' },
];

function SectionHeader({ title, subtitle, action = 'Lihat semua', onPress }: { title: string; subtitle?: string; action?: string; onPress?: () => void }) {
  return <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>{title}</Text>{subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}</View>{onPress ? <Pressable onPress={onPress} style={styles.seeAll}><Text style={styles.seeAllText}>{action}</Text><Ionicons name="chevron-forward" size={13} color="#69AEFF" /></Pressable> : null}</View>;
}

function ListingShelf({ title, subtitle, items, cardWidth, onSeeAll, savedIds, onToggleSaved }: { title: string; subtitle: string; items: Listing[]; cardWidth: number; onSeeAll?: () => void; savedIds: Set<string>; onToggleSaved: (id: string, saved: boolean) => void }) {
  if (!items.length) return null;
  return <View style={styles.marketSection}><SectionHeader title={title} subtitle={subtitle} onPress={onSeeAll} /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelf}>{items.map((item, index) => <Animated.View key={item.id} entering={FadeInDown.delay(Math.min(index * 28, 180)).duration(190)}><ListingCard storefront compact item={item} saved={savedIds.has(item.id)} onToggleSaved={() => onToggleSaved(item.id, savedIds.has(item.id))} style={{ width: cardWidth }} onPress={() => router.push({ pathname: '/(student)/listing/[id]', params: { id: item.id } })} /></Animated.View>)}</ScrollView></View>;
}

function HomeSkeleton({ cardWidth }: { cardWidth: number }) {
  return <View style={styles.skeletonPage}>
    <View style={styles.skeletonSection}><Skeleton width={180} height={22} /><Skeleton width={280} height={12} /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelf}>{[0,1,2,3,4].map(item => <View key={item} style={[styles.skeletonCard, { width: cardWidth }]}><Skeleton height={150} radius={12} /><View style={styles.skeletonCardBody}><Skeleton width="82%" height={13} /><Skeleton width="58%" height={18} /><Skeleton width="68%" height={10} /></View></View>)}</ScrollView></View>
  </View>;
}

type HomeContentProps = {
  initialQuery: string;
  initialCategory: string;
  initialFulfillment: 'ALL' | 'CAMPUS_MEETUP' | 'INSTANT_COURIER';
};

function HomeContent({ initialQuery, initialCategory, initialFulfillment }: HomeContentProps) {
  const user = useAuth(state => state.user);
  const { width } = useWindowDimensions();
  const desktop = width >= 960;
  const mobile = width < 600;
  const [keyword, setKeyword] = useState(initialQuery);
  const deferredKeyword = useDeferredValue(keyword);
  const [category, setCategory] = useState(initialCategory);
  const [listingType, setListingType] = useState<'ALL' | 'PRODUCT' | 'SERVICE'>('ALL');
  const [listingMode, setListingMode] = useState<'ALL' | ListingMode>('ALL');
  const [sort, setSort] = useState<'newest' | 'price_asc' | 'price_desc'>('newest');
  const [fulfillment, setFulfillment] = useState<'ALL' | 'CAMPUS_MEETUP' | 'INSTANT_COURIER'>(initialFulfillment);
  const client = useQueryClient();


  const filtering = Boolean(deferredKeyword.trim()) || category !== 'Semua' || listingType !== 'ALL' || listingMode !== 'ALL' || sort !== 'newest' || fulfillment !== 'ALL';
  const query = useInfiniteQuery({
    queryKey: ['listings', deferredKeyword, category, listingType, listingMode, sort, fulfillment],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => endpoints.listings({ keyword: deferredKeyword.trim() || undefined, category: category === 'Semua' ? undefined : category, type: listingType === 'ALL' ? undefined : listingType, mode: listingMode === 'ALL' ? undefined : listingMode, sort, fulfillmentMethod: fulfillment === 'ALL' ? undefined : fulfillment, page: pageParam, limit: 24 }),
    getNextPageParam: last => last.page < last.totalPages ? last.page + 1 : undefined,
  });
  const wishlist = useQuery({ queryKey: ['wishlist'], queryFn: endpoints.wishlist });
  const notificationCount = useQuery({ queryKey: ['notification-count'], queryFn: endpoints.notificationCount, refetchInterval: 30000 });
  const savedIds = new Set((wishlist.data || []).map(entry => entry.listing.id));
  const toggleSaved = useMutation({ mutationFn: ({ id, saved }: { id: string; saved: boolean }) => saved ? endpoints.unsaveListing(id) : endpoints.saveListing(id), onSuccess: (_data, variables) => { client.invalidateQueries({ queryKey: ['wishlist'] }); client.invalidateQueries({ queryKey: ['saved-status', variables.id] }); } });

  const listings = query.data?.pages.flatMap(page => page.data) || [];
  const totalListings = query.data?.pages[0]?.total || 0;
  const latestRegular = listings.filter(item => item.mode !== 'PREORDER');
  const products = listings.filter(item => item.type === 'PRODUCT' && item.mode !== 'PREORDER');
  const services = listings.filter(item => item.type === 'SERVICE');
  const preorders = listings.filter(item => item.mode === 'PREORDER' && item.preorderAccepting);
  const meetupItems = listings.filter(item => item.fulfillmentMethods?.includes('CAMPUS_MEETUP'));
  const firstName = user?.name?.trim().split(' ')[0] || 'Binusian';
  const contentWidth = Math.max(300, Math.min(width - (desktop ? 80 : 28), layout.contentMaxWidth - 80));
  const columns = contentWidth >= 1120 ? 5 : contentWidth >= 900 ? 4 : contentWidth >= 680 ? 3 : contentWidth >= 320 ? 2 : 1;
  const gap = desktop ? 14 : 10;
  const cardWidth = (contentWidth - gap * (columns - 1)) / columns;
  const shelfWidth = desktop ? 188 : Math.min(168, width * .44);
  const unread = notificationCount.data?.count || 0;

  const chooseCategory = (value: string) => { setCategory(value); setKeyword(''); };
  const resetFilters = () => { setCategory('Semua'); setKeyword(''); setListingType('ALL'); setListingMode('ALL'); setSort('newest'); setFulfillment('ALL'); router.replace('/(student)/(tabs)'); };
  const toggleListingSaved = (id: string, saved: boolean) => toggleSaved.mutate({ id, saved });

  return (
    <Screen style={styles.page} backgroundColor="#FFFFFF">
      {!desktop ? <View style={styles.mobileUtility}>
        <View style={styles.mobileUtilityTop}>
          <Text style={styles.mobileBrand}>BMarket</Text>
          <View style={styles.mobileUtilityActions}>
            <Pressable accessibilityLabel="Buat listing" onPress={() => router.push('/(student)/listing/form')} style={styles.mobileIconButton}><Ionicons name="add" size={20} color={colors.primary} /></Pressable>
            <Pressable accessibilityLabel="Tersimpan" onPress={() => router.push('/(student)/saved')} style={styles.mobileIconButton}><Ionicons name="heart-outline" size={19} color={colors.primary} /></Pressable>
            <Pressable accessibilityLabel="Notifikasi" onPress={() => router.push('/(student)/notifications')} style={styles.mobileIconButton}><Ionicons name={unread ? 'notifications' : 'notifications-outline'} size={19} color={colors.primary} />{unread ? <View style={styles.mobileNotificationBadge}><Text style={styles.mobileNotificationText}>{unread > 9 ? '9+' : unread}</Text></View> : null}</Pressable>
            <Pressable accessibilityLabel="Profil" onPress={() => router.push('/(student)/(tabs)/profile')} style={styles.mobileAvatar}><Text style={styles.mobileAvatarText}>{user?.name?.[0]?.toUpperCase() || 'B'}</Text></Pressable>
          </View>
        </View>
        <View style={styles.mobileSearch}>
          <Ionicons name="search-outline" size={18} color="#728296" />
          <TextInput value={keyword} onChangeText={setKeyword} placeholder="Cari barang, jasa, atau kebutuhan kampus" placeholderTextColor="#8A98A8" returnKeyType="search" style={styles.mobileSearchInput} />
          {keyword ? <Pressable accessibilityLabel="Hapus pencarian" onPress={() => setKeyword('')}><Ionicons name="close-circle" size={18} color="#9AA8B7" /></Pressable> : null}
        </View>
      </View> : null}

      <Animated.View entering={FadeInDown.duration(180)} style={styles.welcomeRow}>
        <Text style={styles.welcomeTitle}>Halo, {firstName}!</Text>
        <Text style={styles.welcomeSubtitle}>Mau cari apa hari ini?</Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(25).duration(220)} style={[styles.heroRow, mobile && styles.heroRowMobile]}>
        <View style={[styles.heroMain, mobile && styles.heroMainMobile]}>
          <View style={styles.heroAccent} />
          <View style={[styles.heroCopy, mobile && styles.heroCopyMobile]}>
            <View style={styles.heroEyebrowRow}><View style={styles.heroLiveDot} /><Text style={styles.heroEyebrow}>MARKETPLACE KAMPUS</Text></View>
            <Text style={[styles.heroTitle, mobile && styles.heroTitleMobile]}>Cari kebutuhan kampus tanpa tenggelam di group chat.</Text>
            <Text style={styles.heroDescription}>Barang preloved, jasa mahasiswa, sampai pre-order angkatan — lebih gampang dicari, dibandingkan, dan ditransaksikan.</Text>
            <View style={styles.heroActions}>
              <Pressable onPress={() => router.push('/(student)/listing/form')} style={({ pressed }) => [styles.heroButton, pressed && styles.heroButtonPressed]}><Text style={styles.heroButtonText}>Mulai jual</Text><Ionicons name="arrow-forward" size={14} color="#0B4A91" /></Pressable>
              <View style={styles.heroSignal}><Ionicons name="storefront-outline" size={15} color="#A9D2FF" /><Text style={styles.heroSignalText}>{totalListings ? `${totalListings} listing tersedia` : 'Temukan dari sesama Binusian'}</Text></View>
            </View>
          </View>
          {!mobile ? <View style={styles.heroVisual}>
            <View style={[styles.heroVisualCard, styles.heroVisualCardBack]}><Ionicons name="book-outline" size={26} color="#D99442" /><Text style={styles.heroVisualLabel}>Buku</Text></View>
            <View style={[styles.heroVisualCard, styles.heroVisualCardMid]}><Ionicons name="fast-food-outline" size={27} color="#D6665B" /><Text style={styles.heroVisualLabel}>PO makanan</Text></View>
            <View style={[styles.heroVisualCard, styles.heroVisualCardFront]}><Ionicons name="laptop-outline" size={30} color="#2877CC" /><Text style={styles.heroVisualLabel}>Elektronik</Text></View>
          </View> : null}
        </View>
        {desktop ? <View style={styles.heroSide}>
          {preorders.length ? <Pressable onPress={() => setListingMode('PREORDER')} style={({ pressed }) => [styles.campusPulseCard, pressed && styles.sidePromoPressed]}>
            <View style={styles.pulseTop}><View style={styles.pulseIcon}><Ionicons name="calendar-outline" size={23} color="#7442C3" /></View><View style={styles.pulseStatus}><View style={styles.pulseDot} /><Text style={styles.pulseStatusText}>SEDANG DIBUKA</Text></View></View>
            <View style={styles.pulseBody}><Text style={styles.pulseKicker}>PRE-ORDER KAMPUS</Text><Text style={styles.pulseTitle}>{preorders.length} PO sedang cari peserta.</Text><Text style={styles.pulseCopy}>Makanan, merch, dan batch mahasiswa yang punya deadline jelas.</Text></View>
            <View style={styles.pulseAction}><Text style={styles.pulseActionText}>Lihat pre-order</Text><Ionicons name="arrow-forward" size={14} color="#7442C3" /></View>
          </Pressable> : <Pressable onPress={() => router.push('/(student)/(tabs)/transactions')} style={({ pressed }) => [styles.escrowCard, pressed && styles.sidePromoPressed]}>
            <View style={styles.escrowIcon}><Ionicons name="shield-checkmark-outline" size={29} color="#1769C2" /></View>
            <View style={styles.escrowBody}><Text style={styles.escrowKicker}>TRANSAKSI AMAN</Text><Text style={styles.escrowTitle}>Dana aman sampai barang diterima.</Text><Text style={styles.escrowCopy}>Saldo diteruskan ke seller setelah serah-terima selesai.</Text></View>
            <View style={styles.escrowAction}><Text style={styles.escrowActionText}>Pelajari alurnya</Text><Ionicons name="arrow-forward" size={14} color="#1769C2" /></View>
          </Pressable>}
        </View> : null}
      </Animated.View>

      <View style={styles.categoryPanel}><SectionHeader title="Kategori" /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRail}>{categories.map(item => { const active = category === item.value; return <Pressable key={item.value} onPress={() => chooseCategory(item.value)} style={({ pressed }) => [styles.categoryItem, active && styles.categoryItemActive, pressed && styles.categoryItemPressed]}><View style={[styles.categoryIcon, { backgroundColor: item.tint }]}><Ionicons name={item.icon} size={25} color={item.color} /></View><Text style={[styles.categoryText, active && styles.categoryTextActive]}>{item.label}</Text></Pressable>; })}</ScrollView></View>

      {query.isLoading ? <HomeSkeleton cardWidth={shelfWidth} /> : query.isError ? <ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} /> : <>
        {!filtering ? <ListingShelf title="Baru di BMarket" subtitle="Listing terbaru dari sesama Binusian" items={latestRegular.slice(0, 10)} cardWidth={shelfWidth} onSeeAll={() => resetFilters()} savedIds={savedIds} onToggleSaved={toggleListingSaved} /> : null}
        {!filtering && preorders.length ? <ListingShelf title="Pre-order kampus" subtitle="Makanan, merch, dan PO mahasiswa yang sedang dibuka" items={preorders.slice(0, 10)} cardWidth={shelfWidth} onSeeAll={() => setListingMode('PREORDER')} savedIds={savedIds} onToggleSaved={toggleListingSaved} /> : null}
        {!filtering && products.length ? <ListingShelf title="Kebutuhan kuliah" subtitle="Barang preloved dan kebutuhan kampus" items={products.slice(0, 10)} cardWidth={shelfWidth} onSeeAll={() => setListingType('PRODUCT')} savedIds={savedIds} onToggleSaved={toggleListingSaved} /> : null}
        {!filtering && services.length ? <ListingShelf title="Jasa mahasiswa" subtitle="Desain, tutoring, bantuan tugas, dan lainnya" items={services.slice(0, 10)} cardWidth={shelfWidth} onSeeAll={() => setListingType('SERVICE')} savedIds={savedIds} onToggleSaved={toggleListingSaved} /> : null}
        {!filtering && meetupItems.length ? <ListingShelf title="Siap meetup" subtitle="Listing yang bisa diserah-terimakan langsung" items={meetupItems.slice(0, 10)} cardWidth={shelfWidth} onSeeAll={() => setFulfillment('CAMPUS_MEETUP')} savedIds={savedIds} onToggleSaved={toggleListingSaved} /> : null}

        <View style={styles.exploreSection}>
          <SectionHeader title={filtering ? 'Hasil pencarian' : 'Explore BMarket'} subtitle={filtering ? `${totalListings} listing ditemukan` : 'Rekomendasi barang dan jasa dari komunitas BINUS'} action={filtering ? 'Reset' : 'Lihat semua'} onPress={filtering ? resetFilters : undefined} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail}>
            <View style={styles.filterGroup}><Text style={styles.filterLabel}>Tipe</Text>{([['ALL','Semua'],['PRODUCT','Barang'],['SERVICE','Jasa']] as const).map(([value,label]) => <Pressable key={value} onPress={() => setListingType(value)} style={({ pressed }) => [styles.filterChip, listingType === value && styles.filterChipActive, pressed && styles.filterChipPressed]}><Text style={[styles.filterChipText, listingType === value && styles.filterChipTextActive]}>{label}</Text></Pressable>)}</View>
            <View style={styles.filterGroup}><Text style={styles.filterLabel}>Model</Text>{([['ALL','Semua'],['ONE_OFF','Satuan'],['STOCKED','Ready stock'],['PREORDER','Pre-order']] as const).map(([value,label]) => <Pressable key={value} onPress={() => setListingMode(value)} style={({ pressed }) => [styles.filterChip, listingMode === value && styles.filterChipActive, pressed && styles.filterChipPressed]}><Text style={[styles.filterChipText, listingMode === value && styles.filterChipTextActive]}>{label}</Text></Pressable>)}</View>
            <View style={styles.filterGroup}><Text style={styles.filterLabel}>Penyerahan</Text>{([['ALL','Semua'],['CAMPUS_MEETUP','Meetup'],['INSTANT_COURIER','Kurir']] as const).map(([value,label]) => <Pressable key={value} onPress={() => setFulfillment(value)} style={({ pressed }) => [styles.filterChip, fulfillment === value && styles.filterChipActive, pressed && styles.filterChipPressed]}><Text style={[styles.filterChipText, fulfillment === value && styles.filterChipTextActive]}>{label}</Text></Pressable>)}</View>
            <View style={styles.filterGroup}><Text style={styles.filterLabel}>Urutkan</Text>{([['newest','Terbaru'],['price_asc','Harga ↑'],['price_desc','Harga ↓']] as const).map(([value,label]) => <Pressable key={value} onPress={() => setSort(value)} style={({ pressed }) => [styles.filterChip, sort === value && styles.filterChipActive, pressed && styles.filterChipPressed]}><Text style={[styles.filterChipText, sort === value && styles.filterChipTextActive]}>{label}</Text></Pressable>)}</View>
          </ScrollView>
          {!listings.length ? <View style={styles.emptyDark}><Empty title="Belum ada listing yang cocok" message="Coba ganti kata kunci atau filter." icon="search-outline" /></View> : <><View style={[styles.grid, { gap }]}>{listings.map(item => <ListingCard storefront compact key={item.id} item={item} saved={savedIds.has(item.id)} onToggleSaved={() => toggleListingSaved(item.id, savedIds.has(item.id))} style={{ width: cardWidth }} onPress={() => router.push({ pathname: '/(student)/listing/[id]', params: { id: item.id } })} />)}</View>{query.hasNextPage ? <Pressable disabled={query.isFetchingNextPage} onPress={() => query.fetchNextPage()} style={styles.loadMore}><Text style={styles.loadMoreText}>{query.isFetchingNextPage ? 'Memuat…' : 'Muat lebih banyak'}</Text><Ionicons name="chevron-down" size={14} color="#1769C2" /></Pressable> : null}</>}
        </View>
      </>}

      <View style={styles.footer}><Text style={styles.footerBrand}>BMarket</Text><Text style={styles.footerText}>Marketplace komunitas BINUS untuk barang, jasa, dan transaksi yang lebih terstruktur.</Text></View>
    </Screen>
  );
}

export default function HomeScreen() {
  const params = useLocalSearchParams<{ q?: string; category?: string; fulfillment?: string }>();
  const initialQuery = typeof params.q === 'string' ? params.q : '';
  const initialCategory = typeof params.category === 'string' ? params.category : 'Semua';
  const initialFulfillment: HomeContentProps['initialFulfillment'] = params.fulfillment === 'CAMPUS_MEETUP' || params.fulfillment === 'INSTANT_COURIER' ? params.fulfillment : 'ALL';
  const routeKey = `${initialQuery}::${initialCategory}::${initialFulfillment}`;

  return <HomeContent key={routeKey} initialQuery={initialQuery} initialCategory={initialCategory} initialFulfillment={initialFulfillment} />;
}

const styles = StyleSheet.create({
  page: { paddingTop: 18, paddingBottom: 48, gap: 24, backgroundColor: '#FFFFFF' },
  mobileUtility: { gap: 10, marginBottom: -2 },
  mobileUtilityTop: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  mobileBrand: { fontFamily: 'PoppinsBold', fontSize: 22, color: '#1769C2', letterSpacing: -.35 },
  mobileUtilityActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  mobileIconButton: { position: 'relative', width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: '#D8E2EC', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', ...webTransition },
  mobileNotificationBadge: { position: 'absolute', right: -4, top: -4, minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: 8, backgroundColor: '#E5485D', alignItems: 'center', justifyContent: 'center' },
  mobileNotificationText: { color: '#FFFFFF', fontFamily: 'PoppinsBold', fontSize: 8 },
  mobileAvatar: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#EAF3FF', alignItems: 'center', justifyContent: 'center' },
  mobileAvatarText: { fontFamily: 'PoppinsBold', fontSize: 12, color: '#1769C2' },
  mobileSearch: { minHeight: 46, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1, borderColor: '#D8E2EC', backgroundColor: '#F8FAFC', flexDirection: 'row', alignItems: 'center', gap: 9 },
  mobileSearchInput: { flex: 1, minWidth: 0, minHeight: 44, paddingVertical: 8, fontFamily: 'PoppinsRegular', fontSize: 12.5, color: '#172334', ...( { outlineStyle: 'none', outlineWidth: 0 } as any ) },
  welcomeRow: { minHeight: 44, justifyContent: 'center', gap: 0, marginBottom: -10 },
  welcomeTitle: { fontFamily: 'PoppinsBold', fontSize: 23, lineHeight: 30, color: '#172334', letterSpacing: -.2 },
  welcomeSubtitle: { fontFamily: 'PoppinsRegular', fontSize: 12.5, lineHeight: 18, color: '#7A8CA0' },

  heroRow: { minHeight: 258, flexDirection: 'row', gap: 12 },
  heroRowMobile: { minHeight: 0 },
  heroMain: { minHeight: 258, flex: 2.35, overflow: 'hidden', position: 'relative', borderRadius: 17, backgroundColor: '#0D4B88', borderWidth: 1, borderColor: '#205F9A', paddingHorizontal: 30, paddingVertical: 27, justifyContent: 'center' },
  heroMainMobile: { minHeight: 238, paddingHorizontal: 20, paddingVertical: 22 },
  heroAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: '#64B5FF' },
  heroCopy: { width: '66%', zIndex: 2, gap: 9 },
  heroCopyMobile: { width: '100%', paddingRight: 0 },
  heroEyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  heroLiveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#67D1A7' },
  heroEyebrow: { fontFamily: 'PoppinsBold', fontSize: 10.5, letterSpacing: .9, color: '#9DD0FF' },
  heroTitle: { maxWidth: 610, fontFamily: 'PoppinsBold', fontSize: 29, lineHeight: 37, color: '#FFFFFF', letterSpacing: -.4 },
  heroTitleMobile: { fontSize: 23, lineHeight: 30, maxWidth: 330 },
  heroDescription: { maxWidth: 570, fontFamily: 'PoppinsRegular', fontSize: 12.5, lineHeight: 20, color: '#C9DAEA' },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 11, marginTop: 7 },
  heroButton: { minHeight: 42, paddingHorizontal: 16, borderRadius: 9, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 7, ...webTransition },
  heroButtonPressed: { opacity: .84, transform: [{ scale: .98 }] },
  heroButtonText: { fontFamily: 'PoppinsSemiBold', fontSize: 12, color: '#0B4A91' },
  heroSignal: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroSignalText: { fontFamily: 'PoppinsMedium', fontSize: 10.75, color: '#BBD7EF' },
  heroVisual: { position: 'absolute', right: 26, top: 30, width: 220, height: 190 },
  heroVisualCard: { position: 'absolute', width: 118, height: 88, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D7E6F5', alignItems: 'center', justifyContent: 'center', gap: 4, ...shadowSoft },
  heroVisualCardBack: { right: 92, top: 18, transform: [{ rotate: '-8deg' }], opacity: .84 },
  heroVisualCardMid: { right: 4, top: 68, transform: [{ rotate: '7deg' }], opacity: .92 },
  heroVisualCardFront: { right: 70, top: 86, transform: [{ rotate: '-1deg' }] },
  heroVisualLabel: { fontFamily: 'PoppinsSemiBold', fontSize: 9.5, color: '#526578' },
  heroSide: { flex: .95, minWidth: 280 },
  sidePromoPressed: { opacity: .84, transform: [{ scale: .988 }] },

  campusPulseCard: { flex: 1, minHeight: 258, borderRadius: 17, borderWidth: 1, borderColor: '#E2D5F2', backgroundColor: '#FBF8FF', padding: 22, justifyContent: 'space-between', ...webTransition },
  pulseTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  pulseIcon: { width: 46, height: 46, borderRadius: 13, backgroundColor: '#F1E8FB', alignItems: 'center', justifyContent: 'center' },
  pulseStatus: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#58B987' },
  pulseStatusText: { fontFamily: 'PoppinsBold', fontSize: 9.5, letterSpacing: .6, color: '#6E7E8F' },
  pulseBody: { gap: 6 },
  pulseKicker: { fontFamily: 'PoppinsBold', fontSize: 10.5, letterSpacing: .8, color: '#7442C3' },
  pulseTitle: { fontFamily: 'PoppinsBold', fontSize: 19, lineHeight: 25, color: '#3D2B57' },
  pulseCopy: { fontFamily: 'PoppinsRegular', fontSize: 11.5, lineHeight: 18, color: '#766A84' },
  pulseAction: { alignSelf: 'flex-start', minHeight: 34, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#F1E8FB', flexDirection: 'row', alignItems: 'center', gap: 6 },
  pulseActionText: { fontFamily: 'PoppinsSemiBold', fontSize: 11, color: '#7442C3' },
  escrowCard: { flex: 1, minHeight: 258, borderRadius: 17, borderWidth: 1, borderColor: '#C9DDF2', backgroundColor: '#F5F9FE', padding: 22, justifyContent: 'space-between', ...webTransition },
  escrowIcon: { width: 48, height: 48, borderRadius: 13, backgroundColor: '#E5F1FD', alignItems: 'center', justifyContent: 'center' },
  escrowBody: { maxWidth: 245, gap: 6 },
  escrowKicker: { fontFamily: 'PoppinsBold', fontSize: 10.5, letterSpacing: .8, color: '#1769C2' },
  escrowTitle: { fontFamily: 'PoppinsBold', fontSize: 18, lineHeight: 24, color: '#173B63' },
  escrowCopy: { fontFamily: 'PoppinsRegular', fontSize: 11.5, lineHeight: 18, color: '#657B92' },
  escrowAction: { alignSelf: 'flex-start', minHeight: 34, paddingHorizontal: 11, borderRadius: 8, backgroundColor: '#E5F1FD', flexDirection: 'row', alignItems: 'center', gap: 7 },
  escrowActionText: { fontFamily: 'PoppinsSemiBold', fontSize: 11, color: '#1769C2' },

  categoryPanel: { gap: 10, paddingTop: 2, paddingBottom: 2 },
  categoryRail: { gap: 9, paddingRight: 8 },
  categoryItem: { width: 90, minHeight: 84, alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, backgroundColor: 'transparent', ...webTransition },
  categoryItemActive: { backgroundColor: '#F3F8FE' },
  categoryItemPressed: { transform: [{ scale: .96 }], opacity: .78 },
  categoryIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  categoryText: { fontFamily: 'PoppinsMedium', fontSize: 11.25, color: '#5F6F82' },
  categoryTextActive: { color: '#1769C2', fontFamily: 'PoppinsSemiBold' },

  marketSection: { gap: 11 },
  sectionHeader: { minHeight: 40, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { fontFamily: 'PoppinsBold', fontSize: 18.5, color: '#172334', letterSpacing: -.18 },
  sectionSubtitle: { fontFamily: 'PoppinsRegular', fontSize: 11.75, color: '#7A8796', marginTop: 1 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 6, paddingHorizontal: 2 },
  seeAllText: { fontFamily: 'PoppinsSemiBold', fontSize: 11.5, color: '#1769C2' },
  shelf: { gap: 12, paddingRight: 12, paddingBottom: 8, paddingTop: 2 },

  skeletonPage: { gap: 22 },
  skeletonSection: { gap: 8 },
  skeletonCard: { overflow: 'hidden', borderWidth: 1, borderColor: '#E5EAF0', borderRadius: 12, backgroundColor: '#FFFFFF' },
  skeletonCardBody: { padding: 12, gap: 8 },

  exploreSection: { gap: 16 },
  filterRail: { gap: 20, paddingRight: 10 },
  filterGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterLabel: { fontFamily: 'PoppinsSemiBold', fontSize: 11.5, color: '#7A8796', marginRight: 2 },
  filterChip: { minHeight: 34, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, borderColor: '#DDE4EC', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', ...webTransition },
  filterChipActive: { borderColor: '#9FC5EC', backgroundColor: '#EEF6FF' },
  filterChipPressed: { transform: [{ scale: .97 }], opacity: .78 },
  filterChipText: { fontFamily: 'PoppinsMedium', fontSize: 11.5, color: '#627286' },
  filterChipTextActive: { color: '#1769C2', fontFamily: 'PoppinsSemiBold' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' },
  loadMore: { alignSelf: 'center', minHeight: 42, marginTop: 4, paddingHorizontal: 16, borderRadius: 9, borderWidth: 1, borderColor: '#B9D3ED', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 6 },
  loadMoreText: { fontFamily: 'PoppinsSemiBold', fontSize: 11.5, color: '#1769C2' },
  emptyDark: { overflow: 'hidden', borderRadius: 10 },
  footer: { marginTop: 12, minHeight: 78, paddingTop: 18, borderTopWidth: 1, borderTopColor: '#E1E7EE', alignItems: 'center', gap: 3 },
  footerBrand: { fontFamily: 'PoppinsBold', fontSize: 16, color: '#1769C2' },
  footerText: { fontFamily: 'PoppinsRegular', fontSize: 11.5, textAlign: 'center', color: '#7A8796' },
});
