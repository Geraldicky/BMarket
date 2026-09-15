import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TransactionsService } from './transactions.service';

const serviceTransaction = (overrides: Record<string, unknown> = {}) => ({
  id: 'tx-1',
  buyerId: 'buyer-1',
  sellerId: 'seller-1',
  status: 'PAID',
  isEscrowHeld: true,
  grandTotal: 150000,
  sellerReceives: 142500,
  listingModeSnapshot: 'SERVICE',
  listingTitleSnapshot: 'Desain poster',
  listing: { mode: 'SERVICE', title: 'Desain poster', images: '[]' },
  dispute: null,
  ...overrides,
});

const file = { originalname: 'hasil.pdf', mimetype: 'application/pdf', buffer: Buffer.from('%PDF'), size: 4 };

function setup(tx: Record<string, any> = {}) {
  const notifications = { create: vi.fn().mockResolvedValue({}), createMany: vi.fn().mockResolvedValue({ count: 0 }) };
  const uploads = {
    storePrivateFile: vi.fn().mockResolvedValue('local:transaction-deliverables/tx-1/file.pdf'),
    readPrivateFile: vi.fn().mockResolvedValue(Buffer.from('%PDF')),
    deletePrivateFile: vi.fn().mockResolvedValue(undefined),
  };
  tx.user ??= {};
  tx.user.findUniqueOrThrow ??= vi.fn().mockResolvedValue({ balance: 0, escrow: 0 });
  tx.walletLedger ??= { upsert: vi.fn().mockResolvedValue({}) };
  const prisma = {
    transaction: { findUnique: vi.fn() },
    transactionDeliverable: {
      count: vi.fn().mockResolvedValue(0),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn((operation: (client: unknown) => unknown) => operation(tx)),
  };
  const service = new TransactionsService(prisma as never, notifications as never, uploads as never);
  return { service, prisma, uploads, notifications, tx };
}

describe('TransactionsService — service deliverables', () => {
  beforeEach(() => vi.clearAllMocks());

  it('only lets the seller upload result files', async () => {
    const { service, prisma, uploads } = setup();
    prisma.transaction.findUnique.mockResolvedValue(serviceTransaction());

    await expect(service.addDeliverables('tx-1', 'buyer-1', [file])).rejects.toThrow(/hanya penjual/i);
    expect(uploads.storePrivateFile).not.toHaveBeenCalled();
  });

  it('rejects result files on a non-service transaction', async () => {
    const { service, prisma } = setup();
    prisma.transaction.findUnique.mockResolvedValue(serviceTransaction({ listingModeSnapshot: 'STOCKED', listing: { mode: 'STOCKED', title: 'Buku' } }));

    await expect(service.addDeliverables('tx-1', 'seller-1', [file])).rejects.toThrow(/hanya tersedia untuk transaksi jasa/i);
  });

  it('rejects uploads once the transaction is no longer in progress', async () => {
    const { service, prisma } = setup();
    prisma.transaction.findUnique.mockResolvedValue(serviceTransaction({ status: 'COMPLETED', isEscrowHeld: false }));

    await expect(service.addDeliverables('tx-1', 'seller-1', [file])).rejects.toThrow(/sedang diproses/i);
  });

  it('stores seller files privately and notifies the buyer', async () => {
    const { service, prisma, uploads, notifications } = setup();
    prisma.transaction.findUnique.mockResolvedValue(serviceTransaction());

    await service.addDeliverables('tx-1', 'seller-1', [file]);

    expect(uploads.storePrivateFile).toHaveBeenCalledWith(file, 'transaction-deliverables/tx-1');
    expect(prisma.transactionDeliverable.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ transactionId: 'tx-1', uploaderId: 'seller-1', fileName: 'hasil.pdf', storageKey: 'local:transaction-deliverables/tx-1/file.pdf', size: 4 })],
    });
    expect(notifications.create).toHaveBeenCalledWith('buyer-1', 'TRANSACTION', 'Hasil jasa dikirim', expect.any(String), 'TRANSACTION', 'tx-1');
  });

  it('requires at least one result file before the buyer can accept', async () => {
    const tx = {
      transaction: { findUnique: vi.fn().mockResolvedValue(serviceTransaction()), updateMany: vi.fn() },
      transactionDeliverable: { count: vi.fn().mockResolvedValue(0) },
    };
    const { service } = setup(tx);

    await expect(service.acceptDeliverables('tx-1', 'buyer-1')).rejects.toThrow(/belum mengunggah/i);
    expect(tx.transaction.updateMany).not.toHaveBeenCalled();
  });

  it('completes the transaction and releases escrow when the buyer accepts', async () => {
    const tx: Record<string, any> = {
      transaction: {
        findUnique: vi.fn().mockResolvedValue(serviceTransaction()),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(serviceTransaction({ status: 'COMPLETED', isEscrowHeld: false })),
      },
      transactionDeliverable: { count: vi.fn().mockResolvedValue(2) },
      user: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), update: vi.fn().mockResolvedValue({}) },
    };
    const { service } = setup(tx);

    const result = await service.acceptDeliverables('tx-1', 'buyer-1');

    expect(tx.transaction.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'tx-1', status: 'PAID', isEscrowHeld: true },
      data: expect.objectContaining({ status: 'COMPLETED', isEscrowHeld: false }),
    }));
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 'seller-1' }, data: { balance: { increment: 142500 } } });
    expect(result.status).toBe('COMPLETED');
  });

  it('does not let a seller accept their own result', async () => {
    const tx = { transaction: { findUnique: vi.fn().mockResolvedValue(serviceTransaction()) } };
    const { service } = setup(tx);

    await expect(service.acceptDeliverables('tx-1', 'seller-1')).rejects.toThrow(/hanya pembeli/i);
  });

  it('issues a download link that cannot be tampered with', async () => {
    const { service, prisma, uploads } = setup();
    prisma.transaction.findUnique.mockResolvedValue(serviceTransaction());
    prisma.transactionDeliverable.findFirst.mockResolvedValue({ id: 'file-1', fileName: 'hasil.pdf' });
    prisma.transactionDeliverable.findUnique.mockResolvedValue({ id: 'file-1', fileName: 'hasil.pdf', mimeType: 'application/pdf', storageKey: 'local:a/b.pdf' });

    const link = await service.createDeliverableLink('tx-1', 'file-1', 'buyer-1');
    await expect(service.readDeliverableByToken(link.token)).resolves.toEqual(expect.objectContaining({ buffer: Buffer.from('%PDF') }));
    expect(uploads.readPrivateFile).toHaveBeenCalledWith('local:a/b.pdf');

    const [id, expires, mode, signature] = link.token.split('.');
    await expect(service.readDeliverableByToken(`${id}.${Number(expires) + 60_000}.${mode}.forged`)).rejects.toThrow(/tidak valid/i);
    await expect(service.readDeliverableByToken(`${id}.${expires}.download.${signature}`)).rejects.toThrow(/tidak valid/i);
  });

  it('gives the buyer an inline preview only until the result is accepted', async () => {
    const { service, prisma } = setup();
    prisma.transaction.findUnique.mockResolvedValue(serviceTransaction());
    prisma.transactionDeliverable.findFirst.mockResolvedValue({ id: 'file-1', fileName: 'hasil.pdf' });
    prisma.transactionDeliverable.findUnique.mockResolvedValue({ id: 'file-1', fileName: 'hasil.pdf', mimeType: 'application/pdf', storageKey: 'local:a/b.pdf' });

    const link = await service.createDeliverableLink('tx-1', 'file-1', 'buyer-1');
    expect(link.mode).toBe('preview');
    await expect(service.readDeliverableByToken(link.token)).resolves.toEqual(expect.objectContaining({ mode: 'preview', previewType: 'application/pdf' }));

    prisma.transaction.findUnique.mockResolvedValue(serviceTransaction({ status: 'COMPLETED', isEscrowHeld: false }));
    await expect(service.createDeliverableLink('tx-1', 'file-1', 'buyer-1')).resolves.toEqual(expect.objectContaining({ mode: 'download' }));
  });

  it('lets the seller download their own files at any time', async () => {
    const { service, prisma } = setup();
    prisma.transaction.findUnique.mockResolvedValue(serviceTransaction());
    prisma.transactionDeliverable.findFirst.mockResolvedValue({ id: 'file-1', fileName: 'source.zip' });

    await expect(service.createDeliverableLink('tx-1', 'file-1', 'seller-1')).resolves.toEqual(expect.objectContaining({ mode: 'download' }));
  });

  it('refuses a buyer link for files that cannot be previewed before acceptance', async () => {
    const { service, prisma } = setup();
    prisma.transaction.findUnique.mockResolvedValue(serviceTransaction());
    prisma.transactionDeliverable.findFirst.mockResolvedValue({ id: 'file-1', fileName: 'source.zip' });

    await expect(service.createDeliverableLink('tx-1', 'file-1', 'buyer-1')).rejects.toThrow(/tidak dapat dipratinjau/i);
  });

  it('blocks the buyer from cancelling after result files were uploaded', async () => {
    const tx = {
      transaction: { findUnique: vi.fn().mockResolvedValue({ ...serviceTransaction(), fulfillmentMethod: 'CAMPUS_MEETUP' }), updateMany: vi.fn() },
      transactionDeliverable: { count: vi.fn().mockResolvedValue(1) },
    };
    const { service } = setup(tx);

    await expect(service.updateStatus('tx-1', 'buyer-1', 'CANCELLED', 'Berubah pikiran')).rejects.toThrow(/buka sengketa/i);
    expect(tx.transaction.updateMany).not.toHaveBeenCalled();
  });

  it('refuses download links for someone outside the transaction', async () => {
    const { service, prisma } = setup();
    prisma.transaction.findUnique.mockResolvedValue(serviceTransaction());

    await expect(service.createDeliverableLink('tx-1', 'file-1', 'stranger')).rejects.toThrow(/akses ditolak/i);
  });
});
