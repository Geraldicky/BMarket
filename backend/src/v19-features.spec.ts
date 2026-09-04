import { describe, expect, it, vi } from 'vitest';
import { TransactionsService } from './transactions/transactions.service';
import { ReviewsService } from './reviews/reviews.service';
import { DisputesService } from './disputes/disputes.service';
import { ActivityService } from './activity/activity.service';

describe('BMarket V13–V19 feature contracts', () => {
  it('creates a QRIS session without moving escrow before callback success', async () => {
    const payment = { id: 'payment-1', method: 'QRIS', status: 'WAITING', reference: 'QRS-1' };
    const tx = {
      transaction: { findUnique: vi.fn().mockResolvedValue({ id: 'order-1', buyerId: 'buyer-1', sellerId: 'seller-1', status: 'PENDING', isEscrowHeld: false, grandTotal: 118000, payment: null }) },
      payment: { upsert: vi.fn().mockResolvedValue(payment) },
    };
    const prisma = { $transaction: vi.fn((operation: (client: unknown) => unknown) => operation(tx)) };
    const service = new TransactionsService(prisma as never);

    await expect(service.createPaymentSession('order-1', 'buyer-1', { method: 'QRIS' })).resolves.toEqual(payment);
    expect(tx.payment.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ method: 'QRIS', amount: 118000 }) }));
  });

  it('accepts a seller review for the buyer after a completed transaction', async () => {
    const tx = {
      review: { create: vi.fn().mockResolvedValue({ id: 'review-1', revieweeId: 'buyer-1' }) },
      notification: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      transaction: { findUnique: vi.fn().mockResolvedValue({ id: 'order-1', buyerId: 'buyer-1', sellerId: 'seller-1', status: 'COMPLETED', reviews: [], listing: { title: 'Laptop' } }) },
      $transaction: vi.fn((operation: (client: unknown) => unknown) => operation(tx)),
    };
    const service = new ReviewsService(prisma as never);

    await service.create('seller-1', { transactionId: 'order-1', rating: 5, comment: 'Buyer tepat waktu' });
    expect(tx.review.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ reviewerId: 'seller-1', revieweeId: 'buyer-1' }) }));
  });

  it('locks the transaction when a participant opens a dispute', async () => {
    const tx = {
      dispute: { create: vi.fn().mockResolvedValue({ id: 'dispute-1' }) },
      transaction: { update: vi.fn().mockResolvedValue({}) },
      notification: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      transaction: { findUnique: vi.fn().mockResolvedValue({ id: 'order-1', buyerId: 'buyer-1', sellerId: 'seller-1', status: 'PAID', isEscrowHeld: true, dispute: null, listing: { title: 'Laptop' } }) },
      $transaction: vi.fn((operation: (client: unknown) => unknown) => operation(tx)),
    };
    const service = new DisputesService(prisma as never);

    await service.create('buyer-1', { transactionId: 'order-1', reason: 'NOT_AS_DESCRIBED', description: 'Barang berbeda dari informasi listing.' });
    expect(tx.transaction.update).toHaveBeenCalledWith({ where: { id: 'order-1' }, data: { isDisputed: true } });
  });

  it('persists one wishlist row per user and listing', async () => {
    const prisma = {
      listing: { findUnique: vi.fn().mockResolvedValue({ id: 'listing-1', status: 'ACTIVE', sellerId: 'seller-1' }) },
      wishlist: { upsert: vi.fn().mockResolvedValue({ id: 'saved-1' }) },
    };
    const service = new ActivityService(prisma as never);

    await service.save('buyer-1', 'listing-1');
    expect(prisma.wishlist.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { userId_listingId: { userId: 'buyer-1', listingId: 'listing-1' } } }));
  });
});
