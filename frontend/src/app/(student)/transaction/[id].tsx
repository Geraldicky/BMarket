import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Button, Card, date, ErrorState, Field, InlineAlert, Loader, money, Screen, Title } from '@/components/ui';
import { colors, radius } from '@/constants/theme';
import { endpoints, errorMessage } from '@/lib/api';
import { useAuth } from '@/store/auth';
import type { Transaction, TransactionStatus } from '@/types';

type ActionKind = 'PAY' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

const statusMeta: Record<TransactionStatus, { title: string; description: string; color: string; tint: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  PENDING: { title: 'Menunggu pembayaran', description: 'Stok sudah direservasi. Buyer perlu membayar dari saldo BMarket.', color: colors.warning, tint: colors.warningSoft, icon: 'time-outline' },
  PAID: { title: 'Pembayaran aman di escrow', description: 'Seller dapat mengonfirmasi dan mulai memproses pesanan.', color: colors.primary, tint: colors.primarySoft, icon: 'shield-checkmark-outline' },
  CONFIRMED: { title: 'Penyerahan sedang berlangsung', description: 'Ikuti detail meetup atau pengiriman, lalu selesaikan setelah pesanan diterima.', color: '#7656C5', tint: '#F0EBFF', icon: 'cube-outline' },
  COMPLETED: { title: 'Transaksi selesai', description: 'Dana escrow sudah dilepas ke seller setelah dikurangi biaya layanan.', color: colors.success, tint: colors.successSoft, icon: 'checkmark-circle-outline' },
  CANCELLED: { title: 'Transaksi dibatalkan', description: 'Dana dan stok telah dikembalikan sesuai kondisi terakhir transaksi.', color: colors.danger, tint: colors.dangerSoft, icon: 'close-circle-outline' },
};

const actionCopy: Record<ActionKind, { eyebrow: string; title: string; description: string; confirm: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  PAY: { eyebrow: 'PEMBAYARAN', title: 'Bayar pesanan sekarang?', description: 'Saldo akan dipindahkan ke escrow dan baru diterima seller setelah transaksi selesai.', confirm: 'Bayar sekarang', icon: 'wallet-outline' },
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

function dateTime(value?: string | null) {
  return value ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '';
}

function Timeline({ transaction }: { transaction: Transaction }) {
  const meetup = transaction.fulfillmentMethod === 'CAMPUS_MEETUP';
  const standard = [
    { title: 'Pesanan dibuat', copy: 'Stok direservasi untuk buyer.', time: transaction.createdAt, icon: 'receipt-outline' as const, reached: true },
    { title: 'Pembayaran diterima', copy: 'Dana dipindahkan ke escrow BMarket.', time: transaction.paidAt, icon: 'wallet-outline' as const, reached: ['PAID', 'CONFIRMED', 'COMPLETED'].includes(transaction.status) },
    { title: meetup ? 'Meetup dikonfirmasi' : 'Pengiriman diproses', copy: meetup ? 'Seller siap bertemu sesuai detail checkout.' : 'Kurir simulasi mulai memproses kiriman.', time: transaction.confirmedAt, icon: meetup ? 'people-outline' as const : 'bicycle-outline' as const, reached: ['CONFIRMED', 'COMPLETED'].includes(transaction.status) },
    { title: 'Transaksi selesai', copy: meetup ? 'Kode serah-terima valid dan dana dilepas.' : 'Kiriman diterima dan dana dilepas.', time: transaction.completedAt, icon: 'checkmark-circle-outline' as const, reached: transaction.status === 'COMPLETED' },
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuth(state => state.user);
  const desktop = useWindowDimensions().width >= 960;
  const client = useQueryClient();
  const [dialog, setDialog] = useState<ActionKind | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [success, setSuccess] = useState('');
  const [handoverCode, setHandoverCode] = useState('');
  const [handoverInput, setHandoverInput] = useState('');

  const query = useQuery({ queryKey: ['transaction', id], queryFn: () => endpoints.transaction(id), refetchInterval: 5000 });
  const transaction = query.data;
  const buyer = transaction ? (transaction.buyerId === user?.id || transaction.buyer.id === user?.id) : false;
  const balance = useQuery({ queryKey: ['balance'], queryFn: endpoints.balance, enabled: Boolean(transaction && buyer && transaction.status === 'PENDING') });

  const action = useMutation({
    mutationFn: ({ kind, reason }: { kind: ActionKind; reason?: string }) => kind === 'PAY'
      ? endpoints.pay(id)
      : endpoints.setTransactionStatus(id, kind, reason),
    onSuccess: updated => {
      client.setQueryData(['transaction', id], updated);
      client.invalidateQueries({ queryKey: ['transactions'] });
      client.invalidateQueries({ queryKey: ['balance'] });
      client.invalidateQueries({ queryKey: ['listings'] });
      client.invalidateQueries({ queryKey: ['listing', updated.listing.id] });
      setSuccess(dialog === 'PAY' ? 'Pembayaran berhasil masuk ke escrow.' : dialog === 'CONFIRMED' ? 'Pesanan sudah dikonfirmasi dan mulai diproses.' : dialog === 'COMPLETED' ? 'Transaksi selesai. Dana sudah dilepas ke seller.' : 'Transaksi berhasil dibatalkan.');
      setDialog(null);
      setCancelReason('');
    },
    onError: error => Alert.alert('Aksi belum berhasil', errorMessage(error)),
  });

  const issueCode = useMutation({
    mutationFn: () => endpoints.issueHandoverCode(id),
    onSuccess: result => {
      setHandoverCode(result.code);
      setSuccess('Kode serah-terima dibuat. Tunjukkan hanya setelah barang atau jasa benar-benar kamu terima.');
    },
    onError: error => Alert.alert('Kode belum dibuat', errorMessage(error)),
  });

  const confirmHandover = useMutation({
    mutationFn: () => endpoints.confirmHandover(id, handoverInput),
    onSuccess: updated => {
      client.setQueryData(['transaction', id], updated);
      client.invalidateQueries({ queryKey: ['transactions'] });
      client.invalidateQueries({ queryKey: ['balance'] });
      setHandoverInput('');
      setSuccess('Meetup selesai. Kode valid dan dana escrow sudah dilepas.');
    },
    onError: error => Alert.alert('Kode belum dapat dikonfirmasi', errorMessage(error)),
  });

  const openDialog = (kind: ActionKind) => {
    setSuccess('');
    setCancelReason('');
    setDialog(kind);
  };

  const chat = async () => {
    if (!transaction) return;
    const other = buyer ? transaction.seller : transaction.buyer;
    if (!other.id) return;
    try {
      const room = await endpoints.createRoom(other.id);
      router.push({ pathname: '/(student)/chat/[id]', params: { id: room.id, name: other.name || 'Binusian' } });
    } catch (error) {
      Alert.alert('Gagal membuka chat', errorMessage(error));
    }
  };

  if (query.isLoading) return <Screen><Loader /></Screen>;
  if (query.isError || !transaction) return <Screen><ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} /></Screen>;

  const meta = statusMeta[transaction.status];
  const counterpart = buyer ? transaction.seller : transaction.buyer;
  const active = ['PENDING', 'PAID', 'CONFIRMED'].includes(transaction.status);
  const grandTotal = Number(transaction.grandTotal || transaction.totalPrice);
  const meetup = transaction.fulfillmentMethod === 'CAMPUS_MEETUP';
  const insufficientBalance = buyer && transaction.status === 'PENDING' && balance.data && Number(balance.data.balance) < grandTotal;
  const dialogCopy = dialog ? actionCopy[dialog] : null;

  return (
    <Screen>
      <View style={styles.backRow}><Pressable onPress={() => router.back()} style={styles.backButton}><Ionicons name="arrow-back" size={18} color={colors.primary} /><Text style={styles.backText}>Kembali ke transaksi</Text></Pressable><Text style={styles.orderId}>ID #{transaction.id.slice(0, 8).toUpperCase()}</Text></View>
      <Title eyebrow={buyer ? 'DETAIL PEMBELIAN' : 'DETAIL PENJUALAN'} subtitle={`Pesanan dibuat ${date(transaction.createdAt)}`}>{transaction.listing.title}</Title>
      {success ? <InlineAlert tone="success" message={success} /> : null}

      <View style={[styles.statusBanner, { backgroundColor: meta.tint, borderColor: meta.color }]}>
        <View style={[styles.statusIcon, { backgroundColor: meta.color }]}><Ionicons name={meta.icon} size={24} color={colors.white} /></View>
        <View style={styles.statusBody}><Text style={[styles.statusTitle, { color: meta.color }]}>{meta.title}</Text><Text style={styles.statusDescription}>{meta.description}</Text></View>
        {active ? <View style={styles.liveBadge}><View style={[styles.liveDot, { backgroundColor: meta.color }]} /><Text style={styles.liveText}>AKTIF</Text></View> : null}
      </View>

      <View style={[styles.columns, !desktop && styles.columnsMobile]}>
        <View style={styles.mainColumn}>
          <Card style={styles.orderCard}>
            <Text style={styles.cardTitle}>Ringkasan pesanan</Text>
            <View style={styles.productRow}>
              <View style={styles.productMedia}>{transaction.listing.images?.[0] ? <Image source={transaction.listing.images[0]} style={styles.productImage} contentFit="cover" transition={140} cachePolicy="memory-disk" /> : <Ionicons name={transaction.listing.type === 'SERVICE' ? 'construct-outline' : 'cube-outline'} size={34} color={colors.primary} />}</View>
              <View style={styles.productBody}><Text style={styles.productType}>{transaction.listing.type === 'SERVICE' ? 'JASA' : 'BARANG'}</Text><Text style={styles.productTitle}>{transaction.listing.title}</Text><Text style={styles.productMeta}>{money(transaction.price)} × {transaction.quantity}</Text></View>
              <Text style={styles.productTotal}>{money(transaction.totalPrice)}</Text>
            </View>
            {transaction.note ? <View style={styles.noteBox}><Ionicons name="document-text-outline" size={18} color={colors.primary} /><View style={styles.flex}><Text style={styles.noteLabel}>Catatan pesanan</Text><Text style={styles.noteText}>{transaction.note}</Text></View></View> : null}
          </Card>

          <Card style={styles.fulfillmentCard}>
            <View style={styles.fulfillmentHeader}>
              <View style={styles.fulfillmentHeading}><View style={styles.fulfillmentIcon}><Ionicons name={meetup ? 'people-outline' : 'bicycle-outline'} size={22} color={colors.primary} /></View><View><Text style={styles.cardTitle}>{meetup ? 'Meetup Kampus' : 'Kurir Instan'}</Text><Text style={styles.cardCopy}>{meetup ? 'Pembayaran tetap melalui BMarket dan penyerahan memakai kode keamanan.' : 'Pengiriman ini merupakan simulasi untuk pengembangan BMarket.'}</Text></View></View>
              <View style={styles.fulfillmentBadge}><Text style={styles.fulfillmentBadgeText}>{meetup ? 'MEETUP' : 'SIMULASI'}</Text></View>
            </View>
            {meetup ? (
              <View style={styles.fulfillmentDetails}>
                <DetailRow icon="school-outline" label="Kampus" value={transaction.meetupCampus || '-'} />
                <DetailRow icon="location-outline" label="Titik temu" value={transaction.meetupLocation || '-'} />
                <DetailRow icon="calendar-outline" label="Jadwal" value={transaction.meetupSchedule || '-'} />
                {transaction.handoverVerifiedAt ? <DetailRow icon="shield-checkmark-outline" label="Serah-terima" value={`Terverifikasi ${dateTime(transaction.handoverVerifiedAt)}`} success /> : null}
              </View>
            ) : (
              <View style={styles.fulfillmentDetails}>
                <DetailRow icon="bicycle-outline" label="Kurir" value={transaction.courierProvider === 'GRABEXPRESS' ? 'GrabExpress Instant (simulasi)' : 'GoSend Instant (simulasi)'} />
                <DetailRow icon="location-outline" label="Tujuan" value={transaction.deliveryAddress || '-'} />
                <DetailRow icon="call-outline" label="Penerima" value={transaction.recipientPhone || '-'} />
                {transaction.trackingNumber ? <DetailRow icon="navigate-outline" label="Nomor tracking" value={transaction.trackingNumber} /> : null}
              </View>
            )}
          </Card>

          <Card style={styles.timelineCard}><Text style={styles.cardTitle}>Progres transaksi</Text><Text style={styles.cardCopy}>Tahapan diperbarui sesuai tindakan buyer dan seller.</Text><Timeline transaction={transaction} /></Card>
        </View>

        <View style={styles.sideColumn}>
          <Card style={styles.paymentCard}>
            <Text style={styles.cardTitle}>Rincian pembayaran</Text>
            <SummaryRow label="Harga satuan" value={money(transaction.price)} />
            <SummaryRow label="Jumlah" value={`${transaction.quantity} item`} />
            <SummaryRow label="Subtotal" value={money(transaction.totalPrice)} />
            <SummaryRow label="Ongkir" value={Number(transaction.shippingFee) ? money(transaction.shippingFee) : 'Gratis'} />
            {!buyer ? <SummaryRow label={`Biaya layanan (${Number(transaction.commissionRate)}%)`} value={`- ${money(transaction.commissionAmt)}`} muted /> : null}
            <View style={styles.summaryDivider} />
            <SummaryRow label={buyer ? 'Total pembayaran' : 'Pendapatan seller'} value={money(buyer ? grandTotal : transaction.sellerReceives)} total />
            {buyer && transaction.status === 'PENDING' ? (
              <View style={styles.balanceBox}><View><Text style={styles.balanceLabel}>Saldo BMarket</Text><Text style={[styles.balanceValue, insufficientBalance && styles.balanceDanger]}>{balance.isLoading ? 'Memuat…' : money(balance.data?.balance)}</Text></View><Ionicons name="wallet-outline" size={22} color={insufficientBalance ? colors.danger : colors.primary} /></View>
            ) : transaction.isEscrowHeld ? <View style={styles.escrowBadge}><Ionicons name="shield-checkmark" size={17} color={colors.success} /><Text style={styles.escrowBadgeText}>Dana aman di escrow</Text></View> : null}
          </Card>

          <Card style={styles.personCard}>
            <Text style={styles.cardTitle}>{buyer ? 'Informasi seller' : 'Informasi buyer'}</Text>
            <View style={styles.personRow}><View style={styles.avatar}><Text style={styles.avatarText}>{counterpart.name?.[0]?.toUpperCase() || 'B'}</Text></View><View style={styles.flex}><Text style={styles.personName}>{counterpart.name || 'Binusian'}</Text><Text style={styles.personEmail}>{counterpart.email || 'Akun BINUS terverifikasi'}</Text></View></View>
            <Button title="Buka chat" variant="secondary" icon="chatbubble-outline" onPress={chat} />
          </Card>

          <Card style={styles.actionCard}>
            <Text style={styles.cardTitle}>Tindakan berikutnya</Text>
            <Text style={styles.actionHelp}>{buyer && transaction.status === 'PENDING' ? 'Bayar agar seller dapat memproses pesananmu.' : !buyer && transaction.status === 'PAID' ? `Konfirmasi setelah kamu siap ${meetup ? 'melakukan meetup' : 'menyerahkan pesanan ke kurir'}.` : transaction.status === 'CONFIRMED' && meetup ? (buyer ? 'Buat kode setelah bertemu seller. Kode tersebut menjadi bukti serah-terima.' : 'Minta kode 6 angka dari buyer setelah barang atau jasa diserahkan.') : buyer && transaction.status === 'CONFIRMED' ? 'Selesaikan hanya setelah kiriman benar-benar diterima.' : active ? 'Menunggu tindakan dari pihak lain.' : 'Tidak ada tindakan lain untuk transaksi ini.'}</Text>
            {buyer && transaction.status === 'PENDING' ? <Button title={insufficientBalance ? 'Saldo tidak cukup' : 'Bayar dari saldo'} icon="wallet-outline" disabled={Boolean(insufficientBalance)} onPress={() => openDialog('PAY')} /> : null}
            {insufficientBalance ? <Button title="Tambah saldo di profil" variant="secondary" icon="add-circle-outline" onPress={() => router.push('/(student)/(tabs)/profile')} /> : null}
            {!buyer && transaction.status === 'PAID' ? <Button title={meetup ? 'Konfirmasi jadwal meetup' : 'Siapkan pengiriman'} icon={meetup ? 'calendar-outline' : 'cube-outline'} onPress={() => openDialog('CONFIRMED')} /> : null}
            {buyer && transaction.status === 'CONFIRMED' && meetup ? (
              <View style={styles.handoverBox}>
                {handoverCode ? <><Text style={styles.handoverLabel}>KODE SERAH-TERIMA</Text><Text selectable style={styles.handoverCode}>{handoverCode}</Text><Text style={styles.handoverHint}>Berlaku 15 menit. Jangan berikan sebelum barang atau jasa diterima.</Text></> : <Text style={styles.handoverHint}>Kode belum dibuat. Buat saat kamu sudah berada bersama seller.</Text>}
                <Button title={handoverCode ? 'Buat kode baru' : 'Buat kode serah-terima'} variant="secondary" icon="key-outline" loading={issueCode.isPending} onPress={() => issueCode.mutate()} />
              </View>
            ) : null}
            {!buyer && transaction.status === 'CONFIRMED' && meetup ? (
              <View style={styles.handoverBox}>
                <Field label="Kode dari buyer" value={handoverInput} onChangeText={value => setHandoverInput(value.replace(/[^0-9]/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} placeholder="6 angka" />
                <Button title="Verifikasi & selesaikan" icon="shield-checkmark-outline" disabled={handoverInput.length !== 6} loading={confirmHandover.isPending} onPress={() => confirmHandover.mutate()} />
              </View>
            ) : null}
            {buyer && transaction.status === 'CONFIRMED' && !meetup ? <Button title="Kiriman sudah diterima" icon="checkmark-circle-outline" onPress={() => openDialog('COMPLETED')} /> : null}
            {active ? <Button title="Batalkan transaksi" variant="ghost" icon="close-circle-outline" onPress={() => openDialog('CANCELLED')} /> : null}
            {transaction.status === 'CANCELLED' && transaction.cancellationReason ? <View style={styles.cancelReason}><Text style={styles.cancelReasonLabel}>ALASAN PEMBATALAN</Text><Text style={styles.cancelReasonText}>{transaction.cancellationReason}</Text><Text style={styles.cancelledBy}>Dibatalkan oleh {transaction.cancelledBy === 'SELLER' ? 'seller' : 'buyer'}</Text></View> : null}
          </Card>
        </View>
      </View>

      <Modal visible={Boolean(dialog)} transparent animationType="fade" onRequestClose={() => !action.isPending && setDialog(null)}>
        <View style={styles.modalBackdrop}>
          {dialogCopy ? <View style={styles.dialog}>
            <View style={styles.dialogHeader}><View style={[styles.dialogIcon, dialog === 'CANCELLED' && styles.dialogIconDanger]}><Ionicons name={dialogCopy.icon} size={24} color={dialog === 'CANCELLED' ? colors.danger : colors.primary} /></View><Pressable accessibilityLabel="Tutup dialog" disabled={action.isPending} onPress={() => setDialog(null)} style={styles.dialogClose}><Ionicons name="close" size={20} color={colors.textSoft} /></Pressable></View>
            <Text style={styles.dialogEyebrow}>{dialogCopy.eyebrow}</Text><Text style={styles.dialogTitle}>{dialogCopy.title}</Text><Text style={styles.dialogDescription}>{dialogCopy.description}</Text>
            {dialog === 'PAY' ? <View style={styles.dialogAmount}><Text style={styles.dialogAmountLabel}>Total yang dibayar</Text><Text style={styles.dialogAmountValue}>{money(grandTotal)}</Text></View> : null}
            {dialog === 'CANCELLED' ? <View style={styles.reasonSection}><Text style={styles.reasonLabel}>Pilih alasan pembatalan</Text><View style={styles.reasonList}>{cancellationReasons.map(reason => <Pressable key={reason} onPress={() => setCancelReason(reason)} style={[styles.reason, cancelReason === reason && styles.reasonActive]}><View style={[styles.reasonRadio, cancelReason === reason && styles.reasonRadioActive]}>{cancelReason === reason ? <View style={styles.reasonRadioDot} /> : null}</View><Text style={[styles.reasonText, cancelReason === reason && styles.reasonTextActive]}>{reason}</Text></Pressable>)}</View></View> : null}
            <View style={styles.dialogActions}><Button title="Kembali" variant="ghost" disabled={action.isPending} onPress={() => setDialog(null)} style={styles.dialogBack} /><Button title={dialogCopy.confirm} variant={dialog === 'CANCELLED' ? 'danger' : 'primary'} icon={dialogCopy.icon} disabled={dialog === 'CANCELLED' && !cancelReason} loading={action.isPending} onPress={() => action.mutate({ kind: dialog!, reason: cancelReason || undefined })} style={styles.dialogConfirm} /></View>
          </View> : null}
        </View>
      </Modal>
    </Screen>
  );
}

function SummaryRow({ label, value, total, muted }: { label: string; value: string; total?: boolean; muted?: boolean }) {
  return <View style={styles.summaryRow}><Text style={[styles.summaryLabel, total && styles.summaryLabelTotal]}>{label}</Text><Text style={[styles.summaryValue, total && styles.summaryValueTotal, muted && styles.summaryValueMuted]}>{value}</Text></View>;
}

function DetailRow({ icon, label, value, success }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string; success?: boolean }) {
  return <View style={styles.detailRow}><View style={[styles.detailIcon, success && styles.detailIconSuccess]}><Ionicons name={icon} size={17} color={success ? colors.success : colors.primary} /></View><View style={styles.flex}><Text style={styles.detailLabel}>{label}</Text><Text style={[styles.detailValue, success && styles.detailValueSuccess]}>{value}</Text></View></View>;
}

const styles = StyleSheet.create({
  backRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  backButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 7 },
  backText: { fontFamily: 'PoppinsSemiBold', fontSize: 11, color: colors.primary },
  orderId: { fontFamily: 'PoppinsMedium', fontSize: 10, color: colors.muted },
  statusBanner: { minHeight: 106, padding: 18, borderRadius: 15, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  statusIcon: { width: 54, height: 54, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  statusBody: { flex: 1, gap: 3 },
  statusTitle: { fontFamily: 'PoppinsBold', fontSize: 17 },
  statusDescription: { maxWidth: 720, fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 19, color: colors.textSoft },
  liveBadge: { minHeight: 30, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveText: { fontFamily: 'PoppinsBold', fontSize: 9, letterSpacing: 0.5, color: colors.textSoft },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  columnsMobile: { flexDirection: 'column' },
  mainColumn: { flex: 1.5, width: '100%', gap: 16 },
  sideColumn: { flex: 1, width: '100%', minWidth: 320, gap: 16 },
  orderCard: { gap: 17 },
  cardTitle: { fontFamily: 'PoppinsBold', fontSize: 18, color: colors.text },
  cardCopy: { fontFamily: 'PoppinsRegular', fontSize: 11, lineHeight: 18, color: colors.muted, marginTop: -6 },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  productMedia: { width: 102, height: 96, borderRadius: 13, overflow: 'hidden', backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  productImage: { width: '100%', height: '100%' },
  productBody: { flex: 1, gap: 4 },
  productType: { fontFamily: 'PoppinsBold', fontSize: 9, letterSpacing: 0.65, color: colors.primary },
  productTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 15, lineHeight: 21, color: colors.text },
  productMeta: { fontFamily: 'PoppinsRegular', fontSize: 11, color: colors.muted },
  productTotal: { fontFamily: 'PoppinsBold', fontSize: 18, color: colors.primaryDark },
  noteBox: { padding: 14, borderRadius: 12, backgroundColor: colors.primarySoft, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  noteLabel: { fontFamily: 'PoppinsSemiBold', fontSize: 11, color: colors.text },
  noteText: { fontFamily: 'PoppinsRegular', fontSize: 11, lineHeight: 18, color: colors.textSoft, marginTop: 2 },
  flex: { flex: 1 },
  fulfillmentCard: { gap: 16 },
  fulfillmentHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  fulfillmentHeading: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11 },
  fulfillmentIcon: { width: 48, height: 48, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  fulfillmentBadge: { minHeight: 28, paddingHorizontal: 9, borderRadius: radius.pill, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  fulfillmentBadgeText: { fontFamily: 'PoppinsBold', fontSize: 9, letterSpacing: 0.5, color: colors.primary },
  fulfillmentDetails: { gap: 9 },
  detailRow: { minHeight: 58, padding: 11, borderRadius: 11, backgroundColor: colors.background, flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  detailIconSuccess: { backgroundColor: colors.successSoft },
  detailLabel: { fontFamily: 'PoppinsRegular', fontSize: 9, color: colors.muted },
  detailValue: { fontFamily: 'PoppinsSemiBold', fontSize: 12, lineHeight: 18, color: colors.text },
  detailValueSuccess: { color: colors.success },
  timelineCard: { gap: 15 },
  timeline: { marginTop: 2 },
  timelineStep: { minHeight: 92, flexDirection: 'row', gap: 13 },
  timelineRail: { width: 42, alignItems: 'center' },
  timelineDot: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  timelineDotReached: { backgroundColor: colors.primary },
  timelineDotCancelled: { backgroundColor: colors.danger },
  timelineLine: { width: 2, flex: 1, backgroundColor: colors.border, marginVertical: 4 },
  timelineLineReached: { backgroundColor: '#B7D3F3' },
  timelineBody: { flex: 1, paddingTop: 2 },
  timelineTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 13, color: colors.text },
  timelineTitlePending: { color: colors.muted },
  timelineCopy: { fontFamily: 'PoppinsRegular', fontSize: 11, lineHeight: 17, color: colors.muted, marginTop: 2 },
  timelineTime: { fontFamily: 'PoppinsMedium', fontSize: 10, color: colors.primary, marginTop: 5 },
  timelineWaiting: { fontFamily: 'PoppinsRegular', fontSize: 10, color: colors.muted, marginTop: 5 },
  paymentCard: { gap: 13 },
  summaryRow: { minHeight: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  summaryLabel: { fontFamily: 'PoppinsRegular', fontSize: 12, color: colors.muted },
  summaryLabelTotal: { fontFamily: 'PoppinsSemiBold', fontSize: 13, color: colors.text },
  summaryValue: { fontFamily: 'PoppinsSemiBold', fontSize: 12, color: colors.text },
  summaryValueTotal: { fontFamily: 'PoppinsBold', fontSize: 19, color: colors.primaryDark },
  summaryValueMuted: { color: colors.danger },
  summaryDivider: { height: 1, backgroundColor: colors.border },
  balanceBox: { minHeight: 66, marginTop: 3, padding: 12, borderRadius: 11, backgroundColor: colors.primarySoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  balanceLabel: { fontFamily: 'PoppinsRegular', fontSize: 10, color: colors.muted },
  balanceValue: { fontFamily: 'PoppinsBold', fontSize: 15, color: colors.primaryDark },
  balanceDanger: { color: colors.danger },
  escrowBadge: { minHeight: 42, marginTop: 2, paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.successSoft, flexDirection: 'row', alignItems: 'center', gap: 8 },
  escrowBadgeText: { fontFamily: 'PoppinsSemiBold', fontSize: 11, color: colors.success },
  personCard: { gap: 15 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'PoppinsBold', fontSize: 16, color: colors.primary },
  personName: { fontFamily: 'PoppinsSemiBold', fontSize: 13, color: colors.text },
  personEmail: { fontFamily: 'PoppinsRegular', fontSize: 10, color: colors.muted },
  actionCard: { gap: 12 },
  actionHelp: { fontFamily: 'PoppinsRegular', fontSize: 11, lineHeight: 18, color: colors.muted },
  handoverBox: { gap: 10, padding: 13, borderRadius: 12, borderWidth: 1, borderColor: '#B7D3F3', backgroundColor: colors.primarySoft },
  handoverLabel: { fontFamily: 'PoppinsBold', fontSize: 9, letterSpacing: 0.8, textAlign: 'center', color: colors.primary },
  handoverCode: { fontFamily: 'PoppinsBold', fontSize: 31, letterSpacing: 8, textAlign: 'center', color: colors.primaryDark },
  handoverHint: { fontFamily: 'PoppinsRegular', fontSize: 10, lineHeight: 17, textAlign: 'center', color: colors.muted },
  cancelReason: { padding: 13, borderRadius: 11, backgroundColor: colors.dangerSoft, gap: 3 },
  cancelReasonLabel: { fontFamily: 'PoppinsBold', fontSize: 9, letterSpacing: 0.6, color: colors.danger },
  cancelReasonText: { fontFamily: 'PoppinsMedium', fontSize: 12, color: colors.text },
  cancelledBy: { fontFamily: 'PoppinsRegular', fontSize: 10, color: colors.muted },
  modalBackdrop: { flex: 1, padding: 18, backgroundColor: 'rgba(10,26,41,.58)', alignItems: 'center', justifyContent: 'center' },
  dialog: { width: '100%', maxWidth: 520, maxHeight: '94%', padding: 24, borderRadius: 18, backgroundColor: colors.surface, gap: 11, shadowColor: '#071727', shadowOpacity: 0.22, shadowRadius: 26, shadowOffset: { width: 0, height: 12 } },
  dialogHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dialogIcon: { width: 50, height: 50, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  dialogIconDanger: { backgroundColor: colors.dangerSoft },
  dialogClose: { width: 40, height: 40, borderRadius: 11, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  dialogEyebrow: { fontFamily: 'PoppinsBold', fontSize: 9, letterSpacing: 0.75, color: colors.primary, marginTop: 4 },
  dialogTitle: { fontFamily: 'PoppinsBold', fontSize: 23, lineHeight: 31, color: colors.text },
  dialogDescription: { fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 19, color: colors.muted },
  dialogAmount: { minHeight: 70, marginTop: 4, padding: 13, borderRadius: 12, backgroundColor: colors.primarySoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dialogAmountLabel: { fontFamily: 'PoppinsMedium', fontSize: 12, color: colors.textSoft },
  dialogAmountValue: { fontFamily: 'PoppinsBold', fontSize: 20, color: colors.primaryDark },
  reasonSection: { gap: 8, marginTop: 3 },
  reasonLabel: { fontFamily: 'PoppinsMedium', fontSize: 12, color: colors.textSoft },
  reasonList: { gap: 7 },
  reason: { minHeight: 43, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 9 },
  reasonActive: { borderColor: '#F1B2B2', backgroundColor: colors.dangerSoft },
  reasonRadio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  reasonRadioActive: { borderColor: colors.danger },
  reasonRadioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
  reasonText: { flex: 1, fontFamily: 'PoppinsRegular', fontSize: 11, color: colors.textSoft },
  reasonTextActive: { fontFamily: 'PoppinsMedium', color: colors.text },
  dialogActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  dialogBack: { flex: 1 },
  dialogConfirm: { flex: 1.6 },
});
