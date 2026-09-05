import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DisputesService } from './disputes.service';

function createNotifications() {
  return {
    create: vi.fn().mockResolvedValue({}),
    createMany: vi.fn().mockResolvedValue({ count: 2 }),
  };
}

function createPrisma() {
  return {
    transaction: { findUnique: vi.fn() },
    dispute: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    $transaction: vi.fn(),
  };
}

describe('DisputesService — escrow safety', () => {
  let prisma: ReturnType<typeof createPrisma>;
  let notifications: ReturnType<typeof createNotifications>;
  let service: DisputesService;

  beforeEach(() => {
    prisma = createPrisma();
    notifications = createNotifications();
    service = new DisputesService(prisma as never, notifications as never);
  });

  it('lets a transaction participant open a dispute while funds are held in escrow', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 'tx-1', buyerId: 'buyer-1', sellerId: 'seller-1', status: 'PAID', isEscrowHeld: true, dispute: null,
    });
    prisma.dispute.create.mockResolvedValue({
      id: 'd-1', transactionId: 'tx-1', openedById: 'buyer-1', reason: 'ITEM_NOT_AS_DESCRIBED',
      description: 'Barang berbeda dari deskripsi.', evidenceUrls: '["http://localhost/evidence.jpg"]', status: 'OPEN',
    });

    const result = await service.create('buyer-1', {
      transactionId: 'tx-1' as never,
      reason: 'ITEM_NOT_AS_DESCRIBED' as never,
      description: '  Barang berbeda dari deskripsi.  ',
      evidenceUrls: ['http://localhost/evidence.jpg'],
    });

    expect(prisma.dispute.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ description: 'Barang berbeda dari deskripsi.', evidenceUrls: '["http://localhost/evidence.jpg"]' }),
    }));
    expect(result.evidenceUrls).toEqual(['http://localhost/evidence.jpg']);
    expect(notifications.create).toHaveBeenCalledWith('seller-1', 'DISPUTE', expect.any(String), expect.stringMatching(/escrow/i), 'TRANSACTION', 'tx-1');
  });

  it('rejects a dispute from a non-participant', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 'tx-1', buyerId: 'buyer-1', sellerId: 'seller-1', status: 'PAID', isEscrowHeld: true, dispute: null,
    });
    await expect(service.create('intruder', {
      transactionId: 'tx-1' as never, reason: 'OTHER' as never, description: 'Saya bukan peserta transaksi ini.',
    })).rejects.toThrow(/bukan peserta/i);
  });

  it('rejects a dispute before payment or after escrow is released', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 'tx-1', buyerId: 'buyer-1', sellerId: 'seller-1', status: 'PENDING', isEscrowHeld: false, dispute: null,
    });
    await expect(service.create('buyer-1', {
      transactionId: 'tx-1' as never, reason: 'OTHER' as never, description: 'Masalah transaksi yang cukup panjang.',
    })).rejects.toThrow(/dana transaksi masih berada di escrow/i);
  });

  it('rejects opening a second dispute for the same transaction', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 'tx-1', buyerId: 'buyer-1', sellerId: 'seller-1', status: 'PAID', isEscrowHeld: true, dispute: { id: 'd-existing' },
    });
    await expect(service.create('buyer-1', {
      transactionId: 'tx-1' as never, reason: 'OTHER' as never, description: 'Masalah transaksi yang cukup panjang.',
    })).rejects.toThrow(/sudah memiliki sengketa/i);
  });

  it('moves an open dispute into admin review without releasing escrow', async () => {
    const tx = {
      dispute: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'd-1', status: 'OPEN', transactionId: 'tx-1', evidenceUrls: '[]',
          transaction: { id: 'tx-1', buyerId: 'buyer-1', sellerId: 'seller-1' },
        }),
        update: vi.fn().mockResolvedValue({ id: 'd-1', status: 'IN_REVIEW', evidenceUrls: '[]' }),
      },
    };
    prisma.$transaction.mockImplementation((operation: (client: unknown) => unknown) => operation(tx));

    const result = await service.resolve('d-1', 'admin-1', 'START_REVIEW');

    expect(result.status).toBe('IN_REVIEW');
    expect(tx.dispute.update).toHaveBeenCalledWith({ where: { id: 'd-1' }, data: { status: 'IN_REVIEW' } });
    expect(notifications.createMany).not.toHaveBeenCalled();
  });

  it('refunds buyer, restores product stock, closes escrow and writes a refund ledger row', async () => {
    const order = {
      id: 'tx-1', buyerId: 'buyer-1', sellerId: 'seller-1', listingId: 'listing-1', status: 'PAID', isEscrowHeld: true,
      grandTotal: 100000, totalPrice: 100000, sellerReceives: 95000, quantity: 1,
      listingTypeSnapshot: 'PRODUCT', listing: { type: 'PRODUCT', mode: 'ONE_OFF', status: 'SOLD' },
    };
    const tx = {
      dispute: {
        findUnique: vi.fn().mockResolvedValue({ id: 'd-1', status: 'IN_REVIEW', transactionId: 'tx-1', evidenceUrls: '[]', transaction: order }),
        update: vi.fn().mockResolvedValue({ id: 'd-1', status: 'RESOLVED', resolution: 'REFUND_BUYER', evidenceUrls: '[]' }),
      },
      user: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ balance: 100000, escrow: 0 }),
      },
      walletLedger: { upsert: vi.fn().mockResolvedValue({}) },
      listing: { update: vi.fn().mockResolvedValue({}) },
      transaction: { update: vi.fn().mockResolvedValue({}) },
    };
    prisma.$transaction.mockImplementation((operation: (client: unknown) => unknown) => operation(tx));

    const result = await service.resolve('d-1', 'admin-1', 'REFUND_BUYER', 'Barang tidak sesuai bukti.');

    expect(result.resolution).toBe('REFUND_BUYER');
    expect(tx.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'buyer-1', escrow: { gte: 100000 } },
      data: { escrow: { decrement: 100000 }, balance: { increment: 100000 } },
    }));
    expect(tx.listing.update).toHaveBeenCalledWith({ where: { id: 'listing-1' }, data: { stockLeft: { increment: 1 }, status: 'ACTIVE' } });
    expect(tx.transaction.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELLED', isEscrowHeld: false }) }));
    expect(tx.walletLedger.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ type: 'REFUND', idempotencyKey: 'DISPUTE:REFUND:tx-1' }),
    }));
    expect(notifications.createMany).toHaveBeenCalled();
  });

  it('releases disputed escrow to seller and writes both buyer and seller ledger rows', async () => {
    const order = {
      id: 'tx-1', buyerId: 'buyer-1', sellerId: 'seller-1', listingId: 'listing-1', status: 'PAID', isEscrowHeld: true,
      grandTotal: 100000, totalPrice: 100000, sellerReceives: 95000, quantity: 1,
      listingTypeSnapshot: 'PRODUCT', listing: { type: 'PRODUCT', mode: 'ONE_OFF', status: 'SOLD' },
    };
    const tx = {
      dispute: {
        findUnique: vi.fn().mockResolvedValue({ id: 'd-1', status: 'IN_REVIEW', transactionId: 'tx-1', evidenceUrls: '[]', transaction: order }),
        update: vi.fn().mockResolvedValue({ id: 'd-1', status: 'RESOLVED', resolution: 'RELEASE_SELLER', evidenceUrls: '[]' }),
      },
      user: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({}),
        findUniqueOrThrow: vi.fn()
          .mockResolvedValueOnce({ balance: 0, escrow: 0 })
          .mockResolvedValueOnce({ balance: 95000, escrow: 0 }),
      },
      walletLedger: { upsert: vi.fn().mockResolvedValue({}) },
      transaction: { update: vi.fn().mockResolvedValue({}) },
    };
    prisma.$transaction.mockImplementation((operation: (client: unknown) => unknown) => operation(tx));

    const result = await service.resolve('d-1', 'admin-1', 'RELEASE_SELLER', 'Seller memenuhi bukti serah-terima.');

    expect(result.resolution).toBe('RELEASE_SELLER');
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 'seller-1' }, data: { balance: { increment: 95000 } } });
    expect(tx.transaction.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED', isEscrowHeld: false }) }));
    expect(tx.walletLedger.upsert).toHaveBeenCalledTimes(2);
  });

  it('rejects a dispute without moving escrow when admin rejects the claim', async () => {
    const order = {
      id: 'tx-1', buyerId: 'buyer-1', sellerId: 'seller-1', listingId: 'listing-1', status: 'PAID', isEscrowHeld: true,
      grandTotal: 100000, totalPrice: 100000, sellerReceives: 95000, quantity: 1,
      listingTypeSnapshot: 'PRODUCT', listing: { type: 'PRODUCT', mode: 'ONE_OFF', status: 'SOLD' },
    };
    const tx = {
      dispute: {
        findUnique: vi.fn().mockResolvedValue({ id: 'd-1', status: 'OPEN', transactionId: 'tx-1', evidenceUrls: '[]', transaction: order }),
        update: vi.fn().mockResolvedValue({ id: 'd-1', status: 'REJECTED', resolution: 'REJECT_DISPUTE', evidenceUrls: '[]' }),
      },
      user: { updateMany: vi.fn(), update: vi.fn(), findUniqueOrThrow: vi.fn() },
      walletLedger: { upsert: vi.fn() },
      transaction: { update: vi.fn() },
    };
    prisma.$transaction.mockImplementation((operation: (client: unknown) => unknown) => operation(tx));

    const result = await service.resolve('d-1', 'admin-1', 'REJECT', 'Bukti tidak cukup.');

    expect(result.status).toBe('REJECTED');
    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(tx.transaction.update).not.toHaveBeenCalled();
  });

  it('reports whether a transaction has an open/in-review dispute', async () => {
    prisma.dispute.count.mockResolvedValue(1);
    await expect(service.hasOpen('tx-1')).resolves.toBe(true);
    expect(prisma.dispute.count).toHaveBeenCalledWith({ where: { transactionId: 'tx-1', status: { in: ['OPEN', 'IN_REVIEW'] } } });
  });
});
