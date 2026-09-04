import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { ListingCard } from '@/components/listing-card';
import { Button, Card, date, Empty, ErrorState, FeedbackDialog, Loader, Screen } from '@/components/ui';
import { colors } from '@/constants/theme';
import { endpoints, errorMessage } from '@/lib/api';
import { useAuth } from '@/store/auth';

function Stars({ rating, size = 17 }: { rating: number; size?: number }) {
  return <View style={styles.stars}>{[1, 2, 3, 4, 5].map(star => <Ionicons key={star} name={star <= Math.round(rating) ? 'star' : 'star-outline'} size={size} color="#F4A928" />)}</View>;
}

export default function SellerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useAuth(state => state.user);
  const width = useWindowDimensions().width;
  const columns = width >= 1180 ? 4 : width >= 820 ? 3 : width >= 560 ? 2 : 1;
  const client = useQueryClient();
  const [pendingAction, setPendingAction] = useState<'BLOCK' | 'UNBLOCK' | 'REPORT' | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'danger'; title: string; message: string } | null>(null);
  const query = useQuery({ queryKey: ['seller-profile', id], queryFn: () => endpoints.userProfile(id) });
  const blockStatus = useQuery({ queryKey: ['block-status', id], queryFn: () => endpoints.blockStatus(id), enabled: Boolean(id && id !== me?.id) });
  const toggleBlock = useMutation({
    mutationFn: () => pendingAction === 'UNBLOCK' ? endpoints.unblockUser(id) : endpoints.blockUser(id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['block-status', id] });
      const unblocked = pendingAction === 'UNBLOCK';
      setPendingAction(null);
      setFeedback({ tone: 'success', title: unblocked ? 'Blokir dibuka' : 'Pengguna diblokir', message: unblocked ? 'Kamu dapat kembali menghubungi pengguna ini melalui BMarket.' : 'Pengguna ini tidak dapat menghubungimu melalui chat sampai blokir dibuka.' });
    },
    onError: error => { setPendingAction(null); setFeedback({ tone: 'danger', title: 'Pengaturan blokir belum berubah', message: errorMessage(error) }); },
  });
  const report = useMutation({
    mutationFn: () => endpoints.report({ targetType: 'USER', targetId: id, reason: 'Perilaku atau aktivitas mencurigakan', description: 'Laporan dikirim dari profil publik seller.' }),
    onSuccess: () => { setPendingAction(null); setFeedback({ tone: 'success', title: 'Laporan terkirim', message: 'Admin akan memeriksa aktivitas pengguna ini. Identitas pelapor tidak ditampilkan kepada pengguna yang dilaporkan.' }); },
    onError: error => { setPendingAction(null); setFeedback({ tone: 'danger', title: 'Laporan belum terkirim', message: errorMessage(error) }); },
  });

  const chat = async () => {
    if (!id || id === me?.id) return;
    try {
      const room = await endpoints.createRoom(id);
      router.push({ pathname: '/(student)/chat/[id]', params: { id: room.id, name: query.data?.name || 'Seller' } });
    } catch (error) {
      setFeedback({ tone: 'danger', title: 'Chat belum dapat dibuka', message: errorMessage(error) });
    }
  };

  if (query.isLoading) return <Screen><Loader /></Screen>;
  if (query.isError || !query.data) return <Screen><ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} /></Screen>;
  const profile = query.data;
  const memberSince = date(profile.createdAt);

  return <Screen>
    <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={18} color={colors.primary} /><Text style={styles.backText}>Kembali</Text></Pressable>

    <Card style={styles.hero}>
      <View style={styles.avatar}>
        {profile.avatarUrl ? <Image source={profile.avatarUrl} style={styles.avatarImage} contentFit="cover" /> : <Text style={styles.avatarText}>{profile.name?.[0]?.toUpperCase() || 'B'}</Text>}
      </View>
      <View style={styles.identity}>
        <View style={styles.nameRow}><Text style={styles.name}>{profile.name}</Text>{profile.isVerified ? <View style={styles.verified}><Ionicons name="checkmark-circle" size={15} color={colors.success} /><Text style={styles.verifiedText}>BINUSIAN TERVERIFIKASI</Text></View> : null}</View>
        <View style={styles.ratingRow}><Stars rating={profile.avgRating} /><Text style={styles.ratingValue}>{profile.totalReviews ? profile.avgRating.toFixed(1) : 'Belum ada rating'}</Text>{profile.totalReviews ? <Text style={styles.ratingCount}>({profile.totalReviews} review)</Text> : null}</View>
        <Text style={styles.member}>Bergabung {memberSince}</Text>
        <Text style={styles.bio}>{profile.bio || 'Seller belum menambahkan deskripsi profil.'}</Text>
      </View>
      {id !== me?.id ? <View style={styles.safetyActions}><Button title={blockStatus.data?.blocked ? 'Buka blokir' : 'Chat seller'} icon={blockStatus.data?.blocked ? 'lock-open-outline' : 'chatbubble-outline'} onPress={blockStatus.data?.blocked ? () => setPendingAction('UNBLOCK') : chat} style={styles.chatButton} />{!blockStatus.data?.blocked ? <Pressable disabled={toggleBlock.isPending} onPress={() => setPendingAction('BLOCK')} style={styles.smallAction}><Ionicons name="ban-outline" size={18} color={colors.textSoft}/><Text style={styles.smallActionText}>Block</Text></Pressable> : null}<Pressable disabled={report.isPending} onPress={() => setPendingAction('REPORT')} style={styles.smallAction}><Ionicons name="flag-outline" size={18} color={colors.danger}/><Text style={[styles.smallActionText,{color:colors.danger}]}>Laporkan</Text></Pressable></View> : null}
    </Card>

    <View style={styles.metrics}>
      <Card style={styles.metric}><Text style={styles.metricValue}>{profile.completedSales}</Text><Text style={styles.metricLabel}>Transaksi selesai</Text></Card>
      <Card style={styles.metric}><Text style={styles.metricValue}>{profile.activeListingCount}</Text><Text style={styles.metricLabel}>Listing aktif</Text></Card>
      <Card style={styles.metric}><Text style={styles.metricValue}>{profile.totalReviews ? profile.avgRating.toFixed(1) : '-'}</Text><Text style={styles.metricLabel}>Rating seller</Text></Card>
    </View>

    <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Listing aktif</Text><Text style={styles.sectionCopy}>Barang dan jasa yang sedang ditawarkan seller ini.</Text></View></View>
    {!profile.listings.length ? <Empty icon="storefront-outline" title="Belum ada listing aktif" message="Seller ini belum memiliki listing yang sedang tersedia." /> : <View style={styles.grid}>{profile.listings.map(item => <ListingCard key={item.id} item={{ ...item, seller: { id: profile.id, name: profile.name, avatarUrl: profile.avatarUrl, isVerified: profile.isVerified } }} onPress={() => router.push({ pathname: '/(student)/listing/[id]', params: { id: item.id } })} style={{ width: columns === 1 ? '100%' : `${100 / columns - 1.4}%` }} />)}</View>}

    <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Review buyer</Text><Text style={styles.sectionCopy}>{profile.totalReviews ? `${profile.totalReviews} pengalaman transaksi selesai.` : 'Belum ada review untuk seller ini.'}</Text></View></View>
    {!profile.reviews.length ? <Empty icon="star-outline" title="Belum ada review" message="Review akan muncul setelah buyer menyelesaikan transaksi dan memberikan rating." /> : <View style={styles.reviewList}>{profile.reviews.map(review => <Card key={review.id} style={styles.reviewCard}><View style={styles.reviewHead}><View style={styles.reviewerAvatar}><Text style={styles.reviewerInitial}>{review.reviewer?.name?.[0]?.toUpperCase() || 'B'}</Text></View><View style={styles.reviewIdentity}><Text style={styles.reviewerName}>{review.reviewer?.name || 'Binusian'}</Text><Text style={styles.reviewMeta}>{review.listingTitle || 'Transaksi BMarket'} · {date(review.createdAt)}</Text></View><Stars rating={review.rating} size={15} /></View>{review.comment ? <Text style={styles.reviewComment}>{review.comment}</Text> : <Text style={styles.reviewEmpty}>Buyer memberikan rating tanpa komentar.</Text>}</Card>)}</View>}
    <FeedbackDialog visible={Boolean(pendingAction)} tone={pendingAction === 'REPORT' || pendingAction === 'BLOCK' ? 'danger' : 'warning'} title={pendingAction === 'REPORT' ? 'Laporkan pengguna ini?' : pendingAction === 'UNBLOCK' ? 'Buka blokir pengguna?' : 'Blokir pengguna ini?'} message={pendingAction === 'REPORT' ? 'Laporan akan masuk ke antrean admin untuk diperiksa.' : pendingAction === 'UNBLOCK' ? 'Pengguna ini akan dapat kembali menghubungimu melalui chat BMarket.' : 'Pesan baru dari pengguna ini akan diblokir sampai kamu membuka blokir.'} primaryLabel={pendingAction === 'REPORT' ? 'Kirim laporan' : pendingAction === 'UNBLOCK' ? 'Buka blokir' : 'Blokir'} secondaryLabel="Batal" loading={toggleBlock.isPending || report.isPending} onClose={() => setPendingAction(null)} onSecondary={() => setPendingAction(null)} onPrimary={() => pendingAction === 'REPORT' ? report.mutate() : toggleBlock.mutate()} />
    <FeedbackDialog visible={Boolean(feedback)} tone={feedback?.tone || 'success'} title={feedback?.title || ''} message={feedback?.message || ''} onClose={() => setFeedback(null)} />
  </Screen>;
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 7 },
  backText: { fontFamily: 'PoppinsSemiBold', fontSize: 12, color: colors.primary },
  hero: { minHeight: 190, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 20, padding: 24 },
  avatar: { width: 92, height: 92, borderRadius: 24, overflow: 'hidden', backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { fontFamily: 'PoppinsBold', fontSize: 31, color: colors.primary },
  identity: { flex: 1, minWidth: 250, gap: 6 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 9, flexWrap: 'wrap' },
  name: { fontFamily: 'PoppinsBold', fontSize: 25, color: colors.text },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 18, backgroundColor: colors.successSoft },
  verifiedText: { fontFamily: 'PoppinsBold', fontSize: 12, color: colors.success },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  stars: { flexDirection: 'row', gap: 2 },
  ratingValue: { fontFamily: 'PoppinsSemiBold', fontSize: 12, color: colors.text },
  ratingCount: { fontFamily: 'PoppinsRegular', fontSize: 12, color: colors.muted },
  member: { fontFamily: 'PoppinsRegular', fontSize: 12, color: colors.muted },
  bio: { maxWidth: 720, marginTop: 4, fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 20, color: colors.textSoft },
  safetyActions: { minWidth: 180, gap: 8 },
  chatButton: { minWidth: 165 },
  smallAction: { minHeight: 36, paddingHorizontal: 11, borderRadius: 9, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  smallActionText: { fontFamily: 'PoppinsSemiBold', fontSize: 12, color: colors.textSoft },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  metric: { flex: 1, minWidth: 180, gap: 3 },
  metricValue: { fontFamily: 'PoppinsBold', fontSize: 25, color: colors.primaryDark },
  metricLabel: { fontFamily: 'PoppinsRegular', fontSize: 12, color: colors.muted },
  sectionHeader: { marginTop: 4 },
  sectionTitle: { fontFamily: 'PoppinsBold', fontSize: 20, color: colors.text },
  sectionCopy: { marginTop: 3, fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 18, color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  reviewList: { gap: 12 },
  reviewCard: { gap: 12 },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  reviewerAvatar: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  reviewerInitial: { fontFamily: 'PoppinsBold', fontSize: 14, color: colors.primary },
  reviewIdentity: { flex: 1 },
  reviewerName: { fontFamily: 'PoppinsSemiBold', fontSize: 12, color: colors.text },
  reviewMeta: { marginTop: 2, fontFamily: 'PoppinsRegular', fontSize: 12, color: colors.muted },
  reviewComment: { fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 20, color: colors.textSoft },
  reviewEmpty: { fontFamily: 'PoppinsRegular', fontSize: 12, fontStyle: 'italic', color: colors.muted },
});
