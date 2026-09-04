import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewsService } from './reviews.service';

function createPrisma() {
  return {
    transaction: { findUnique: vi.fn() },
    review: { create: vi.fn(), findMany: vi.fn(), aggregate: vi.fn() },
  };
}

function createNotifications() {
  return { create: vi.fn().mockResolvedValue({}) };
}

describe('ReviewsService — completed transaction trust flow', () => {
  let prisma: ReturnType<typeof createPrisma>;
  let notifications: ReturnType<typeof createNotifications>;
  let service: ReviewsService;

  beforeEach(() => {
    prisma = createPrisma();
    notifications = createNotifications();
    service = new ReviewsService(prisma as never, notifications as never);
  });

  it('lets the buyer review the seller after a completed transaction', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 'tx-1', buyerId: 'buyer-1', sellerId: 'seller-1', status: 'COMPLETED', review: null,
    });
    prisma.review.create.mockResolvedValue({
      id: 'review-1', rating: 5, comment: 'Barang sesuai.', reviewer: { id: 'buyer-1', name: 'Buyer', avatarUrl: null },
    });

    const result = await service.create('buyer-1', { transactionId: 'tx-1', rating: 5, comment: '  Barang sesuai.  ' });

    expect(prisma.review.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        transactionId: 'tx-1', reviewerId: 'buyer-1', revieweeId: 'seller-1', rating: 5, comment: 'Barang sesuai.',
      }),
    }));
    expect(notifications.create).toHaveBeenCalledWith('seller-1', 'REVIEW', 'Review baru', expect.stringContaining('5/5'), 'TRANSACTION', 'tx-1');
    expect(result.id).toBe('review-1');
  });

  it('stores a blank comment as null', async () => {
    prisma.transaction.findUnique.mockResolvedValue({ id: 'tx-1', buyerId: 'buyer-1', sellerId: 'seller-1', status: 'COMPLETED', review: null });
    prisma.review.create.mockResolvedValue({ id: 'review-1', rating: 4, comment: null, reviewer: { id: 'buyer-1', name: 'Buyer' } });

    await service.create('buyer-1', { transactionId: 'tx-1', rating: 4, comment: '   ' });
    expect(prisma.review.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ comment: null }) }));
  });

  it('rejects an unknown transaction', async () => {
    prisma.transaction.findUnique.mockResolvedValue(null);
    await expect(service.create('buyer-1', { transactionId: 'tx-x', rating: 5 })).rejects.toThrow(/tidak ditemukan/i);
  });

  it('rejects a review submitted by anyone other than the buyer', async () => {
    prisma.transaction.findUnique.mockResolvedValue({ id: 'tx-1', buyerId: 'buyer-1', sellerId: 'seller-1', status: 'COMPLETED', review: null });
    await expect(service.create('seller-1', { transactionId: 'tx-1', rating: 5 })).rejects.toThrow(/hanya pembeli/i);
  });

  it('rejects review before the transaction is completed', async () => {
    prisma.transaction.findUnique.mockResolvedValue({ id: 'tx-1', buyerId: 'buyer-1', sellerId: 'seller-1', status: 'PAID', review: null });
    await expect(service.create('buyer-1', { transactionId: 'tx-1', rating: 5 })).rejects.toThrow(/setelah transaksi selesai/i);
  });

  it('rejects a duplicate review for one transaction', async () => {
    prisma.transaction.findUnique.mockResolvedValue({ id: 'tx-1', buyerId: 'buyer-1', sellerId: 'seller-1', status: 'COMPLETED', review: { id: 'review-existing' } });
    await expect(service.create('buyer-1', { transactionId: 'tx-1', rating: 5 })).rejects.toThrow(/sudah memberikan review/i);
  });

  it('builds seller rating summary and prefers the immutable listing snapshot', async () => {
    prisma.review.findMany.mockResolvedValue([
      {
        id: 'review-1', rating: 5, comment: 'Bagus', createdAt: new Date('2026-09-04T00:00:00Z'),
        reviewer: { id: 'buyer-1', name: 'Buyer', avatarUrl: null },
        transaction: { listingTitleSnapshot: 'Keyboard saat dibeli', listing: { title: 'Keyboard edited' } },
      },
      {
        id: 'review-2', rating: 4, comment: null, createdAt: new Date('2026-09-03T00:00:00Z'),
        reviewer: { id: 'buyer-2', name: 'Buyer 2', avatarUrl: null },
        transaction: { listingTitleSnapshot: null, listing: { title: 'Mouse' } },
      },
    ]);
    prisma.review.aggregate.mockResolvedValue({ _avg: { rating: 4.5 }, _count: 2 });

    const result = await service.getUserReviews('seller-1');

    expect(result.avgRating).toBe(4.5);
    expect(result.totalReviews).toBe(2);
    expect(result.reviews[0].listingTitle).toBe('Keyboard saat dibeli');
    expect(result.reviews[1].listingTitle).toBe('Mouse');
  });
});
