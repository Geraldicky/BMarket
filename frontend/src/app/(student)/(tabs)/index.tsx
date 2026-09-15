import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { TypewriterLoop, TypewriterOnce } from '@/components/typewriter';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { endpoints, errorMessage } from '@/lib/api';
import { Empty, ErrorState, Screen, Skeleton } from '@/components/ui';
import { ListingCard } from '@/components/listing-card';
import { webTransition, makeStyles, colors } from '@/constants/theme';
import { useAuth } from '@/store/auth';
import type { Listing } from '@/types';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// All searching and filtering happens on the "Cari listing" tab; Beranda only links into it.
const openSearch = (params: Record<string, string> = {}) => router.push({ pathname: '/(student)/(tabs)/search', params } as never);

// Category accent colors work on light and dark backgrounds; the icon tile uses the accent at low opacity.
const categories = [
  { value: 'Semua', label: 'Semua', icon: 'grid-outline' as IconName, color: '#2F7FE0' },
  { value: 'ELECTRONICS', label: 'Elektronik', icon: 'game-controller-outline' as IconName, color: '#5F72E0' },
  { value: 'BOOKS', label: 'Buku', icon: 'book-outline' as IconName, color: '#E0801F' },
  { value: 'FASHION', label: 'Fashion', icon: 'shirt-outline' as IconName, color: '#A064D6' },
  { value: 'FOOD', label: 'Makanan', icon: 'fast-food-outline' as IconName, color: '#DE6155' },
  { value: 'SERVICES', label: 'Jasa', icon: 'construct-outline' as IconName, color: '#1F9C80' },
  { value: 'SPORTS', label: 'Olahraga', icon: 'basketball-outline' as IconName, color: '#D0961E' },
  { value: 'OTHER', label: 'Lainnya', icon: 'apps-outline' as IconName, color: '#7C8EA2' },
];

// Rotating marketplace-style taglines under the greeting.
const welcomePhrases = [
  'Mau cari apa hari ini?',
  'Laptop bekas mulus harga mahasiswa? Ada!',
  'Buku kuliah semester depan, cek di sini.',
  'Butuh jasa desain buat tugas? Tinggal cari.',
  'Pre-order makanan kampus lagi dibuka!',
  'Barang nganggur? Jual jadi cuan.',
  'Belanja aman pakai escrow BMarket.',
];

// Quick filters on the "Cari listing" card at the bottom of Beranda.
const searchShortcuts: { label: string; icon: IconName; params: Record<string, string> }[] = [
  { label: 'Barang', icon: 'cube-outline', params: { type: 'PRODUCT' } },
  { label: 'Jasa', icon: 'construct-outline', params: { type: 'SERVICE' } },
  { label: 'Pre-order', icon: 'calendar-outline', params: { type: 'PRODUCT', mode: 'PREORDER' } },
  { label: 'Termurah', icon: 'arrow-down', params: { sort: 'price_asc' } },
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
  return <View style={styles.marketSection}><SectionHeader title={title} subtitle={subtitle} onPress={onSeeAll} /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelf}>{items.map((item, index) => <Animated.View key={item.id} entering={FadeInDown.delay(Math.min(index * 28, 180)).duration(190)}><ListingCard storefront compact item={item} saved={savedIds.has(item.id)} onToggleSaved={() => onToggleSaved(item.id, savedIds.has(item.id))} style={{ width: cardWidth }} onPress={() => router.push({ pathname: '/(student)/listing/[id]', params: { id: item.id } })} /></Animated.View>)}</ScrollView></View>;
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
  // Re-play the one-time greeting animation every time the user comes back to Beranda.
  const [greetingRun, setGreetingRun] = useState(0);
  useFocusEffect(useCallback(() => { setGreetingRun(run => run + 1); }, []));
  const shelfWidth = desktop ? 188 : Math.min(168, width * .44);
  const toggleListingSaved = (id: string, saved: boolean) => toggleSaved.mutate({ id, saved });

  return (
    <Screen style={styles.page} backgroundColor={colors.surface}>
      <Animated.View entering={FadeInDown.duration(180)} style={styles.welcomeRow}>
        <TypewriterOnce key={`${greetingRun}-${firstName}`} text={`Halo, ${firstName}!`} style={styles.welcomeTitle} />
        <TypewriterLoop phrases={welcomePhrases} style={styles.welcomeSubtitle} numberOfLines={1} />
      </Animated.View>

      <View style={styles.categoryPanel}><SectionHeader title="Kategori" /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRail}>{categories.map(item => <Pressable key={item.value} onPress={() => openCategory(item.value)} style={({ pressed }) => [styles.categoryItem, pressed && styles.categoryItemPressed]}><View style={[styles.categoryIcon, { backgroundColor: `${item.color}22` }]}><Ionicons name={item.icon} size={25} color={item.color} /></View><Text style={styles.categoryText}>{item.label}</Text></Pressable>)}</ScrollView></View>

      {query.isLoading ? <HomeSkeleton cardWidth={shelfWidth} /> : query.isError ? <ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} /> : !listings.length ? (
        <Empty title="Belum ada listing" message="Listing dari sesama Binusian akan tampil di sini." icon="storefront-outline" />
      ) : <>
        <ListingShelf title="Baru di BMarket" subtitle="Listing terbaru dari sesama Binusian" items={latestRegular.slice(0, 10)} cardWidth={shelfWidth} onSeeAll={() => openSearch()} savedIds={savedIds} onToggleSaved={toggleListingSaved} />
        <ListingShelf title="Pre-order kampus" subtitle="Makanan, merch, dan PO mahasiswa yang sedang dibuka" items={preorders.slice(0, 10)} cardWidth={shelfWidth} onSeeAll={() => openSearch({ type: 'PRODUCT', mode: 'PREORDER' })} savedIds={savedIds} onToggleSaved={toggleListingSaved} />
        <ListingShelf title="Barang mahasiswa" subtitle="Elektronik, buku, fashion, dan kebutuhan kampus lainnya" items={products.slice(0, 10)} cardWidth={shelfWidth} onSeeAll={() => openSearch({ type: 'PRODUCT' })} savedIds={savedIds} onToggleSaved={toggleListingSaved} />
        <ListingShelf title="Jasa mahasiswa" subtitle="Desain, tutoring, bantuan tugas, dan lainnya" items={services.slice(0, 10)} cardWidth={shelfWidth} onSeeAll={() => openSearch({ type: 'SERVICE' })} savedIds={savedIds} onToggleSaved={toggleListingSaved} />
      </>}

      <View style={[styles.searchCta, !desktop && styles.searchCtaMobile]}>
        <View pointerEvents="none" style={[styles.ctaBubble, styles.ctaBubbleLarge]} />
        <View pointerEvents="none" style={[styles.ctaBubble, styles.ctaBubbleSmall]} />
        <View style={[styles.searchCtaMain, !desktop && styles.searchCtaMainMobile]}>
          <View style={styles.searchCtaCopy}>
            <View style={styles.searchCtaEyebrow}><Ionicons name="sparkles" size={13} color={colors.warning} /><Text style={styles.searchCtaEyebrowText}>BELUM KETEMU YANG DICARI?</Text></View>
            <Text style={[styles.searchCtaTitle, !desktop && styles.searchCtaTitleMobile]}>Cari listing sesuai kebutuhanmu</Text>
            <Text style={styles.searchCtaText}>Saring barang dan jasa berdasarkan tipe, model, kategori, sampai harga termurah.</Text>
            <View style={styles.ctaChips}>
              {searchShortcuts.map(item => (
                <Pressable key={item.label} accessibilityRole="button" onPress={() => openSearch(item.params)} style={({ pressed }) => [styles.ctaChip, pressed && styles.ctaChipPressed]}>
                  <Ionicons name={item.icon} size={14} color={colors.primary} />
                  <Text style={styles.ctaChipText}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={[styles.searchCtaSide, !desktop && styles.searchCtaSideMobile]}>
            {desktop ? <View style={styles.searchCtaIllustration}><Ionicons name="search" size={40} color={colors.primary} /></View> : null}
            <Pressable accessibilityRole="button" onPress={() => openSearch()} style={({ pressed }) => [styles.searchCtaButton, !desktop && styles.searchCtaButtonMobile, pressed && styles.ctaChipPressed]}>
              <Text style={styles.searchCtaButtonText}>Mulai cari</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </View>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  page: { paddingTop: 18, paddingBottom: 48, gap: 24, backgroundColor: colors.surface },
  welcomeRow: { minHeight: 44, justifyContent: 'center', gap: 0 },
  welcomeTitle: { fontFamily: 'PoppinsBold', fontSize: 23, lineHeight: 30, color: colors.text, letterSpacing: -.2 },
  welcomeSubtitle: { fontFamily: 'PoppinsRegular', fontSize: 12.5, lineHeight: 18, color: colors.muted },

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
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 6, paddingHorizontal: 2 },
  seeAllText: { fontFamily: 'PoppinsSemiBold', fontSize: 11.5, color: colors.primary },
  shelf: { gap: 12, paddingRight: 12, paddingBottom: 8, paddingTop: 2 },

  skeletonPage: { gap: 22 },
  skeletonSection: { gap: 8 },
  skeletonCard: { overflow: 'hidden', borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface },
  skeletonCardBody: { padding: 12, gap: 8 },

  // Soft tinted card: light blue ground with dark text so it stays readable without shouting.
  searchCta: { position: 'relative', overflow: 'hidden', paddingHorizontal: 28, paddingVertical: 26, borderRadius: 18, borderWidth: 1, borderColor: colors.primaryBorder, backgroundColor: colors.primaryMist },
  searchCtaMobile: { paddingHorizontal: 18, paddingVertical: 20, borderRadius: 16 },
  ctaBubble: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(11,87,183,.06)' },
  ctaBubbleLarge: { width: 260, height: 260, right: -70, top: -110 },
  ctaBubbleSmall: { width: 140, height: 140, right: 150, bottom: -90, backgroundColor: 'rgba(125,187,255,.16)' },
  searchCtaMain: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  searchCtaMainMobile: { flexDirection: 'column', alignItems: 'stretch', gap: 16 },
  searchCtaCopy: { flex: 1, minWidth: 0, gap: 6 },
  searchCtaEyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  searchCtaEyebrowText: { fontFamily: 'PoppinsSemiBold', fontSize: 10.5, letterSpacing: .6, color: colors.primary },
  searchCtaTitle: { fontFamily: 'PoppinsBold', fontSize: 22, lineHeight: 30, color: colors.text, letterSpacing: -.2 },
  searchCtaTitleMobile: { fontSize: 18, lineHeight: 25 },
  searchCtaText: { fontFamily: 'PoppinsRegular', fontSize: 12.5, lineHeight: 19, color: colors.textSoft },
  ctaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  ctaChip: { minHeight: 34, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.primaryBorder, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 6, ...webTransition },
  ctaChipPressed: { opacity: .8, transform: [{ scale: .97 }] },
  ctaChipText: { fontFamily: 'PoppinsSemiBold', fontSize: 12, color: colors.primary },
  searchCtaSide: { alignItems: 'center', gap: 16 },
  searchCtaSideMobile: { alignItems: 'stretch' },
  searchCtaIllustration: { width: 84, height: 84, borderRadius: 24, borderWidth: 1, borderColor: colors.primaryBorder, backgroundColor: 'rgba(11,87,183,.08)', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }] },
  searchCtaButton: { minHeight: 46, paddingHorizontal: 22, borderRadius: 12, backgroundColor: colors.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, ...webTransition },
  searchCtaButtonMobile: { width: '100%' },
  searchCtaButtonText: { fontFamily: 'PoppinsBold', fontSize: 13.5, color: '#FFFFFF' },
}));
