import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TransactionsService } from './transactions.service';

function notifications() {
  return {
    create: vi.fn().mockResolvedValue({}),
    createMany: vi.fn().mockResolvedValue({ count: 2 }),
  };
}

function serviceWithTx(tx: Record<string, any>, topLevel: Record<string, any> = {}) {
  tx.user ??= {};
  tx.user.findUniqueOrThrow ??= vi.fn().mockResolvedValue({ balance: 0, escrow: 0 });
  tx.walletLedger ??= { upsert: vi.fn().mockResolvedValue({}) };
  const prisma = {
    transaction: { findMany: vi.fn().mockResolvedValue([]), ...(topLevel.transaction || {}) },
    walletLedger: topLevel.walletLedger || { findMany: vi.fn() },
    user: topLevel.user || { findUnique: vi.fn() },
    $transaction: vi.fn((operation: (client: unknown) => unknown) => operation(tx)),
    ...topLevel,
  };
  const notify = notifications();
  return { service: new TransactionsService(prisma as never, notify as never), prisma, notify };
}

describe('TransactionsService — payment, handover & wallet integrity', () => {
  beforeEach(() => {
    process.env.OTP_HASH_SECRET = 'unit-test-secret';
  });

  it('moves buyer balance into escrow on payment and creates an idempotent purchase-hold ledger entry', async () => {
    const future = new Date(Date.now() + 60_000);
    const current: any = {
      id: 'tx-1', buyerId: 'buyer-1', sellerId: 'seller-1', listingId: 'listing-1', status: 'PENDING', isEscrowHeld: false,
      reservationExpiresAt: future, grandTotal: 100000, totalPrice: 100000, listing: { title: 'Keyboard', images: '[]' },
      listingTitleSnapshot: 'Keyboard',
    };
    const paid = { ...current, status: 'PAID', isEscrowHeld: true, listing: { title: 'Keyboard', images: '[]' }, dispute: null, review: null };
    const tx = {
      transaction: {
        findUnique: vi.fn().mockResolvedValue(current),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(paid),
      },
      user: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ balance: 400000, escrow: 100000 }),
      },
      walletLedger: { upsert: vi.fn().mockResolvedValue({}) },
    };
    const { service, notify } = serviceWithTx(tx);

    await service.pay('tx-1', 'buyer-1');

    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'buyer-1', balance: { gte: 100000 } },
      data: { balance: { decrement: 100000 }, escrow: { increment: 100000 } },
    });
    expect(tx.transaction.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'PAID', isEscrowHeld: true }) }));
    expect(tx.walletLedger.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { idempotencyKey: 'PAY:tx-1' },
      create: expect.objectContaining({ type: 'PURCHASE_HOLD', balanceDelta: -100000, escrowDelta: 100000, idempotencyKey: 'PAY:tx-1' }),
    }));
    expect(notify.create).toHaveBeenCalledWith('seller-1', 'TRANSACTION', 'Pembayaran diterima', expect.stringMatching(/escrow/i), 'TRANSACTION', 'tx-1');
  });

  it('rejects payment when buyer balance is insufficient and does not advance transaction status', async () => {
    const current = {
      id: 'tx-1', buyerId: 'buyer-1', status: 'PENDING', isEscrowHeld: false,
      reservationExpiresAt: new Date(Date.now() + 60_000), grandTotal: 100000,
    };
    const tx = {
      transaction: { findUnique: vi.fn().mockResolvedValue(current), updateMany: vi.fn() },
      user: { updateMany: vi.fn().mockResolvedValue({ count: 0 }), findUniqueOrThrow: vi.fn() },
      walletLedger: { upsert: vi.fn() },
    };
    const { service } = serviceWithTx(tx);

    await expect(service.pay('tx-1', 'buyer-1')).rejects.toThrow(/saldo tidak cukup/i);
    expect(tx.transaction.updateMany).not.toHaveBeenCalled();
    expect(tx.walletLedger.upsert).not.toHaveBeenCalled();
  });

  it('disables buyer handover code while a dispute is open', async () => {
    const topLevel = {
      transaction: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'tx-1', buyerId: 'buyer-1', sellerId: 'seller-1', fulfillmentMethod: 'CAMPUS_MEETUP', status: 'PAID', isEscrowHeld: true,
          dispute: { id: 'd-1', status: 'OPEN' },
        }),
        update: vi.fn(),
      },
    };
    const { service, prisma } = serviceWithTx({}, topLevel);

    await expect(service.issueHandoverCode('tx-1', 'buyer-1')).rejects.toThrow(/sengketa/i);
    expect(prisma.transaction.update).not.toHaveBeenCalled();
  });

  it('rejects an expired handover code without releasing escrow', async () => {
    const current = {
      id: 'tx-1', buyerId: 'buyer-1', sellerId: 'seller-1', fulfillmentMethod: 'CAMPUS_MEETUP', status: 'PAID', isEscrowHeld: true,
      dispute: null, handoverCodeHash: 'hash', handoverCodeExpiresAt: new Date(Date.now() - 1_000), grandTotal: 100000, sellerReceives: 95000,
    };
    const tx = {
      transaction: { findUnique: vi.fn().mockResolvedValue(current), updateMany: vi.fn() },
      user: { updateMany: vi.fn(), update: vi.fn(), findUniqueOrThrow: vi.fn() },
      walletLedger: { upsert: vi.fn() },
    };
    const { service } = serviceWithTx(tx);

    await expect(service.confirmHandover('tx-1', 'seller-1', '123456')).rejects.toThrow(/kedaluwarsa/i);
    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(tx.transaction.updateMany).not.toHaveBeenCalled();
  });

  it('rejects an incorrect handover code without releasing escrow', async () => {
    const topTransaction = {
      id: 'tx-1', buyerId: 'buyer-1', sellerId: 'seller-1', fulfillmentMethod: 'CAMPUS_MEETUP', status: 'PAID', isEscrowHeld: true,
      dispute: null, handoverCodeHash: 'definitely-not-the-code-hash', handoverCodeExpiresAt: new Date(Date.now() + 60_000), grandTotal: 100000, sellerReceives: 95000,
    };
    const tx = {
      transaction: { findUnique: vi.fn().mockResolvedValue(topTransaction), updateMany: vi.fn() },
      user: { updateMany: vi.fn(), update: vi.fn(), findUniqueOrThrow: vi.fn() },
      walletLedger: { upsert: vi.fn() },
    };
    const { service } = serviceWithTx(tx);

    await expect(service.confirmHandover('tx-1', 'seller-1', '123456')).rejects.toThrow(/tidak benar/i);
    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });

  it('writes buyer escrow-release and seller-payout ledger rows after valid meetup completion', async () => {
    const topPrisma: any = {
      transaction: { findUnique: vi.fn(), update: vi.fn() },
    };
    const tx: any = {
      transaction: { findUnique: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }), findUniqueOrThrow: vi.fn() },
      user: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }), update: vi.fn().mockResolvedValue({}),
        findUniqueOrThrow: vi.fn()
          .mockResolvedValueOnce({ balance: 0, escrow: 0 })
          .mockResolvedValueOnce({ balance: 95000, escrow: 0 }),
      },
      walletLedger: { upsert: vi.fn().mockResolvedValue({}) },
    };
    const { service, prisma, notify } = serviceWithTx(tx, topPrisma);

    prisma.transaction.findUnique.mockResolvedValue({
      id: 'tx-1', buyerId: 'buyer-1', sellerId: 'seller-1', fulfillmentMethod: 'CAMPUS_MEETUP', status: 'PAID', isEscrowHeld: true, dispute: null,
    });
    prisma.transaction.update.mockImplementation(async ({ data }: any) => ({ ...data }));
    const issued = await service.issueHandoverCode('tx-1', 'buyer-1');

    const hashUpdate = prisma.transaction.update.mock.calls[0][0].data.handoverCodeHash;
    tx.transaction.findUnique.mockResolvedValue({
      id: 'tx-1', buyerId: 'buyer-1', sellerId: 'seller-1', fulfillmentMethod: 'CAMPUS_MEETUP', status: 'PAID', isEscrowHeld: true,
      dispute: null, handoverCodeHash: hashUpdate, handoverCodeExpiresAt: issued.expiresAt, grandTotal: 100000, sellerReceives: 95000,
    });
    tx.transaction.findUniqueOrThrow.mockResolvedValue({
      id: 'tx-1', buyerId: 'buyer-1', sellerId: 'seller-1', status: 'COMPLETED', isEscrowHeld: false, sellerReceives: 95000,
      listingTitleSnapshot: 'Keyboard', listing: { title: 'Keyboard', images: '[]' }, dispute: null, review: null,
    });

    await service.confirmHandover('tx-1', 'seller-1', issued.code);

    expect(tx.walletLedger.upsert).toHaveBeenCalledTimes(2);
    expect(tx.walletLedger.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { idempotencyKey: 'HANDOVER:BUYER:tx-1' },
      create: expect.objectContaining({ type: 'ESCROW_RELEASE', escrowDelta: -100000 }),
    }));
    expect(tx.walletLedger.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { idempotencyKey: 'HANDOVER:SELLER:tx-1' },
      create: expect.objectContaining({ type: 'SELLER_PAYOUT', balanceDelta: 95000 }),
    }));
    expect(notify.createMany).toHaveBeenCalled();
  });

  it('top up increases balance and creates an auditable TOPUP ledger record', async () => {
    const tx = {
      user: {
        update: vi.fn().mockResolvedValue({ id: 'buyer-1', name: 'Buyer', balance: 250000, escrow: 0 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ balance: 250000, escrow: 0 }),
      },
      walletLedger: { upsert: vi.fn().mockResolvedValue({}) },
    };
    const { service } = serviceWithTx(tx);

    const result = await service.topup('buyer-1', { amount: 250000 });

    expect(result.balance).toBe(250000);
    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { balance: { increment: 250000 } } }));
    expect(tx.walletLedger.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ type: 'TOPUP', balanceDelta: 250000, escrowDelta: 0 }),
    }));
  });

  it('returns wallet history newest first and normalizes balance values to numbers', async () => {
    const walletLedger = { findMany: vi.fn().mockResolvedValue([{ id: 'ledger-1' }]) };
    const user = { findUnique: vi.fn().mockResolvedValue({ balance: '125000.00', escrow: '50000.00' }) };
    const { service } = serviceWithTx({}, { walletLedger, user });

    await expect(service.getWalletLedger('buyer-1')).resolves.toEqual([{ id: 'ledger-1' }]);
    expect(walletLedger.findMany).toHaveBeenCalledWith({ where: { userId: 'buyer-1' }, orderBy: { createdAt: 'desc' }, take: 100 });
    await expect(service.getBalance('buyer-1')).resolves.toEqual({ balance: 125000, escrow: 50000 });
  });
});
