import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, date, Empty, ErrorState, Loader, money, Screen, Title } from '@/components/ui';
import { endpoints, errorMessage } from '@/lib/api';
import { colors, radius } from '@/constants/theme';
import type { Complaint } from '@/types';

export default function ModerationScreen() {
  const client = useQueryClient();
  const [workingId, setWorkingId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['reported-listings'],
    queryFn: () => endpoints.complaints({ targetType: 'LISTING', unresolved: true }),
  });
  const reports = query.data || [];

  const update = async (
    report: Complaint,
    status: 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED',
    listingAction?: 'KEEP_ACTIVE' | 'HIDE_LISTING' | 'REMOVE_LISTING',
  ) => {
    setWorkingId(report.id);
    try {
      const notes = {
        KEEP_ACTIVE: 'Laporan diperiksa dan listing dinyatakan tetap aktif.',
        HIDE_LISTING: 'Listing disembunyikan setelah pemeriksaan admin.',
        REMOVE_LISTING: 'Listing dihapus karena melanggar aturan komunitas.',
      } as const;
      await endpoints.complaintStatus(report.id, status, listingAction, listingAction ? notes[listingAction] : undefined);
      await Promise.all([
        client.invalidateQueries({ queryKey: ['reported-listings'] }),
        client.invalidateQueries({ queryKey: ['complaints'] }),
        client.invalidateQueries({ queryKey: ['admin-stats'] }),
        client.invalidateQueries({ queryKey: ['listings'] }),
      ]);
    } catch (error) {
      Alert.alert('Aksi gagal', errorMessage(error));
    } finally {
      setWorkingId(null);
    }
  };

  const confirm = (
    report: Complaint,
    action: 'KEEP_ACTIVE' | 'HIDE_LISTING' | 'REMOVE_LISTING',
  ) => {
    const content = {
      KEEP_ACTIVE: { title: 'Pertahankan listing?', message: 'Laporan ini akan ditolak dan listing tetap dapat dilihat pengguna.', button: 'Pertahankan', style: 'default' as const },
      HIDE_LISTING: { title: 'Sembunyikan listing?', message: 'Listing tidak lagi muncul di etalase. Semua laporan terbuka untuk listing ini akan diselesaikan.', button: 'Sembunyikan', style: 'destructive' as const },
      REMOVE_LISTING: { title: 'Hapus listing?', message: 'Listing ditandai melanggar aturan dan tidak dapat dikelola lagi oleh seller.', button: 'Hapus listing', style: 'destructive' as const },
    }[action];
    Alert.alert(content.title, content.message, [
      { text: 'Batal', style: 'cancel' },
      { text: content.button, style: content.style, onPress: () => update(report, action === 'KEEP_ACTIVE' ? 'DISMISSED' : 'RESOLVED', action) },
    ]);
  };

  return (
    <Screen>
      <Title eyebrow="TRUST & SAFETY" subtitle="Periksa listing yang dilaporkan oleh komunitas sebelum mengambil tindakan.">Moderasi laporan</Title>
      <View style={styles.stats}>
        <Card style={styles.stat}><Text style={styles.statLabel}>PERLU DIPERIKSA</Text><Text style={styles.statValue}>{reports.length}</Text></Card>
        <Card style={styles.stat}><Text style={styles.statLabel}>LAPORAN BARU</Text><Text style={styles.statValue}>{reports.filter(item => item.status === 'OPEN').length}</Text></Card>
        <Card style={styles.stat}><Text style={styles.statLabel}>SEDANG DITINJAU</Text><Text style={styles.statValue}>{reports.filter(item => item.status === 'IN_REVIEW').length}</Text></Card>
      </View>

      {query.isLoading ? <Loader /> : query.isError ? (
        <ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} />
      ) : !reports.length ? (
        <Empty title="Antrean laporan bersih" message="Belum ada listing yang perlu diperiksa oleh admin." icon="shield-checkmark-outline" />
      ) : (
        <View style={styles.list}>
          {reports.map(report => {
            const listing = report.targetListing;
            const loading = workingId === report.id;
            return (
              <Card key={report.id} style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <View style={[styles.statusBadge, report.status === 'IN_REVIEW' && styles.reviewBadge]}>
                    <View style={[styles.statusDot, report.status === 'IN_REVIEW' && styles.reviewDot]} />
                    <Text style={styles.statusText}>{report.status === 'OPEN' ? 'LAPORAN BARU' : 'SEDANG DITINJAU'}</Text>
                  </View>
                  <Text style={styles.date}>{date(report.createdAt)}</Text>
                </View>

                <View style={styles.listingRow}>
                  <View style={styles.media}>
                    {listing?.images?.[0] ? <Image source={{ uri: listing.images[0] }} style={styles.image} /> : <Ionicons name="cube-outline" size={30} color={colors.muted} />}
                  </View>
                  <View style={styles.listingBody}>
                    <Text style={styles.listingLabel}>LISTING DILAPORKAN</Text>
                    <Text numberOfLines={2} style={styles.listingTitle}>{listing?.title || 'Listing sudah tidak tersedia'}</Text>
                    {listing ? <Text style={styles.listingMeta}>{money(listing.price)} · {listing.type === 'SERVICE' ? 'Jasa' : 'Barang'} · {listing.seller?.name || 'Seller'}</Text> : null}
                  </View>
                  {listing ? <View style={[styles.listingStatus, listing.status !== 'ACTIVE' && styles.listingStatusDanger]}><Text style={styles.listingStatusText}>{listing.status}</Text></View> : null}
                </View>

                <View style={styles.reasonBox}>
                  <View style={styles.reasonIcon}><Ionicons name="flag-outline" size={18} color={colors.danger} /></View>
                  <View style={styles.reasonBody}>
                    <Text style={styles.reason}>{report.reason}</Text>
                    {report.description ? <Text style={styles.description}>{report.description}</Text> : null}
                    <Text style={styles.reporter}>Dilaporkan oleh {report.reporter?.name || 'Pengguna BMarket'}</Text>
                  </View>
                </View>

                <View style={styles.actions}>
                  {report.status === 'OPEN' ? <Button title="Mulai tinjau" variant="secondary" icon="search-outline" loading={loading} onPress={() => update(report, 'IN_REVIEW')} style={styles.action} /> : null}
                  {listing && ['ACTIVE', 'HIDDEN'].includes(listing.status) ? <Button title="Pertahankan" variant="ghost" icon="checkmark-circle-outline" disabled={loading} onPress={() => confirm(report, 'KEEP_ACTIVE')} style={styles.action} /> : null}
                  {listing && listing.status === 'ACTIVE' ? <Button title="Sembunyikan" variant="ghost" icon="eye-off-outline" disabled={loading} onPress={() => confirm(report, 'HIDE_LISTING')} style={styles.action} /> : null}
                  {listing && listing.status !== 'REMOVED' ? <Button title="Hapus listing" variant="danger" icon="trash-outline" disabled={loading} onPress={() => confirm(report, 'REMOVE_LISTING')} style={styles.action} /> : null}
                  {!listing ? <Button title="Tutup laporan" variant="ghost" disabled={loading} onPress={() => update(report, 'DISMISSED')} style={styles.action} /> : null}
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  stat: { minWidth: 180, flex: 1, minHeight: 108, justifyContent: 'space-between', padding: 18 },
  statLabel: { fontFamily: 'PoppinsBold', fontSize: 10, letterSpacing: .65, color: colors.muted },
  statValue: { fontFamily: 'PoppinsBold', fontSize: 29, color: colors.text },
  list: { gap: 14 },
  reportCard: { gap: 18 },
  reportHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.dangerSoft },
  reviewBadge: { backgroundColor: colors.warningSoft },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.danger },
  reviewDot: { backgroundColor: colors.warning },
  statusText: { fontFamily: 'PoppinsBold', fontSize: 10, color: colors.textSoft },
  date: { fontFamily: 'PoppinsRegular', fontSize: 11, color: colors.muted },
  listingRow: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  media: { width: 94, height: 78, borderRadius: 11, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  listingBody: { flex: 1, gap: 2 },
  listingLabel: { fontFamily: 'PoppinsBold', fontSize: 10, letterSpacing: .55, color: colors.muted },
  listingTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 16, color: colors.text },
  listingMeta: { fontFamily: 'PoppinsRegular', fontSize: 11, lineHeight: 18, color: colors.textSoft },
  listingStatus: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.successSoft },
  listingStatusDanger: { backgroundColor: colors.dangerSoft },
  listingStatusText: { fontFamily: 'PoppinsBold', fontSize: 10, color: colors.textSoft },
  reasonBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 13, padding: 15, borderRadius: radius.sm, backgroundColor: '#FFF8F8', borderWidth: 1, borderColor: '#F4DADA' },
  reasonIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  reasonBody: { flex: 1, gap: 4 },
  reason: { fontFamily: 'PoppinsSemiBold', fontSize: 14, color: colors.text },
  description: { fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 19, color: colors.textSoft },
  reporter: { fontFamily: 'PoppinsRegular', fontSize: 10, color: colors.muted, marginTop: 3 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  action: { minWidth: 150, flexGrow: 1 },
});
