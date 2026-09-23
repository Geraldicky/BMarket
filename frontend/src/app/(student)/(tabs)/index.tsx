import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { endpoints, errorMessage } from '@/lib/api';
import { Empty, ErrorState, Screen, Skeleton } from '@/components/ui';
import { ListingCard } from '@/components/listing-card';
import { webTransition, makeStyles, colors } from '@/constants/theme';
import { useAuth } from '@/store/auth';
import type { Listing } from '@/types';
import { CATEGORY_METADATA } from '@/lib/domain-metadata';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// All searching and filtering happens on the "Cari listing" tab; Beranda only links into it.
const openSearch = (params: Record<string, string> = {}) => router.push({ pathname: '/(student)/(tabs)/search', params } as never);

// Category accent colors work on light and dark backgrounds; the icon tile uses the accent at low opacity.
const categories = [
  { value: 'Semua', label: 'Semua', icon: 'grid-outline' as IconName, color: '#2F7FE0' },
  ...Object.entries(CATEGORY_METADATA).map(([value, meta]) => ({ value, ...meta, icon: meta.icon as IconName })),
];

// Jasa maps to the Jasa listing type; every other category is a goods category.
const openCategory = (value: string) => {
  if (value === 'SERVICES') openSearch({ type: 'SERVICE' });
  else if (value === 'Semua') openSearch();
  else openSearch({ type: 'PRODUCT', category: value });
};

function SectionHeader({ title, subtitle, action = 'Lihat semua', onPress }: { title: string; subtitle?: string; action?: string; onPress?: () => void }) {
  const styles = useStyles();
  return <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>{title}</Text>{subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}</View>{onPress ? <Pressable onPress={onPress} style={styles.seeAll}><Text style={styles.seeAllText}>{action}</Text><Ionicons name="chevron-forward" size={13} color={colors.primary} /></Pressable> : null}</View>;
}

function ListingShelf({ title, subtitle, items, cardWidth, onSeeAll, savedIds, onToggleSaved }: { title: string; subtitle: string; items: Listing[]; cardWidth: number; onSeeAll?: () => void; savedIds: Set<string>; onToggleSaved: (id: string, saved: boolean) => void }) {
  const styles = useStyles();
  if (!items.length) return null;
  return <View style={styles.marketSection}><SectionHeader title={title} subtitle={subtitle} onPress={onSeeAll} /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelf}>{items.map(item => <ListingCard key={item.id} storefront compact item={item} saved={savedIds.has(item.id)} onToggleSaved={() => onToggleSaved(item.id, savedIds.has(item.id))} style={{ width: cardWidth }} onPress={() => router.push({ pathname: '/(student)/listing/[id]', params: { id: item.id } })} />)}</ScrollView></View>;
}

function HomeSkeleton({ cardWidth }: { cardWidth: number }) {
  const styles = useStyles();
  return <View style={styles.skeletonPage}>
    <View style={styles.skeletonSection}><Skeleton width={180} height={22} /><Skeleton width={280} height={12} /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelf}>{[0,1,2,3,4].map(item => <View key={item} style={[styles.skeletonCard, { width: cardWidth }]}><Skeleton height={150} radius={12} /><View style={styles.skeletonCardBody}><Skeleton width="82%" height={13} /><Skeleton width="58%" height={18} /><Skeleton width="68%" height={10} /></View></View>)}</ScrollView></View>
  </View>;
}

export default function HomeScreen() {
  const styles = useStyles();
  const user = useAuth(state => state.user);
  const { width } = useWindowDimensions();
  const desktop = width >= 960;
  const client = useQueryClient();

  const query = useQuery({ queryKey: ['listings', 'home'], queryFn: () => endpoints.listings({ sort: 'newest', page: 1, limit: 48 }) });
  const wishlist = useQuery({ queryKey: ['wishlist'], queryFn: endpoints.wishlist });
  const savedIds = new Set((wishlist.data || []).map(entry => entry.listing.id));
  const toggleSaved = useMutation({ mutationFn: ({ id, saved }: { id: string; saved: boolean }) => saved ? endpoints.unsaveListing(id) : endpoints.saveListing(id), onSuccess: (_data, variables) => { client.invalidateQueries({ queryKey: ['wishlist'] }); client.invalidateQueries({ queryKey: ['saved-status', variables.id] }); } });

  const listings = query.data?.data || [];
  const latestRegular = listings.filter(item => item.mode !== 'PREORDER');
  // Pre-orders have their own shelf, so the goods shelf shows one-off and stocked products only.
  const products = listings.filter(item => item.type === 'PRODUCT' && item.mode !== 'PREORDER');
  const services = listings.filter(item => item.type === 'SERVICE');
  const preorders = listings.filter(item => item.mode === 'PREORDER' && item.preorderAccepting);
  const firstName = user?.name?.trim().split(' ')[0] || 'Binusian';
  const shelfWidth = desktop ? 188 : Math.min(168, width * .44);
  const toggleListingSaved = (id: string, saved: boolean) => toggleSaved.mutate({ id, saved });

  return (
    <Screen style={styles.page} backgroundColor={colors.surface}>
      <View style={styles.welcomeRow}>
        <Text style={styles.welcomeTitle}>Halo, {firstName}!</Text>
        <Text style={styles.welcomeSubtitle}>Temukan barang, jasa, dan pre-order dari komunitas BINUS.</Text>
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel="Cari barang, jasa, atau kebutuhan kampus" onPress={() => openSearch()} style={({ pressed }) => [styles.searchEntry, pressed && styles.searchEntryPressed]}>
        <View style={styles.searchEntryIcon}><Ionicons name="search" size={20} color={colors.primary} /></View>
        <Text style={styles.searchEntryText}>Cari barang, jasa, atau kebutuhan kampus</Text>
        <Ionicons name="arrow-forward" size={18} color={colors.muted} />
      </Pressable>

      <View style={styles.categoryPanel}><SectionHeader title="Kategori" /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRail}>{categories.map(item => <Pressable key={item.value} onPress={() => openCategory(item.value)} style={({ pressed }) => [styles.categoryItem, pressed && styles.categoryItemPressed]}><View style={[styles.categoryIcon, { backgroundColor: `${item.color}22` }]}><Ionicons name={item.icon} size={25} color={item.color} /></View><Text style={styles.categoryText}>{item.label}</Text></Pressable>)}</ScrollView></View>

      {query.isLoading ? <HomeSkeleton cardWidth={shelfWidth} /> : query.isError ? <ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} /> : !listings.length ? (
        <Empty title="Belum ada listing" message="Listing dari sesama Binusian akan tampil di sini." icon="storefront-outline" />
      ) : <>
        <ListingShelf title="Baru di BMarket" subtitle="Listing terbaru dari sesama Binusian" items={latestRegular.slice(0, 10)} cardWidth={shelfWidth} onSeeAll={() => openSearch()} savedIds={savedIds} onToggleSaved={toggleListingSaved} />
        <ListingShelf title="Pre-order kampus" subtitle="Makanan, merch, dan PO mahasiswa yang sedang dibuka" items={preorders.slice(0, 10)} cardWidth={shelfWidth} onSeeAll={() => openSearch({ type: 'PRODUCT', mode: 'PREORDER' })} savedIds={savedIds} onToggleSaved={toggleListingSaved} />
        <ListingShelf title="Barang mahasiswa" subtitle="Elektronik, buku, fashion, dan kebutuhan kampus lainnya" items={products.slice(0, 10)} cardWidth={shelfWidth} onSeeAll={() => openSearch({ type: 'PRODUCT' })} savedIds={savedIds} onToggleSaved={toggleListingSaved} />
        <ListingShelf title="Jasa mahasiswa" subtitle="Desain, tutoring, bantuan tugas, dan lainnya" items={services.slice(0, 10)} cardWidth={shelfWidth} onSeeAll={() => openSearch({ type: 'SERVICE' })} savedIds={savedIds} onToggleSaved={toggleListingSaved} />
      </>}

    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  page: { paddingTop: 18, paddingBottom: 48, gap: 24, backgroundColor: colors.surface },
  welcomeRow: { minHeight: 44, justifyContent: 'center', gap: 0 },
  welcomeTitle: { fontFamily: 'PoppinsBold', fontSize: 23, lineHeight: 30, color: colors.text, letterSpacing: -.2 },
  welcomeSubtitle: { fontFamily: 'PoppinsRegular', fontSize: 12.5, lineHeight: 18, color: colors.muted },
  searchEntry: { minHeight: 58, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.primaryBorder, backgroundColor: colors.primaryMist, flexDirection: 'row', alignItems: 'center', gap: 11, ...webTransition },
  searchEntryPressed: { backgroundColor: colors.primarySoft, transform: [{ scale: .995 }] },
  searchEntryIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  searchEntryText: { flex: 1, fontFamily: 'PoppinsMedium', fontSize: 13, color: colors.textSoft },

  categoryPanel: { gap: 10, paddingTop: 2, paddingBottom: 2 },
  categoryRail: { gap: 9, paddingRight: 8 },
  categoryItem: { width: 90, minHeight: 84, alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, backgroundColor: 'transparent', ...webTransition },
  categoryItemPressed: { transform: [{ scale: .96 }], opacity: .78 },
  categoryIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  categoryText: { fontFamily: 'PoppinsMedium', fontSize: 11.25, color: colors.textSoft },

  marketSection: { gap: 11 },
  sectionHeader: { minHeight: 40, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { fontFamily: 'PoppinsBold', fontSize: 18.5, color: colors.text, letterSpacing: -.18 },
  sectionSubtitle: { fontFamily: 'PoppinsRegular', fontSize: 11.75, color: colors.muted, marginTop: 1 },
  seeAll: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6 },
  seeAllText: { fontFamily: 'PoppinsSemiBold', fontSize: 11.5, color: colors.primary },
  shelf: { gap: 12, paddingRight: 12, paddingBottom: 8, paddingTop: 2 },

  skeletonPage: { gap: 22 },
  skeletonSection: { gap: 8 },
  skeletonCard: { overflow: 'hidden', borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface },
  skeletonCardBody: { padding: 12, gap: 8 },

}));
