import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Empty, ErrorState, Loader, Screen } from '@/components/ui';
import { ListingCard } from '@/components/listing-card';
import { colors, layout } from '@/constants/theme';
import { endpoints, errorMessage } from '@/lib/api';

export default function SavedScreen() {
  const [tab, setTab] = useState<'WISHLIST' | 'RECENT'>('WISHLIST');
  const client = useQueryClient();
  const { width } = useWindowDimensions();
  const mobile = width < 600;
  const wishlist = useQuery({ queryKey: ['wishlist'], queryFn: endpoints.wishlist });
  const recent = useQuery({ queryKey: ['recent-listings'], queryFn: endpoints.recentListings });
  const remove = useMutation({ mutationFn: endpoints.unsaveListing, onSuccess: () => client.invalidateQueries({ queryKey: ['wishlist'] }) });
  const query = tab === 'WISHLIST' ? wishlist : recent;
  const contentWidth = Math.max(0, Math.min(width - (mobile ? 28 : 32), layout.contentMaxWidth - 80));
  const columns = contentWidth >= 1040 ? 5 : contentWidth >= 780 ? 4 : contentWidth >= 540 ? 3 : contentWidth >= 310 ? 2 : 1;
  const gap = 12;
  const cardWidth = (contentWidth - gap * (columns - 1)) / columns;

  return <Screen style={styles.page}>
    <View style={styles.topRow}>
      <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={18} color={colors.primary}/><Text style={styles.backText}>Kembali</Text></Pressable>
      <View style={styles.heading}><Text style={styles.eyebrow}>DISCOVERY</Text><Text style={[styles.title, mobile && styles.titleMobile]}>Tersimpan & terakhir dilihat</Text><Text style={styles.copy}>Simpan listing yang menarik dan lanjutkan pencarian tanpa kehilangan jejak.</Text></View>
    </View>
    <View style={[styles.tabs, mobile && styles.tabsMobile]}>
      <Pressable onPress={() => setTab('WISHLIST')} style={[styles.tab, tab==='WISHLIST'&&styles.tabActive]}><Ionicons name={tab==='WISHLIST'?'heart':'heart-outline'} size={18} color={tab==='WISHLIST'?colors.primary:colors.muted}/><Text style={[styles.tabText,tab==='WISHLIST'&&styles.tabTextActive]}>Tersimpan</Text></Pressable>
      <Pressable onPress={() => setTab('RECENT')} style={[styles.tab, tab==='RECENT'&&styles.tabActive]}><Ionicons name="time-outline" size={18} color={tab==='RECENT'?colors.primary:colors.muted}/><Text style={[styles.tabText,tab==='RECENT'&&styles.tabTextActive]}>Terakhir dilihat</Text></Pressable>
    </View>
    {query.isLoading ? <Loader/> : query.isError ? <ErrorState message={errorMessage(query.error)} retry={() => query.refetch()}/> : !query.data?.length ? <Empty icon={tab==='WISHLIST'?'heart-outline':'time-outline'} title={tab==='WISHLIST'?'Belum ada listing tersimpan':'Belum ada riwayat'} message={tab==='WISHLIST'?'Tekan ikon hati pada listing yang ingin kamu simpan.':'Listing yang kamu buka akan muncul di sini.'}/> : <View style={[styles.grid,{gap}]}>{query.data.map(entry => <ListingCard key={entry.id} item={entry.listing} saved={tab==='WISHLIST'} onToggleSaved={tab==='WISHLIST'?()=>remove.mutate(entry.listing.id):undefined} onPress={()=>router.push({pathname:'/(student)/listing/[id]',params:{id:entry.listing.id}})} style={{width:cardWidth}} compact/>)}</View>}
  </Screen>;
}
const styles=StyleSheet.create({
  page:{gap:22,paddingTop:24,paddingBottom:48},topRow:{gap:18},back:{flexDirection:'row',alignItems:'center',gap:7,alignSelf:'flex-start'},backText:{fontFamily:'PoppinsSemiBold',fontSize:12,color:colors.primary},heading:{gap:3},eyebrow:{fontFamily:'PoppinsBold',fontSize:11.5,letterSpacing:.8,color:colors.primary},title:{fontFamily:'PoppinsBold',fontSize:27,lineHeight:35,color:colors.text},titleMobile:{fontSize:23,lineHeight:30},copy:{fontFamily:'PoppinsRegular',fontSize:12,lineHeight:19,color:colors.muted},tabs:{flexDirection:'row',gap:8,borderBottomWidth:1,borderBottomColor:colors.border},tabsMobile:{gap:2},tab:{minHeight:46,paddingHorizontal:14,flexDirection:'row',alignItems:'center',gap:7,borderBottomWidth:2,borderBottomColor:'transparent'},tabActive:{borderBottomColor:colors.primary},tabText:{fontFamily:'PoppinsMedium',fontSize:12,color:colors.muted},tabTextActive:{fontFamily:'PoppinsSemiBold',color:colors.primary},grid:{flexDirection:'row',flexWrap:'wrap',alignItems:'flex-start'}
});
