import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminEmptyState, AdminInfoRow, AdminStatCard, AdminStatusPill } from '@/components/admin-ui';
import { Button, Card, date, ErrorState, FeedbackDialog, Field, Loader, money, Screen, Title } from '@/components/ui';
import { endpoints, errorMessage } from '@/lib/api';
import { colors, radius } from '@/constants/theme';
import type { Complaint } from '@/types';

export default function ModerationScreen() {
  const client = useQueryClient();
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ report: Complaint; action: 'KEEP_ACTIVE' | 'HIDE_LISTING' | 'REMOVE_LISTING' } | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'danger'; title: string; message: string } | null>(null);
  const [search, setSearch] = useState('');
  const query = useQuery({ queryKey: ['reported-listings'], queryFn: () => endpoints.complaints({ targetType: 'LISTING', unresolved: true }) });
  const reports = query.data || [];
  const q = search.trim().toLowerCase();
  const visible = reports.filter(item => !q || [item.reason, item.description, item.reporter?.name, item.targetListing?.title, item.targetListing?.seller?.name].some(value => String(value || '').toLowerCase().includes(q)));

  const update = async (report: Complaint, status: 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED', listingAction?: 'KEEP_ACTIVE' | 'HIDE_LISTING' | 'REMOVE_LISTING') => {
    setWorkingId(report.id);
    try {
      const notes = { KEEP_ACTIVE: 'Laporan diperiksa dan listing dinyatakan tetap aktif.', HIDE_LISTING: 'Listing disembunyikan setelah pemeriksaan admin.', REMOVE_LISTING: 'Listing dihapus karena melanggar aturan komunitas.' } as const;
      await endpoints.complaintStatus(report.id, status, listingAction, listingAction ? notes[listingAction] : undefined);
      await Promise.all([client.invalidateQueries({ queryKey: ['reported-listings'] }), client.invalidateQueries({ queryKey: ['complaints'] }), client.invalidateQueries({ queryKey: ['admin-stats'] }), client.invalidateQueries({ queryKey: ['listings'] })]);
      if (status === 'RESOLVED' || status === 'DISMISSED') setFeedback({ tone: 'success', title: 'Moderasi tersimpan', message: listingAction === 'KEEP_ACTIVE' ? 'Listing dipertahankan dan laporan ditutup.' : listingAction === 'HIDE_LISTING' ? 'Listing sudah disembunyikan dan laporan ditutup.' : listingAction === 'REMOVE_LISTING' ? 'Listing sudah dihapus dari marketplace dan laporan ditutup.' : 'Status laporan berhasil diperbarui.' });
      setPending(null);
    } catch (error) {
      setPending(null);
      setFeedback({ tone: 'danger', title: 'Aksi moderasi belum berhasil', message: errorMessage(error) });
    } finally { setWorkingId(null); }
  };
  const confirm = (report: Complaint, action: 'KEEP_ACTIVE' | 'HIDE_LISTING' | 'REMOVE_LISTING') => setPending({ report, action });

  return (
    <Screen backgroundColor={colors.surfaceMuted}>
      <Title subtitle="Periksa listing yang dilaporkan oleh komunitas sebelum mengambil tindakan.">Moderasi laporan</Title>
      <View style={styles.stats}>
        <AdminStatCard label="Perlu diperiksa" value={reports.length} caption="Total laporan aktif" icon="search-circle-outline" />
        <AdminStatCard label="Laporan baru" value={reports.filter(item => item.status === 'OPEN').length} caption="Belum mulai ditinjau" icon="document-text-outline" color={colors.success} background={colors.successSoft} />
        <AdminStatCard label="Sedang ditinjau" value={reports.filter(item => item.status === 'IN_REVIEW').length} caption="Dalam pemeriksaan admin" icon="hourglass-outline" color={colors.warning} background={colors.warningSoft} />
      </View>
      <Card style={styles.queueCard}>
        <View style={styles.toolbar}><View style={styles.search}><Field icon="search-outline" value={search} onChangeText={setSearch} placeholder="Cari judul listing, alasan, atau pelapor..." /></View><Text style={styles.queueCount}>{visible.length} laporan</Text></View>
        {query.isLoading ? <Loader /> : query.isError ? <ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} /> : !reports.length ? <AdminEmptyState title="Antrean laporan bersih" message="Belum ada listing yang perlu diperiksa oleh admin." /> : !visible.length ? <AdminEmptyState compact icon="search-outline" title="Laporan tidak ditemukan" message="Coba gunakan kata kunci pencarian yang berbeda." /> : <View style={styles.list}>
          {visible.map(report => {
            const listing = report.targetListing;
            const loading = workingId === report.id;
            return <View key={report.id} style={styles.reportCard}>
              <View style={styles.reportHeader}><AdminStatusPill label={report.status === 'OPEN' ? 'Laporan baru' : 'Sedang ditinjau'} tone={report.status === 'OPEN' ? 'danger' : 'warning'} /><Text style={styles.date}>{date(report.createdAt)}</Text></View>
              <View style={styles.listingRow}>
                <View style={styles.media}>{listing?.images?.[0] ? <Image source={{ uri: listing.images[0] }} style={styles.image} /> : <Ionicons name="cube-outline" size={28} color={colors.muted} />}</View>
                <View style={styles.listingBody}><Text style={styles.listingLabel}>LISTING DILAPORKAN</Text><Text numberOfLines={2} style={styles.listingTitle}>{listing?.title || 'Listing sudah tidak tersedia'}</Text>{listing ? <Text style={styles.listingMeta}>{money(listing.price)} · {listing.type === 'SERVICE' ? 'Jasa' : 'Barang'} · {listing.seller?.name || 'Seller'}</Text> : null}</View>
                {listing ? <AdminStatusPill label={listing.status} tone={listing.status === 'ACTIVE' ? 'success' : 'danger'} /> : null}
              </View>
              <View style={styles.reasonBox}><View style={styles.reasonIcon}><Ionicons name="flag-outline" size={18} color={colors.danger} /></View><View style={styles.reasonBody}><Text style={styles.reason}>{report.reason}</Text>{report.description ? <Text style={styles.description}>{report.description}</Text> : null}<Text style={styles.reporter}>Dilaporkan oleh {report.reporter?.name || 'Pengguna BMarket'}</Text></View></View>
              <View style={styles.actions}>{report.status === 'OPEN' ? <Button title="Mulai tinjau" variant="secondary" icon="search-outline" loading={loading} onPress={() => update(report, 'IN_REVIEW')} style={styles.action} /> : null}{listing && ['ACTIVE', 'HIDDEN'].includes(listing.status) ? <Button title="Pertahankan" variant="ghost" icon="checkmark-circle-outline" disabled={loading} onPress={() => confirm(report, 'KEEP_ACTIVE')} style={styles.action} /> : null}{listing && listing.status === 'ACTIVE' ? <Button title="Sembunyikan" variant="ghost" icon="eye-off-outline" disabled={loading} onPress={() => confirm(report, 'HIDE_LISTING')} style={styles.action} /> : null}{listing && listing.status !== 'REMOVED' ? <Button title="Hapus listing" variant="danger" icon="trash-outline" disabled={loading} onPress={() => confirm(report, 'REMOVE_LISTING')} style={styles.action} /> : null}{!listing ? <Button title="Tutup laporan" variant="ghost" disabled={loading} onPress={() => update(report, 'DISMISSED')} style={styles.action} /> : null}</View>
            </View>;
          })}
        </View>}
      </Card>
      <Card style={styles.guide}><Text style={styles.guideTitle}>Panduan moderasi</Text><View style={styles.guideGrid}><AdminInfoRow icon="shield-checkmark-outline" title="Tinjau setiap laporan" message="Periksa detail laporan dan bukti sebelum mengambil tindakan." /><AdminInfoRow icon="scale-outline" title="Bersikap adil" message="Terapkan kebijakan secara konsisten dan tidak memihak." /><AdminInfoRow icon="lock-closed-outline" title="Lindungi komunitas" message="Tindak listing yang melanggar kebijakan untuk keamanan bersama." /><AdminInfoRow icon="bookmark-outline" title="Catat keputusan" message="Semua tindakan tetap tercatat di riwayat moderasi." /></View></Card>
      <FeedbackDialog visible={Boolean(pending)} tone={pending?.action === 'KEEP_ACTIVE' ? 'warning' : 'danger'} title={pending?.action === 'KEEP_ACTIVE' ? 'Pertahankan listing?' : pending?.action === 'HIDE_LISTING' ? 'Sembunyikan listing?' : 'Hapus listing?'} message={pending?.action === 'KEEP_ACTIVE' ? 'Laporan akan ditolak dan listing tetap dapat dilihat pengguna.' : pending?.action === 'HIDE_LISTING' ? 'Listing tidak lagi muncul di etalase. Laporan terbuka untuk listing ini akan diselesaikan.' : 'Listing ditandai melanggar aturan dan tidak dapat dikelola lagi oleh seller.'} primaryLabel={pending?.action === 'KEEP_ACTIVE' ? 'Pertahankan' : pending?.action === 'HIDE_LISTING' ? 'Sembunyikan' : 'Hapus listing'} secondaryLabel="Batal" loading={Boolean(pending && workingId === pending.report.id)} onClose={() => setPending(null)} onSecondary={() => setPending(null)} onPrimary={() => pending && update(pending.report, pending.action === 'KEEP_ACTIVE' ? 'DISMISSED' : 'RESOLVED', pending.action)} />
      <FeedbackDialog visible={Boolean(feedback)} tone={feedback?.tone || 'success'} title={feedback?.title || ''} message={feedback?.message || ''} onClose={() => setFeedback(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  queueCard: { padding: 0, overflow: 'hidden', gap: 0 },
  toolbar: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border, flexWrap: 'wrap' },
  search: { flex: 1, minWidth: 280 },
  queueCount: { color: colors.muted, fontFamily: 'PoppinsMedium', fontSize: 12 },
  list: { padding: 14, gap: 12 },
  reportCard: { padding: 18, gap: 17, borderRadius: 13, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  reportHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  date: { fontFamily: 'PoppinsRegular', fontSize: 11.5, color: colors.muted },
  listingRow: { flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' },
  media: { width: 90, height: 74, borderRadius: 12, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  listingBody: { flex: 1, minWidth: 220, gap: 2 },
  listingLabel: { fontFamily: 'PoppinsBold', fontSize: 10.5, letterSpacing: .55, color: colors.muted },
  listingTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 15, color: colors.text },
  listingMeta: { fontFamily: 'PoppinsRegular', fontSize: 11.5, lineHeight: 18, color: colors.textSoft },
  reasonBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: radius.md, backgroundColor: '#FFF9F9', borderWidth: 1, borderColor: '#F3DEDE' },
  reasonIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  reasonBody: { flex: 1, gap: 3 },
  reason: { fontFamily: 'PoppinsSemiBold', fontSize: 13.5, color: colors.text },
  description: { fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 19, color: colors.textSoft },
  reporter: { fontFamily: 'PoppinsRegular', fontSize: 11.5, color: colors.muted, marginTop: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { minWidth: 135, flexGrow: 1 },
  guide: { gap: 8 },
  guideTitle: { color: colors.text, fontFamily: 'PoppinsSemiBold', fontSize: 15 },
  guideGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 26 },
});
