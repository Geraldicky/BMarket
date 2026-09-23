import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Button, Card, date, ErrorState, FeedbackDialog, Field, InlineAlert, Loader, money, Screen, Title } from '@/components/ui';
import { colors, radius, makeStyles } from '@/constants/theme';
import { endpoints, errorMessage } from '@/lib/api';
import { canPreviewDeliverable, deliverableIcon, fileSizeLabel, openSignedFile, reservePreviewTab } from '@/lib/deliverables';
import { useAuth } from '@/store/auth';
import type { DisputeReason, Transaction, TransactionDeliverable } from '@/types';
import { DISPUTE_REASON_OPTIONS } from '@/lib/domain-metadata';
import { PAYMENT_POLL_INTERVAL_MS } from '@/lib/runtime-config';
import { ListingImageFallback } from '@/components/listing-image-fallback';
import { UserAvatar } from '@/components/user-avatar';
import { transactionPresentation } from '@/lib/transaction-presentation';

const DELIVERABLE_MAX_BYTES = 20 * 1024 * 1024;
const DELIVERABLE_MAX_FILES = 5;

type ActionKind = 'PAY' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

const actionCopy: Record<ActionKind, { eyebrow: string; title: string; description: string; confirm: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  PAY: { eyebrow: 'MIDTRANS SNAP SANDBOX', title: 'Buka halaman pembayaran?', description: 'Kamu akan diarahkan ke halaman aman Midtrans. Status pesanan hanya berubah setelah konfirmasi server Midtrans diterima BMarket.', confirm: 'Lanjut ke Midtrans', icon: 'card-outline' },
  CONFIRMED: { eyebrow: 'KONFIRMASI SELLER', title: 'Mulai proses pesanan?', description: 'Pastikan detail pesanan sudah dipahami dan kamu siap memenuhi pesanan buyer.', confirm: 'Konfirmasi & proses', icon: 'cube-outline' },
  COMPLETED: { eyebrow: 'KONFIRMASI BUYER', title: 'Pesanan sudah diterima?', description: 'Tindakan ini menyelesaikan transaksi dan melepaskan dana escrow kepada seller.', confirm: 'Ya, pesanan diterima', icon: 'checkmark-circle-outline' },
  CANCELLED: { eyebrow: 'PEMBATALAN', title: 'Batalkan transaksi?', description: 'Dana yang sudah masuk escrow dan stok barang akan dikembalikan secara otomatis.', confirm: 'Batalkan transaksi', icon: 'close-circle-outline' },
};

const cancellationReasons = [
  'Berubah pikiran',
  'Tidak dapat menghubungi pihak lain',
  'Detail barang atau jasa tidak sesuai',
  'Tidak dapat memenuhi pesanan',
  'Kesepakatan dibatalkan bersama',
];

const disputeReasons: readonly { value: DisputeReason; label: string }[] = DISPUTE_REASON_OPTIONS;

function dateTime(value?: string | null) {
  return value ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '';
}

function Timeline({ transaction }: { transaction: Transaction }) {
  const styles = useStyles();
  const meetup = transaction.fulfillmentMethod === 'CAMPUS_MEETUP';
  const service = transaction.listing.mode === 'SERVICE';
  const standard = [
    { title: 'Pesanan dibuat', copy: 'Stok direservasi untuk buyer.', time: transaction.createdAt, icon: 'receipt-outline' as const, reached: true },
    { title: 'Pembayaran diterima', copy: 'Dana dipindahkan ke escrow BMarket.', time: transaction.paidAt, icon: 'wallet-outline' as const, reached: ['PAID', 'CONFIRMED', 'COMPLETED'].includes(transaction.status) },
    { title: service ? 'Pengerjaan jasa' : meetup ? 'Koordinasi meetup' : 'Proses penyerahan lama', copy: service ? 'Penjual mengerjakan jasa lalu mengunggah file hasilnya di halaman transaksi.' : meetup ? 'Buyer dan seller menyepakati waktu serta lokasi melalui chat BMarket.' : 'Transaksi historis melanjutkan alur penyerahan yang tersimpan.', time: meetup ? transaction.paidAt : transaction.confirmedAt, icon: meetup ? 'chatbubbles-outline' as const : 'archive-outline' as const, reached: meetup ? ['PAID', 'CONFIRMED', 'COMPLETED'].includes(transaction.status) : ['CONFIRMED', 'COMPLETED'].includes(transaction.status) },
    { title: 'Transaksi selesai', copy: service ? 'Buyer menerima hasil jasa dan dana dilepas.' : meetup ? 'Kode serah-terima valid dan dana dilepas.' : 'Penyerahan selesai dan dana dilepas.', time: transaction.completedAt, icon: 'checkmark-circle-outline' as const, reached: transaction.status === 'COMPLETED' },
  ];
  const steps = transaction.status === 'CANCELLED'
    ? [...standard.filter((step, index) => index === 0 || Boolean(step.time)), { title: 'Transaksi dibatalkan', copy: transaction.cancellationReason || 'Transaksi dihentikan.', time: transaction.cancelledAt, icon: 'close-circle-outline' as const, reached: true, cancelled: true }]
    : standard;

  return (
    <View style={styles.timeline}>
      {steps.map((step, index) => (
        <View key={step.title} style={styles.timelineStep}>
          <View style={styles.timelineRail}>
            <View style={[styles.timelineDot, step.reached && styles.timelineDotReached, 'cancelled' in step && step.cancelled && styles.timelineDotCancelled]}><Ionicons name={step.icon} size={16} color={step.reached ? colors.white : colors.muted} /></View>
            {index < steps.length - 1 ? <View style={[styles.timelineLine, step.reached && styles.timelineLineReached]} /> : null}
          </View>
          <View style={styles.timelineBody}><Text style={[styles.timelineTitle, !step.reached && styles.timelineTitlePending]}>{step.title}</Text><Text style={styles.timelineCopy}>{step.copy}</Text>{step.time ? <Text style={styles.timelineTime}>{dateTime(step.time)}</Text> : <Text style={styles.timelineWaiting}>Menunggu tahap sebelumnya</Text>}</View>
        </View>
      ))}
    </View>
  );
}

export default function TransactionDetailScreen() {
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuth(state => state.user);
  const width = useWindowDimensions().width;
  const desktop = width >= 960;
  const mobile = width < 600;
  const client = useQueryClient();
  const [dialog, setDialog] = useState<ActionKind | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [success, setSuccess] = useState('');
  const [handoverCode, setHandoverCode] = useState('');
  const [handoverInput, setHandoverInput] = useState('');
  const [handoverConfirmVisible, setHandoverConfirmVisible] = useState(false);
  const [handoverCodeVisible, setHandoverCodeVisible] = useState(false);
  const [handoverExpiresAt, setHandoverExpiresAt] = useState('');
  const [clock, setClock] = useState(0);
  const [reviewVisible, setReviewVisible] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [actionError, setActionError] = useState('');
  const [handoverFeedback, setHandoverFeedback] = useState<{ tone: 'success' | 'danger'; title: string; message: string } | null>(null);
  const [disputeVisible, setDisputeVisible] = useState(false);
  const [disputeReason, setDisputeReason] = useState<DisputeReason>('ITEM_NOT_AS_DESCRIBED');
  const [disputeDescription, setDisputeDescription] = useState('');
  const [disputeEvidence, setDisputeEvidence] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [acceptVisible, setAcceptVisible] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const query = useQuery({ queryKey: ['transaction', id], queryFn: () => endpoints.transaction(id), refetchInterval: PAYMENT_POLL_INTERVAL_MS });
  const transaction = query.data;

  useEffect(() => {
    if (!handoverCodeVisible || !handoverExpiresAt) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [handoverCodeVisible, handoverExpiresAt]);

  const buyer = transaction ? (transaction.buyerId === user?.id || transaction.buyer.id === user?.id) : false;
  const payment = useQuery({ queryKey: ['payment', id], queryFn: () => endpoints.payment(id), enabled: Boolean(transaction && buyer), refetchInterval: transaction?.status === 'PENDING' ? PAYMENT_POLL_INTERVAL_MS : false });

  const action = useMutation({
    mutationFn: ({ kind, reason }: { kind: Exclude<ActionKind, 'PAY'>; reason?: string }) => endpoints.setTransactionStatus(id, kind, reason),
    onSuccess: updated => {
      setActionError('');
      client.setQueryData(['transaction', id], updated);
      client.invalidateQueries({ queryKey: ['transactions'] });
      client.invalidateQueries({ queryKey: ['balance'] });
      client.invalidateQueries({ queryKey: ['listings'] });
      client.invalidateQueries({ queryKey: ['listing', updated.listing.id] });
      setSuccess(dialog === 'CONFIRMED' ? 'Pesanan sudah dikonfirmasi dan mulai diproses.' : dialog === 'COMPLETED' ? 'Transaksi selesai. Dana sudah dilepas ke seller.' : 'Transaksi berhasil dibatalkan.');
      setDialog(null);
      setCancelReason('');
    },
    onError: error => setActionError(errorMessage(error)),
  });

  const pay = useMutation({
    mutationFn: async () => {
      const created = await endpoints.createPayment(id);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.assign(created.redirectUrl);
      } else {
        await WebBrowser.openBrowserAsync(created.redirectUrl, { dismissButtonStyle: 'done' });
      }
      return created;
    },
    onSuccess: async () => {
      setDialog(null);
      setActionError('');
      setSuccess('Menunggu konfirmasi pembayaran dari Midtrans. Halaman ini akan memperbarui status secara otomatis.');
      await Promise.all([query.refetch(), payment.refetch()]);
      client.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: error => setActionError(errorMessage(error)),
  });

  const issueCode = useMutation({
    mutationFn: () => endpoints.issueHandoverCode(id),
    onSuccess: result => {
      setActionError('');
      setHandoverCode(result.code);
      setHandoverExpiresAt(result.expiresAt);
      setClock(Date.now());
      setHandoverConfirmVisible(false);
      setHandoverCodeVisible(true);
      setSuccess('Kode serah-terima aktif. Berikan hanya kepada seller setelah barang sudah kamu terima dan periksa.');
    },
    onError: error => setActionError(errorMessage(error)),
  });

  const confirmHandover = useMutation({
    mutationFn: () => endpoints.confirmHandover(id, handoverInput),
    onSuccess: updated => {
      setActionError('');
      client.setQueryData(['transaction', id], updated);
      client.invalidateQueries({ queryKey: ['transactions'] });
      client.invalidateQueries({ queryKey: ['balance'] });
      client.invalidateQueries({ queryKey: ['notifications'] });
      client.invalidateQueries({ queryKey: ['notification-count'] });
      setHandoverInput('');
      setSuccess('');
      setHandoverFeedback({
        tone: 'success',
        title: 'Serah-terima berhasil diverifikasi',
        message: `Kode dari buyer valid. Transaksi sudah selesai dan ${money(updated.sellerReceives)} telah dilepas dari escrow ke saldo BMarket kamu.`,
      });
    },
    onError: error => {
      const message = errorMessage(error);
      setActionError('');
      setHandoverFeedback({
        tone: 'danger',
        title: 'Kode tidak dapat diverifikasi',
        message: `${message} Periksa kembali 6 angka dari buyer dan pastikan kode belum kedaluwarsa.`,
      });
    },
  });


  const createDispute = useMutation({
    mutationFn: async () => {
      if (disputeDescription.trim().length < 10) throw new Error('Jelaskan masalah minimal 10 karakter.');
      const uploaded = disputeEvidence.length ? await endpoints.upload(disputeEvidence.map(asset => ({ uri: asset.uri, fileName: asset.fileName, mimeType: asset.mimeType, file: asset.file }))) : { urls: [] };
      return endpoints.createDispute({ transactionId: id, reason: disputeReason, description: disputeDescription.trim(), evidenceUrls: uploaded.urls });
    },
    onSuccess: dispute => {
      setDisputeVisible(false); setDisputeDescription(''); setDisputeEvidence([]);
      client.setQueryData(['transaction', id], (old: Transaction | undefined) => old ? { ...old, dispute } : old);
      client.invalidateQueries({ queryKey: ['transaction', id] });
      client.invalidateQueries({ queryKey: ['transactions'] });
      setSuccess('Sengketa dibuka. Dana escrow dibekukan sampai admin memberi keputusan.'); setActionError('');
    },
    onError: error => setActionError(errorMessage(error)),
  });

  const refreshTransaction = () => {
    client.invalidateQueries({ queryKey: ['transaction', id] });
    client.invalidateQueries({ queryKey: ['transactions'] });
  };

  // Seller picks result files (documents, images, code, ZIP) and uploads them to the transaction.
  const uploadDeliverables = useMutation({
    mutationFn: async () => {
      const picked = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
      if (picked.canceled || !picked.assets?.length) return null;
      if (picked.assets.length > DELIVERABLE_MAX_FILES) throw new Error(`Pilih maksimal ${DELIVERABLE_MAX_FILES} file sekali unggah.`);
      const tooLarge = picked.assets.find(asset => (asset.size || 0) > DELIVERABLE_MAX_BYTES);
      if (tooLarge) throw new Error(`${tooLarge.name} lebih dari 20 MB.`);
      setUploadProgress(0);
      return endpoints.uploadDeliverables(id, picked.assets.map(asset => ({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType, file: asset.file })), setUploadProgress);
    },
    onSuccess: result => {
      setUploadProgress(null);
      if (!result) return;
      setActionError('');
      refreshTransaction();
      setSuccess('File hasil jasa berhasil diunggah. Buyer sudah bisa mempratinjaunya.');
    },
    onError: error => { setUploadProgress(null); setActionError(errorMessage(error)); },
  });

  const removeDeliverable = useMutation({
    mutationFn: (deliverableId: string) => endpoints.deleteDeliverable(id, deliverableId),
    onSuccess: () => { setActionError(''); refreshTransaction(); },
    onError: error => setActionError(errorMessage(error)),
  });

  // Files open through a short-lived signed link, so they are only reachable by the buyer/seller.
  // Before accepting, the buyer gets an inline preview; the original download unlocks after acceptance.
  const openDeliverable = useMutation({
    mutationFn: ({ file, popup }: { file: TransactionDeliverable; popup: Window | null }) => openSignedFile(() => endpoints.deliverableLink(id, file.id), popup),
    onError: error => setActionError(errorMessage(error)),
  });

  const acceptResult = useMutation({
    mutationFn: () => endpoints.acceptDeliverables(id),
    onSuccess: updated => {
      setAcceptVisible(false);
      setActionError('');
      client.setQueryData(['transaction', id], updated);
      client.invalidateQueries({ queryKey: ['transactions'] });
      client.invalidateQueries({ queryKey: ['balance'] });
      client.invalidateQueries({ queryKey: ['notification-count'] });
      setSuccess('Hasil jasa diterima. Transaksi selesai dan dana sudah dilepas ke penjual.');
    },
    onError: error => { setAcceptVisible(false); setActionError(errorMessage(error)); },
  });

  const pickEvidence = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: Math.max(1, 4 - disputeEvidence.length), quality: .82 });
    if (!result.canceled) setDisputeEvidence(current => [...current, ...result.assets].slice(0, 4));
  };


  const submitReview = useMutation({
    mutationFn: () => endpoints.createReview({ transactionId: id, rating: reviewRating, comment: reviewComment.trim() || undefined }),
    onSuccess: () => {
      setActionError('');
      setReviewVisible(false);
      setReviewRating(0);
      setReviewComment('');
      setSuccess('Review berhasil dikirim. Terima kasih sudah membantu membangun kepercayaan di BMarket.');
      client.invalidateQueries({ queryKey: ['transaction', id] });
      if (transaction?.sellerId) client.invalidateQueries({ queryKey: ['seller-profile', transaction.sellerId] });
    },
    onError: error => setActionError(errorMessage(error)),
  });

  const openDialog = (kind: ActionKind) => {
    setSuccess('');
    setActionError('');
    setCancelReason('');
    setDialog(kind);
  };

  const chat = async () => {
    if (!transaction) return;
    const other = buyer ? transaction.seller : transaction.buyer;
    if (!other.id) return;
    try {
      const room = await endpoints.createRoom(other.id);
      router.push({ pathname: '/(student)/chat/[id]', params: { id: room.id, name: other.name || 'Binusian', transactionId: transaction.id } });
    } catch (error) {
      setActionError(errorMessage(error));
    }
  };

  if (query.isLoading) return <Screen><Loader /></Screen>;
  if (query.isError || !transaction) return <Screen><ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} /></Screen>;

  const meetup = transaction.fulfillmentMethod === 'CAMPUS_MEETUP';
  const service = transaction.listing.mode === 'SERVICE';
  const meta = transactionPresentation(transaction, user?.id);
  const counterpart = buyer ? transaction.seller : transaction.buyer;
  const active = ['PENDING', 'PAID', 'CONFIRMED'].includes(transaction.status);
  const disputeActive = Boolean(transaction.dispute && ['OPEN', 'IN_REVIEW'].includes(transaction.dispute.status));
  const canOpenDispute = ['PAID', 'CONFIRMED'].includes(transaction.status) && transaction.isEscrowHeld && !transaction.dispute;
  const deliverables = transaction.deliverables || [];
  // The backend also blocks this: after result files exist, a buyer must open a dispute instead of cancelling.
  const canCancel = ['PENDING', 'PAID'].includes(transaction.status) && !disputeActive && !(buyer && service && deliverables.length > 0);
  const previewOnly = buyer && transaction.status !== 'COMPLETED';
  const serviceInProgress = service && ['PAID', 'CONFIRMED'].includes(transaction.status) && transaction.isEscrowHeld;
  const canManageResult = !buyer && serviceInProgress && !disputeActive;
  const canAcceptResult = buyer && serviceInProgress && !disputeActive && deliverables.length > 0;
  const preorder = transaction.listing.mode === 'PREORDER';
  const preorderReady = !preorder || ['READY', 'COMPLETED'].includes(transaction.listing.preorderStatus || '');
  const preorderStatusText = ({ OPEN: 'PO masih dibuka', CLOSED: 'PO sudah ditutup', PROCESSING: 'Sedang diproduksi/disiapkan', READY: 'Siap diambil/dikirim', COMPLETED: 'Batch PO selesai', CANCELLED: 'PO dibatalkan' } as Record<string, string>)[transaction.listing.preorderStatus || ''] || 'Status PO belum tersedia';
  const grandTotal = Number(transaction.grandTotal || transaction.totalPrice);
  const dialogCopy = dialog ? actionCopy[dialog] : null;
  const codeSeconds = handoverExpiresAt ? Math.max(0, Math.ceil((new Date(handoverExpiresAt).getTime() - clock) / 1000)) : 0;
  const codeTime = `${String(Math.floor(codeSeconds / 60)).padStart(2, '0')}:${String(codeSeconds % 60).padStart(2, '0')}`;

  return (
    <Screen style={styles.page}>
      <View style={styles.backRow}><Pressable onPress={() => router.back()} style={styles.backButton}><Ionicons name="arrow-back" size={18} color={colors.primary} /><Text style={styles.backText}>Kembali ke transaksi</Text></Pressable><Text style={styles.orderId}>ID #{transaction.id.slice(0, 8).toUpperCase()}</Text></View>
      <Title eyebrow={buyer ? 'DETAIL PEMBELIAN' : 'DETAIL PENJUALAN'} subtitle={`Pesanan dibuat ${date(transaction.createdAt)}`}>{transaction.listing.title}</Title>
      {success ? <InlineAlert tone="success" message={success} /> : null}
      {actionError ? <InlineAlert message={actionError} /> : null}
      {buyer && transaction.status === 'PENDING' && payment.data?.status === 'PENDING' ? <InlineAlert tone="warning" message="Menunggu konfirmasi pembayaran dari Midtrans. Jangan menutup atau membuat checkout baru; status akan diperbarui otomatis setelah webhook terverifikasi." /> : null}
      {transaction.status === 'PENDING' && transaction.reservationExpiresAt ? <InlineAlert tone="warning" message={`Stok direservasi sampai ${dateTime(transaction.reservationExpiresAt)}. Jika belum dibayar, pesanan otomatis dibatalkan dan stok dikembalikan.`} /> : null}
      {preorder && ['PAID', 'CONFIRMED'].includes(transaction.status) ? <InlineAlert tone={preorderReady ? 'success' : 'warning'} message={`${preorderStatusText}${transaction.listing.preorderReadyAt ? ` · Estimasi siap ${dateTime(transaction.listing.preorderReadyAt)}` : ''}${transaction.listing.preorderPickupLocation ? ` · Pickup ${transaction.listing.preorderPickupLocation}` : ''}. ${preorderReady ? 'Pesanan sudah dapat dilanjutkan ke proses penyerahan.' : 'Dana tetap aman di escrow sampai seller menandai batch siap.'}`} /> : null}
      {transaction.dispute ? <InlineAlert tone={disputeActive ? 'warning' : 'success'} message={disputeActive ? `Sengketa ${transaction.dispute.status === 'OPEN' ? 'menunggu admin' : 'sedang ditinjau'}. Dana escrow dan tindakan penyelesaian transaksi dikunci.` : `Sengketa sudah ditutup${transaction.dispute.resolutionNote ? `: ${transaction.dispute.resolutionNote}` : '.'}`} /> : null}

      <View style={[styles.statusBanner, { backgroundColor: meta.tint, borderColor: meta.color }]}>
        <View style={[styles.statusPrimary, mobile && styles.statusPrimaryMobile]}>
          <View style={[styles.statusIcon, { backgroundColor: meta.color }]}><Ionicons name={meta.icon} size={23} color={colors.white} /></View>
          <View style={styles.statusBody}>
            <View style={styles.statusTitleRow}><Text style={[styles.statusTitle, { color: meta.color }]}>{meta.title}</Text>{active ? <View style={styles.liveBadge}><View style={[styles.liveDot, { backgroundColor: meta.color }]} /><Text style={styles.liveText}>AKTIF</Text></View> : null}</View>
            <Text style={styles.statusDescription}>{meta.description}</Text>
            <View style={styles.nextStep}><Text style={styles.nextStepLabel}>LANGKAH BERIKUTNYA</Text><Text style={styles.nextStepText}>{meta.nextAction}</Text></View>
          </View>
        </View>
        <View style={[styles.statusAside, mobile && styles.statusAsideMobile]}>
          <Text style={styles.statusAsideLabel}>{buyer ? 'TOTAL PEMBAYARAN' : 'NILAI PESANAN'}</Text>
          <Text style={styles.statusAsideValue}>{money(buyer ? grandTotal : transaction.totalPrice)}</Text>
          <Text style={styles.statusAsideMeta}>{service ? 'Jasa' : meetup ? 'Meetup kampus' : 'Transaksi historis'} · {buyer ? 'Pembelian' : 'Penjualan'}</Text>
        </View>
      </View>

      <View style={[styles.columns, !desktop && styles.columnsMobile]}>
        <View style={styles.mainColumn}>
          <Card style={styles.orderCard}>
            <Text style={styles.cardTitle}>Ringkasan pesanan</Text>
            <View style={[styles.productRow, mobile && styles.productRowMobile]}>
              <View style={styles.productMedia}>{transaction.listing.images?.[0] ? <Image source={transaction.listing.images[0]} style={styles.productImage} contentFit="cover" transition={140} cachePolicy="memory-disk" /> : <ListingImageFallback type={transaction.listing.type} size={34} color={colors.primary} />}</View>
              <View style={styles.productBody}><Text style={styles.productType}>{transaction.listing.type === 'SERVICE' ? 'JASA' : 'BARANG'}</Text><Text style={styles.productTitle}>{transaction.listing.title}</Text><Text style={styles.productMeta}>{money(transaction.price)} × {transaction.quantity}</Text></View>
              <Text style={styles.productTotal}>{money(transaction.totalPrice)}</Text>
            </View>
            {transaction.note ? <View style={styles.noteBox}><Ionicons name="document-text-outline" size={18} color={colors.primary} /><View style={styles.flex}><Text style={styles.noteLabel}>Catatan pesanan</Text><Text style={styles.noteText}>{transaction.note}</Text></View></View> : null}
          </Card>

          {service ? (
            <Card style={styles.fulfillmentCard}>
              <View style={styles.fulfillmentHeader}>
                <View style={styles.fulfillmentHeading}><View style={styles.fulfillmentIcon}><Ionicons name="folder-open-outline" size={22} color={colors.primary} /></View><View style={styles.flex}><Text style={styles.cardTitle}>Hasil jasa</Text><Text style={styles.cardCopy}>{buyer ? (previewOnly ? 'File hasil pengerjaan dari penjual. Pratinjau dan periksa sebelum menerima hasil.' : 'File hasil pengerjaan dari penjual. Kamu sudah dapat mengunduh file aslinya.') : 'Unggah file hasil pengerjaan agar buyer bisa mengunduh dan memeriksanya.'}</Text></View></View>
                <View style={styles.fulfillmentBadge}><Text style={styles.fulfillmentBadgeText}>{deliverables.length} FILE</Text></View>
              </View>
              {deliverables.length ? (
                <View style={styles.fulfillmentDetails}>
                  {deliverables.map(file => (
                    <View key={file.id} style={styles.detailRow}>
                      <View style={styles.detailIcon}><Ionicons name={deliverableIcon(file)}size={18} color={colors.primary} /></View>
                      <View style={styles.flex}><Text numberOfLines={1} style={styles.detailValue}>{file.fileName}</Text><Text style={styles.detailLabel}>{fileSizeLabel(file.size)} · {dateTime(file.createdAt)}</Text></View>
                      {previewOnly && !canPreviewDeliverable(file.fileName)
                        ? <View accessible accessibilityLabel={`${file.fileName} dapat diunduh setelah hasil diterima`} style={[styles.fileAction, { opacity: .55 }]}><Ionicons name="lock-closed-outline" size={17} color={colors.muted} /></View>
                        : <Pressable accessibilityRole="button" accessibilityLabel={`${previewOnly ? 'Pratinjau' : 'Unduh'} ${file.fileName}`} disabled={openDeliverable.isPending} onPress={() => openDeliverable.mutate({ file, popup: previewOnly ? reservePreviewTab() : null })} style={({ pressed }) => [styles.fileAction, pressed && { opacity: .7 }]}><Ionicons name={previewOnly ? 'eye-outline' : 'download-outline'} size={18} color={colors.primary} /></Pressable>}
                      {canManageResult ? <Pressable accessibilityRole="button" accessibilityLabel={`Hapus ${file.fileName}`} disabled={removeDeliverable.isPending} onPress={() => removeDeliverable.mutate(file.id)} style={({ pressed }) => [styles.fileAction, styles.fileActionDanger, pressed && { opacity: .7 }]}><Ionicons name="trash-outline" size={17} color={colors.danger} /></Pressable> : null}
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.fileEmpty}>
                  <Ionicons name="cloud-upload-outline" size={26} color={colors.muted} />
                  <Text style={styles.fileEmptyText}>{serviceInProgress ? (buyer ? 'Penjual belum mengunggah hasil jasa.' : 'Belum ada file. Unggah hasil jasa setelah pengerjaan selesai.') : 'Tidak ada file hasil jasa pada transaksi ini.'}</Text>
                </View>
              )}
              {previewOnly && deliverables.length ? <Text style={styles.fileHint}>Sebelum hasil diterima, file hanya dapat dipratinjau (PDF, gambar, teks/kode). File asli, termasuk ZIP dan dokumen Office, dapat diunduh setelah kamu menekan Terima hasil. Jika hasil tidak sesuai, buka sengketa; transaksi tidak dapat dibatalkan sepihak setelah file diunggah.</Text> : null}
              {canManageResult ? <>
                {uploadProgress !== null ? <Text style={styles.fileHint}>Mengunggah file… {uploadProgress}%</Text> : null}
                <Button title="Unggah file hasil jasa" icon="cloud-upload-outline" loading={uploadDeliverables.isPending} onPress={() => { setSuccess(''); setActionError(''); uploadDeliverables.mutate(); }} />
                <Text style={styles.fileHint}>PDF, Office, TXT, gambar, ZIP, atau file kode · maks. 20 MB per file, 5 file sekali unggah.</Text>
              </> : null}
            </Card>
          ) : <Card style={styles.fulfillmentCard}>
            <View style={styles.fulfillmentHeader}>
              <View style={styles.fulfillmentHeading}><View style={styles.fulfillmentIcon}><Ionicons name={meetup ? 'people-outline' : 'archive-outline'} size={22} color={colors.primary} /></View><View><Text style={styles.cardTitle}>{meetup ? 'Meetup langsung' : 'Penyerahan transaksi lama'}</Text><Text style={styles.cardCopy}>{meetup ? 'Atur waktu dan lokasi lewat chat. Dana dilepas setelah seller memverifikasi kode dari buyer.' : 'Detail penyerahan lama tetap tersimpan untuk kompatibilitas riwayat.'}</Text></View></View>
              <View style={styles.fulfillmentBadge}><Text style={styles.fulfillmentBadgeText}>{meetup ? 'MEETUP' : 'RIWAYAT'}</Text></View>
            </View>
            {meetup ? (
              <View style={styles.fulfillmentDetails}>
                <DetailRow icon="chatbubbles-outline" label="Koordinasi meetup" value="Sepakati waktu dan lokasi melalui chat BMarket" />
                <DetailRow icon="key-outline" label="Penyelesaian" value="Buyer memberikan kode 6 angka setelah barang diterima" />
                {transaction.handoverVerifiedAt ? <DetailRow icon="shield-checkmark-outline" label="Serah-terima" value={`Terverifikasi ${dateTime(transaction.handoverVerifiedAt)}`} success /> : null}
              </View>
            ) : (
              <View style={styles.fulfillmentDetails}><DetailRow icon="archive-outline" label="Kompatibilitas" value="Data penyerahan transaksi ini berasal dari versi BMarket sebelumnya" /></View>
            )}
          </Card>}

          <Card style={styles.timelineCard}><Text style={styles.cardTitle}>Progres transaksi</Text><Text style={styles.cardCopy}>Tahapan diperbarui sesuai tindakan buyer dan seller.</Text><Timeline transaction={transaction} /></Card>
        </View>

        <View style={[styles.sideColumn, !desktop && styles.sideColumnMobile]}>
          <Card style={styles.paymentCard}>
            <Text style={styles.cardEyebrow}>PEMBAYARAN</Text><Text style={styles.cardTitle}>Rincian pembayaran</Text>
            <SummaryRow label="Harga satuan" value={money(transaction.price)} />
            <SummaryRow label="Jumlah" value={`${transaction.quantity} item`} />
            <SummaryRow label="Subtotal" value={money(transaction.totalPrice)} />
            {Number(transaction.shippingFee) > 0 ? <SummaryRow label="Biaya penyerahan lama" value={money(transaction.shippingFee)} /> : null}
            {!buyer ? <SummaryRow label={`Biaya layanan (${Number(transaction.commissionRate)}%)`} value={`- ${money(transaction.commissionAmt)}`} muted /> : null}
            <View style={styles.summaryDivider} />
            <SummaryRow label={buyer ? 'Total pembayaran' : 'Pendapatan seller'} value={money(buyer ? grandTotal : transaction.sellerReceives)} total />
            {buyer && transaction.status === 'PENDING' ? (
              <View style={styles.balanceBox}><View><Text style={styles.balanceLabel}>Metode pembayaran</Text><Text style={styles.balanceValue}>Midtrans Snap Sandbox</Text></View><Ionicons name="card-outline" size={22} color={colors.primary} /></View>
            ) : transaction.isEscrowHeld ? <View style={styles.escrowBadge}><Ionicons name="shield-checkmark" size={17} color={colors.success} /><Text style={styles.escrowBadgeText}>Dana aman di escrow</Text></View> : null}
          </Card>

          <Card style={styles.personCard}>
            <Text style={styles.cardEyebrow}>LAWAN TRANSAKSI</Text><Text style={styles.cardTitle}>{buyer ? 'Informasi seller' : 'Informasi buyer'}</Text>
            <Pressable disabled={!counterpart.id} onPress={() => counterpart.id && router.push({ pathname: '/(student)/seller/[id]', params: { id: counterpart.id } })} style={styles.personRow}><UserAvatar name={counterpart.name} avatarUrl={counterpart.avatarUrl} style={styles.avatar} textStyle={styles.avatarText} /><View style={styles.flex}><Text style={styles.personName}>{counterpart.name || 'Binusian'}</Text><Text style={styles.personEmail}>{counterpart.email || 'Akun BINUS terverifikasi'}</Text><Text style={styles.personLink}>Lihat profil publik</Text></View><Ionicons name="chevron-forward" size={18} color={colors.muted} /></Pressable>
            <Button title="Buka chat" variant="secondary" icon="chatbubble-outline" onPress={chat} />
          </Card>

          <Card style={styles.actionCard}>
            <Text style={styles.cardEyebrow}>TINDAKAN</Text><Text style={styles.cardTitle}>Tindakan berikutnya</Text>
            <Text style={styles.actionHelp}>{buyer && transaction.status === 'PENDING' ? 'Bayar melalui Midtrans Snap Sandbox. BMarket menunggu notifikasi server Midtrans sebelum menandai pesanan dibayar.' : serviceInProgress ? (buyer ? (deliverables.length ? 'Pratinjau dan periksa file hasil jasa. Jika sudah sesuai, tekan Terima hasil untuk menyelesaikan transaksi dan membuka unduhan file. Jika tidak sesuai, buka sengketa.' : 'Tunggu penjual mengunggah hasil jasa. Gunakan chat untuk membahas detail pengerjaan.') : 'Kerjakan jasa sesuai kesepakatan, lalu unggah hasilnya. Dana dilepas setelah buyer menerima hasil.') : meetup && ['PAID', 'CONFIRMED'].includes(transaction.status) ? (buyer ? 'Chat dengan seller untuk menyepakati waktu dan lokasi. Setelah barang benar-benar kamu terima, buat kode dan berikan 6 angka tersebut kepada seller.' : 'Chat dengan buyer untuk menyepakati waktu dan lokasi. Setelah barang diserahkan, minta kode 6 angka dari buyer lalu masukkan di bawah.') : active ? 'Transaksi historis ini tetap dapat diselesaikan dengan alur versi sebelumnya.' : 'Tidak ada tindakan lain untuk transaksi ini.'}</Text>
            {buyer && transaction.status === 'PENDING' ? <Button title={payment.data?.status === 'PENDING' ? 'Lanjutkan pembayaran Midtrans' : 'Bayar dengan Midtrans'} icon="card-outline" onPress={() => openDialog('PAY')} /> : null}
            {!buyer && transaction.status === 'PAID' && !meetup && preorderReady ? <Button title="Siapkan pengiriman" icon="cube-outline" onPress={() => openDialog('CONFIRMED')} /> : null}
            {!buyer && transaction.status === 'PAID' && !meetup && preorder && !preorderReady ? <InlineAlert tone="warning" message="Pengiriman belum dapat diproses. Ubah status batch pre-order menjadi Siap diambil/dikirim dari Etalase Saya terlebih dahulu." /> : null}
            {canAcceptResult ? <Button title="Terima hasil" icon="checkmark-done-outline" onPress={() => { setActionError(''); setAcceptVisible(true); }} /> : null}
            {buyer && meetup && !service && ['PAID', 'CONFIRMED'].includes(transaction.status) ? (
              <View style={styles.handoverBox}>
                {preorder && !preorderReady ? <>
                  <Text style={styles.handoverLabel}>MENUNGGU PRE-ORDER SIAP</Text>
                  <Text style={styles.handoverHint}>Seller masih menyiapkan batch pre-order. Kode serah-terima baru tersedia setelah status PO menjadi Siap diambil/dikirim.</Text>
                </> : <>
                  {handoverCode && codeSeconds > 0 ? <><Text style={styles.handoverLabel}>KODE SERAH-TERIMA AKTIF</Text><Text style={styles.handoverHint}>Kode sudah dibuat dan masih aktif selama {codeTime}. Buka kembali jika perlu melihatnya.</Text></> : <Text style={styles.handoverHint}>Buat kode hanya setelah meetup berlangsung, barang sudah kamu terima, dan kondisinya sudah kamu periksa.</Text>}
                  <Button title={handoverCode && codeSeconds > 0 ? 'Lihat kode serah-terima' : 'Saya sudah menerima barang · Buat kode'} variant="secondary" icon="key-outline" loading={issueCode.isPending} onPress={() => { if (handoverCode && codeSeconds > 0) { setClock(Date.now()); setHandoverCodeVisible(true); } else { setHandoverConfirmVisible(true); } }} />
                </>}
              </View>
            ) : null}
            {!buyer && meetup && !service && ['PAID', 'CONFIRMED'].includes(transaction.status) ? (
              <View style={styles.handoverBox}>
                {preorder && !preorderReady ? <>
                  <Text style={styles.handoverLabel}>BATCH BELUM SIAP</Text>
                  <Text style={styles.handoverHint}>Tandai pre-order sebagai Siap diambil/dikirim dari Etalase Saya sebelum melakukan serah-terima dengan buyer.</Text>
                </> : <>
                  <Field label="Kode dari buyer" value={handoverInput} onChangeText={value => setHandoverInput(value.replace(/[^0-9]/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} placeholder="Masukkan 6 angka setelah barang diserahkan" />
                  <Button title="Verifikasi kode & selesaikan transaksi" icon="shield-checkmark-outline" disabled={handoverInput.length !== 6} loading={confirmHandover.isPending} onPress={() => confirmHandover.mutate()} />
                </>}
              </View>
            ) : null}
            {buyer && transaction.status === 'CONFIRMED' && !meetup ? <Button title="Kiriman sudah diterima" icon="checkmark-circle-outline" onPress={() => openDialog('COMPLETED')} /> : null}
            {buyer && transaction.status === 'COMPLETED' ? (
              transaction.review ? <View style={styles.reviewDone}><View style={styles.reviewStars}>{[1,2,3,4,5].map(star => <Ionicons key={star} name={star <= transaction.review!.rating ? 'star' : 'star-outline'} size={18} color="#F4A928" />)}</View><Text style={styles.reviewDoneTitle}>Review sudah dikirim</Text>{transaction.review.comment ? <Text style={styles.reviewDoneCopy}>{transaction.review.comment}</Text> : null}</View>
                : <Button title="Beri rating & review seller" icon="star-outline" onPress={() => { setActionError(''); setReviewVisible(true); }} />
            ) : null}
            {canOpenDispute ? <Button title="Ada masalah · Buka sengketa" variant="secondary" icon="warning-outline" onPress={() => { setActionError(''); setDisputeVisible(true); }} /> : null}
            {disputeActive ? <View style={styles.disputeLock}><Ionicons name="lock-closed-outline" size={18} color={colors.warning}/><View style={styles.flex}><Text style={styles.disputeLockTitle}>Transaksi dikunci sementara</Text><Text style={styles.disputeLockCopy}>Admin akan meninjau bukti dan memutuskan refund buyer atau pelepasan dana ke seller.</Text></View></View> : null}
            {canCancel ? <Button title="Batalkan transaksi" variant="ghost" icon="close-circle-outline" onPress={() => openDialog('CANCELLED')} /> : null}
            {transaction.status === 'CANCELLED' && transaction.cancellationReason ? <View style={styles.cancelReason}><Text style={styles.cancelReasonLabel}>ALASAN PEMBATALAN</Text><Text style={styles.cancelReasonText}>{transaction.cancellationReason}</Text><Text style={styles.cancelledBy}>Dibatalkan oleh {transaction.cancelledBy === 'SYSTEM' ? 'sistem (reservasi kedaluwarsa)' : transaction.cancelledBy === 'SELLER' ? 'seller' : 'buyer'}</Text></View> : null}
          </Card>
        </View>
      </View>

      <Modal visible={disputeVisible} transparent animationType="fade" onRequestClose={() => !createDispute.isPending && setDisputeVisible(false)}>
        <View style={[styles.modalBackdrop, mobile && styles.modalBackdropMobile]}><View style={[styles.dialog, mobile && styles.dialogMobile]}>
          <View style={styles.dialogHeader}><View style={[styles.dialogIcon, { backgroundColor: colors.warningSoft }]}><Ionicons name="warning-outline" size={24} color={colors.warning}/></View><Pressable disabled={createDispute.isPending} onPress={() => setDisputeVisible(false)} style={styles.dialogClose}><Ionicons name="close" size={20} color={colors.textSoft}/></Pressable></View>
          <Text style={styles.dialogEyebrow}>DISPUTE & SAFETY</Text><Text style={styles.dialogTitle}>Laporkan masalah transaksi</Text><Text style={styles.dialogDescription}>Dana tetap dibekukan di escrow selama admin meninjau sengketa. Sertakan informasi yang objektif dan bukti jika tersedia.</Text>
          <View style={styles.reasonSection}><Text style={styles.reasonLabel}>Jenis masalah</Text><View style={styles.reasonList}>{disputeReasons.map(item => <Pressable key={item.value} onPress={() => setDisputeReason(item.value)} style={[styles.reason, disputeReason===item.value&&styles.reasonActive]}><View style={[styles.reasonRadio, disputeReason===item.value&&styles.reasonRadioActive]}>{disputeReason===item.value?<View style={styles.reasonRadioDot}/>:null}</View><Text style={[styles.reasonText, disputeReason===item.value&&styles.reasonTextActive]}>{item.label}</Text></Pressable>)}</View></View>
          <Field label="Kronologi masalah" multiline value={disputeDescription} onChangeText={setDisputeDescription} placeholder="Jelaskan apa yang terjadi, hasil komunikasi, dan kondisi barang..." maxLength={2000}/>
          <View style={styles.evidenceBox}><View style={styles.flex}><Text style={styles.evidenceTitle}>Bukti foto ({disputeEvidence.length}/4)</Text><Text style={styles.evidenceCopy}>Opsional. Screenshot chat atau foto kondisi barang dapat membantu admin.</Text></View><Button title="Tambah bukti" variant="secondary" icon="images-outline" disabled={disputeEvidence.length>=4} onPress={pickEvidence}/></View>
          {disputeEvidence.length ? <View style={styles.evidenceList}>{disputeEvidence.map((asset,index)=><Pressable key={`${asset.uri}-${index}`} onPress={()=>setDisputeEvidence(current=>current.filter((_,i)=>i!==index))} style={styles.evidenceChip}><Ionicons name="image-outline" size={14} color={colors.primary}/><Text numberOfLines={1} style={styles.evidenceChipText}>Bukti {index+1}</Text><Ionicons name="close" size={13} color={colors.muted}/></Pressable>)}</View>:null}
          <View style={[styles.dialogActions, mobile && styles.dialogActionsMobile]}><Button title="Kembali" variant="ghost" disabled={createDispute.isPending} onPress={()=>setDisputeVisible(false)} style={styles.dialogBack}/><Button title="Buka sengketa" icon="shield-outline" loading={createDispute.isPending} disabled={disputeDescription.trim().length<10} onPress={()=>createDispute.mutate()} style={styles.dialogConfirm}/></View>
        </View></View>
      </Modal>

      <Modal visible={Boolean(dialog)} transparent animationType="fade" onRequestClose={() => !action.isPending && !pay.isPending && setDialog(null)}>
        <View style={[styles.modalBackdrop, mobile && styles.modalBackdropMobile]}>
          {dialogCopy ? <View style={[styles.dialog, mobile && styles.dialogMobile]}>
            <View style={styles.dialogHeader}><View style={[styles.dialogIcon, dialog === 'CANCELLED' && styles.dialogIconDanger]}><Ionicons name={dialogCopy.icon} size={24} color={dialog === 'CANCELLED' ? colors.danger : colors.primary} /></View><Pressable accessibilityLabel="Tutup dialog" disabled={action.isPending || pay.isPending} onPress={() => setDialog(null)} style={styles.dialogClose}><Ionicons name="close" size={20} color={colors.textSoft} /></Pressable></View>
            <Text style={styles.dialogEyebrow}>{dialogCopy.eyebrow}</Text><Text style={styles.dialogTitle}>{dialogCopy.title}</Text><Text style={styles.dialogDescription}>{dialogCopy.description}</Text>
            {dialog === 'PAY' ? <View style={styles.dialogAmount}><Text style={styles.dialogAmountLabel}>Total yang dibayar</Text><Text style={styles.dialogAmountValue}>{money(grandTotal)}</Text></View> : null}
            {dialog === 'CANCELLED' ? <View style={styles.reasonSection}><Text style={styles.reasonLabel}>Pilih alasan pembatalan</Text><View style={styles.reasonList}>{cancellationReasons.map(reason => <Pressable key={reason} onPress={() => setCancelReason(reason)} style={[styles.reason, cancelReason === reason && styles.reasonActive]}><View style={[styles.reasonRadio, cancelReason === reason && styles.reasonRadioActive]}>{cancelReason === reason ? <View style={styles.reasonRadioDot} /> : null}</View><Text style={[styles.reasonText, cancelReason === reason && styles.reasonTextActive]}>{reason}</Text></Pressable>)}</View></View> : null}
            <View style={[styles.dialogActions, mobile && styles.dialogActionsMobile]}><Button title="Kembali" variant="ghost" disabled={action.isPending || pay.isPending} onPress={() => setDialog(null)} style={styles.dialogBack} /><Button title={dialogCopy.confirm} variant={dialog === 'CANCELLED' ? 'danger' : 'primary'} icon={dialogCopy.icon} disabled={dialog === 'CANCELLED' && !cancelReason} loading={action.isPending || pay.isPending} onPress={() => dialog === 'PAY' ? pay.mutate() : action.mutate({ kind: dialog as Exclude<ActionKind, 'PAY'>, reason: cancelReason || undefined })} style={styles.dialogConfirm} /></View>
          </View> : null}
        </View>
      </Modal>

      <FeedbackDialog
        visible={acceptVisible}
        tone="warning"
        eyebrow="TERIMA HASIL JASA"
        title="Terima hasil jasa?"
        message="Pastikan semua file sudah kamu pratinjau dan periksa. Setelah diterima, transaksi selesai, dana escrow diteruskan ke penjual, dan file asli dapat kamu unduh."
        primaryLabel="Ya, terima hasil"
        secondaryLabel="Periksa dulu"
        loading={acceptResult.isPending}
        onPrimary={() => acceptResult.mutate()}
        onSecondary={() => setAcceptVisible(false)}
        onClose={() => setAcceptVisible(false)}
      />

      <FeedbackDialog
        visible={Boolean(handoverFeedback)}
        tone={handoverFeedback?.tone || 'success'}
        eyebrow={handoverFeedback?.tone === 'success' ? 'TRANSAKSI SELESAI' : 'VERIFIKASI GAGAL'}
        title={handoverFeedback?.title || ''}
        message={handoverFeedback?.message || ''}
        primaryLabel={handoverFeedback?.tone === 'success' ? 'Selesai' : 'Coba lagi'}
        onPrimary={() => setHandoverFeedback(null)}
        onClose={() => setHandoverFeedback(null)}
      />

      <Modal visible={handoverConfirmVisible} transparent animationType="fade" onRequestClose={() => !issueCode.isPending && setHandoverConfirmVisible(false)}>
        <View style={[styles.modalBackdrop, mobile && styles.modalBackdropMobile]}>
          <View style={[styles.dialog, mobile && styles.dialogMobile]}>
            <View style={styles.dialogHeader}><View style={styles.dialogIcon}><Ionicons name="shield-checkmark-outline" size={24} color={colors.primary} /></View><Pressable disabled={issueCode.isPending} onPress={() => setHandoverConfirmVisible(false)} style={styles.dialogClose}><Ionicons name="close" size={20} color={colors.textSoft} /></Pressable></View>
            <Text style={styles.dialogEyebrow}>KONFIRMASI SERAH-TERIMA</Text>
            <Text style={styles.dialogTitle}>Barang sudah kamu terima?</Text>
            <Text style={styles.dialogDescription}>Kode hanya boleh dibuat setelah barang benar-benar ada di tanganmu. Setelah seller memverifikasi kode, transaksi selesai dan dana escrow dilepas.</Text>
            <View style={styles.checklist}>{['Barang sudah diterima langsung dari seller','Kondisi barang sudah diperiksa','Barang sesuai dengan listing dan kesepakatan'].map(item => <View key={item} style={styles.checkRow}><Ionicons name="checkmark-circle" size={19} color={colors.success} /><Text style={styles.checkText}>{item}</Text></View>)}</View>
            <InlineAlert tone="warning" message="Jangan berikan kode sebelum barang diterima. Kode yang berhasil diverifikasi akan menyelesaikan transaksi." />
            <View style={[styles.dialogActions, mobile && styles.dialogActionsMobile]}><Button title="Belum" variant="ghost" disabled={issueCode.isPending} onPress={() => setHandoverConfirmVisible(false)} style={styles.dialogBack} /><Button title="Ya, buat kode" icon="key-outline" loading={issueCode.isPending} onPress={() => issueCode.mutate()} style={styles.dialogConfirm} /></View>
          </View>
        </View>
      </Modal>

      <Modal visible={handoverCodeVisible} transparent animationType="fade" onRequestClose={() => setHandoverCodeVisible(false)}>
        <View style={[styles.modalBackdrop, mobile && styles.modalBackdropMobile]}>
          <View style={[styles.dialog, styles.codeDialog]}>
            <View style={styles.dialogHeader}><View style={styles.dialogIcon}><Ionicons name="key-outline" size={24} color={colors.primary} /></View><Pressable onPress={() => setHandoverCodeVisible(false)} style={styles.dialogClose}><Ionicons name="close" size={20} color={colors.textSoft} /></Pressable></View>
            <Text style={styles.dialogEyebrow}>KODE SERAH-TERIMA</Text>
            <Text style={styles.dialogTitle}>{codeSeconds > 0 ? 'Berikan kode ini ke seller' : 'Kode sudah kedaluwarsa'}</Text>
            {codeSeconds > 0 ? <><View style={styles.codeCard}><Text selectable style={styles.codeNumber}>{handoverCode}</Text><Text style={styles.codeTimer}>Berlaku {codeTime}</Text></View><Text style={styles.dialogDescription}>Seller memasukkan 6 angka ini untuk mengonfirmasi serah-terima. Setelah valid, dana escrow otomatis diteruskan ke seller.</Text></> : <InlineAlert tone="warning" message="Minta kode baru hanya jika kamu masih sedang bersama seller dan barang sudah diterima." />}
            <Button title={codeSeconds > 0 ? 'Tutup' : 'Buat kode baru'} variant={codeSeconds > 0 ? 'secondary' : 'primary'} icon={codeSeconds > 0 ? 'close-outline' : 'refresh-outline'} loading={issueCode.isPending} onPress={() => codeSeconds > 0 ? setHandoverCodeVisible(false) : issueCode.mutate()} />
          </View>
        </View>
      </Modal>

      <Modal visible={reviewVisible} transparent animationType="fade" onRequestClose={() => !submitReview.isPending && setReviewVisible(false)}>
        <View style={[styles.modalBackdrop, mobile && styles.modalBackdropMobile]}>
          <View style={[styles.dialog, mobile && styles.dialogMobile]}>
            <View style={styles.dialogHeader}><View style={styles.dialogIcon}><Ionicons name="star-outline" size={24} color={colors.primary} /></View><Pressable disabled={submitReview.isPending} onPress={() => setReviewVisible(false)} style={styles.dialogClose}><Ionicons name="close" size={20} color={colors.textSoft} /></Pressable></View>
            <Text style={styles.dialogEyebrow}>REVIEW SELLER</Text>
            <Text style={styles.dialogTitle}>Bagaimana pengalamanmu?</Text>
            <Text style={styles.dialogDescription}>Rating akan tampil di profil publik seller dan membantu Binusian lain mengambil keputusan.</Text>
            <View style={styles.ratingPicker}>{[1,2,3,4,5].map(star => <Pressable key={star} onPress={() => setReviewRating(star)} style={styles.starButton}><Ionicons name={star <= reviewRating ? 'star' : 'star-outline'} size={34} color="#F4A928" /></Pressable>)}</View>
            <Text style={styles.ratingLabel}>{reviewRating ? `${reviewRating}/5 · ${reviewRating >= 5 ? 'Sangat baik' : reviewRating >= 4 ? 'Baik' : reviewRating >= 3 ? 'Cukup' : reviewRating >= 2 ? 'Kurang' : 'Buruk'}` : 'Pilih rating 1–5'}</Text>
            <Field label="Review (opsional)" value={reviewComment} onChangeText={setReviewComment} multiline placeholder="Ceritakan kondisi barang, komunikasi seller, atau pengalaman meetup..." maxLength={1000} />
            <View style={[styles.dialogActions, mobile && styles.dialogActionsMobile]}><Button title="Nanti" variant="ghost" disabled={submitReview.isPending} onPress={() => setReviewVisible(false)} style={styles.dialogBack} /><Button title="Kirim review" icon="send-outline" disabled={!reviewRating} loading={submitReview.isPending} onPress={() => submitReview.mutate()} style={styles.dialogConfirm} /></View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function SummaryRow({ label, value, total, muted }: { label: string; value: string; total?: boolean; muted?: boolean }) {
  const styles = useStyles();
  return <View style={styles.summaryRow}><Text style={[styles.summaryLabel, total && styles.summaryLabelTotal]}>{label}</Text><Text style={[styles.summaryValue, total && styles.summaryValueTotal, muted && styles.summaryValueMuted]}>{value}</Text></View>;
}

function DetailRow({ icon, label, value, success }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string; success?: boolean }) {
  const styles = useStyles();
  return <View style={styles.detailRow}><View style={[styles.detailIcon, success && styles.detailIconSuccess]}><Ionicons name={icon} size={17} color={success ? colors.success : colors.primary} /></View><View style={styles.flex}><Text style={styles.detailLabel}>{label}</Text><Text style={[styles.detailValue, success && styles.detailValueSuccess]}>{value}</Text></View></View>;
}

const useStyles = makeStyles(() => ({
  page: { maxWidth: 1180, gap: 18 },
  backRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  backButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 7 },
  backText: { fontFamily: 'PoppinsSemiBold', fontSize: 12, color: colors.primary },
  orderId: { fontFamily: 'PoppinsMedium', fontSize: 12, color: colors.muted },
  statusBanner: { minHeight: 112, padding: 16, borderRadius: 15, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' },
  statusPrimary: { minWidth: 320, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 13 },
  statusPrimaryMobile: { minWidth: 0, width: '100%' },
  statusIcon: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  statusBody: { flex: 1, gap: 4 },
  statusTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 9 },
  statusTitle: { fontFamily: 'PoppinsBold', fontSize: 16.5 },
  statusDescription: { maxWidth: 650, fontFamily: 'PoppinsRegular', fontSize: 12.5, lineHeight: 19, color: colors.textSoft },
  nextStep: { maxWidth: 650, marginTop: 7, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  nextStepLabel: { fontFamily: 'PoppinsBold', fontSize: 9.5, letterSpacing: .7, color: colors.muted },
  nextStepText: { marginTop: 2, fontFamily: 'PoppinsMedium', fontSize: 12, lineHeight: 18, color: colors.text },
  liveBadge: { minHeight: 26, paddingHorizontal: 9, borderRadius: radius.pill, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveText: { fontFamily: 'PoppinsBold', fontSize: 10.5, letterSpacing: .5, color: colors.textSoft },
  statusAside: { minWidth: 190, paddingLeft: 18, borderLeftWidth: 1, borderLeftColor: 'rgba(23,43,58,.12)', alignItems: 'flex-end' },
  statusAsideMobile: { minWidth: 0, width: '100%', paddingLeft: 0, paddingTop: 12, borderLeftWidth: 0, borderTopWidth: 1, borderTopColor: 'rgba(23,43,58,.12)', alignItems: 'flex-start' },
  statusAsideLabel: { fontFamily: 'PoppinsBold', fontSize: 10.5, letterSpacing: .55, color: colors.muted },
  statusAsideValue: { marginTop: 2, fontFamily: 'PoppinsBold', fontSize: 20, color: colors.text },
  statusAsideMeta: { marginTop: 3, fontFamily: 'PoppinsRegular', fontSize: 11.5, color: colors.muted },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: 18 },
  columnsMobile: { flexDirection: 'column' },
  mainColumn: { flex: 1.72, width: '100%', gap: 14 },
  sideColumn: { flex: .9, width: '100%', minWidth: 330, maxWidth: 390, gap: 14 },
  sideColumnMobile: { minWidth: 0, maxWidth: '100%' },
  orderCard: { gap: 14 },
  cardEyebrow: { fontFamily: 'PoppinsBold', fontSize: 10.5, letterSpacing: .75, color: colors.primary, marginBottom: -4 },
  cardTitle: { fontFamily: 'PoppinsBold', fontSize: 16.5, color: colors.text },
  cardCopy: { fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 18, color: colors.muted, marginTop: -5 },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  productRowMobile: { alignItems: 'flex-start', flexWrap: 'wrap' },
  productMedia: { width: 90, height: 86, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  productImage: { width: '100%', height: '100%' },
  productBody: { flex: 1, gap: 4 },
  productType: { fontFamily: 'PoppinsBold', fontSize: 12, letterSpacing: 0.65, color: colors.primary },
  productTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 14.5, lineHeight: 20, color: colors.text },
  productMeta: { fontFamily: 'PoppinsRegular', fontSize: 12, color: colors.muted },
  productTotal: { fontFamily: 'PoppinsBold', fontSize: 17, color: colors.primaryDark },
  noteBox: { padding: 14, borderRadius: 12, backgroundColor: colors.primarySoft, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  noteLabel: { fontFamily: 'PoppinsSemiBold', fontSize: 12, color: colors.text },
  noteText: { fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 18, color: colors.textSoft, marginTop: 2 },
  flex: { flex: 1 },
  fulfillmentCard: { gap: 14 },
  fulfillmentHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  fulfillmentHeading: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11 },
  fulfillmentIcon: { width: 48, height: 48, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  fulfillmentBadge: { minHeight: 28, paddingHorizontal: 9, borderRadius: radius.pill, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  fulfillmentBadgeText: { fontFamily: 'PoppinsBold', fontSize: 12, letterSpacing: 0.5, color: colors.primary },
  fulfillmentDetails: { gap: 9 },
  detailRow: { minHeight: 54, padding: 10, borderRadius: 10, backgroundColor: colors.surfaceMuted, flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  detailIconSuccess: { backgroundColor: colors.successSoft },
  detailLabel: { fontFamily: 'PoppinsRegular', fontSize: 12, color: colors.muted },
  detailValue: { fontFamily: 'PoppinsSemiBold', fontSize: 12, lineHeight: 18, color: colors.text },
  detailValueSuccess: { color: colors.success },
  fileAction: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, borderColor: colors.primaryBorder, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  fileActionDanger: { borderColor: colors.dangerBorder },
  fileEmpty: { minHeight: 110, padding: 16, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.borderStrong, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', gap: 8 },
  fileEmptyText: { fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 18, textAlign: 'center', color: colors.muted },
  fileHint: { fontFamily: 'PoppinsRegular', fontSize: 11.5, lineHeight: 17, textAlign: 'center', color: colors.muted },
  timelineCard: { gap: 12 },
  timeline: { marginTop: 2 },
  timelineStep: { minHeight: 82, flexDirection: 'row', gap: 12 },
  timelineRail: { width: 42, alignItems: 'center' },
  timelineDot: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  timelineDotReached: { backgroundColor: colors.primary },
  timelineDotCancelled: { backgroundColor: colors.danger },
  timelineLine: { width: 2, flex: 1, backgroundColor: colors.border, marginVertical: 4 },
  timelineLineReached: { backgroundColor: colors.primaryBorder },
  timelineBody: { flex: 1, paddingTop: 2 },
  timelineTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 13, color: colors.text },
  timelineTitlePending: { color: colors.muted },
  timelineCopy: { fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 17, color: colors.muted, marginTop: 2 },
  timelineTime: { fontFamily: 'PoppinsMedium', fontSize: 12, color: colors.primary, marginTop: 5 },
  timelineWaiting: { fontFamily: 'PoppinsRegular', fontSize: 12, color: colors.muted, marginTop: 5 },
  paymentCard: { gap: 11, padding: 17 },
  summaryRow: { minHeight: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  summaryLabel: { fontFamily: 'PoppinsRegular', fontSize: 12, color: colors.muted },
  summaryLabelTotal: { fontFamily: 'PoppinsSemiBold', fontSize: 13, color: colors.text },
  summaryValue: { fontFamily: 'PoppinsSemiBold', fontSize: 12, color: colors.text },
  summaryValueTotal: { fontFamily: 'PoppinsBold', fontSize: 19, color: colors.primaryDark },
  summaryValueMuted: { color: colors.danger },
  summaryDivider: { height: 1, backgroundColor: colors.border },
  balanceBox: { minHeight: 66, marginTop: 3, padding: 12, borderRadius: 11, backgroundColor: colors.primarySoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  balanceLabel: { fontFamily: 'PoppinsRegular', fontSize: 12, color: colors.muted },
  balanceValue: { fontFamily: 'PoppinsBold', fontSize: 15, color: colors.primaryDark },
  balanceDanger: { color: colors.danger },
  escrowBadge: { minHeight: 42, marginTop: 2, paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.successSoft, flexDirection: 'row', alignItems: 'center', gap: 8 },
  escrowBadgeText: { fontFamily: 'PoppinsSemiBold', fontSize: 12, color: colors.success },
  personCard: { gap: 12, padding: 17 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'PoppinsBold', fontSize: 16, color: colors.primary },
  personName: { fontFamily: 'PoppinsSemiBold', fontSize: 13, color: colors.text },
  personEmail: { fontFamily: 'PoppinsRegular', fontSize: 12, color: colors.muted },
  personLink: { fontFamily: 'PoppinsSemiBold', fontSize: 12, color: colors.primary, marginTop: 3 },
  actionCard: { gap: 11, padding: 17 },
  actionHelp: { fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 18, color: colors.muted, paddingBottom: 2 },
  handoverBox: { gap: 10, padding: 13, borderRadius: 12, borderWidth: 1, borderColor: colors.primaryBorder, backgroundColor: colors.primarySoft },
  handoverLabel: { fontFamily: 'PoppinsBold', fontSize: 12, letterSpacing: 0.8, textAlign: 'center', color: colors.primary },
  handoverCode: { fontFamily: 'PoppinsBold', fontSize: 31, letterSpacing: 8, textAlign: 'center', color: colors.primaryDark },
  handoverHint: { fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 17, textAlign: 'center', color: colors.muted },
  disputeLock: { padding: 13, borderRadius: 12, backgroundColor: colors.warningSoft, borderWidth: 1, borderColor: colors.warningBorder, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  disputeLockTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 12, color: colors.text },
  disputeLockCopy: { marginTop: 2, fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 16, color: colors.textSoft },
  evidenceBox: { padding: 12, borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, flexDirection: 'row', alignItems: 'center', gap: 10 },
  evidenceTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 12, color: colors.text },
  evidenceCopy: { marginTop: 2, fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 15, color: colors.muted },
  evidenceList: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  evidenceChip: { maxWidth: 130, minHeight: 32, paddingHorizontal: 9, borderRadius: 9, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 5 },
  evidenceChipText: { flex: 1, fontFamily: 'PoppinsMedium', fontSize: 12, color: colors.textSoft },
  reviewDone: { gap: 6, padding: 13, borderRadius: 12, backgroundColor: colors.warningSoft, borderWidth: 1, borderColor: colors.warningBorder },
  reviewStars: { flexDirection: 'row', gap: 3 },
  reviewDoneTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 12, color: colors.text },
  reviewDoneCopy: { fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 18, color: colors.textSoft },
  cancelReason: { padding: 13, borderRadius: 11, backgroundColor: colors.dangerSoft, gap: 3 },
  cancelReasonLabel: { fontFamily: 'PoppinsBold', fontSize: 12, letterSpacing: 0.6, color: colors.danger },
  cancelReasonText: { fontFamily: 'PoppinsMedium', fontSize: 12, color: colors.text },
  cancelledBy: { fontFamily: 'PoppinsRegular', fontSize: 12, color: colors.muted },
  modalBackdrop: { flex: 1, padding: 18, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center' },
  modalBackdropMobile: { padding: 10 },
  dialog: { width: '100%', maxWidth: 520, maxHeight: '94%', padding: 24, borderRadius: 18, backgroundColor: colors.surface, gap: 11, shadowColor: '#071727', shadowOpacity: 0.22, shadowRadius: 26, shadowOffset: { width: 0, height: 12 } },
  dialogMobile: { padding: 15, borderRadius: 15 },
  dialogHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dialogIcon: { width: 50, height: 50, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  dialogIconDanger: { backgroundColor: colors.dangerSoft },
  dialogClose: { width: 40, height: 40, borderRadius: 11, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  dialogEyebrow: { fontFamily: 'PoppinsBold', fontSize: 12, letterSpacing: 0.75, color: colors.primary, marginTop: 4 },
  dialogTitle: { fontFamily: 'PoppinsBold', fontSize: 23, lineHeight: 31, color: colors.text },
  dialogDescription: { fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 19, color: colors.muted },
  dialogAmount: { minHeight: 70, marginTop: 4, padding: 13, borderRadius: 12, backgroundColor: colors.primarySoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dialogAmountLabel: { fontFamily: 'PoppinsMedium', fontSize: 12, color: colors.textSoft },
  dialogAmountValue: { fontFamily: 'PoppinsBold', fontSize: 20, color: colors.primaryDark },
  reasonSection: { gap: 8, marginTop: 3 },
  reasonLabel: { fontFamily: 'PoppinsMedium', fontSize: 12, color: colors.textSoft },
  reasonList: { gap: 7 },
  reason: { minHeight: 43, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 9 },
  reasonActive: { borderColor: colors.dangerBorder, backgroundColor: colors.dangerSoft },
  reasonRadio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  reasonRadioActive: { borderColor: colors.danger },
  reasonRadioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
  reasonText: { flex: 1, fontFamily: 'PoppinsRegular', fontSize: 12, color: colors.textSoft },
  reasonTextActive: { fontFamily: 'PoppinsMedium', color: colors.text },
  dialogActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  dialogActionsMobile: { flexDirection: 'column-reverse' },
  dialogBack: { flex: 1 },
  dialogConfirm: { flex: 1.6 },
  checklist: { gap: 9, padding: 14, borderRadius: 12, backgroundColor: colors.background },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  checkText: { flex: 1, fontFamily: 'PoppinsMedium', fontSize: 12, lineHeight: 18, color: colors.textSoft },
  codeDialog: { maxWidth: 470 },
  codeCard: { marginVertical: 5, paddingVertical: 22, paddingHorizontal: 16, borderRadius: 15, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder, alignItems: 'center', gap: 8 },
  codeNumber: { fontFamily: 'PoppinsBold', fontSize: 38, letterSpacing: 9, color: colors.primaryDark },
  codeTimer: { fontFamily: 'PoppinsSemiBold', fontSize: 12, color: colors.primary },
  ratingPicker: { flexDirection: 'row', justifyContent: 'center', gap: 7, marginTop: 5 },
  starButton: { width: 43, height: 43, alignItems: 'center', justifyContent: 'center' },
  ratingLabel: { fontFamily: 'PoppinsMedium', fontSize: 12, textAlign: 'center', color: colors.textSoft },
}));
