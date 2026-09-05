import Ionicons from '@expo/vector-icons/Ionicons';
import { useDeferredValue, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { endpoints, errorMessage } from '@/lib/api';
import { Empty, ErrorState, Loader, Screen } from '@/components/ui';
import { ListingCard } from '@/components/listing-card';
import { colors, layout } from '@/constants/theme';
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
  return <View style={styles.marketSection}><SectionHeader title={title} subtitle={subtitle} onPress={onSeeAll} /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelf}>{items.map(item => <ListingCard storefront compact key={item.id} item={item} saved={savedIds.has(item.id)} onToggleSaved={() => onToggleSaved(item.id, savedIds.has(item.id))} style={{ width: cardWidth }} onPress={() => router.push({ pathname: '/(student)/listing/[id]', params: { id: item.id } })} />)}</ScrollView></View>;
}

export default function HomeScreen() {
  const user = useAuth(state => state.user);
  const params = useLocalSearchParams<{ q?: string; category?: string; fulfillment?: string }>();
  const initialQuery = typeof params.q === 'string' ? params.q : '';
  const initialCategory = typeof params.category === 'string' ? params.category : 'Semua';
  const initialFulfillment = params.fulfillment === 'CAMPUS_MEETUP' || params.fulfillment === 'INSTANT_COURIER' ? params.fulfillment : 'ALL';
  const { width } = useWindowDimensions();
  const desktop = width >= 960;
  const [keyword, setKeyword] = useState(initialQuery);
  const deferredKeyword = useDeferredValue(keyword);
  const [category, setCategory] = useState(initialCategory);
  const [listingType, setListingType] = useState<'ALL' | 'PRODUCT' | 'SERVICE'>('ALL');
  const [listingMode, setListingMode] = useState<'ALL' | ListingMode>('ALL');
  const [sort, setSort] = useState<'newest' | 'price_asc' | 'price_desc'>('newest');
  const [fulfillment, setFulfillment] = useState<'ALL' | 'CAMPUS_MEETUP' | 'INSTANT_COURIER'>(initialFulfillment);
  const client = useQueryClient();

  useEffect(() => setKeyword(initialQuery), [initialQuery]);
  useEffect(() => setCategory(initialCategory), [initialCategory]);
  useEffect(() => setFulfillment(initialFulfillment), [initialFulfillment]);

  const filtering = Boolean(deferredKeyword.trim()) || category !== 'Semua' || listingType !== 'ALL' || listingMode !== 'ALL' || sort !== 'newest' || fulfillment !== 'ALL';
  const query = useInfiniteQuery({
    queryKey: ['listings', deferredKeyword, category, listingType, listingMode, sort, fulfillment],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => endpoints.listings({ keyword: deferredKeyword.trim() || undefined, category: category === 'Semua' ? undefined : category, type: listingType === 'ALL' ? undefined : listingType, mode: listingMode === 'ALL' ? undefined : listingMode, sort, fulfillmentMethod: fulfillment === 'ALL' ? undefined : fulfillment, page: pageParam, limit: 24 }),
    getNextPageParam: last => last.page < last.totalPages ? last.page + 1 : undefined,
  });
  const wishlist = useQuery({ queryKey: ['wishlist'], queryFn: endpoints.wishlist });
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
  const columns = contentWidth >= 1120 ? 5 : contentWidth >= 900 ? 4 : contentWidth >= 680 ? 3 : contentWidth >= 440 ? 2 : 1;
  const gap = desktop ? 14 : 10;
  const cardWidth = (contentWidth - gap * (columns - 1)) / columns;
  const shelfWidth = desktop ? 188 : Math.min(176, width * .46);

  const chooseCategory = (value: string) => { setCategory(value); setKeyword(''); };
  const resetFilters = () => { setCategory('Semua'); setKeyword(''); setListingType('ALL'); setListingMode('ALL'); setSort('newest'); setFulfillment('ALL'); router.replace('/(student)/(tabs)'); };
  const toggleListingSaved = (id: string, saved: boolean) => toggleSaved.mutate({ id, saved });

  return (
    <Screen style={styles.page} backgroundColor="#FFFFFF">
      <Animated.View entering={FadeInDown.duration(180)} style={styles.welcomeRow}>
        <Text style={styles.welcomeTitle}>Halo, {firstName}!</Text>
        <Text style={styles.welcomeSubtitle}>Mau cari apa hari ini?</Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(25).duration(200)} style={styles.heroRow}>
        <View style={styles.heroMain}>
          <View style={styles.heroGlowOne} /><View style={styles.heroGlowTwo} />
          <View style={styles.heroCopy}><Text style={styles.heroTitle}>Barang kampus, jasa mahasiswa, satu tempat.</Text><Text style={styles.heroDescription}>Jual barang yang tidak terpakai dan temukan kebutuhan kampus dalam satu marketplace.</Text><View style={styles.heroActions}><Pressable onPress={() => router.push('/(student)/listing/form')} style={styles.heroButton}><Text style={styles.heroButtonText}>Mulai jual</Text><Ionicons name="arrow-forward" size={14} color="#0B4A91" /></Pressable></View></View>
          <View style={styles.heroTiles}><View style={[styles.heroTile, { transform: [{ rotate: '-5deg' }] }]}><Ionicons name="laptop-outline" size={38} color="#72B5FF" /><Text style={styles.heroTileText}>Elektronik</Text></View><View style={[styles.heroTile, styles.heroTileTwo]}><Ionicons name="book-outline" size={34} color="#FFB36A" /><Text style={styles.heroTileText}>Buku</Text></View><View style={[styles.heroTile, styles.heroTileThree]}><Ionicons name="construct-outline" size={34} color="#64D6B1" /><Text style={styles.heroTileText}>Jasa</Text></View></View>
        </View>
        {desktop ? <View style={styles.heroSide}>
          <Pressable onPress={() => router.push('/(student)/(tabs)/transactions')} style={({ pressed }) => [styles.escrowCard, pressed && styles.sidePromoPressed]}>
            <View style={styles.escrowDecorOne} />
            <View style={styles.escrowDecorTwo} />
            <View style={styles.escrowIcon}><Ionicons name="shield-checkmark-outline" size={30} color="#1769C2" /></View>
            <View style={styles.escrowBody}>
              <Text style={styles.escrowKicker}>TRANSAKSI AMAN</Text>
              <Text style={styles.escrowTitle}>Dana aman sampai barang diterima.</Text>
              <Text style={styles.escrowCopy}>Saldo diteruskan ke seller setelah serah-terima selesai.</Text>
            </View>
            <View style={styles.escrowAction}><Text style={styles.escrowActionText}>Pelajari alurnya</Text><Ionicons name="arrow-forward" size={14} color="#1769C2" /></View>
          </Pressable>
        </View> : null}
      </Animated.View>

      <View style={styles.categoryPanel}><SectionHeader title="Kategori" /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRail}>{categories.map(item => { const active = category === item.value; return <Pressable key={item.value} onPress={() => chooseCategory(item.value)} style={[styles.categoryItem, active && styles.categoryItemActive]}><View style={[styles.categoryIcon, { backgroundColor: item.tint }]}><Ionicons name={item.icon} size={25} color={item.color} /></View><Text style={[styles.categoryText, active && styles.categoryTextActive]}>{item.label}</Text></Pressable>; })}</ScrollView></View>

      {query.isLoading ? <Loader /> : query.isError ? <ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} /> : <>
        {!filtering ? <ListingShelf title="Baru di BMarket" subtitle="Listing terbaru dari sesama Binusian" items={latestRegular.slice(0, 10)} cardWidth={shelfWidth} onSeeAll={() => resetFilters()} savedIds={savedIds} onToggleSaved={toggleListingSaved} /> : null}
        {!filtering && preorders.length ? <ListingShelf title="Pre-order kampus" subtitle="Makanan, merch, dan PO mahasiswa yang sedang dibuka" items={preorders.slice(0, 10)} cardWidth={shelfWidth} onSeeAll={() => setListingMode('PREORDER')} savedIds={savedIds} onToggleSaved={toggleListingSaved} /> : null}
        {!filtering && products.length ? <ListingShelf title="Kebutuhan kuliah" subtitle="Barang preloved dan kebutuhan kampus" items={products.slice(0, 10)} cardWidth={shelfWidth} onSeeAll={() => setListingType('PRODUCT')} savedIds={savedIds} onToggleSaved={toggleListingSaved} /> : null}
        {!filtering && services.length ? <ListingShelf title="Jasa mahasiswa" subtitle="Desain, tutoring, bantuan tugas, dan lainnya" items={services.slice(0, 10)} cardWidth={shelfWidth} onSeeAll={() => setListingType('SERVICE')} savedIds={savedIds} onToggleSaved={toggleListingSaved} /> : null}
        {!filtering && meetupItems.length ? <ListingShelf title="Siap meetup" subtitle="Listing yang bisa diserah-terimakan langsung" items={meetupItems.slice(0, 10)} cardWidth={shelfWidth} onSeeAll={() => setFulfillment('CAMPUS_MEETUP')} savedIds={savedIds} onToggleSaved={toggleListingSaved} /> : null}

        <View style={styles.exploreSection}>
          <SectionHeader title={filtering ? 'Hasil pencarian' : 'Explore BMarket'} subtitle={filtering ? `${totalListings} listing ditemukan` : 'Rekomendasi barang dan jasa dari komunitas BINUS'} action={filtering ? 'Reset' : 'Lihat semua'} onPress={filtering ? resetFilters : undefined} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail}>
            <View style={styles.filterGroup}><Text style={styles.filterLabel}>Tipe</Text>{([['ALL','Semua'],['PRODUCT','Barang'],['SERVICE','Jasa']] as const).map(([value,label]) => <Pressable key={value} onPress={() => setListingType(value)} style={[styles.filterChip, listingType === value && styles.filterChipActive]}><Text style={[styles.filterChipText, listingType === value && styles.filterChipTextActive]}>{label}</Text></Pressable>)}</View>
            <View style={styles.filterGroup}><Text style={styles.filterLabel}>Model</Text>{([['ALL','Semua'],['ONE_OFF','Satuan'],['STOCKED','Ready stock'],['PREORDER','Pre-order']] as const).map(([value,label]) => <Pressable key={value} onPress={() => setListingMode(value)} style={[styles.filterChip, listingMode === value && styles.filterChipActive]}><Text style={[styles.filterChipText, listingMode === value && styles.filterChipTextActive]}>{label}</Text></Pressable>)}</View>
            <View style={styles.filterGroup}><Text style={styles.filterLabel}>Penyerahan</Text>{([['ALL','Semua'],['CAMPUS_MEETUP','Meetup'],['INSTANT_COURIER','Kurir']] as const).map(([value,label]) => <Pressable key={value} onPress={() => setFulfillment(value)} style={[styles.filterChip, fulfillment === value && styles.filterChipActive]}><Text style={[styles.filterChipText, fulfillment === value && styles.filterChipTextActive]}>{label}</Text></Pressable>)}</View>
            <View style={styles.filterGroup}><Text style={styles.filterLabel}>Urutkan</Text>{([['newest','Terbaru'],['price_asc','Harga ↑'],['price_desc','Harga ↓']] as const).map(([value,label]) => <Pressable key={value} onPress={() => setSort(value)} style={[styles.filterChip, sort === value && styles.filterChipActive]}><Text style={[styles.filterChipText, sort === value && styles.filterChipTextActive]}>{label}</Text></Pressable>)}</View>
          </ScrollView>
          {!listings.length ? <View style={styles.emptyDark}><Empty title="Belum ada listing yang cocok" message="Coba ganti kata kunci atau filter." icon="search-outline" /></View> : <><View style={[styles.grid, { gap }]}>{listings.map(item => <ListingCard storefront compact key={item.id} item={item} saved={savedIds.has(item.id)} onToggleSaved={() => toggleListingSaved(item.id, savedIds.has(item.id))} style={{ width: cardWidth }} onPress={() => router.push({ pathname: '/(student)/listing/[id]', params: { id: item.id } })} />)}</View>{query.hasNextPage ? <Pressable disabled={query.isFetchingNextPage} onPress={() => query.fetchNextPage()} style={styles.loadMore}><Text style={styles.loadMoreText}>{query.isFetchingNextPage ? 'Memuat…' : 'Muat lebih banyak'}</Text><Ionicons name="chevron-down" size={14} color="#1769C2" /></Pressable> : null}</>}
        </View>
      </>}

      <View style={styles.footer}><Text style={styles.footerBrand}>BMarket</Text><Text style={styles.footerText}>Marketplace komunitas BINUS untuk barang, jasa, dan transaksi yang lebih terstruktur.</Text></View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { paddingTop: 18, paddingBottom: 48, gap: 22, backgroundColor: '#FFFFFF' },
  welcomeRow: { minHeight: 44, justifyContent: 'center', gap: 0, marginBottom: -12 },
  welcomeTitle: { fontFamily: 'PoppinsBold', fontSize: 23, lineHeight: 30, color: '#172334' },
  welcomeSubtitle: { fontFamily: 'PoppinsRegular', fontSize: 12.5, lineHeight: 18, color: '#7A8CA0' },
  heroRow: { minHeight: 246, flexDirection: 'row', gap: 12 },
  heroMain: { minHeight: 246, flex: 2.35, overflow: 'hidden', position: 'relative', borderRadius: 14, backgroundColor: '#0B4A91', borderWidth: 1, borderColor: '#1E67AE', paddingHorizontal: 28, paddingVertical: 24, justifyContent: 'center' },
  heroGlowOne: { position: 'absolute', width: 330, height: 330, borderRadius: 165, right: -120, top: -155, backgroundColor: '#1365B8' }, heroGlowTwo: { position: 'absolute', width: 210, height: 210, borderRadius: 105, right: 110, bottom: -150, backgroundColor: '#0D579F' },
  heroCopy: { width: '62%', zIndex: 2, gap: 9 }, heroTitle: { fontFamily: 'PoppinsBold', fontSize: 28, lineHeight: 36, color: '#FFFFFF' }, heroDescription: { maxWidth: 520, fontFamily: 'PoppinsRegular', fontSize: 12.5, lineHeight: 20, color: '#C6D8EA' },
  heroActions: { flexDirection: 'row', gap: 8, marginTop: 6 }, heroButton: { minHeight: 42, paddingHorizontal: 16, borderRadius: 7, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 7 }, heroButtonText: { fontFamily: 'PoppinsSemiBold', fontSize: 12, color: '#0B4A91' },
  heroTiles: { position: 'absolute', right: 26, top: 27, width: 218, height: 170 }, heroTile: { position: 'absolute', right: 8, top: 0, width: 82, height: 82, borderRadius: 12, backgroundColor: 'rgba(255,255,255,.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,.28)', alignItems: 'center', justifyContent: 'center', gap: 4 }, heroTileTwo: { right: 68, top: 82, transform: [{ rotate: '4deg' }] }, heroTileThree: { right: 132, top: 21, transform: [{ rotate: '-3deg' }] }, heroTileText: { fontFamily: 'PoppinsSemiBold', fontSize: 10, color: '#FFFFFF' },
  heroSide: { flex: .95, minWidth: 280 },
  sidePromoPressed: { opacity: .84, transform: [{ scale: .99 }] },
  escrowCard: { flex: 1, minHeight: 246, position: 'relative', overflow: 'hidden', borderRadius: 14, borderWidth: 1, borderColor: '#C5DCF3', backgroundColor: '#F3F8FE', padding: 22, justifyContent: 'space-between' },
  escrowDecorOne: { position: 'absolute', width: 170, height: 170, borderRadius: 85, right: -64, top: -74, backgroundColor: '#E4F0FC' },
  escrowDecorTwo: { position: 'absolute', width: 112, height: 112, borderRadius: 56, right: 35, bottom: -70, backgroundColor: '#E9F3FD' },
  escrowIcon: { width: 50, height: 50, borderRadius: 14, backgroundColor: '#E5F1FD', alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  escrowBody: { maxWidth: 245, gap: 6, zIndex: 1 },
  escrowKicker: { fontFamily: 'PoppinsBold', fontSize: 10.5, letterSpacing: .8, color: '#1769C2' },
  escrowTitle: { fontFamily: 'PoppinsBold', fontSize: 18, lineHeight: 24, color: '#173B63' },
  escrowCopy: { fontFamily: 'PoppinsRegular', fontSize: 11.5, lineHeight: 18, color: '#657B92' },
  escrowAction: { alignSelf: 'flex-start', minHeight: 34, paddingHorizontal: 11, borderRadius: 8, backgroundColor: '#E5F1FD', flexDirection: 'row', alignItems: 'center', gap: 7, zIndex: 1 },
  escrowActionText: { fontFamily: 'PoppinsSemiBold', fontSize: 11, color: '#1769C2' },
  categoryPanel: { gap: 10, paddingTop: 2, paddingBottom: 2 }, categoryRail: { gap: 18, paddingRight: 8 }, categoryItem: { width: 84, minHeight: 82, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, backgroundColor: 'transparent' }, categoryItemActive: { backgroundColor: '#F1F7FE' }, categoryIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, categoryText: { fontFamily: 'PoppinsMedium', fontSize: 11.25, color: '#5F6F82' }, categoryTextActive: { color: '#1769C2', fontFamily: 'PoppinsSemiBold' },
  marketSection: { gap: 11 }, sectionHeader: { minHeight: 38, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }, sectionTitle: { fontFamily: 'PoppinsBold', fontSize: 18, color: '#172334' }, sectionSubtitle: { fontFamily: 'PoppinsRegular', fontSize: 12, color: '#7A8796', marginTop: 1 }, seeAll: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 5 }, seeAllText: { fontFamily: 'PoppinsSemiBold', fontSize: 11.5, color: '#1769C2' }, shelf: { gap: 12, paddingRight: 12, paddingBottom: 4 },
  exploreSection: { gap: 16 }, filterRail: { gap: 20, paddingRight: 10 }, filterGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 }, filterLabel: { fontFamily: 'PoppinsSemiBold', fontSize: 11.5, color: '#7A8796', marginRight: 2 }, filterChip: { minHeight: 34, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#DDE4EC', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }, filterChipActive: { borderColor: '#9FC5EC', backgroundColor: '#EEF6FF' }, filterChipText: { fontFamily: 'PoppinsMedium', fontSize: 11.5, color: '#627286' }, filterChipTextActive: { color: '#1769C2', fontFamily: 'PoppinsSemiBold' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' }, loadMore: { alignSelf: 'center', minHeight: 42, marginTop: 4, paddingHorizontal: 16, borderRadius: 7, borderWidth: 1, borderColor: '#B9D3ED', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 6 }, loadMoreText: { fontFamily: 'PoppinsSemiBold', fontSize: 11.5, color: '#1769C2' }, emptyDark: { overflow: 'hidden', borderRadius: 10 },
  footer: { marginTop: 12, minHeight: 78, paddingTop: 18, borderTopWidth: 1, borderTopColor: '#E1E7EE', alignItems: 'center', gap: 3 }, footerBrand: { fontFamily: 'PoppinsBold', fontSize: 16, color: '#1769C2' }, footerText: { fontFamily: 'PoppinsRegular', fontSize: 11.5, textAlign: 'center', color: '#7A8796' },
});
