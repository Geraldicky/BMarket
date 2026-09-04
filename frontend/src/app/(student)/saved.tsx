import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { ListingCard } from '@/components/listing-card';
import { Empty, ErrorState, Loader, Screen, Title } from '@/components/ui';
import { colors } from '@/constants/theme';
import { endpoints, errorMessage } from '@/lib/api';

export default function SavedScreen() {
  const [tab, setTab] = useState<'WISHLIST' | 'RECENT'>('WISHLIST');
  const width = useWindowDimensions().width;
  const client = useQueryClient();
  const wishlist = useQuery({ queryKey: ['wishlist'], queryFn: endpoints.wishlist });
  const recent = useQuery({ queryKey: ['recent-listings'], queryFn: endpoints.recentListings });
  const remove = useMutation({ mutationFn: endpoints.unsaveListing, onSuccess: () => client.invalidateQueries({ queryKey: ['wishlist'] }) });
  const query = tab === 'WISHLIST' ? wishlist : recent;
  const columns = width >= 1200 ? 4 : width >= 760 ? 3 : 2;

  return <Screen>
    <Title eyebrow="KOLEKSI PRIBADI" subtitle="Simpan listing untuk dibandingkan atau lanjutkan dari riwayat pencarianmu.">Tersimpan</Title>
    <View style={styles.tabs}>
      <Pressable onPress={() => setTab('WISHLIST')} style={[styles.tab, tab === 'WISHLIST' && styles.tabActive]}><Ionicons name="heart-outline" size={18} color={tab === 'WISHLIST' ? colors.primary : colors.muted} /><Text style={[styles.tabText, tab === 'WISHLIST' && styles.tabTextActive]}>Wishlist</Text></Pressable>
      <Pressable onPress={() => setTab('RECENT')} style={[styles.tab, tab === 'RECENT' && styles.tabActive]}><Ionicons name="time-outline" size={18} color={tab === 'RECENT' ? colors.primary : colors.muted} /><Text style={[styles.tabText, tab === 'RECENT' && styles.tabTextActive]}>Baru dilihat</Text></Pressable>
    </View>
    {query.isLoading ? <Loader /> : query.isError ? <ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} /> : !query.data?.length ? <Empty icon={tab === 'WISHLIST' ? 'heart-outline' : 'time-outline'} title={tab === 'WISHLIST' ? 'Belum ada listing tersimpan' : 'Belum ada riwayat'} message={tab === 'WISHLIST' ? 'Tekan ikon hati di halaman detail listing.' : 'Listing yang kamu buka akan muncul di sini.'} /> : <View style={styles.grid}>{query.data.map(entry => <ListingCard key={entry.id} item={entry.listing} saved={tab === 'WISHLIST'} onToggleSaved={tab === 'WISHLIST' ? () => remove.mutate(entry.listing.id) : undefined} onPress={() => router.push({ pathname: '/(student)/listing/[id]', params: { id: entry.listing.id } })} style={{ width: `${100 / columns - 1.2}%` }} />)}</View>}
  </Screen>;
}

const styles = StyleSheet.create({
  tabs: { alignSelf: 'flex-start', flexDirection: 'row', gap: 5, padding: 5, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  tab: { minHeight: 44, paddingHorizontal: 16, borderRadius: 9, flexDirection: 'row', alignItems: 'center', gap: 8 },
  tabActive: { backgroundColor: colors.primarySoft },
  tabText: { fontFamily: 'PoppinsMedium', fontSize: 13, color: colors.textSoft },
  tabTextActive: { fontFamily: 'PoppinsSemiBold', color: colors.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
});
