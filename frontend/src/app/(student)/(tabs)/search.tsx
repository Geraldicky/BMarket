import Ionicons from '@expo/vector-icons/Ionicons';
import { useDeferredValue, useState } from 'react';
import { Pressable, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { endpoints, errorMessage } from '@/lib/api';
import { Empty, ErrorState, Loader, Screen, Title } from '@/components/ui';
import { BackButton } from '@/components/back-button';
import { ListingCard } from '@/components/listing-card';
import { FilterSelect, type FilterOption } from '@/components/filter-select';
import { colors, layout, webTransition, makeStyles } from '@/constants/theme';
import { CATEGORY_METADATA, PRODUCT_CATEGORIES } from '@/lib/domain-metadata';

type TypeFilter = 'ALL' | 'PRODUCT' | 'SERVICE';
type ModeFilter = 'ALL' | 'ONE_OFF' | 'STOCKED' | 'PREORDER';
type SortOption = 'newest' | 'oldest' | 'price_desc' | 'price_asc';

const typeOptions: FilterOption<TypeFilter>[] = [
  { key: 'ALL', label: 'Semua tipe' },
  { key: 'PRODUCT', label: 'Barang', icon: 'cube-outline' },
  { key: 'SERVICE', label: 'Jasa', icon: 'construct-outline' },
];
const modeOptions: FilterOption<ModeFilter>[] = [
  { key: 'ALL', label: 'Semua model' },
  { key: 'ONE_OFF', label: 'Barang satuan' },
  { key: 'STOCKED', label: 'Produk dengan stok' },
  { key: 'PREORDER', label: 'Pre-order' },
];
// Jasa is its own listing type, so it is not offered as a goods category.
const categoryOptions: FilterOption<string>[] = [
  { key: 'ALL', label: 'Semua kategori' },
  ...PRODUCT_CATEGORIES.map(key => ({ key, label: CATEGORY_METADATA[key].label, icon: CATEGORY_METADATA[key].icon })),
];
const sortOptions: FilterOption<SortOption>[] = [
  { key: 'newest', label: 'Terbaru', icon: 'time-outline' },
  { key: 'oldest', label: 'Terlama', icon: 'hourglass-outline' },
  { key: 'price_desc', label: 'Harga paling tinggi', icon: 'arrow-up' },
  { key: 'price_asc', label: 'Harga paling rendah', icon: 'arrow-down' },
];

const pick = <T extends string>(value: unknown, options: FilterOption<T>[]): T =>
  options.find(option => option.key === value)?.key ?? options[0].key;

type Filters = { q: string; type: TypeFilter; mode: ModeFilter; category: string; sort: SortOption };

function SearchContent({ initial }: { initial: Filters }) {
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const desktop = width >= 960;
  const client = useQueryClient();
  const [keyword, setKeyword] = useState(initial.q);
  const deferredKeyword = useDeferredValue(keyword);
  const [listingType, setListingType] = useState(initial.type);
  const [mode, setMode] = useState(initial.mode);
  const [category, setCategory] = useState(initial.category);
  const [sort, setSort] = useState(initial.sort);
  const goods = listingType === 'PRODUCT';

  const query = useInfiniteQuery({
    queryKey: ['listings', 'search', deferredKeyword.trim(), listingType, mode, category, sort],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => endpoints.listings({
      keyword: deferredKeyword.trim() || undefined,
      type: listingType === 'ALL' ? undefined : listingType,
      mode: goods && mode !== 'ALL' ? mode : undefined,
      category: goods && category !== 'ALL' ? category : undefined,
      sort,
      page: pageParam,
      limit: 24,
    }),
    getNextPageParam: last => last.page < last.totalPages ? last.page + 1 : undefined,
  });
  const wishlist = useQuery({ queryKey: ['wishlist'], queryFn: endpoints.wishlist });
  const savedIds = new Set((wishlist.data || []).map(entry => entry.listing.id));
  const toggleSaved = useMutation({
    mutationFn: ({ id, saved }: { id: string; saved: boolean }) => saved ? endpoints.unsaveListing(id) : endpoints.saveListing(id),
    onSuccess: (_data, variables) => { client.invalidateQueries({ queryKey: ['wishlist'] }); client.invalidateQueries({ queryKey: ['saved-status', variables.id] }); },
  });

  const listings = query.data?.pages.flatMap(page => page.data) || [];
  const total = query.data?.pages[0]?.total || 0;
  const contentWidth = Math.max(300, Math.min(width - (desktop ? 80 : 28), layout.contentMaxWidth - 80));
  const columns = contentWidth >= 1120 ? 5 : contentWidth >= 900 ? 4 : contentWidth >= 680 ? 3 : contentWidth >= 320 ? 2 : 1;
  const gap = desktop ? 14 : 10;
  const cardWidth = (contentWidth - gap * (columns - 1)) / columns;
  const filtered = Boolean(keyword.trim()) || listingType !== 'ALL' || sort !== 'newest';
  const selectStyle = [styles.filterSelect, !desktop && styles.filterSelectMobile];

  // Model and category filters only apply to goods; clear them when leaving the Barang type.
  const chooseType = (value: TypeFilter) => {
    setListingType(value);
    if (value !== 'PRODUCT') { setMode('ALL'); setCategory('ALL'); }
  };
  const reset = () => { setKeyword(''); chooseType('ALL'); setSort('newest'); };

  return (
    <Screen style={styles.page} backgroundColor={colors.surface}>
      <BackButton />
      <Title subtitle="Cari barang dan jasa dari sesama Binusian, lalu saring sesuai kebutuhanmu.">Cari listing</Title>

      <View style={styles.search}>
        <Ionicons name="search-outline" size={18} color={colors.muted} />
        <TextInput value={keyword} onChangeText={setKeyword} placeholder="Cari barang, jasa, atau kebutuhan kampus" placeholderTextColor={colors.muted} returnKeyType="search" style={styles.searchInput} />
        {keyword ? <Pressable accessibilityLabel="Hapus pencarian" onPress={() => setKeyword('')}><Ionicons name="close-circle" size={18} color={colors.muted} /></Pressable> : null}
      </View>

      <View style={styles.filterRow}>
        <FilterSelect label="Tipe" icon="albums-outline" value={listingType} options={typeOptions} onChange={chooseType} style={selectStyle} />
        {goods ? <>
          <FilterSelect label="Model" icon="cube-outline" value={mode} options={modeOptions} onChange={setMode} style={selectStyle} />
          <FilterSelect label="Kategori" icon="pricetags-outline" value={category} options={categoryOptions} onChange={setCategory} style={selectStyle} />
        </> : null}
        <FilterSelect label="Urutkan" icon="funnel-outline" value={sort} options={sortOptions} onChange={setSort} style={selectStyle} />
      </View>

      <View style={styles.resultHead}>
        <Text style={styles.resultCount}>{query.isLoading ? 'Memuat listing…' : `${total} listing ditemukan`}</Text>
        {filtered ? <Pressable onPress={reset} style={({ pressed }) => [styles.reset, pressed && { opacity: .7 }]}><Ionicons name="refresh-outline" size={14} color={colors.primary} /><Text style={styles.resetText}>Reset filter</Text></Pressable> : null}
      </View>

      {query.isLoading ? <Loader /> : query.isError ? <ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} /> : !listings.length ? (
        <Empty title="Belum ada listing yang cocok" message="Coba ganti kata kunci atau filter." icon="search-outline" />
      ) : <>
        <View style={[styles.grid, { gap }]}>
          {listings.map(item => <ListingCard storefront compact key={item.id} item={item} saved={savedIds.has(item.id)} onToggleSaved={() => toggleSaved.mutate({ id: item.id, saved: savedIds.has(item.id) })} style={{ width: cardWidth }} onPress={() => router.push({ pathname: '/(student)/listing/[id]', params: { id: item.id } })} />)}
        </View>
        {query.hasNextPage ? <Pressable disabled={query.isFetchingNextPage} onPress={() => query.fetchNextPage()} style={styles.loadMore}><Text style={styles.loadMoreText}>{query.isFetchingNextPage ? 'Memuat…' : 'Muat lebih banyak'}</Text><Ionicons name="chevron-down" size={14} color={colors.primary} /></Pressable> : null}
      </>}
    </Screen>
  );
}

export default function SearchScreen() {
  const params = useLocalSearchParams<{ q?: string; type?: string; mode?: string; category?: string; sort?: string }>();
  const type = pick(params.type, typeOptions);
  const goods = type === 'PRODUCT';
  const initial: Filters = {
    q: typeof params.q === 'string' ? params.q : '',
    type,
    mode: goods ? pick(params.mode, modeOptions) : 'ALL',
    category: goods ? pick(params.category, categoryOptions) : 'ALL',
    sort: pick(params.sort, sortOptions),
  };
  // Remount when the route params change (e.g. opened again from Beranda with other filters).
  return <SearchContent key={JSON.stringify(initial)} initial={initial} />;
}

const useStyles = makeStyles(() => ({
  page: { paddingTop: 18, paddingBottom: 48, gap: 18, backgroundColor: colors.surface },
  search: { minHeight: 48, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted, flexDirection: 'row', alignItems: 'center', gap: 9 },
  searchInput: { flex: 1, minWidth: 0, minHeight: 46, paddingVertical: 8, fontFamily: 'PoppinsRegular', fontSize: 13, color: colors.text, ...({ outlineStyle: 'none', outlineWidth: 0 } as any) },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  filterSelect: { width: 210 },
  filterSelectMobile: { width: '48%' },
  resultHead: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  resultCount: { fontFamily: 'PoppinsSemiBold', fontSize: 13, color: colors.textSoft },
  reset: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 4, ...webTransition },
  resetText: { fontFamily: 'PoppinsSemiBold', fontSize: 12, color: colors.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' },
  loadMore: { alignSelf: 'center', minHeight: 42, marginTop: 4, paddingHorizontal: 16, borderRadius: 9, borderWidth: 1, borderColor: colors.primaryBorder, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 6 },
  loadMoreText: { fontFamily: 'PoppinsSemiBold', fontSize: 11.5, color: colors.primary },
}));
