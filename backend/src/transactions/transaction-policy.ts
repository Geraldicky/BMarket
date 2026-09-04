import { TransactionStatus } from '@prisma/client';

export type TransactionActor = 'buyer' | 'seller';

// V21: setelah seller CONFIRMED, transaksi tidak boleh direct-cancel karena barang/jasa
// sudah masuk proses penyerahan. Penyelesaian konflik setelah tahap ini akan ditangani
// melalui dispute flow di versi berikutnya, bukan refund sepihak.
const rules: Record<TransactionStatus, Partial<Record<TransactionStatus, TransactionActor[]>>> = {
  PENDING: { CANCELLED: ['buyer', 'seller'] },
  PAID: { CONFIRMED: ['seller'], CANCELLED: ['buyer', 'seller'] },
  CONFIRMED: { COMPLETED: ['buyer'] },
  COMPLETED: {},
  CANCELLED: {},
};

export function canTransition(from: TransactionStatus, to: TransactionStatus, actor: TransactionActor) {
  return rules[from][to]?.includes(actor) ?? false;
}
