import { describe, expect, it, vi } from 'vitest';
import { TransactionsService } from './transactions.service';

const listing = {
  id: 'd0d13ac9-b998-4f36-a5f8-643c85003a88',
  sellerId: 'seller-1',
  status: 'ACTIVE',
  type: 'PRODUCT',
  stockLeft: 3,
  price: 100000,
  images: JSON.stringify(['http://localhost:3000/uploads/product.jpg']),
  fulfillmentMethods: ['CAMPUS_MEETUP', 'INSTANT_COURIER'],
};

const meetupCheckout = {
  listingId: listing.id,
  quantity: 1,
  fulfillmentMethod: 'CAMPUS_MEETUP' as const,
  meetupCampus: 'BINUS @Kemanggisan',
  meetupLocation: 'Lobby Anggrek',
  meetupSchedule: 'Jumat, 13.00 WIB',
};

function serviceWithTransactionClient(tx: Record<string, unknown>) {
  const prisma = {
    $transaction: vi.fn((operation: (client: unknown) => unknown) => operation(tx)),
  };
  return new TransactionsService(prisma as never);
}

describe('TransactionsService checkout flow', () => {
  it('rejects a duplicate active checkout from the same buyer', async () => {
    const tx = {
      listing: { findUnique: vi.fn().mockResolvedValue(listing) },
      transaction: { findFirst: vi.fn().mockResolvedValue({ id: 'existing-transaction' }) },
    };
    const service = serviceWithTransactionClient(tx);

    await expect(service.create('buyer-1', meetupCheckout)).rejects.toThrow(/transaksi aktif/i);
    expect(tx.transaction.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ buyerId: 'buyer-1', listingId: listing.id }),
    }));
  });

  it('reserves stock and returns parsed product photos', async () => {
    const created = {
      id: 'transaction-1', buyerId: 'buyer-1', sellerId: 'seller-1',
      status: 'PENDING', quantity: 2, listing: { ...listing, stockLeft: 1 },
      buyer: { id: 'buyer-1', name: 'Buyer' }, seller: { id: 'seller-1', name: 'Seller' },
    };
    const tx = {
      listing: {
        findUnique: vi.fn().mockResolvedValue(listing),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn(),
      },
      transaction: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(created),
      },
      commissionSetting: { findFirst: vi.fn().mockResolvedValue({ rate: 5 }) },
    };
    const service = serviceWithTransactionClient(tx);

    const result = await service.create('buyer-1', { ...meetupCheckout, quantity: 2 });

    expect(tx.listing.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ stockLeft: { gte: 2 } }),
      data: { stockLeft: { decrement: 2 } },
    }));
    expect(result.listing.images).toEqual(['http://localhost:3000/uploads/product.jpg']);
  });

  it('adds courier fee to buyer total without charging seller commission on shipping', async () => {
    const tx = {
      listing: {
        findUnique: vi.fn().mockResolvedValue(listing),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn(),
      },
      transaction: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({
          id: 'courier-transaction', status: 'PENDING', buyerId: 'buyer-1', sellerId: listing.sellerId,
          ...data, listing, buyer: { id: 'buyer-1' }, seller: { id: listing.sellerId },
        })),
      },
      commissionSetting: { findFirst: vi.fn().mockResolvedValue({ rate: 5 }) },
    };
    const service = serviceWithTransactionClient(tx);

    await service.create('buyer-1', {
      listingId: listing.id,
      quantity: 1,
      fulfillmentMethod: 'INSTANT_COURIER',
      courierProvider: 'GOSEND',
      deliveryAddress: 'Jl. Kebon Jeruk Raya No. 27, Jakarta Barat',
      recipientPhone: '081234567890',
    });

    expect(tx.transaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        totalPrice: 100000,
        shippingFee: 18000,
        grandTotal: 118000,
        commissionAmt: 5000,
        sellerReceives: 95000,
      }),
    }));
  });

  it('completes a campus meetup only after seller enters the buyer handover code', async () => {
    const current: any = {
      id: 'transaction-meetup', buyerId: 'buyer-1', sellerId: 'seller-1', status: 'CONFIRMED',
      fulfillmentMethod: 'CAMPUS_MEETUP', isEscrowHeld: true, grandTotal: 100000,
      sellerReceives: 95000, handoverCodeHash: null, handoverCodeExpiresAt: null,
    };
    const completed = { ...current, status: 'COMPLETED', listing, buyer: { id: 'buyer-1' }, seller: { id: 'seller-1' } };
    const tx = {
      transaction: {
        findUnique: vi.fn().mockImplementation(() => Promise.resolve(current)),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(completed),
      },
      user: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), update: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      transaction: {
        findUnique: vi.fn().mockResolvedValue(current),
        update: vi.fn().mockImplementation(({ data }) => {
          Object.assign(current, data);
          return Promise.resolve(current);
        }),
      },
      $transaction: vi.fn((operation: (client: unknown) => unknown) => operation(tx)),
    };
    const service = new TransactionsService(prisma as never);

    const issued = await service.issueHandoverCode(current.id, current.buyerId);
    await service.confirmHandover(current.id, current.sellerId, issued.code);

    expect(issued.code).toMatch(/^\d{6}$/);
    expect(tx.transaction.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'COMPLETED', handoverVerifiedAt: expect.any(Date) }),
    }));
    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { balance: { increment: 95000 } },
    }));
  });

  it('requires a cancellation reason', async () => {
    const tx = {
      transaction: { findUnique: vi.fn().mockResolvedValue({
        id: 'transaction-1', buyerId: 'buyer-1', sellerId: 'seller-1', status: 'PENDING',
        listingId: listing.id, listing: { type: 'PRODUCT', status: 'ACTIVE' },
      }) },
    };
    const service = serviceWithTransactionClient(tx);

    await expect(service.updateStatus('transaction-1', 'buyer-1', 'CANCELLED')).rejects.toThrow(/alasan pembatalan/i);
  });

  it('rejects a second payment request', async () => {
    const tx = {
      transaction: { findUnique: vi.fn().mockResolvedValue({
        id: 'transaction-1', buyerId: 'buyer-1', status: 'PAID', isEscrowHeld: true,
      }) },
      user: { updateMany: vi.fn() },
    };
    const service = serviceWithTransactionClient(tx);

    await expect(service.pay('transaction-1', 'buyer-1')).rejects.toThrow(/sudah dibayar/i);
    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });

  it('refunds escrow and reopens a sold listing after cancellation', async () => {
    const current = {
      id: 'transaction-1', buyerId: 'buyer-1', sellerId: 'seller-1', status: 'PAID',
      listingId: listing.id, listing: { type: 'PRODUCT', status: 'SOLD' },
      isEscrowHeld: true, quantity: 1, totalPrice: 100000, grandTotal: 100000,
    };
    const result = { ...current, status: 'CANCELLED', isEscrowHeld: false, listing };
    const tx = {
      transaction: {
        findUnique: vi.fn().mockResolvedValue(current),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(result),
      },
      listing: { update: vi.fn().mockResolvedValue({}) },
      user: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), update: vi.fn() },
    };
    const service = serviceWithTransactionClient(tx);

    await service.updateStatus('transaction-1', 'buyer-1', 'CANCELLED', 'Kesepakatan dibatalkan bersama');

    expect(tx.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { balance: { increment: 100000 }, escrow: { decrement: 100000 } },
    }));
    expect(tx.listing.update).toHaveBeenCalledWith({
      where: { id: listing.id },
      data: { stockLeft: { increment: 1 }, status: 'ACTIVE' },
    });
  });

  it('does not reactivate a listing hidden by admin when an order is cancelled', async () => {
    const current = {
      id: 'transaction-1', buyerId: 'buyer-1', sellerId: 'seller-1', status: 'PENDING',
      listingId: listing.id, listing: { type: 'PRODUCT', status: 'HIDDEN' },
      isEscrowHeld: false, quantity: 1, totalPrice: 100000, grandTotal: 100000,
    };
    const result = { ...current, status: 'CANCELLED', listing: { ...listing, status: 'HIDDEN' } };
    const tx = {
      transaction: {
        findUnique: vi.fn().mockResolvedValue(current),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(result),
      },
      listing: { update: vi.fn().mockResolvedValue({}) },
      user: { updateMany: vi.fn(), update: vi.fn() },
    };
    const service = serviceWithTransactionClient(tx);

    await service.updateStatus('transaction-1', 'buyer-1', 'CANCELLED', 'Berubah pikiran');

    expect(tx.listing.update).toHaveBeenCalledWith({
      where: { id: listing.id },
      data: { stockLeft: { increment: 1 } },
    });
  });
});
