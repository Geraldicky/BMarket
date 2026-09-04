import Ionicons from '@expo/vector-icons/Ionicons';
import { useDeferredValue, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { endpoints, errorMessage } from '@/lib/api';
import { Empty, ErrorState, Field, Loader, Screen } from '@/components/ui';
import { ListingCard } from '@/components/listing-card';
import { colors, layout, radius } from '@/constants/theme';
import { useAuth } from '@/store/auth';
import type { Listing } from '@/types';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const categories = [
  { value: 'Semua', label: 'Semua', icon: 'grid-outline' as IconName, tint: '#EAF3FF', color: '#1167D8' },
  { value: 'ELECTRONICS', label: 'Elektronik', icon: 'phone-portrait-outline' as IconName, tint: '#E7F4FF', color: '#1676C8' },
  { value: 'BOOKS', label: 'Buku', icon: 'book-outline' as IconName, tint: '#FFF2E1', color: '#D97706' },
  { value: 'FASHION', label: 'Fashion', icon: 'shirt-outline' as IconName, tint: '#F3ECFF', color: '#8255C7' },
  { value: 'FOOD', label: 'Makanan', icon: 'fast-food-outline' as IconName, tint: '#FFF0ED', color: '#D95D52' },
  { value: 'SERVICES', label: 'Jasa', icon: 'construct-outline' as IconName, tint: '#E6F7F2', color: '#14856C' },
  { value: 'SPORTS', label: 'Olahraga', icon: 'basketball-outline' as IconName, tint: '#FFF5DA', color: '#C78308' },
  { value: 'OTHER', label: 'Lainnya', icon: 'ellipsis-horizontal' as IconName, tint: '#EEF1F4', color: '#657587' },
];

const popular = ['Laptop', 'Buku kuliah', 'Jasa desain', 'Kalkulator'];

function SectionHeader({ title, subtitle, action, onPress }: { title: string; subtitle?: string; action?: string; onPress?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {action ? (
        <Pressable onPress={onPress} style={styles.seeAll}>
          <Text style={styles.seeAllText}>{action}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

function ListingShelf({ title, subtitle, items, cardWidth, onSeeAll }: { title: string; subtitle: string; items: Listing[]; cardWidth: number; onSeeAll?: () => void }) {
  if (!items.length) return null;
  return (
    <View style={styles.marketSection}>
      <SectionHeader title={title} subtitle={subtitle} action="Lihat semua" onPress={onSeeAll} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll} contentContainerStyle={styles.shelf}>
        {items.map(item => (
          <ListingCard
            compact
            key={item.id}
            item={item}
            style={{ width: cardWidth }}
            onPress={() => router.push({ pathname: '/(student)/listing/[id]', params: { id: item.id } })}
          />
        ))}
      </ScrollView>
    </View>
  );
}

export default function HomeScreen() {
  const user = useAuth(state => state.user);
  const { width } = useWindowDimensions();
  const desktop = width >= 960;
  const [keyword, setKeyword] = useState('');
  const deferredKeyword = useDeferredValue(keyword);
  const [category, setCategory] = useState('Semua');
  const filtering = Boolean(deferredKeyword.trim()) || category !== 'Semua';

  const query = useQuery({
    queryKey: ['listings', deferredKeyword, category],
    queryFn: () => endpoints.listings({
      keyword: deferredKeyword.trim() || undefined,
      category: category === 'Semua' ? undefined : category,
      limit: 50,
    }),
  });

  const contentWidth = Math.max(288, Math.min(width - (desktop ? 80 : 32), layout.contentMaxWidth - 80));
  const columns = contentWidth >= 1180 ? 6 : contentWidth >= 960 ? 5 : contentWidth >= 740 ? 4 : contentWidth >= 520 ? 3 : contentWidth >= 350 ? 2 : 1;
  const gridGap = desktop ? 12 : 10;
  const cardWidth = (contentWidth - gridGap * (columns - 1)) / columns;
  const shelfCardWidth = desktop ? Math.min(216, cardWidth) : Math.min(184, width * .46);
  const categoryColumns = desktop ? 8 : 4;
  const categoryGap = desktop ? 10 : 8;
  const categoryWidth = (contentWidth - 40 - categoryGap * (categoryColumns - 1)) / categoryColumns;

  const listings = query.data?.data || [];
  const services = listings.filter(item => item.type === 'SERVICE').slice(0, 8);
  const products = listings.filter(item => item.type === 'PRODUCT').slice(0, 8);
  const firstName = user?.name?.trim().split(' ')[0] || 'Binusian';

  const chooseCategory = (value: string) => {
    setCategory(value);
    setKeyword('');
  };

  const quickActions: { label: string; caption: string; icon: IconName; tint: string; color: string; onPress: () => void }[] = [
    { label: 'Buat listing', caption: 'Mulai jual', icon: 'add-circle-outline', tint: colors.primarySoft, color: colors.primary, onPress: () => router.push('/(student)/listing/form') },
    { label: 'Elektronik', caption: 'Cari gadget', icon: 'phone-portrait-outline', tint: '#E7F4FF', color: '#1676C8', onPress: () => chooseCategory('ELECTRONICS') },
    { label: 'Buku kuliah', caption: 'Cari buku', icon: 'book-outline', tint: '#FFF2E1', color: '#D97706', onPress: () => chooseCategory('BOOKS') },
    { label: 'Jasa mahasiswa', caption: 'Cari bantuan', icon: 'construct-outline', tint: '#E6F7F2', color: '#14856C', onPress: () => chooseCategory('SERVICES') },
    { label: 'Transaksi', caption: 'Cek pesanan', icon: 'receipt-outline', tint: '#F3ECFF', color: '#8255C7', onPress: () => router.push('/(student)/(tabs)/transactions') },
    { label: 'Pesan', caption: 'Buka chat', icon: 'chatbubble-ellipses-outline', tint: '#FFF0ED', color: '#D95D52', onPress: () => router.push('/(student)/(tabs)/chats') },
  ];

  return (
    <Screen style={styles.page}>
      <Animated.View entering={FadeInDown.duration(200)} style={styles.introRow}>
        <View>
          <Text style={styles.introEyebrow}>MARKETPLACE KOMUNITAS BINUS</Text>
          <Text style={styles.introTitle}>Halo, {firstName}!</Text>
        </View>
        <View style={styles.campusBadge}>
          <Ionicons name="location-outline" size={16} color={colors.primary} />
          <View><Text style={styles.campusLabel}>Kampus</Text><Text style={styles.campusName}>BINUS University</Text></View>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(30).duration(220)} style={styles.searchArea}>
        <Field
          value={keyword}
          onChangeText={setKeyword}
          icon="search-outline"
          placeholder="Cari laptop, buku, jasa desain, makanan, dan lainnya..."
          returnKeyType="search"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll} contentContainerStyle={styles.popularRow}>
          <Text style={styles.popularLabel}>Pencarian populer</Text>
          {popular.map(item => <Pressable key={item} onPress={() => setKeyword(item)} style={styles.popularChip}><Text style={styles.popularText}>{item}</Text></Pressable>)}
        </ScrollView>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(60).duration(240)} style={[styles.heroGrid, !desktop && styles.heroGridMobile]}>
        <View style={[styles.heroMain, !desktop && styles.heroMainMobile]}>
          <View style={styles.heroCircleLarge} />
          <View style={styles.heroCircleSmall} />
          <View style={[styles.heroContent, !desktop && styles.heroContentMobile]}>
            <View style={styles.heroBadge}><Ionicons name="school-outline" size={14} color="#DCEBFF" /><Text style={styles.heroBadgeText}>DARI BINUSIAN, UNTUK BINUSIAN</Text></View>
            <Text style={[styles.heroTitle, !desktop && styles.heroTitleMobile]}>Beli dari teman kampus, jual tanpa ribet.</Text>
            <Text style={styles.heroCopy}>Temukan barang dan jasa yang relevan untuk kehidupan kuliahmu.</Text>
            <View style={styles.heroActions}>
              <Pressable onPress={() => router.push('/(student)/listing/form')} style={styles.heroPrimary}><Text style={styles.heroPrimaryText}>Mulai berjualan</Text><Ionicons name="arrow-forward" size={15} color={colors.primaryDark} /></Pressable>
              <Pressable onPress={() => chooseCategory('Semua')} style={styles.heroSecondary}><Text style={styles.heroSecondaryText}>Lihat etalase</Text></Pressable>
            </View>
          </View>
          <View style={[styles.heroVisual, !desktop && styles.heroVisualMobile]}>
            <View style={[styles.productTile, styles.tileBook]}><Ionicons name="book" size={33} color="#8255C7" /></View>
            <View style={[styles.productTile, styles.tileLaptop]}><Ionicons name="laptop" size={40} color={colors.primary} /></View>
            <View style={[styles.productTile, styles.tileHeadset]}><Ionicons name="headset" size={31} color="#D97706" /></View>
          </View>
        </View>

        <View style={styles.heroSide}>
          <View style={styles.safeCard}>
            <View style={styles.sideIcon}><Ionicons name="shield-checkmark" size={27} color={colors.success} /></View>
            <View style={styles.sideBody}><Text style={styles.sideTitle}>Transaksi lebih aman</Text><Text style={styles.sideCopy}>Profil, chat, dan status transaksi tercatat di BMarket.</Text></View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </View>
          <Pressable onPress={() => router.push('/(student)/(tabs)/sell')} style={styles.sellerCard}>
            <View style={styles.sellerCardCopy}><Text style={styles.sellerKicker}>UNTUK SELLER</Text><Text style={styles.sellerTitle}>Punya barang yang sudah tidak dipakai?</Text><Text style={styles.sellerLink}>Buka etalase saya →</Text></View>
            <Ionicons name="storefront-outline" size={54} color="#A9CAEF" />
          </Pressable>
        </View>
      </Animated.View>

      <View style={styles.quickPanel}>
        {quickActions.map(item => (
          <Pressable key={item.label} onPress={item.onPress} style={({ pressed }) => [styles.quickItem, pressed && styles.pressed]}>
            <View style={[styles.quickIcon, { backgroundColor: item.tint }]}><Ionicons name={item.icon} size={22} color={item.color} /></View>
            <View><Text style={styles.quickLabel}>{item.label}</Text><Text style={styles.quickCaption}>{item.caption}</Text></View>
          </Pressable>
        ))}
      </View>

      <View style={styles.categoryPanel}>
        <SectionHeader title="Kategori" subtitle="Cari berdasarkan kebutuhanmu" />
        <View style={[styles.categoryGrid, { gap: categoryGap }]}>
          {categories.map(item => {
            const active = category === item.value;
            return (
              <Pressable
                key={item.value}
                onPress={() => chooseCategory(item.value)}
                style={({ pressed }) => [styles.categoryItem, { width: categoryWidth }, active && styles.categoryActive, pressed && styles.pressed]}
              >
                <View style={[styles.categoryIcon, { backgroundColor: item.tint }]}><Ionicons name={item.icon} size={27} color={item.color} /></View>
                <Text numberOfLines={1} style={[styles.categoryText, active && styles.categoryTextActive]}>{item.label}</Text>
                {active ? <View style={styles.categoryCheck}><Ionicons name="checkmark" size={10} color={colors.white} /></View> : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable onPress={() => router.push('/(student)/listing/form')} style={styles.communityStrip}>
        <View style={styles.communityIcon}><Ionicons name="megaphone-outline" size={24} color={colors.primary} /></View>
        <View style={styles.communityBody}><Text style={styles.communityTitle}>Sekarang listing bisa langsung tayang</Text><Text style={styles.communityCopy}>Publikasikan barang atau jasamu dan temukan pembeli dari komunitas BINUS.</Text></View>
        <View style={styles.communityAction}><Text style={styles.communityActionText}>Buat listing</Text><Ionicons name="arrow-forward" size={14} color={colors.primary} /></View>
      </Pressable>

      {query.isLoading ? <Loader /> : query.isError ? (
        <ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} />
      ) : (
        <>
          {!filtering ? <ListingShelf title="Baru di BMarket" subtitle="Listing terbaru dari sesama Binusian" items={listings.slice(0, 10)} cardWidth={shelfCardWidth} onSeeAll={() => chooseCategory('Semua')} /> : null}
          {!filtering ? <ListingShelf title="Jasa pilihan mahasiswa" subtitle="Temukan bantuan untuk tugas dan kebutuhan kampus" items={services} cardWidth={shelfCardWidth} onSeeAll={() => chooseCategory('SERVICES')} /> : null}
          {!filtering && products.length ? <ListingShelf title="Barang untuk kebutuhan kuliah" subtitle="Barang preloved yang masih layak dipakai" items={products} cardWidth={shelfCardWidth} onSeeAll={() => chooseCategory('Semua')} /> : null}

          <View style={styles.catalogue}>
            <SectionHeader
              title={filtering ? 'Hasil pencarian' : 'Jelajahi semua listing'}
              subtitle={filtering ? `${query.data?.total || 0} listing ditemukan` : 'Rekomendasi terbaru untukmu'}
              action={filtering ? 'Reset filter' : undefined}
              onPress={() => chooseCategory('Semua')}
            />
            {!listings.length ? (
              <Empty title="Belum ada listing yang cocok" message="Coba ganti kata kunci atau pilih kategori lain." icon="search-outline" />
            ) : (
              <View style={[styles.grid, { gap: gridGap }]}>
                {listings.map(item => (
                  <ListingCard
                    compact
                    key={item.id}
                    item={item}
                    style={{ width: cardWidth }}
                    onPress={() => router.push({ pathname: '/(student)/listing/[id]', params: { id: item.id } })}
                  />
                ))}
              </View>
            )}
          </View>
        </>
      )}

      <View style={styles.footerNote}>
        <Ionicons name="shield-checkmark-outline" size={16} color={colors.success} />
        <Text style={styles.footerText}>BMarket adalah marketplace khusus komunitas BINUS. Laporkan listing yang mencurigakan agar komunitas tetap aman.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { paddingTop: 24, paddingBottom: 48, gap: 28 },
  introRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 18 },
  introEyebrow: { fontFamily: 'PoppinsBold', fontSize: 10, letterSpacing: .8, color: colors.primary },
  introTitle: { fontFamily: 'PoppinsBold', fontSize: 29, lineHeight: 37, color: colors.text },
  campusBadge: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  campusLabel: { fontFamily: 'PoppinsRegular', fontSize: 10, color: colors.muted },
  campusName: { fontFamily: 'PoppinsSemiBold', fontSize: 12, color: colors.text },
  searchArea: { gap: 9 },
  horizontalScroll: { flexGrow: 0 },
  popularRow: { alignItems: 'center', gap: 8, paddingRight: 12 },
  popularLabel: { fontFamily: 'PoppinsMedium', fontSize: 11, color: colors.muted, marginRight: 3 },
  popularChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  popularText: { fontFamily: 'PoppinsMedium', fontSize: 11, color: colors.textSoft },
  heroGrid: { minHeight: 290, flexDirection: 'row', gap: 14 },
  heroGridMobile: { flexDirection: 'column' },
  heroMain: { position: 'relative', minHeight: 290, flex: 2.08, overflow: 'hidden', borderRadius: 18, padding: 32, justifyContent: 'center', backgroundColor: colors.primaryDeep },
  heroMainMobile: { minHeight: 370, padding: 24 },
  heroCircleLarge: { position: 'absolute', width: 360, height: 360, borderRadius: 180, right: -115, top: -155, backgroundColor: '#184F86' },
  heroCircleSmall: { position: 'absolute', width: 170, height: 170, borderRadius: 85, right: 155, bottom: -125, backgroundColor: '#164878' },
  heroContent: { width: '64%', gap: 10, zIndex: 2 },
  heroContentMobile: { width: '84%' },
  heroBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,.1)' },
  heroBadgeText: { fontFamily: 'PoppinsBold', fontSize: 10, letterSpacing: .55, color: '#DCEBFF' },
  heroTitle: { fontFamily: 'PoppinsBold', fontSize: 32, lineHeight: 41, color: colors.white },
  heroTitleMobile: { fontSize: 27, lineHeight: 35 },
  heroCopy: { maxWidth: 520, fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 20, color: '#C8D8E7' },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 9 },
  heroPrimary: { minHeight: 44, paddingHorizontal: 17, borderRadius: 9, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroPrimaryText: { fontFamily: 'PoppinsSemiBold', fontSize: 12, color: colors.primaryDark },
  heroSecondary: { minHeight: 44, paddingHorizontal: 17, borderRadius: 9, borderWidth: 1, borderColor: 'rgba(255,255,255,.3)', alignItems: 'center', justifyContent: 'center' },
  heroSecondaryText: { fontFamily: 'PoppinsSemiBold', fontSize: 12, color: colors.white },
  heroVisual: { position: 'absolute', right: 34, top: 38, width: 218, height: 185 },
  heroVisualMobile: { right: -42, top: 82, opacity: .28, zIndex: 1 },
  productTile: { position: 'absolute', width: 82, height: 82, borderRadius: 17, borderWidth: 4, borderColor: '#D8E9FB', backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  tileBook: { right: 2, top: 0, transform: [{ rotate: '7deg' }] },
  tileLaptop: { right: 28, bottom: 0, transform: [{ rotate: '-2deg' }] },
  tileHeadset: { left: 4, top: 61, transform: [{ rotate: '-8deg' }] },
  heroSide: { minWidth: 320, flex: 1, gap: 14 },
  safeCard: { minHeight: 138, flex: 1, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 13 },
  sideIcon: { width: 48, height: 48, borderRadius: 13, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' },
  sideBody: { flex: 1, gap: 4 },
  sideTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 14, color: colors.text },
  sideCopy: { fontFamily: 'PoppinsRegular', fontSize: 11, lineHeight: 18, color: colors.muted },
  sellerCard: { minHeight: 138, flex: 1, overflow: 'hidden', padding: 20, borderRadius: 16, backgroundColor: '#EAF3FF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 13 },
  sellerCardCopy: { maxWidth: 210, gap: 4 },
  sellerKicker: { fontFamily: 'PoppinsBold', fontSize: 10, letterSpacing: .65, color: colors.primary },
  sellerTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 14, lineHeight: 20, color: colors.text },
  sellerLink: { fontFamily: 'PoppinsSemiBold', fontSize: 11, color: colors.primary, marginTop: 5 },
  quickPanel: { minHeight: 98, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  quickItem: { minWidth: 165, flex: 1, paddingHorizontal: 11, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 11 },
  quickIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontFamily: 'PoppinsSemiBold', fontSize: 12, color: colors.text },
  quickCaption: { fontFamily: 'PoppinsRegular', fontSize: 11, color: colors.muted, marginTop: 2 },
  categoryPanel: { padding: 20, gap: 18, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  categoryItem: { position: 'relative', minHeight: 108, borderRadius: 12, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 6 },
  categoryActive: { borderColor: '#B7D3F3', backgroundColor: '#F7FAFE' },
  categoryIcon: { width: 54, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  categoryText: { maxWidth: '100%', fontFamily: 'PoppinsMedium', fontSize: 11, color: colors.textSoft },
  categoryTextActive: { fontFamily: 'PoppinsSemiBold', color: colors.primary },
  categoryCheck: { position: 'absolute', right: 7, top: 7, width: 17, height: 17, borderRadius: 9, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  communityStrip: { minHeight: 82, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 15, borderWidth: 1, borderColor: '#CFE1F6', backgroundColor: '#F0F6FE', flexDirection: 'row', alignItems: 'center', gap: 14 },
  communityIcon: { width: 48, height: 48, borderRadius: 13, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  communityBody: { flex: 1 },
  communityTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 14, color: colors.text },
  communityCopy: { fontFamily: 'PoppinsRegular', fontSize: 11, lineHeight: 18, color: colors.muted, marginTop: 2 },
  communityAction: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 9, backgroundColor: colors.surface },
  communityActionText: { fontFamily: 'PoppinsSemiBold', fontSize: 11, color: colors.primary },
  marketSection: { gap: 15 },
  sectionHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14 },
  sectionHeading: { flex: 1 },
  sectionTitle: { fontFamily: 'PoppinsBold', fontSize: 21, lineHeight: 28, color: colors.text },
  sectionSubtitle: { fontFamily: 'PoppinsRegular', fontSize: 11, lineHeight: 17, color: colors.muted, marginTop: 2 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 6 },
  seeAllText: { fontFamily: 'PoppinsSemiBold', fontSize: 11, color: colors.primary },
  shelf: { gap: 14, paddingRight: 16, paddingBottom: 7 },
  catalogue: { gap: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' },
  pressed: { opacity: .72, transform: [{ scale: .985 }] },
  footerNote: { minHeight: 54, marginTop: 4, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7 },
  footerText: { maxWidth: 760, textAlign: 'center', fontFamily: 'PoppinsRegular', fontSize: 11, lineHeight: 18, color: colors.muted },
});
