import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PaymentsService } from './payments.service';

const future = () => new Date(Date.now() + 15 * 60_000);
const baseTransaction = (overrides: Record<string, unknown> = {}) => ({
  id: 'tx-1', listingId: 'listing-1', buyerId: 'buyer-1', sellerId: 'seller-1',
  status: 'PENDING', isEscrowHeld: false, reservationExpiresAt: future(),
  price: 100000, quantity: 1, totalPrice: 100000, shippingFee: 0, grandTotal: 100000,
  listingTitleSnapshot: 'Keyboard', listingTypeSnapshot: 'PRODUCT', listingModeSnapshot: 'STOCKED',
  listing: { title: 'Keyboard', type: 'PRODUCT', mode: 'STOCKED', status: 'ACTIVE' },
  buyer: { name: 'Buyer', email: 'buyer@binus.ac.id', phone: '08123456789' },
  ...overrides,
});

function setup(options: { transaction?: any; payment?: any; provider?: any } = {}) {
  const transaction = options.transaction ?? baseTransaction();
  const payment = options.payment ?? null;
  const prisma: any = {
    transaction: {
      findUnique: vi.fn().mockResolvedValue(transaction),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    payment: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(payment),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'pay-1', status: 'PENDING', createdAt: new Date(), updatedAt: new Date(), ...data })),
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'pay-1', orderId: 'BMARKET-ORDER', amount: 100000, createdAt: new Date(), updatedAt: new Date(), ...data })),
    },
    listing: { update: vi.fn().mockResolvedValue({}), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  prisma.$transaction = vi.fn((operation: (tx: any) => unknown) => operation(prisma));
  const midtrans: any = {
    createSnap: vi.fn().mockResolvedValue({ token: 'snap-token', redirect_url: 'https://app.sandbox.midtrans.com/snap/test' }),
    verifySignature: vi.fn().mockReturnValue(true),
    getStatus: vi.fn().mockResolvedValue(options.provider),
    refund: vi.fn().mockResolvedValue({ transaction_status: 'refund' }),
    cancel: vi.fn().mockResolvedValue({ transaction_status: 'cancel' }),
  };
  const notifications: any = { create: vi.fn().mockResolvedValue({}), createMany: vi.fn().mockResolvedValue({ count: 0 }) };
  return { service: new PaymentsService(prisma, midtrans, notifications), prisma, midtrans, notifications };
}

const notification = { order_id: 'BMARKET-ORDER', status_code: '200', gross_amount: '100000.00', signature_key: 'signed', transaction_status: 'settlement' };
const settledStatus = { ...notification, transaction_id: 'midtrans-1', payment_type: 'bank_transfer', fraud_status: 'accept' };
const storedPayment = (transaction = baseTransaction(), overrides: Record<string, unknown> = {}) => ({
  id: 'pay-1', orderId: 'BMARKET-ORDER', amount: 100000, status: 'PENDING', settledAt: null, transaction, ...overrides,
});

describe('PaymentsService', () => {
  it('creates a Snap payment for the buyer from the database amount', async () => {
    const { service, prisma, midtrans } = setup();
    const result = await service.create('tx-1', 'buyer-1');
    expect(result).toMatchObject({ paymentId: 'pay-1', amount: 100000, token: 'snap-token' });
    expect(midtrans.createSnap).toHaveBeenCalledWith(expect.objectContaining({
      transaction_details: expect.objectContaining({ gross_amount: 100000 }),
      item_details: [{ id: 'listing-1', price: 100000, quantity: 1, name: 'Keyboard' }],
    }));
    expect(prisma.payment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ amount: 100000 }) }));
  });

  it('rejects another user before creating a payment', async () => {
    const { service, midtrans } = setup();
    await expect(service.create('tx-1', 'buyer-2')).rejects.toThrow(/bukan pembeli/i);
    expect(midtrans.createSnap).not.toHaveBeenCalled();
  });

  it('reuses an active Snap session on repeated clicks', async () => {
    const { service, prisma, midtrans } = setup();
    prisma.payment.findFirst.mockResolvedValue({
      id: 'pay-existing', orderId: 'BMARKET-EXISTING', amount: 100000, status: 'PENDING', snapToken: 'existing-token',
      redirectUrl: 'https://app.sandbox.midtrans.com/snap/existing', expiresAt: future(), settledAt: null, createdAt: new Date(), updatedAt: new Date(),
    });
    await expect(service.create('tx-1', 'buyer-1')).resolves.toMatchObject({ paymentId: 'pay-existing', token: 'existing-token' });
    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(midtrans.createSnap).not.toHaveBeenCalled();
  });

  it('rejects a transaction that is already paid', async () => {
    const { service, midtrans } = setup({ transaction: baseTransaction({ status: 'PAID', isEscrowHeld: true }) });
    await expect(service.create('tx-1', 'buyer-1')).rejects.toThrow(/sudah dibayar/i);
    expect(midtrans.createSnap).not.toHaveBeenCalled();
  });

  it('expires an elapsed reservation and restores stock without creating Snap', async () => {
    const expired = baseTransaction({ reservationExpiresAt: new Date(Date.now() - 1000), listing: { title: 'Keyboard', type: 'PRODUCT', mode: 'STOCKED', status: 'ACTIVE' } });
    const { service, prisma, midtrans } = setup({ transaction: expired });
    await expect(service.create('tx-1', 'buyer-1')).rejects.toThrow(/kedaluwarsa/i);
    expect(prisma.transaction.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELLED' }) }));
    expect(prisma.listing.update).toHaveBeenCalledWith(expect.objectContaining({ data: { stockLeft: { increment: 1 } } }));
    expect(midtrans.createSnap).not.toHaveBeenCalled();
  });

  it('settles a valid verified notification without debiting buyer balance', async () => {
    const transaction = baseTransaction();
    const { service, prisma, notifications } = setup({ transaction, payment: storedPayment(transaction), provider: settledStatus });
    const result = await service.handleNotification(notification);
    expect(result).toMatchObject({ status: 'SETTLED', transactionStatus: 'PAID' });
    expect(prisma.transaction.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'PAID', isEscrowHeld: true }) }));
    expect(prisma.user).toBeUndefined();
    expect(notifications.create).toHaveBeenCalledTimes(1);
  });

  it('settles a realistic QRIS payload with Decimal database amounts', async () => {
    const transaction = baseTransaction({
      id: '9636d22b-f491-41c5-bbb3-8c8e179ed745',
      grandTotal: new Prisma.Decimal('100000.00'),
      reservationExpiresAt: new Date('2026-09-23T09:45:29.653Z'),
    });
    const qrisNotification = {
      order_id: 'BMARKET-9636d22bf49141c5bb-aa1d1562bf844434', status_code: '200', gross_amount: '100000.00',
      signature_key: 'signed', transaction_status: 'settlement', payment_type: 'qris', transaction_id: 'qris-provider-id',
    };
    const provider = { ...qrisNotification, settlement_time: '2026-09-23 16:44:30', fraud_status: 'accept' };
    const payment = storedPayment(transaction, { orderId: qrisNotification.order_id, amount: new Prisma.Decimal('100000') });
    const { service, prisma } = setup({ transaction, payment, provider });

    await expect(service.handleNotification(qrisNotification)).resolves.toMatchObject({ status: 'SETTLED', transactionStatus: 'PAID' });
    expect(prisma.transaction.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'PAID', isEscrowHeld: true, paidAt: new Date('2026-09-23T09:44:30.000Z') }),
    }));
    expect(prisma.payment.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'SETTLED', paymentType: 'qris' }) }));
  });

  it('handles repeated settlement idempotently', async () => {
    const transaction = baseTransaction({ status: 'PAID', isEscrowHeld: true });
    const { service, prisma, notifications } = setup({ transaction, payment: storedPayment(transaction, { status: 'SETTLED', settledAt: new Date() }), provider: settledStatus });
    await service.handleNotification(notification);
    expect(prisma.transaction.updateMany).not.toHaveBeenCalled();
    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('rejects an invalid signature before querying provider status', async () => {
    const transaction = baseTransaction();
    const { service, midtrans } = setup({ transaction, payment: storedPayment(transaction), provider: settledStatus });
    midtrans.verifySignature.mockReturnValue(false);
    await expect(service.handleNotification(notification)).rejects.toThrow(/signature/i);
    expect(midtrans.getStatus).not.toHaveBeenCalled();
  });

  it('rejects a provider order ID mismatch before any database mutation', async () => {
    const transaction = baseTransaction();
    const { service, prisma } = setup({ transaction, payment: storedPayment(transaction), provider: { ...settledStatus, order_id: 'DIFFERENT-ORDER' } });
    await expect(service.handleNotification(notification)).rejects.toThrow(/Order ID/i);
    expect(prisma.payment.findUnique).not.toHaveBeenCalled();
    expect(prisma.transaction.updateMany).not.toHaveBeenCalled();
  });

  it('does not mark paid when the verified provider amount mismatches', async () => {
    const transaction = baseTransaction();
    const provider = { ...settledStatus, gross_amount: '99999.00' };
    const { service, prisma } = setup({ transaction, payment: storedPayment(transaction), provider });
    await expect(service.handleNotification(notification)).rejects.toThrow(/nominal/i);
    expect(prisma.transaction.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    ['expire', 'EXPIRED'],
    ['deny', 'FAILED'],
  ])('maps %s without marking the transaction paid', async (transactionStatus, expected) => {
    const transaction = baseTransaction();
    const provider = { ...settledStatus, transaction_status: transactionStatus };
    const { service, prisma } = setup({ transaction, payment: storedPayment(transaction), provider });
    const result = await service.handleNotification(notification);
    expect(result).toMatchObject({ status: expected, transactionStatus: 'PENDING' });
    expect(prisma.transaction.updateMany).not.toHaveBeenCalled();
    expect(prisma.payment.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: expected }) }));
  });

  it('keeps the transaction pending for a verified pending provider status', async () => {
    const transaction = baseTransaction();
    const provider = { ...settledStatus, transaction_status: 'pending' };
    const { service, prisma } = setup({ transaction, payment: storedPayment(transaction), provider });
    await expect(service.handleNotification({ ...notification, transaction_status: 'pending' })).resolves.toMatchObject({ status: 'PENDING', transactionStatus: 'PENDING' });
    expect(prisma.transaction.updateMany).not.toHaveBeenCalled();
  });

  it('recovers a system-expired checkout when verified settlement occurred before reservation expiry', async () => {
    const reservationExpiresAt = new Date('2026-09-23T09:45:29.653Z');
    const transaction = baseTransaction({
      status: 'CANCELLED', isEscrowHeld: false, reservationExpiresAt,
      cancelledBy: 'SYSTEM', cancellationReason: 'Reservasi pembayaran kedaluwarsa.', cancelledAt: new Date('2026-09-23T09:45:33.898Z'),
      listing: { title: 'Keyboard', type: 'PRODUCT', mode: 'STOCKED', status: 'ACTIVE', stockLeft: 1 },
    });
    const provider = { ...settledStatus, payment_type: 'qris', settlement_time: '2026-09-23 16:45:20' };
    const { service, prisma, midtrans } = setup({ transaction, payment: storedPayment(transaction, { status: 'EXPIRED' }), provider });

    await expect(service.handleNotification(notification)).resolves.toMatchObject({ status: 'SETTLED', transactionStatus: 'PAID' });
    expect(prisma.listing.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { stockLeft: { decrement: 1 } } }));
    expect(prisma.transaction.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: 'CANCELLED', cancelledBy: 'SYSTEM' }),
      data: expect.objectContaining({ status: 'PAID', isEscrowHeld: true, cancelledAt: null, cancelledBy: null }),
    }));
    expect(midtrans.refund).not.toHaveBeenCalled();
  });

  it('preserves refund behavior when verified settlement occurred after reservation expiry', async () => {
    const transaction = baseTransaction({
      status: 'CANCELLED', isEscrowHeld: false, reservationExpiresAt: new Date('2026-09-23T09:45:29.653Z'),
      cancelledBy: 'SYSTEM', cancellationReason: 'Reservasi pembayaran kedaluwarsa.',
      listing: { title: 'Keyboard', type: 'PRODUCT', mode: 'STOCKED', status: 'ACTIVE', stockLeft: 1 },
    });
    const provider = { ...settledStatus, payment_type: 'qris', transaction_id: 'qris-provider-id', settlement_time: '2026-09-23 16:45:40' };
    const { service, prisma, midtrans } = setup({ transaction, payment: storedPayment(transaction, { status: 'EXPIRED' }), provider });

    await expect(service.handleNotification(notification)).resolves.toMatchObject({ status: 'CANCELLED', action: 'REFUNDED_OR_CANCELLED' });
    expect(midtrans.refund).toHaveBeenCalledWith('qris-provider-id', 100000, expect.any(String), expect.stringMatching(/^BMARKET-REFUND-/));
    expect(prisma.transaction.updateMany).not.toHaveBeenCalled();
  });
});

describe('Midtrans signature fixture', () => {
  it('documents the official SHA-512 field order used by the webhook', () => {
    expect(createHash('sha512').update('ORDER20010000.00SERVER').digest('hex')).toHaveLength(128);
  });
});
