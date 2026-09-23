import type Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '@/constants/theme';
import type { Transaction, TransactionStatus } from '@/types';

export type TransactionTone = 'warning' | 'info' | 'progress' | 'success' | 'danger';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export type TransactionPresentation = {
  label: string;
  title: string;
  description: string;
  nextAction: string;
  icon: IconName;
  color: string;
  tint: string;
  tone: TransactionTone;
};

const basePresentation = (): Record<TransactionStatus, TransactionPresentation> => ({
  PENDING: {
    label: 'Menunggu pembayaran',
    title: 'Selesaikan pembayaran',
    description: 'Pesanan sudah dibuat dan stok masih direservasi untukmu.',
    nextAction: 'Bayar sebelum waktu reservasi berakhir.',
    icon: 'time-outline', color: colors.warning, tint: colors.warningSoft, tone: 'warning',
  },
  PAID: {
    label: 'Pembayaran berhasil',
    title: 'Pembayaran aman di escrow',
    description: 'Pembayaran sudah dikonfirmasi dan diamankan BMarket.',
    nextAction: 'Koordinasikan langkah berikutnya dengan pihak transaksi.',
    icon: 'shield-checkmark-outline', color: colors.primary, tint: colors.primarySoft, tone: 'info',
  },
  CONFIRMED: {
    label: 'Sedang diproses',
    title: 'Penyerahan sedang berlangsung',
    description: 'Pesanan sedang diproses sesuai kesepakatan buyer dan seller.',
    nextAction: 'Periksa pesanan sebelum menyelesaikan transaksi.',
    icon: 'sync-outline', color: colors.purple, tint: colors.purpleSoft, tone: 'progress',
  },
  COMPLETED: {
    label: 'Selesai',
    title: 'Transaksi selesai',
    description: 'Serah-terima selesai dan dana sudah dilepas kepada seller.',
    nextAction: 'Berikan ulasan jika pengalaman transaksi sudah selesai.',
    icon: 'checkmark-circle-outline', color: colors.success, tint: colors.successSoft, tone: 'success',
  },
  CANCELLED: {
    label: 'Dibatalkan',
    title: 'Transaksi dibatalkan',
    description: 'Transaksi dihentikan dan dana atau stok ditangani sesuai kondisi terakhir.',
    nextAction: 'Lihat detail pembatalan untuk informasi selengkapnya.',
    icon: 'close-circle-outline', color: colors.danger, tint: colors.dangerSoft, tone: 'danger',
  },
});

export function transactionPresentation(transaction: Transaction, viewerId?: string): TransactionPresentation {
  const base = basePresentation()[transaction.status];
  const buyer = transaction.buyerId === viewerId || transaction.buyer?.id === viewerId;
  const service = transaction.listing.mode === 'SERVICE';
  const meetup = transaction.fulfillmentMethod === 'CAMPUS_MEETUP';

  if (transaction.dispute && ['OPEN', 'IN_REVIEW'].includes(transaction.dispute.status)) {
    return {
      label: 'Dalam sengketa', title: 'Sengketa sedang ditinjau',
      description: 'BMarket sedang meninjau laporan dan bukti dari transaksi ini.',
      nextAction: 'Pantau pembaruan dan lengkapi bukti bila diminta.',
      icon: 'alert-circle-outline', color: colors.warning, tint: colors.warningSoft, tone: 'warning',
    };
  }

  if (transaction.status === 'PAID' && service) {
    return { ...base, label: 'Jasa sedang dikerjakan', title: 'Jasa sedang dikerjakan', nextAction: buyer ? 'Tunggu hasil dari seller, lalu periksa sebelum menerima.' : 'Kerjakan jasa dan unggah hasil untuk diperiksa buyer.' };
  }
  if (transaction.status === 'PAID' && meetup) {
    return { ...base, label: 'Menunggu meetup', title: 'Siap koordinasi meetup', nextAction: buyer ? 'Atur meetup lewat chat. Tunjukkan kode hanya setelah barang diperiksa.' : 'Atur meetup lewat chat. Minta kode setelah barang diterima buyer.' };
  }
  if (transaction.status === 'CONFIRMED' && meetup) {
    return { ...base, label: 'Menunggu serah terima', title: 'Menunggu konfirmasi serah terima', nextAction: buyer ? 'Periksa barang dan tunjukkan kode kepada seller.' : 'Masukkan kode buyer setelah barang diterima dan diperiksa.' };
  }
  return base;
}

export function transactionStatusLabel(status: TransactionStatus) {
  return basePresentation()[status].label;
}
