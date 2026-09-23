import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Image, Modal, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { AdminEmptyState, AdminStatCard, AdminStatusPill } from '@/components/admin-ui';
import { FilterSelect, type FilterOption } from '@/components/filter-select';
import { Button, Card, date, ErrorState, FeedbackDialog, Field, InlineAlert, Loader, money, Screen, Title } from '@/components/ui';
import { colors, radius, makeStyles } from '@/constants/theme';
import { endpoints, errorMessage } from '@/lib/api';
import { canPreviewDeliverable, deliverableIcon, fileSizeLabel, isZipDeliverable, openPreviewUrl, openSignedFile, reservePreviewTab } from '@/lib/deliverables';
import type { DeliverableArchiveEntryPreview, Dispute, TransactionDeliverable } from '@/types';

const reasonLabel: Record<string, string> = { ITEM_NOT_AS_DESCRIBED: 'Barang tidak sesuai', ITEM_DAMAGED: 'Barang rusak', NOT_RECEIVED: 'Tidak diterima', SELLER_NO_SHOW: 'Seller tidak hadir', BUYER_NO_SHOW: 'Buyer tidak hadir', OTHER: 'Lainnya' };
const transactionStatusLabel: Record<string, string> = { PENDING: 'Menunggu pembayaran', PAID: 'Dibayar (escrow)', CONFIRMED: 'Diproses', COMPLETED: 'Selesai', CANCELLED: 'Dibatalkan' };
const TEXT_PREVIEW_MAX_CHARS = 200_000;
type ListingKind = 'ALL' | 'PRODUCT' | 'SERVICE';
const listingKindOptions: FilterOption<ListingKind>[] = [
  { key: 'ALL', label: 'Barang & jasa', icon: 'albums-outline' },
  { key: 'PRODUCT', label: 'Barang', icon: 'cube-outline' },
  { key: 'SERVICE', label: 'Jasa', icon: 'construct-outline' },
];
type ResolveAction = 'START_REVIEW' | 'REFUND_BUYER' | 'RELEASE_SELLER' | 'REJECT';
type DecisionAction = Exclude<ResolveAction, 'START_REVIEW'>;
const actionCopy: Record<DecisionAction, { title: string; message: string; label: string; tone: 'warning' | 'danger' }> = {
  REFUND_BUYER: { title: 'Refund dana ke buyer?', message: 'Dana escrow akan dikembalikan ke buyer dan keputusan ini menutup sengketa.', label: 'Refund buyer', tone: 'warning' },
  RELEASE_SELLER: { title: 'Lepaskan dana ke seller?', message: 'Transaksi akan diselesaikan dan dana escrow akan diteruskan ke seller.', label: 'Release seller', tone: 'warning' },
  REJECT: { title: 'Tolak sengketa ini?', message: 'Sengketa akan ditutup dan flow transaksi dibuka kembali sesuai status terakhir.', label: 'Tolak sengketa', tone: 'danger' },
};

export default function AdminDisputes() {
  const styles = useStyles();
  const client = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [search, setSearch] = useState('');
  const [listingKind, setListingKind] = useState<ListingKind>('ALL');
  const [pendingAction, setPendingAction] = useState<DecisionAction | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'danger'; title: string; message: string } | null>(null);
  const query = useQuery({ queryKey: ['admin-disputes'], queryFn: () => endpoints.adminDisputes() });
  const resolve = useMutation({
    mutationFn: (action: ResolveAction) => endpoints.resolveDispute(expandedId!, action, note.trim() || undefined),
    onSuccess: (_, action) => {
      const finished = action !== 'START_REVIEW'; setPendingAction(null); if (finished) { setNote(''); setExpandedId(null); }
      client.invalidateQueries({ queryKey: ['admin-disputes'] }); client.invalidateQueries({ queryKey: ['admin-stats'] });
      setFeedback({ tone: 'success', title: action === 'START_REVIEW' ? 'Sengketa masuk tahap review' : 'Keputusan sengketa tersimpan', message: action === 'START_REVIEW' ? 'Kasus ditandai sedang ditinjau. Periksa bukti dan catatan sebelum menentukan keputusan akhir.' : 'Buyer dan seller akan melihat hasil keputusan ini dari transaksi dan notifikasi mereka.' });
    },
    onError: error => { setPendingAction(null); setFeedback({ tone: 'danger', title: 'Keputusan belum tersimpan', message: errorMessage(error) }); },
  });
  const all = query.data || [];
  const active = all.filter(item => ['OPEN', 'IN_REVIEW'].includes(item.status));
  const q = search.trim().toLowerCase();
  const visible = active.filter(item => listingKind === 'ALL' || item.transaction?.listing?.type === listingKind).filter(item => !q || [item.id, item.transactionId, item.openedBy?.name, item.description, item.transaction?.listingTitleSnapshot, item.transaction?.listing?.title].some(value => String(value || '').toLowerCase().includes(q)));
  const toggle = (id: string) => { setNote(''); setExpandedId(current => current === id ? null : id); };

  return (
    <Screen backgroundColor={colors.surfaceMuted}>
      <Title subtitle="Buka kasus untuk memeriksa laporan, isi listing, dan file hasil jasa sebelum memutuskan ke mana dana escrow dilepas.">Sengketa transaksi</Title>
      <View style={styles.stats}>
        <AdminStatCard label="Sengketa" value={active.length} caption="Jumlah sengketa yang sedang berjalan saat ini" icon="file-tray-full-outline" />
      </View>
      <Card style={styles.toolbar}>
        <View style={styles.search}><Field icon="search-outline" value={search} onChangeText={setSearch} placeholder="Cari ID transaksi, pengguna, atau listing..." /></View>
        <FilterSelect label="Jenis listing" icon="funnel-outline" value={listingKind} options={listingKindOptions} onChange={setListingKind} style={styles.kindSelect} />
      </Card>
      {query.isLoading ? <Loader /> : query.isError ? <ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} /> : (
        <Card style={styles.caseArea}>
          {!active.length ? <AdminEmptyState title="Tidak ada sengketa aktif" message="Semua transaksi berjalan tanpa sengketa yang perlu ditangani." /> : !visible.length ? <AdminEmptyState compact icon="search-outline" title="Sengketa tidak ditemukan" message="Coba gunakan kata kunci pencarian atau filter jenis listing yang berbeda." /> : (
            <View style={styles.list}>
              {visible.map(item => {
                const open = expandedId === item.id;
                const title = item.transaction?.listingTitleSnapshot || item.transaction?.listing?.title || 'Transaksi BMarket';
                return (
                  <View key={item.id} style={[styles.caseCard, open && styles.active]}>
                    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${open ? 'Tutup' : 'Buka'} detail sengketa ${title}`} onPress={() => toggle(item.id)} style={({ pressed }) => [styles.caseToggle, pressed && styles.pressed]}>
                      <View style={styles.head}>
                        <View style={styles.warn}><Ionicons name="warning-outline" size={20} color={colors.warning} /></View>
                        <View style={styles.flex}><Text style={styles.reason}>{reasonLabel[item.reason] || item.reason}</Text><Text style={styles.title}>{title}</Text><Text style={styles.meta}>{item.openedBy?.name || 'Binusian'} · {item.id.slice(0, 8)}</Text></View>
                        <AdminStatusPill label={item.status === 'OPEN' ? 'Menunggu tinjauan' : 'Sedang ditinjau'} tone={item.status === 'OPEN' ? 'warning' : 'primary'} />
                        <Text style={styles.amount}>{money(item.transaction?.grandTotal)}</Text>
                        <View style={styles.chevron}><Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSoft} /></View>
                      </View>
                      {open ? null : <Text numberOfLines={2} style={styles.desc}>{item.description}</Text>}
                    </Pressable>
                    {open ? (
                      <DisputeDetail
                        dispute={item}
                        note={note}
                        onNoteChange={setNote}
                        busy={resolve.isPending}
                        onStartReview={() => resolve.mutate('START_REVIEW')}
                        onDecision={setPendingAction}
                        onClose={() => setExpandedId(null)}
                      />
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </Card>
      )}
      <FeedbackDialog visible={Boolean(pendingAction)} tone={pendingAction ? actionCopy[pendingAction].tone : 'warning'} title={pendingAction ? actionCopy[pendingAction].title : ''} message={pendingAction ? `${actionCopy[pendingAction].message}${note.trim() ? ' Catatan admin akan ikut disimpan.' : ''}` : ''} primaryLabel={pendingAction ? actionCopy[pendingAction].label : 'Lanjut'} secondaryLabel="Batal" loading={resolve.isPending} onClose={() => setPendingAction(null)} onSecondary={() => setPendingAction(null)} onPrimary={() => pendingAction && resolve.mutate(pendingAction)} />
      <FeedbackDialog visible={Boolean(feedback)} tone={feedback?.tone || 'success'} title={feedback?.title || ''} message={feedback?.message || ''} onClose={() => setFeedback(null)} />
    </Screen>
  );
}

function Section({ icon, title, subtitle, children }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; subtitle?: string; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={styles.sectionIcon}><Ionicons name={icon} size={17} color={colors.primary} /></View>
        <View style={styles.flex}><Text style={styles.sectionTitle}>{title}</Text>{subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}</View>
      </View>
      {children}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  const styles = useStyles();
  if (!value) return null;
  return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>;
}

function DisputeDetail({ dispute, note, onNoteChange, busy, onStartReview, onDecision, onClose }: {
  dispute: Dispute;
  note: string;
  onNoteChange: (value: string) => void;
  busy: boolean;
  onStartReview: () => void;
  onDecision: (action: DecisionAction) => void;
  onClose: () => void;
}) {
  const styles = useStyles();
  const mobile = useWindowDimensions().width < 700;
  const [error, setError] = useState('');
  const [archiveFor, setArchiveFor] = useState<string | null>(null);
  const [entryPreview, setEntryPreview] = useState<DeliverableArchiveEntryPreview | null>(null);
  const transaction = dispute.transaction;
  const listing = transaction?.listing;
  const deliverables = transaction?.deliverables || [];
  const service = listing?.mode === 'SERVICE' || listing?.type === 'SERVICE' || deliverables.length > 0;
  const reporter = dispute.openedById === transaction?.buyerId ? 'buyer' : 'seller';

  const openFile = useMutation({
    mutationFn: ({ file, mode, popup }: { file: TransactionDeliverable; mode: 'preview' | 'download'; popup: Window | null }) => openSignedFile(() => endpoints.adminDeliverableLink(file.id, mode), popup),
    onSuccess: () => setError(''),
    onError: err => setError(errorMessage(err)),
  });
  const archive = useQuery({ queryKey: ['admin-deliverable-archive', archiveFor], queryFn: () => endpoints.adminDeliverableArchive(archiveFor!), enabled: Boolean(archiveFor) });
  const previewEntry = useMutation({
    mutationFn: (path: string) => endpoints.adminDeliverableArchiveEntry(archiveFor!, path),
    onSuccess: result => { setError(''); setEntryPreview(result); },
    onError: err => setError(errorMessage(err)),
  });

  const archiveFiles = archive.data?.entries.filter(entry => !entry.isDirectory) || [];
  const previewText = entryPreview?.kind === 'text' ? entryPreview.content : '';

  return (
    <View style={styles.detail}>
      {error ? <InlineAlert message={error} /> : null}

      <Section icon="chatbox-ellipses-outline" title="Laporan sengketa" subtitle={`Dibuka oleh ${reporter} (${dispute.openedBy?.name || 'Binusian'}) · ${date(dispute.createdAt)}`}>
        <Text style={styles.body}>{dispute.description}</Text>
        {dispute.evidenceUrls?.length ? (
          <View style={styles.evidenceWrap}>
            <Text style={styles.smallLabel}>{dispute.evidenceUrls.length} bukti foto · ketuk untuk memperbesar</Text>
            <View style={styles.imageGrid}>{dispute.evidenceUrls.map((url, index) => <Pressable key={`${url}-${index}`} accessibilityRole="button" accessibilityLabel={`Buka bukti foto ${index + 1}`} onPress={() => openPreviewUrl(url)}><Image source={{ uri: url }} style={styles.thumb} /></Pressable>)}</View>
          </View>
        ) : <Text style={styles.muted}>Pelapor tidak melampirkan bukti foto.</Text>}
      </Section>

      <Section icon="pricetag-outline" title="Listing yang disengketakan" subtitle="Foto dan deskripsi menampilkan versi listing saat ini, bisa berbeda dari saat transaksi dibuat.">
        {listing?.images?.length ? <View style={styles.imageGrid}>{listing.images.map((url, index) => <Pressable key={`${url}-${index}`} accessibilityRole="button" accessibilityLabel={`Buka foto listing ${index + 1}`} onPress={() => openPreviewUrl(url)}><Image source={{ uri: url }} style={styles.listingImage} /></Pressable>)}</View> : null}
        <Text style={styles.listingTitle}>{transaction?.listingTitleSnapshot || listing?.title || 'Listing tidak tersedia'}</Text>
        <View style={styles.chips}>
          {[listing?.type === 'SERVICE' ? 'Jasa' : listing ? 'Barang' : null, listing?.category, listing?.condition, listing?.status ? `Status: ${listing.status}` : null].filter(Boolean).map(chip => <View key={chip} style={styles.chip}><Text style={styles.chipText}>{chip}</Text></View>)}
        </View>
        {listing?.price !== undefined ? <Text style={styles.price}>{money(listing.price)}</Text> : null}
        <Text style={styles.body}>{listing?.description || 'Listing tidak memiliki deskripsi.'}</Text>
      </Section>

      <Section icon="receipt-outline" title="Detail transaksi" subtitle={`ID #${dispute.transactionId.slice(0, 8).toUpperCase()}`}>
        <InfoRow label="Buyer" value={[transaction?.buyer?.name, transaction?.buyer?.email].filter(Boolean).join(' · ')} />
        <InfoRow label="Seller" value={[transaction?.seller?.name, transaction?.seller?.email].filter(Boolean).join(' · ')} />
        <InfoRow label="Status" value={transaction ? transactionStatusLabel[transaction.status] || transaction.status : null} />
        <InfoRow label="Harga" value={transaction ? `${money(transaction.price)} × ${transaction.quantity}` : null} />
        <InfoRow label="Total dibayar" value={transaction ? money(transaction.grandTotal || transaction.totalPrice) : null} />
        <InfoRow label="Penyerahan" value={service ? 'File hasil jasa' : transaction?.fulfillmentMethod === 'CAMPUS_MEETUP' ? 'Meetup kampus' : 'Transaksi historis'} />
        <InfoRow label="Dipesan" value={transaction ? date(transaction.createdAt) : null} />
        <InfoRow label="Catatan buyer" value={transaction?.note} />
      </Section>

      {service ? (
        <Section icon="folder-open-outline" title="File hasil jasa" subtitle="Pratinjau, unduh, atau lihat isi ZIP untuk memastikan hasil sesuai dengan listing dan laporan.">
          {deliverables.length ? deliverables.map(file => (
            <View key={file.id} style={styles.fileBlock}>
              <View style={styles.fileRow}>
                <View style={styles.fileIcon}><Ionicons name={deliverableIcon(file)} size={18} color={colors.primary} /></View>
                <View style={styles.flex}><Text numberOfLines={1} style={styles.fileName}>{file.fileName}</Text><Text style={styles.muted}>{fileSizeLabel(file.size)} · diunggah {date(file.createdAt)}</Text></View>
              </View>
              <View style={styles.fileActions}>
                {canPreviewDeliverable(file.fileName) ? <Button title="Pratinjau" variant="secondary" icon="eye-outline" disabled={openFile.isPending} onPress={() => openFile.mutate({ file, mode: 'preview', popup: reservePreviewTab() })} style={styles.fileAction} /> : null}
                {isZipDeliverable(file.fileName) ? <Button title={archiveFor === file.id ? 'Tutup isi ZIP' : 'Lihat isi ZIP'} variant="secondary" icon="archive-outline" onPress={() => setArchiveFor(current => current === file.id ? null : file.id)} style={styles.fileAction} /> : null}
                <Button title="Unduh" variant="ghost" icon="download-outline" disabled={openFile.isPending} onPress={() => openFile.mutate({ file, mode: 'download', popup: null })} style={styles.fileAction} />
              </View>
              {archiveFor === file.id ? (
                <View style={styles.archive}>
                  {archive.isLoading ? <Loader /> : archive.isError ? <InlineAlert message={errorMessage(archive.error)} /> : archive.data ? <>
                    <Text style={styles.smallLabel}>{archiveFiles.length} file{archive.data.truncated ? ' · daftar dipotong, unduh ZIP untuk melihat semuanya' : ''} · ketuk file bertanda mata untuk pratinjau</Text>
                    <ScrollView style={styles.archiveList} nestedScrollEnabled>
                      {archiveFiles.length ? archiveFiles.map(entry => (
                        <Pressable key={entry.path} accessibilityRole="button" accessibilityLabel={entry.previewable ? `Pratinjau ${entry.path}` : `${entry.path} tidak dapat dipratinjau`} disabled={!entry.previewable || previewEntry.isPending} onPress={() => previewEntry.mutate(entry.path)} style={({ pressed }) => [styles.entryRow, pressed && styles.pressed]}>
                          <Ionicons name={entry.previewable ? 'eye-outline' : 'document-outline'} size={15} color={entry.previewable ? colors.primary : colors.muted} />
                          <Text numberOfLines={1} style={[styles.entryPath, !entry.previewable && styles.entryPathMuted]}>{entry.path}</Text>
                          <Text style={styles.entrySize}>{fileSizeLabel(entry.size)}</Text>
                        </Pressable>
                      )) : <Text style={styles.muted}>ZIP ini kosong.</Text>}
                    </ScrollView>
                  </> : null}
                </View>
              ) : null}
            </View>
          )) : <Text style={styles.muted}>Penjual belum mengunggah file hasil jasa.</Text>}
        </Section>
      ) : null}

      <Section icon="hammer-outline" title="Keputusan admin" subtitle="Tulis dasar keputusan setelah memeriksa laporan, listing, dan file.">
        <Field label="Catatan keputusan" multiline value={note} onChangeText={onNoteChange} placeholder="Jelaskan dasar keputusan..." hint="Catatan membantu buyer dan seller memahami hasil review." />
        <View style={styles.decisionActions}>
          {dispute.status === 'OPEN' ? <Button title="Mulai review" variant="secondary" icon="eye-outline" loading={busy} onPress={onStartReview} style={styles.decisionAction} /> : null}
          <Button title="Refund buyer" icon="return-down-back-outline" disabled={busy} onPress={() => onDecision('REFUND_BUYER')} style={styles.decisionAction} />
          <Button title="Release ke seller" icon="wallet-outline" disabled={busy} onPress={() => onDecision('RELEASE_SELLER')} style={styles.decisionAction} />
          <Button title="Tolak sengketa" variant="danger" icon="close-circle-outline" disabled={busy} onPress={() => onDecision('REJECT')} style={styles.decisionAction} />
        </View>
      </Section>

      <Button title="Tutup detail sengketa" variant="ghost" icon="chevron-up" onPress={onClose} />

      <Modal visible={Boolean(entryPreview)} transparent animationType="fade" onRequestClose={() => setEntryPreview(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modal, mobile && styles.modalMobile]}>
            <View style={styles.modalHead}>
              <Ionicons name={entryPreview?.kind === 'image' ? 'image-outline' : 'code-slash-outline'} size={18} color={colors.primary} />
              <Text numberOfLines={2} style={styles.modalTitle}>{entryPreview?.path}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Tutup pratinjau" onPress={() => setEntryPreview(null)} style={styles.modalClose}><Ionicons name="close" size={20} color={colors.textSoft} /></Pressable>
            </View>
            {entryPreview?.kind === 'image' ? (
              <Image source={{ uri: `data:${entryPreview.mimeType};base64,${entryPreview.content}` }} style={styles.modalImage} resizeMode="contain" />
            ) : (
              <>
                {previewText.length > TEXT_PREVIEW_MAX_CHARS ? <Text style={styles.smallLabel}>Menampilkan {TEXT_PREVIEW_MAX_CHARS.toLocaleString('id-ID')} karakter pertama. Unduh ZIP untuk melihat file lengkap.</Text> : null}
                <ScrollView style={styles.codeBox} nestedScrollEnabled>
                  <ScrollView horizontal nestedScrollEnabled><Text selectable style={styles.code}>{previewText.slice(0, TEXT_PREVIEW_MAX_CHARS) || '(file kosong)'}</Text></ScrollView>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  toolbar: { padding: 14, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  search: { flexGrow: 1, flexBasis: 280 },
  kindSelect: { flexGrow: 1, flexBasis: 200, maxWidth: 320 },
  caseArea: { width: '100%', padding: 0, overflow: 'hidden' },
  list: { padding: 12, gap: 9 },
  pressed: { opacity: .72 },
  caseCard: { borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  caseToggle: { padding: 15, gap: 9 },
  active: { borderColor: colors.primaryBorder, backgroundColor: colors.primaryMist },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  warn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.warningSoft, alignItems: 'center', justifyContent: 'center' },
  chevron: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  flex: { flex: 1, minWidth: 160 },
  reason: { fontFamily: 'PoppinsBold', fontSize: 10.5, letterSpacing: .45, color: colors.warning },
  title: { fontFamily: 'PoppinsSemiBold', fontSize: 14, color: colors.text },
  meta: { fontFamily: 'PoppinsRegular', fontSize: 11.5, color: colors.muted },
  amount: { fontFamily: 'PoppinsBold', fontSize: 13, color: colors.primaryDark },
  desc: { fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 19, color: colors.textSoft },
  detail: { paddingHorizontal: 15, paddingBottom: 15, gap: 12 },
  section: { padding: 14, gap: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  sectionIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontFamily: 'PoppinsBold', fontSize: 14, color: colors.text },
  sectionSubtitle: { fontFamily: 'PoppinsRegular', fontSize: 11.5, lineHeight: 17, color: colors.muted },
  body: { fontFamily: 'PoppinsRegular', fontSize: 12.5, lineHeight: 20, color: colors.text },
  muted: { fontFamily: 'PoppinsRegular', fontSize: 11.5, color: colors.muted },
  smallLabel: { fontFamily: 'PoppinsMedium', fontSize: 11.5, color: colors.primary },
  evidenceWrap: { gap: 8 },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: { width: 76, height: 76, borderRadius: 10, backgroundColor: colors.surfaceMuted },
  listingImage: { width: 120, height: 120, borderRadius: 12, backgroundColor: colors.surfaceMuted },
  listingTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 15, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: colors.surfaceMuted },
  chipText: { fontFamily: 'PoppinsMedium', fontSize: 11, color: colors.textSoft },
  price: { fontFamily: 'PoppinsBold', fontSize: 14, color: colors.primaryDark },
  infoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabel: { width: 120, fontFamily: 'PoppinsMedium', fontSize: 12, color: colors.muted },
  infoValue: { flex: 1, minWidth: 160, fontFamily: 'PoppinsRegular', fontSize: 12.5, color: colors.text },
  fileBlock: { gap: 8, padding: 10, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fileIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  fileName: { fontFamily: 'PoppinsSemiBold', fontSize: 12.5, color: colors.text },
  fileActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fileAction: { flexGrow: 1, flexBasis: 130, minHeight: 40 },
  archive: { gap: 8, padding: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  archiveList: { maxHeight: 320 },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border },
  entryPath: { flex: 1, fontFamily: 'PoppinsRegular', fontSize: 12, color: colors.text },
  entryPathMuted: { color: colors.muted },
  entrySize: { fontFamily: 'PoppinsRegular', fontSize: 11, color: colors.muted },
  decisionActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  decisionAction: { flexGrow: 1, flexBasis: 180, minHeight: 44 },
  modalBackdrop: { flex: 1, padding: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, .6)' },
  modal: { width: '100%', maxWidth: 900, maxHeight: '90%', padding: 16, gap: 10, borderRadius: 16, backgroundColor: colors.surface },
  modalMobile: { padding: 12 },
  modalHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalTitle: { flex: 1, fontFamily: 'PoppinsSemiBold', fontSize: 13, color: colors.text },
  modalClose: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  modalImage: { width: '100%', height: 520, maxHeight: '100%', borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  codeBox: { maxHeight: 560, padding: 12, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  code: { fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), fontSize: 12, lineHeight: 18, color: colors.text },
}));
