import { TransactionStatus } from '@prisma/client';
export type TransactionActor = 'buyer' | 'seller';
const rules: Record<TransactionStatus, Partial<Record<TransactionStatus, TransactionActor[]>>> = {
  PENDING: { CANCELLED: ['buyer', 'seller'] },
  PAID: { CONFIRMED: ['seller'], CANCELLED: ['buyer', 'seller'] },
  CONFIRMED: { COMPLETED: ['buyer'], CANCELLED: ['buyer', 'seller'] },
  COMPLETED: {}, CANCELLED: {},
};
export function canTransition(from: TransactionStatus, to: TransactionStatus, actor: TransactionActor) { return rules[from][to]?.includes(actor) ?? false; }
