import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Image, Modal, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { AdminEmptyState, AdminStatCard, AdminStatusPill } from '@/components/admin-ui';
import { FilterSelect } from '@/components/filter-select';
import { Button, Card, date, ErrorState, FeedbackDialog, Field, Loader, money, Screen, Title } from '@/components/ui';
import { colors, radius, makeStyles } from '@/constants/theme';
import { endpoints, errorMessage } from '@/lib/api';
import type { Listing, ListingMode, ListingStatus } from '@/types';
import { ListingImageFallback } from '@/components/listing-image-fallback';
import { UserAvatar } from '@/components/user-avatar';

type StatusFilter = 'ALL' | ListingStatus;
type ModeFilter = 'ALL' | ListingMode;
type DirectStatus = 'ACTIVE' | 'HIDDEN' | 'REMOVED';
type PendingAction = { listing: Listing; kind: 'STATUS'; status: DirectStatus } | { listing: Listing; kind: 'MODERATE'; action: 'approve' | 'reject' };

// Non-clickable Pressable areas (backdrop, modal panel) should not show the pointer cursor on web.
const defaultCursor = Platform.OS === 'web' ? ({ cursor: 'default' } as any) : {};

const statusOptions: { key: StatusFilter; label: string }[] = [
  { key: 'ALL', label: 'Semua' },
  { key: 'ACTIVE', label: 'Aktif' },
  { key: 'HIDDEN', label: 'Disembunyikan' },
  { key: 'REMOVED', label: 'Dihapus' },
  { key: 'SOLD', label: 'Terjual' },
  { key: 'INACTIVE', label: 'Nonaktif' },
  { key: 'PENDING', label: 'Pending' },
];

const modeOptions: { key: ModeFilter; label: string }[] = [
  { key: 'ALL', label: 'Semua model' },
  { key: 'ONE_OFF', label: 'Satuan' },
  { key: 'STOCKED', label: 'Ready stock' },
  { key: 'PREORDER', label: 'Pre-order' },
  { key: 'SERVICE', label: 'Jasa' },
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
  const styles = useStyles();
  const client = useQueryClient();
  const { width, height } = useWindowDimensions();
  const desktop = width >= 900;
  const mobile = width < 600;
  const [search, setSearch] = useState('');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [mode, setMode] = useState<ModeFilter>('ALL');
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'danger'; title: string; message: string } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => { setKeyword(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);


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
  const detail = listings.find(item => item.id === detailId) || null;
  const [viewer, setViewer] = useState<{ images: string[]; index: number } | null>(null);
  const viewerUri = viewer ? viewer.images[viewer.index] : null;
  // Zoom and measured size are keyed by image URI, so switching photos resets them without an effect-driven reset.
  const [zoomedUri, setZoomedUri] = useState<string | null>(null);
  const [measured, setMeasured] = useState<{ uri: string; width: number; height: number } | null>(null);
  const zoomed = Boolean(viewerUri) && zoomedUri === viewerUri;
  const imageSize = measured && measured.uri === viewerUri ? measured : null;
  const toggleZoom = () => setZoomedUri(current => current === viewerUri ? null : viewerUri);

  useEffect(() => {
    if (!viewerUri) return;
    let active = true;
    Image.getSize(
      viewerUri,
      (w, h) => { if (active) setMeasured({ uri: viewerUri, width: w, height: h }); },
      () => { if (active) setMeasured({ uri: viewerUri, width: width - 32, height: height - 160 }); },
    );
    return () => { active = false; };
  }, [viewerUri, width, height]);

  const viewportWidth = width;
  const viewportHeight = height - 130;
  const fitScale = imageSize ? Math.min(1, (viewportWidth - 32) / imageSize.width, (viewportHeight - 32) / imageSize.height) : 1;
  const displaySize = imageSize ? { width: imageSize.width * (zoomed ? 1 : fitScale), height: imageSize.height * (zoomed ? 1 : fitScale) } : null;
  const canZoom = fitScale < 1;

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
      setDetailId(null);
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
        <View style={[styles.selects, mobile && styles.selectsMobile]}>
          <FilterSelect label="Model" icon="cube-outline" value={mode} options={modeOptions} onChange={key => { setMode(key); setPage(1); }} style={styles.select} />
          <FilterSelect label="Status" icon="funnel-outline" value={status} options={statusOptions} onChange={key => { setStatus(key); setPage(1); }} style={styles.select} />
          <Pressable onPress={() => query.refetch()} style={({ pressed }) => [styles.refresh, pressed && { opacity: .6 }]}><Ionicons name="refresh-outline" size={19} color={colors.primary} /></Pressable>
        </View>
      </Card>

      {query.isLoading ? <Loader /> : query.isError ? <ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} /> : !listings.length ? (
        <Card><AdminEmptyState icon="search-outline" title="Listing tidak ditemukan" message="Tidak ada listing yang cocok dengan pencarian atau filter saat ini." /></Card>
      ) : (
        <View style={styles.list}>
          {listings.map(listing => {
            const reportCount = listing.openReportCount || 0;
            return <Pressable key={listing.id} onPress={() => setDetailId(listing.id)} style={({ pressed }) => [pressed && { opacity: .75 }]}>
              <Card style={styles.listingCard}>
              <View style={[styles.listingRow, !desktop && styles.listingRowMobile]}>
                <View style={[styles.media, mobile && styles.mediaMobile]}>
                  {listing.images?.[0] ? <Image source={{ uri: listing.images[0] }} style={styles.image} resizeMode="cover" /> : <ListingImageFallback type={listing.type} category={listing.category} size={27} />}
                </View>
                <View style={[styles.listingBody, mobile && styles.listingBodyMobile]}>
                  <View style={styles.titleLine}><Text numberOfLines={2} style={styles.listingTitle}>{listing.title}</Text><AdminStatusPill label={statusLabel[listing.status]} tone={statusTone(listing.status)} /></View>
                  <Text style={styles.price}>{money(listing.price)}</Text>
                  <Text style={styles.meta}>{modeLabel[listing.mode]} · {listing.category} · dibuat {date(listing.createdAt)}</Text>
                  <View style={styles.sellerRow}><UserAvatar name={listing.seller?.name} avatarUrl={listing.seller?.avatarUrl} style={styles.sellerAvatar} textStyle={styles.sellerInitial} /><View><Text style={styles.sellerName}>{listing.seller?.name || 'Seller BMarket'}</Text><Text style={styles.sellerMeta}>{listing.seller?.email || 'Email tidak tersedia'}{listing.seller?.studentId ? ` · NIM ${listing.seller.studentId}` : ''}</Text></View></View>
                </View>
                <View style={[styles.side, mobile && styles.sideMobile]}>
                  {reportCount > 0 ? <View style={styles.reportBadge}><Ionicons name="flag-outline" size={15} color={colors.danger} /><Text style={styles.reportBadgeText}>{reportCount} laporan terbuka</Text></View> : <View style={styles.cleanBadge}><Ionicons name="shield-checkmark-outline" size={15} color={colors.success} /><Text style={styles.cleanBadgeText}>Belum ada laporan</Text></View>}
                  <View style={[styles.tapHint, mobile && styles.tapHintMobile]}><Ionicons name="hand-left-outline" size={14} color={colors.muted} /><Text style={styles.tapHintText}>Ketuk untuk detail & tindakan</Text></View>
                </View>
              </View>
              </Card>
            </Pressable>;
          })}
        </View>
      )}

      {result && result.totalPages > 1 ? <Card style={styles.pagination}>
        <Text style={styles.pageText}>Halaman {result.page} dari {result.totalPages} · {result.total} hasil</Text>
        <View style={styles.pageActions}><Button title="Sebelumnya" variant="ghost" disabled={result.page <= 1} onPress={() => setPage(value => Math.max(1, value - 1))} style={styles.pageButton} /><Button title="Berikutnya" variant="secondary" disabled={result.page >= result.totalPages} onPress={() => setPage(value => Math.min(result.totalPages, value + 1))} style={styles.pageButton} /></View>
      </Card> : null}

      <Modal visible={Boolean(viewerUri)} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setViewer(null)}>
        <View style={styles.viewerBackdrop}>
          <View style={styles.viewerBar}>
            <Text style={styles.viewerCount}>{viewer ? `${viewer.index + 1} / ${viewer.images.length}` : ''}{imageSize && canZoom ? ` · ${zoomed ? 'Ukuran asli' : 'Pas layar'}` : ''}</Text>
            <View style={styles.viewerTools}>
              {canZoom ? <Pressable onPress={toggleZoom} style={styles.viewerButton}><Ionicons name={zoomed ? 'contract-outline' : 'expand-outline'} size={21} color={colors.white} /></Pressable> : null}
              <Pressable onPress={() => setViewer(null)} style={styles.viewerButton}><Ionicons name="close" size={23} color={colors.white} /></Pressable>
            </View>
          </View>
          <ScrollView key={`${viewerUri}-${zoomed}`} horizontal style={styles.flex} contentContainerStyle={{ minWidth: viewportWidth, alignItems: 'center', justifyContent: 'center' }} showsHorizontalScrollIndicator={zoomed}>
            <ScrollView contentContainerStyle={{ minHeight: viewportHeight, minWidth: viewportWidth, alignItems: 'center', justifyContent: 'center', padding: 16 }} showsVerticalScrollIndicator={zoomed}>
              {viewerUri && displaySize ? <Pressable disabled={!canZoom} onPress={toggleZoom}>
                <Image source={{ uri: viewerUri }} style={displaySize} resizeMode="contain" />
              </Pressable> : <Loader />}
            </ScrollView>
          </ScrollView>
          {viewer && viewer.images.length > 1 ? <>
            <Pressable disabled={viewer.index === 0} onPress={() => setViewer({ ...viewer, index: viewer.index - 1 })} style={[styles.viewerNav, styles.viewerNavLeft, viewer.index === 0 && { opacity: .3 }]}><Ionicons name="chevron-back" size={26} color={colors.white} /></Pressable>
            <Pressable disabled={viewer.index === viewer.images.length - 1} onPress={() => setViewer({ ...viewer, index: viewer.index + 1 })} style={[styles.viewerNav, styles.viewerNavRight, viewer.index === viewer.images.length - 1 && { opacity: .3 }]}><Ionicons name="chevron-forward" size={26} color={colors.white} /></Pressable>
          </> : null}
          <Text style={styles.viewerHint}>{canZoom ? 'Ketuk gambar untuk memperbesar / memperkecil' : 'Gambar ditampilkan dalam ukuran asli'}</Text>
        </View>
      </Modal>

      <Modal visible={Boolean(detail) && !pending && !feedback && !viewer} transparent animationType="fade" onRequestClose={() => setDetailId(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setDetailId(null)}>
          {detail ? <Pressable onPress={() => {}} style={[styles.detailModal, mobile && styles.detailModalMobile]}>
            <View style={styles.modalHeader}>
              <View style={styles.flex}><Text style={styles.detailLabel}>DETAIL LISTING</Text><Text numberOfLines={2} style={styles.modalTitle}>{detail.title}</Text></View>
              <Pressable onPress={() => setDetailId(null)} style={styles.modalClose}><Ionicons name="close" size={20} color={colors.textSoft} /></Pressable>
            </View>
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.hero}>
                <Pressable disabled={!detail.images?.[0]} onPress={() => setViewer({ images: detail.images, index: 0 })} style={({ pressed }) => [styles.heroMedia, mobile && styles.heroMediaMobile, pressed && { opacity: .8 }]}>
                  {detail.images?.[0] ? <>
                    <Image source={{ uri: detail.images[0] }} style={styles.image} resizeMode="cover" />
                    <View style={styles.zoomBadge}><Ionicons name="search-outline" size={15} color={colors.white} /></View>
                  </> : <ListingImageFallback type={detail.type} category={detail.category} size={34} />}
                </Pressable>
                <View style={styles.heroInfo}>
                  <Text style={[styles.heroPrice, mobile && styles.heroPriceMobile]}>{money(detail.price)}</Text>
                  <View style={styles.badgeLeft}><AdminStatusPill label={statusLabel[detail.status]} tone={statusTone(detail.status)} /></View>
                  <View style={styles.heroLine}><Ionicons name="pricetag-outline" size={17} color={colors.muted} /><Text style={styles.heroText}>{detail.category}</Text></View>
                  <View style={styles.heroLine}><Ionicons name="person-outline" size={17} color={colors.muted} /><Text style={styles.heroText}>{detail.seller?.name || 'Seller BMarket'}</Text></View>
                  <Text style={styles.heroSub}>{detail.seller?.email || 'Email tidak tersedia'}{detail.seller?.studentId ? ` · NIM ${detail.seller.studentId}` : ''}</Text>
                  {(detail.openReportCount || 0) > 0 ? <View style={[styles.reportBadge, styles.badgeLeft]}><Ionicons name="flag-outline" size={15} color={colors.danger} /><Text style={styles.reportBadgeText}>{detail.openReportCount} laporan terbuka</Text></View> : null}
                </View>
              </View>
              {(detail.images?.length || 0) > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
                {detail.images.slice(1).map((uri, index) => <Pressable key={uri} onPress={() => setViewer({ images: detail.images, index: index + 1 })} style={({ pressed }) => [pressed && { opacity: .8 }]}><Image source={{ uri }} style={styles.galleryImage} resizeMode="cover" /></Pressable>)}
              </ScrollView> : null}
              <View style={styles.modalSection}><Text style={styles.modalLabel}>Deskripsi</Text><Text style={styles.modalText}>{detail.description}</Text></View>
              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Informasi produk</Text>
                <View style={styles.factList}>
                  {([
                    ['Model', modeLabel[detail.mode]],
                    ['Kondisi', detail.condition || 'Tidak berlaku'],
                    [detail.mode === 'PREORDER' ? 'Kuota tersisa' : 'Stok', detail.mode === 'SERVICE' ? 'Tanpa stok' : `${detail.stockLeft ?? 0} / ${detail.stock ?? 0}`],
                    ['Penyerahan', detail.mode === 'SERVICE' ? 'Tidak ada (jasa)' : 'Meetup langsung'],
                    ...(detail.mode === 'PREORDER' ? [
                      ['Status PO', preorderLabel(detail.preorderStatus)],
                      ['Deadline PO', detail.preorderDeadline ? date(detail.preorderDeadline) : '-'],
                      ['Minimum / max buyer', `${detail.preorderMinOrder || '-'} / ${detail.preorderMaxPerBuyer || '-'}`],
                      ['Pickup', detail.preorderPickupLocation || '-'],
                    ] : []),
                    ['Dibuat', date(detail.createdAt)],
                    ['ID listing', detail.id],
                  ] as [string, string][]).map(([label, value], index) => (
                    <View key={label} style={[styles.factRow, index > 0 && styles.factRowBorder]}>
                      <Text style={styles.factRowLabel}>{label}</Text>
                      <Text selectable style={styles.factRowValue}>{value}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>
            <View style={styles.modalFooter}>
              {detail.status === 'ACTIVE' || detail.status === 'HIDDEN' ? <>
                <Pressable onPress={() => setPending({ listing: detail, kind: 'STATUS', status: detail.status === 'ACTIVE' ? 'HIDDEN' : 'ACTIVE' })} style={({ pressed }) => [styles.toggleRow, pressed && { opacity: .7 }]} accessibilityRole="switch" accessibilityState={{ checked: detail.status === 'ACTIVE' }}>
                  <View style={[styles.toggleTrack, detail.status === 'ACTIVE' && styles.toggleTrackOn]}><View style={[styles.toggleKnob, detail.status === 'ACTIVE' && styles.toggleKnobOn]} /></View>
                  <View><Text style={styles.toggleTitle}>{detail.status === 'ACTIVE' ? 'Aktif' : 'Disembunyikan'}</Text><Text style={styles.toggleCaption}>{detail.status === 'ACTIVE' ? 'Ketuk untuk sembunyikan' : 'Ketuk untuk aktifkan'}</Text></View>
                </Pressable>
                <Button title="Hapus produk" variant="danger" icon="trash-outline" onPress={() => setPending({ listing: detail, kind: 'STATUS', status: 'REMOVED' })} style={styles.action} />
              </> : null}
              {detail.status === 'PENDING' ? <>
                <Button title="Setujui" variant="secondary" icon="checkmark-circle-outline" onPress={() => setPending({ listing: detail, kind: 'MODERATE', action: 'approve' })} style={styles.action} />
                <Button title="Tolak" variant="danger" icon="close-circle-outline" onPress={() => setPending({ listing: detail, kind: 'MODERATE', action: 'reject' })} style={styles.action} />
              </> : null}
              {['SOLD', 'INACTIVE', 'REMOVED', 'REJECTED'].includes(detail.status) ? <Text style={styles.readOnly}>Status ini hanya dipantau. Tidak ada tindakan yang tersedia.</Text> : null}
            </View>
          </Pressable> : null}
        </Pressable>
      </Modal>

      <FeedbackDialog visible={Boolean(pending && dialog)} tone={dialog?.tone || 'warning'} title={dialog?.title || ''} message={dialog?.message || ''} primaryLabel={dialog?.label || 'Lanjutkan'} secondaryLabel="Batal" loading={working} onClose={() => setPending(null)} onSecondary={() => setPending(null)} onPrimary={execute} />
      <FeedbackDialog visible={Boolean(feedback)} tone={feedback?.tone || 'success'} title={feedback?.title || ''} message={feedback?.message || ''} onClose={() => setFeedback(null)} />
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  toolbar: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  search: { flex: 1, minWidth: 280 },
  searchMobile: { minWidth: 0, width: '100%', flexBasis: '100%' },
  selects: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectsMobile: { width: '100%' },
  select: { flex: 1, minWidth: 150 },
  refresh: { width: 46, height: 46, borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
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
  tapHint: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 6 },
  tapHintMobile: { alignSelf: 'flex-start' },
  tapHintText: { color: colors.muted, fontFamily: 'PoppinsMedium', fontSize: 10.5 },
  action: { minWidth: 126, minHeight: 40 },
  readOnly: { flex: 1, color: colors.muted, fontFamily: 'PoppinsRegular', fontSize: 14, lineHeight: 21 },
  flex: { flex: 1 },
  badgeLeft: { alignSelf: 'flex-start' },
  modalBackdrop: { ...defaultCursor, flex: 1, padding: 12, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center' },
  detailModal: { ...defaultCursor, width: '100%', maxWidth: 720, maxHeight: '92%', padding: 20, borderRadius: 18, backgroundColor: colors.surface, gap: 14 },
  detailModalMobile: { maxHeight: '94%', padding: 14, borderRadius: 14 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  modalTitle: { color: colors.text, fontFamily: 'PoppinsSemiBold', fontSize: 21, lineHeight: 29, marginTop: 2 },
  hero: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  heroMedia: { width: 220, height: 220, borderRadius: 14, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  heroMediaMobile: { width: 130, height: 130 },
  heroInfo: { flex: 1, gap: 8 },
  heroPrice: { color: colors.primary, fontFamily: 'PoppinsBold', fontSize: 24 },
  heroPriceMobile: { fontSize: 19 },
  heroLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  heroText: { flex: 1, color: colors.text, fontFamily: 'PoppinsMedium', fontSize: 15 },
  heroSub: { color: colors.muted, fontFamily: 'PoppinsRegular', fontSize: 13, marginTop: -4, marginLeft: 24 },
  modalSection: { gap: 6 },
  modalLabel: { color: colors.textSoft, fontFamily: 'PoppinsSemiBold', fontSize: 15 },
  modalText: { color: colors.text, fontFamily: 'PoppinsRegular', fontSize: 15, lineHeight: 24 },
  factList: { borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted },
  factRow: { paddingHorizontal: 14, paddingVertical: 11, gap: 2 },
  factRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  factRowLabel: { color: colors.muted, fontFamily: 'PoppinsMedium', fontSize: 13 },
  factRowValue: { color: colors.text, fontFamily: 'PoppinsSemiBold', fontSize: 15, lineHeight: 22 },
  modalClose: { width: 36, height: 36, borderRadius: 9, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  modalScroll: { flexGrow: 0, flexShrink: 1 },
  modalContent: { gap: 10 },
  gallery: { gap: 8 },
  galleryImage: { width: 90, height: 90, borderRadius: 10, backgroundColor: colors.surfaceMuted },
  zoomBadge: { position: 'absolute', right: 8, bottom: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center' },
  viewerBackdrop: { flex: 1, backgroundColor: 'rgba(5,12,20,.94)' },
  viewerBar: { height: 64, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  viewerCount: { color: colors.white, fontFamily: 'PoppinsMedium', fontSize: 14 },
  viewerTools: { flexDirection: 'row', gap: 8 },
  viewerButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,.14)', alignItems: 'center', justifyContent: 'center' },
  viewerNav: { position: 'absolute', top: '50%', marginTop: -24, width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,.16)', alignItems: 'center', justifyContent: 'center' },
  viewerNavLeft: { left: 12 },
  viewerNavRight: { right: 12 },
  viewerHint: { height: 66, paddingHorizontal: 16, textAlign: 'center', textAlignVertical: 'center', color: 'rgba(255,255,255,.7)', fontFamily: 'PoppinsRegular', fontSize: 13, lineHeight: 66 },
  modalFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  toggleTrack: { width: 50, height: 28, borderRadius: 14, padding: 3, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, justifyContent: 'center' },
  toggleTrackOn: { backgroundColor: colors.success, borderColor: colors.success },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, shadowColor: '#071727', shadowOpacity: .18, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  toggleKnobOn: { alignSelf: 'flex-end', borderColor: colors.white },
  toggleTitle: { color: colors.text, fontFamily: 'PoppinsSemiBold', fontSize: 15 },
  toggleCaption: { color: colors.muted, fontFamily: 'PoppinsRegular', fontSize: 13 },
  detailLabel: { color: colors.muted, fontFamily: 'PoppinsBold', fontSize: 12, letterSpacing: .65 },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: 12 },
  pageText: { color: colors.muted, fontFamily: 'PoppinsMedium', fontSize: 11.5 },
  pageActions: { flexDirection: 'row', gap: 7 },
  pageButton: { minWidth: 120, minHeight: 40 },
}));
