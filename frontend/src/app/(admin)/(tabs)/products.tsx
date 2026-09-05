import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { AdminEmptyState, AdminStatCard, AdminStatusPill } from '@/components/admin-ui';
import { Button, Card, date, ErrorState, FeedbackDialog, Field, Loader, money, Screen, Title } from '@/components/ui';
import { colors, radius } from '@/constants/theme';
import { endpoints, errorMessage } from '@/lib/api';
import type { Listing, ListingMode, ListingStatus } from '@/types';

type StatusFilter = 'ALL' | ListingStatus;
type ModeFilter = 'ALL' | ListingMode;
type DirectStatus = 'ACTIVE' | 'HIDDEN' | 'REMOVED';
type PendingAction = { listing: Listing; kind: 'STATUS'; status: DirectStatus } | { listing: Listing; kind: 'MODERATE'; action: 'approve' | 'reject' };

const statusOptions: { key: StatusFilter; label: string }[] = [
  { key: 'ALL', label: 'Semua' },
  { key: 'ACTIVE', label: 'Aktif' },
  { key: 'HIDDEN', label: 'Disembunyikan' },
  { key: 'REMOVED', label: 'Dihapus' },
  { key: 'SOLD', label: 'Terjual' },
  { key: 'INACTIVE', label: 'Nonaktif' },
  { key: 'PENDING', label: 'Pending' },
];

const statusLabel: Record<ListingStatus, string> = {
  PENDING: 'Pending',
  ACTIVE: 'Aktif',
  REJECTED: 'Ditolak',
  SOLD: 'Terjual',
  INACTIVE: 'Nonaktif seller',
  HIDDEN: 'Disembunyikan',
  REMOVED: 'Dihapus admin',
};

const statusTone = (status: ListingStatus): 'neutral' | 'success' | 'warning' | 'danger' | 'primary' => {
  if (status === 'ACTIVE') return 'success';
  if (status === 'HIDDEN' || status === 'PENDING') return 'warning';
  if (status === 'REMOVED' || status === 'REJECTED') return 'danger';
  if (status === 'SOLD') return 'primary';
  return 'neutral';
};

const modeLabel: Record<ListingMode, string> = {
  ONE_OFF: 'Barang satuan',
  STOCKED: 'Ready stock',
  PREORDER: 'Pre-order',
  SERVICE: 'Jasa',
};

const preorderLabel = (status?: string | null) => ({
  OPEN: 'PO dibuka', CLOSED: 'PO ditutup', PROCESSING: 'Diproses', READY: 'Siap diambil', COMPLETED: 'PO selesai', CANCELLED: 'Dibatalkan',
}[status || ''] || '-');

export default function AdminProductsScreen() {
  const client = useQueryClient();
  const width = useWindowDimensions().width;
  const desktop = width >= 900;
  const mobile = width < 600;
  const [search, setSearch] = useState('');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [mode, setMode] = useState<ModeFilter>('ALL');
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'danger'; title: string; message: string } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => { setKeyword(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => { setPage(1); }, [status, mode]);

  const params = useMemo(() => ({
    ...(keyword ? { keyword } : {}),
    ...(status !== 'ALL' ? { status } : {}),
    ...(mode !== 'ALL' ? { mode } : {}),
    page,
    limit: 20,
  }), [keyword, status, mode, page]);

  const query = useQuery({ queryKey: ['admin-listings', params], queryFn: () => endpoints.adminListings(params) });
  const result = query.data;
  const listings = result?.data || [];
  const summary = result?.summary;

  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['admin-listings'] }),
      client.invalidateQueries({ queryKey: ['admin-stats'] }),
      client.invalidateQueries({ queryKey: ['listings'] }),
      client.invalidateQueries({ queryKey: ['reported-listings'] }),
    ]);
  };

  const execute = async () => {
    if (!pending) return;
    setWorking(true);
    try {
      if (pending.kind === 'STATUS') await endpoints.adminListingStatus(pending.listing.id, pending.status);
      else await endpoints.moderate(pending.listing.id, pending.action);
      const title = pending.kind === 'STATUS'
        ? pending.status === 'ACTIVE' ? 'Listing diaktifkan kembali' : pending.status === 'HIDDEN' ? 'Listing disembunyikan' : 'Listing dihapus'
        : pending.action === 'approve' ? 'Listing disetujui' : 'Listing ditolak';
      await refresh();
      setFeedback({ tone: 'success', title, message: `${pending.listing.title} berhasil diperbarui oleh admin.` });
      setPending(null);
    } catch (error) {
      setFeedback({ tone: 'danger', title: 'Moderasi belum berhasil', message: errorMessage(error) });
      setPending(null);
    } finally {
      setWorking(false);
    }
  };

  const dialog = pending ? pending.kind === 'STATUS'
    ? pending.status === 'ACTIVE'
      ? { tone: 'warning' as const, title: 'Aktifkan kembali listing?', message: 'Listing akan kembali terlihat dan dapat ditemukan pengguna di marketplace.', label: 'Aktifkan' }
      : pending.status === 'HIDDEN'
        ? { tone: 'warning' as const, title: 'Sembunyikan listing?', message: 'Listing langsung hilang dari etalase. Seller tidak dapat mengedit listing selama statusnya disembunyikan.', label: 'Sembunyikan' }
        : { tone: 'danger' as const, title: 'Hapus listing?', message: 'Listing ditandai melanggar aturan dan tidak dapat dikelola lagi oleh seller. Gunakan tindakan ini untuk pelanggaran yang jelas.', label: 'Hapus listing' }
    : pending.action === 'approve'
      ? { tone: 'warning' as const, title: 'Setujui listing pending?', message: 'Listing akan diaktifkan dan tampil di marketplace.', label: 'Setujui' }
      : { tone: 'danger' as const, title: 'Tolak listing pending?', message: 'Listing akan ditandai ditolak dan tidak akan ditampilkan di marketplace.', label: 'Tolak listing' }
    : null;

  return (
    <Screen backgroundColor={colors.surfaceMuted}>
      <Title subtitle="Pantau seluruh barang dan jasa secara proaktif. Admin dapat memeriksa dan menindak listing tanpa menunggu laporan pengguna.">Listing marketplace</Title>

      <View style={styles.stats}>
        <AdminStatCard label="Semua listing" value={summary?.total || 0} caption="Seluruh listing yang pernah dibuat" icon="albums-outline" />
        <AdminStatCard label="Aktif" value={summary?.active || 0} caption="Sedang terlihat di marketplace" icon="storefront-outline" color={colors.success} background={colors.successSoft} />
        <AdminStatCard label="Disembunyikan" value={summary?.hidden || 0} caption="Ditahan oleh tindakan admin" icon="eye-off-outline" color={colors.warning} background={colors.warningSoft} />
        <AdminStatCard label="Dihapus admin" value={summary?.removed || 0} caption="Listing dengan tindakan final" icon="trash-outline" color={colors.danger} background={colors.dangerSoft} />
      </View>

      <Card style={styles.toolbar}>
        <View style={[styles.search, mobile && styles.searchMobile]}><Field icon="search-outline" value={search} onChangeText={setSearch} placeholder="Cari judul, deskripsi, seller, atau email..." /></View>
        <View style={styles.typeFilters}>
          {([['ALL', 'Semua model'], ['ONE_OFF', 'Satuan'], ['STOCKED', 'Ready stock'], ['PREORDER', 'Pre-order'], ['SERVICE', 'Jasa']] as const).map(([key, label]) => (
            <Pressable key={key} onPress={() => setMode(key)} style={[styles.filter, mode === key && styles.filterActive]}><Text style={[styles.filterText, mode === key && styles.filterTextActive]}>{label}</Text></Pressable>
          ))}
        </View>
        <Pressable onPress={() => query.refetch()} style={({ pressed }) => [styles.refresh, pressed && { opacity: .6 }]}><Ionicons name="refresh-outline" size={19} color={colors.primary} /></Pressable>
      </Card>

      <View style={styles.statusFilters}>
        {statusOptions.map(option => (
          <Pressable key={option.key} onPress={() => setStatus(option.key)} style={[styles.statusFilter, status === option.key && styles.statusFilterActive]}>
            <Text style={[styles.statusFilterText, status === option.key && styles.statusFilterTextActive]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>

      {query.isLoading ? <Loader /> : query.isError ? <ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} /> : !listings.length ? (
        <Card><AdminEmptyState icon="search-outline" title="Listing tidak ditemukan" message="Tidak ada listing yang cocok dengan pencarian atau filter saat ini." /></Card>
      ) : (
        <View style={styles.list}>
          {listings.map(listing => {
            const reportCount = listing.openReportCount || 0;
            return <Card key={listing.id} style={styles.listingCard}>
              <View style={[styles.listingRow, !desktop && styles.listingRowMobile]}>
                <View style={[styles.media, mobile && styles.mediaMobile]}>
                  {listing.images?.[0] ? <Image source={{ uri: listing.images[0] }} style={styles.image} resizeMode="cover" /> : <Ionicons name="image-outline" size={27} color={colors.muted} />}
                </View>
                <View style={[styles.listingBody, mobile && styles.listingBodyMobile]}>
                  <View style={styles.titleLine}><Text numberOfLines={2} style={styles.listingTitle}>{listing.title}</Text><AdminStatusPill label={statusLabel[listing.status]} tone={statusTone(listing.status)} /></View>
                  <Text style={styles.price}>{money(listing.price)}</Text>
                  <Text style={styles.meta}>{modeLabel[listing.mode]} · {listing.category} · dibuat {date(listing.createdAt)}</Text>
                  <View style={styles.sellerRow}><View style={styles.sellerAvatar}><Text style={styles.sellerInitial}>{listing.seller?.name?.[0]?.toUpperCase() || 'B'}</Text></View><View><Text style={styles.sellerName}>{listing.seller?.name || 'Seller BMarket'}</Text><Text style={styles.sellerMeta}>{listing.seller?.email || 'Email tidak tersedia'}{listing.seller?.studentId ? ` · NIM ${listing.seller.studentId}` : ''}</Text></View></View>
                </View>
                <View style={[styles.side, mobile && styles.sideMobile]}>
                  {reportCount > 0 ? <View style={styles.reportBadge}><Ionicons name="flag-outline" size={15} color={colors.danger} /><Text style={styles.reportBadgeText}>{reportCount} laporan terbuka</Text></View> : <View style={styles.cleanBadge}><Ionicons name="shield-checkmark-outline" size={15} color={colors.success} /><Text style={styles.cleanBadgeText}>Belum ada laporan</Text></View>}
                  <View style={[styles.actions, mobile && styles.actionsMobile]}>
                    <Button title={expandedId === listing.id ? 'Tutup detail' : 'Lihat detail'} variant="ghost" icon={expandedId === listing.id ? 'chevron-up-outline' : 'eye-outline'} onPress={() => setExpandedId(value => value === listing.id ? null : listing.id)} style={styles.action} />
                    {listing.status === 'ACTIVE' ? <><Button title="Sembunyikan" variant="ghost" icon="eye-off-outline" onPress={() => setPending({ listing, kind: 'STATUS', status: 'HIDDEN' })} style={styles.action} /><Button title="Hapus" variant="danger" icon="trash-outline" onPress={() => setPending({ listing, kind: 'STATUS', status: 'REMOVED' })} style={styles.action} /></> : null}
                    {listing.status === 'HIDDEN' ? <><Button title="Aktifkan" variant="secondary" icon="eye-outline" onPress={() => setPending({ listing, kind: 'STATUS', status: 'ACTIVE' })} style={styles.action} /><Button title="Hapus" variant="danger" icon="trash-outline" onPress={() => setPending({ listing, kind: 'STATUS', status: 'REMOVED' })} style={styles.action} /></> : null}
                    {listing.status === 'PENDING' ? <><Button title="Setujui" variant="secondary" icon="checkmark-circle-outline" onPress={() => setPending({ listing, kind: 'MODERATE', action: 'approve' })} style={styles.action} /><Button title="Tolak" variant="danger" icon="close-circle-outline" onPress={() => setPending({ listing, kind: 'MODERATE', action: 'reject' })} style={styles.action} /></> : null}
                    {['SOLD', 'INACTIVE', 'REMOVED', 'REJECTED'].includes(listing.status) ? <Text style={[styles.readOnly, mobile && styles.readOnlyMobile]}>Status ini hanya dipantau. Tidak ada tindakan cepat yang tersedia.</Text> : null}
                  </View>
                </View>
              </View>
              {expandedId === listing.id ? <View style={styles.detailPanel}>
                <View style={styles.detailBlock}><Text style={styles.detailLabel}>DESKRIPSI</Text><Text style={styles.detailText}>{listing.description}</Text></View>
                <View style={styles.detailFacts}>
                  <View style={styles.fact}><Text style={styles.detailLabel}>MODEL</Text><Text style={styles.factValue}>{modeLabel[listing.mode]}</Text></View>
                  <View style={styles.fact}><Text style={styles.detailLabel}>KONDISI</Text><Text style={styles.factValue}>{listing.condition || 'Tidak berlaku'}</Text></View>
                  <View style={styles.fact}><Text style={styles.detailLabel}>{listing.mode === 'PREORDER' ? 'KUOTA TERSISA' : 'STOK'}</Text><Text style={styles.factValue}>{listing.mode === 'SERVICE' ? 'Tanpa stok' : `${listing.stockLeft ?? 0} / ${listing.stock ?? 0}`}</Text></View>
                  <View style={styles.fact}><Text style={styles.detailLabel}>PENYERAHAN</Text><Text style={styles.factValue}>{listing.fulfillmentMethods?.join(' · ') || '-'}</Text></View>
                  {listing.mode === 'PREORDER' ? <>
                    <View style={styles.fact}><Text style={styles.detailLabel}>STATUS PO</Text><Text style={styles.factValue}>{preorderLabel(listing.preorderStatus)}</Text></View>
                    <View style={styles.fact}><Text style={styles.detailLabel}>DEADLINE PO</Text><Text style={styles.factValue}>{listing.preorderDeadline ? date(listing.preorderDeadline) : '-'}</Text></View>
                    <View style={styles.fact}><Text style={styles.detailLabel}>MINIMUM / MAX BUYER</Text><Text style={styles.factValue}>{listing.preorderMinOrder || '-'} / {listing.preorderMaxPerBuyer || '-'}</Text></View>
                    <View style={styles.fact}><Text style={styles.detailLabel}>PICKUP</Text><Text style={styles.factValue}>{listing.preorderPickupLocation || '-'}</Text></View>
                  </> : null}
                  <View style={styles.fact}><Text style={styles.detailLabel}>ID LISTING</Text><Text selectable style={styles.factValue}>{listing.id}</Text></View>
                </View>
              </View> : null}
            </Card>;
          })}
        </View>
      )}

      {result && result.totalPages > 1 ? <Card style={styles.pagination}>
        <Text style={styles.pageText}>Halaman {result.page} dari {result.totalPages} · {result.total} hasil</Text>
        <View style={styles.pageActions}><Button title="Sebelumnya" variant="ghost" disabled={result.page <= 1} onPress={() => setPage(value => Math.max(1, value - 1))} style={styles.pageButton} /><Button title="Berikutnya" variant="secondary" disabled={result.page >= result.totalPages} onPress={() => setPage(value => Math.min(result.totalPages, value + 1))} style={styles.pageButton} /></View>
      </Card> : null}

      <FeedbackDialog visible={Boolean(pending && dialog)} tone={dialog?.tone || 'warning'} title={dialog?.title || ''} message={dialog?.message || ''} primaryLabel={dialog?.label || 'Lanjutkan'} secondaryLabel="Batal" loading={working} onClose={() => setPending(null)} onSecondary={() => setPending(null)} onPrimary={execute} />
      <FeedbackDialog visible={Boolean(feedback)} tone={feedback?.tone || 'success'} title={feedback?.title || ''} message={feedback?.message || ''} onClose={() => setFeedback(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  toolbar: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  search: { flex: 1, minWidth: 280 },
  searchMobile: { minWidth: 0, width: '100%', flexBasis: '100%' },
  typeFilters: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  filter: { minHeight: 38, paddingHorizontal: 13, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  filterActive: { borderColor: '#C5DDF8', backgroundColor: colors.primarySoft },
  filterText: { color: colors.textSoft, fontFamily: 'PoppinsMedium', fontSize: 11.5 },
  filterTextActive: { color: colors.primary, fontFamily: 'PoppinsSemiBold' },
  refresh: { width: 40, height: 40, borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  statusFilters: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginTop: -8 },
  statusFilter: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  statusFilterActive: { backgroundColor: colors.primaryDeep, borderColor: colors.primaryDeep },
  statusFilterText: { color: colors.textSoft, fontFamily: 'PoppinsMedium', fontSize: 11 },
  statusFilterTextActive: { color: colors.white, fontFamily: 'PoppinsSemiBold' },
  list: { gap: 10 },
  listingCard: { padding: 15 },
  listingRow: { flexDirection: 'row', alignItems: 'stretch', gap: 15 },
  listingRowMobile: { flexWrap: 'wrap' },
  media: { width: 128, minHeight: 112, borderRadius: 13, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  mediaMobile: { width: 84, minHeight: 84, height: 84 },
  image: { width: '100%', height: '100%' },
  listingBody: { flex: 1.5, minWidth: 260, justifyContent: 'center', gap: 3 },
  listingBodyMobile: { minWidth: 0, flexBasis: 180 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 9, flexWrap: 'wrap' },
  listingTitle: { maxWidth: 500, color: colors.text, fontFamily: 'PoppinsSemiBold', fontSize: 16 },
  price: { color: colors.primary, fontFamily: 'PoppinsBold', fontSize: 17, marginTop: 1 },
  meta: { color: colors.muted, fontFamily: 'PoppinsRegular', fontSize: 11.5, lineHeight: 18 },
  sellerRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 9 },
  sellerAvatar: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  sellerInitial: { color: colors.primary, fontFamily: 'PoppinsBold', fontSize: 12 },
  sellerName: { color: colors.textSoft, fontFamily: 'PoppinsSemiBold', fontSize: 11.5 },
  sellerMeta: { color: colors.muted, fontFamily: 'PoppinsRegular', fontSize: 10.5, marginTop: 1 },
  side: { width: 285, minWidth: 240, justifyContent: 'center', gap: 11 },
  sideMobile: { width: '100%', minWidth: 0, alignItems: 'stretch' },
  reportBadge: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.dangerSoft },
  reportBadgeText: { color: colors.danger, fontFamily: 'PoppinsSemiBold', fontSize: 10.5 },
  cleanBadge: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.successSoft },
  cleanBadgeText: { color: colors.success, fontFamily: 'PoppinsSemiBold', fontSize: 10.5 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 7 },
  actionsMobile: { justifyContent: 'flex-start' },
  action: { minWidth: 126, minHeight: 40 },
  readOnly: { maxWidth: 255, color: colors.muted, fontFamily: 'PoppinsRegular', fontSize: 10.5, lineHeight: 17, textAlign: 'right' },
  readOnlyMobile: { maxWidth: '100%', textAlign: 'left' },
  detailPanel: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border, gap: 12 },
  detailBlock: { gap: 4 },
  detailLabel: { color: colors.muted, fontFamily: 'PoppinsBold', fontSize: 9.5, letterSpacing: .65 },
  detailText: { color: colors.textSoft, fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 19 },
  detailFacts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fact: { minWidth: 180, flex: 1, padding: 11, borderRadius: 10, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, gap: 3 },
  factValue: { color: colors.text, fontFamily: 'PoppinsMedium', fontSize: 11.5, lineHeight: 17 },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: 12 },
  pageText: { color: colors.muted, fontFamily: 'PoppinsMedium', fontSize: 11.5 },
  pageActions: { flexDirection: 'row', gap: 7 },
  pageButton: { minWidth: 120, minHeight: 40 },
});
