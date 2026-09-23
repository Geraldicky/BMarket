import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { Prisma, TransactionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateTransactionDto, TopupDto } from './dto/transaction.dto';
import { canTransition, TransactionActor } from './transaction-policy';
import { UploadsService, type PrivateUploadFile } from '../uploads/uploads.service';
import { listZipEntries, readZipEntry, ZipReadError } from './zip-reader';
import { MidtransService } from '../payments/midtrans/midtrans.service';

// Public fields of a service deliverable; the storage key never leaves the server.
export const deliverableSelect ={ id: true, fileName: true, mimeType: true, size: true, createdAt: true, uploaderId: true } as const;
const DELIVERABLE_LINK_TTL_MS = 5 * 60_000;
const DELIVERABLE_MAX_PER_TRANSACTION = 20;
const DELIVERABLE_TEXT_PREVIEW = /\.(txt|md|csv|js|jsx|ts|tsx|py|ipynb|java|kt|swift|c|cpp|h|cs|go|rb|php|html|css|json|sql|xml|ya?ml)$/i;
const DELIVERABLE_IMAGE_PREVIEW: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
const ARCHIVE_ENTRY_PREVIEW_MAX_BYTES = 2 * 1024 * 1024;
const RESERVATION_CLEANUP_INTERVAL_MS = 60_000;
const HANDOVER_CODE_TTL_MS = 15 * 60_000;

export type DeliverableLinkMode = 'preview' | 'download';

// Content type used to show a deliverable inline, or null when the browser cannot preview it safely.
// Based on the stored file name, never the client-supplied MIME type (HTML/SVG are shown as plain text).
export function deliverablePreviewType(fileName: string): string | null {
  const extension = fileName.toLowerCase().split('.').pop() || '';
  if (extension === 'pdf') return 'application/pdf';
  if (DELIVERABLE_IMAGE_PREVIEW[extension]) return DELIVERABLE_IMAGE_PREVIEW[extension];
  if (DELIVERABLE_TEXT_PREVIEW.test(fileName)) return 'text/plain; charset=utf-8';
  return null;
}

@Injectable()
export class TransactionsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TransactionsService.name);
  private reservationTimer?: NodeJS.Timeout;
  private reservationCleanupRunning = false;

  constructor(private prisma: PrismaService, private notifications: NotificationsService, private uploads: UploadsService, @Optional() private midtrans?: MidtransService) {}

  private isMidtransFunded(transaction: { payments?: { id: string }[] }) {
    return Boolean(transaction.payments?.length);
  }

  private get reservationMinutes(): number {
    const configured = Number(process.env.CHECKOUT_RESERVATION_MINUTES);
    return Number.isInteger(configured) && configured > 0 ? configured : 15;
  }

  onModuleInit() {
    void this.expirePendingReservations().catch(error =>
      this.logger.warn(`Initial reservation cleanup gagal: ${error instanceof Error ? error.message : String(error)}`),
    );
    this.reservationTimer = setInterval(() => {
      void this.expirePendingReservations().catch(error =>
        this.logger.warn(`Reservation cleanup gagal: ${error instanceof Error ? error.message : String(error)}`),
      );
    }, RESERVATION_CLEANUP_INTERVAL_MS);
    this.reservationTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.reservationTimer) clearInterval(this.reservationTimer);
  }

  private reservationExpiry(from = new Date()): Date {
    return new Date(from.getTime() + this.reservationMinutes * 60_000);
  }

  private async serializable<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>, attempt = 0): Promise<T> {
    try {
      return await this.prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 2_000,
        timeout: 5_000,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < 1) {
        await new Promise(resolve => setTimeout(resolve, 25 + Math.floor(Math.random() * 50)));
        return this.serializable(operation, attempt + 1);
      }
      throw error;
    }
  }

  private parseImages(raw: string): string[] {
    try {
      const images = JSON.parse(raw);
      return Array.isArray(images) ? images : [];
    } catch {
      return [];
    }
  }

  private withParsedListing<T extends { listing: { images: string; title?: string; type?: unknown; condition?: unknown } }>(transaction: T) {
    const snapshot = transaction as T & {
      handoverCodeHash?: string | null;
      listingTitleSnapshot?: string | null;
      listingImageSnapshot?: string | null;
      listingTypeSnapshot?: unknown | null;
      listingModeSnapshot?: unknown | null;
      listingConditionSnapshot?: unknown | null;
    };
    const safeTransaction = { ...snapshot };
    delete safeTransaction.handoverCodeHash;
    const parsedImages = this.parseImages(transaction.listing.images);
    return {
      ...safeTransaction,
      listing: {
        ...transaction.listing,
        ...(snapshot.listingTitleSnapshot ? { title: snapshot.listingTitleSnapshot } : {}),
        ...(snapshot.listingTypeSnapshot ? { type: snapshot.listingTypeSnapshot } : {}),
        ...(snapshot.listingModeSnapshot ? { mode: snapshot.listingModeSnapshot } : {}),
        ...(snapshot.listingTypeSnapshot ? { condition: snapshot.listingConditionSnapshot ?? null } : {}),
        images: snapshot.listingImageSnapshot ? [snapshot.listingImageSnapshot] : parsedImages,
      },
    };
  }

  private async expirePendingReservation(id: string): Promise<boolean> {
    // Most calls are no-ops. Check without reserving an interactive-transaction
    // connection, then use a short atomic transaction only for an elapsed row.
    const candidate = await this.prisma.transaction.findUnique({
      where: { id },
      select: { status: true, reservationExpiresAt: true },
    });
    if (!candidate || candidate.status !== 'PENDING' || !candidate.reservationExpiresAt || candidate.reservationExpiresAt.getTime() > Date.now()) return false;

    return this.prisma.$transaction(async tx => {
      const current = await tx.transaction.findUnique({
        where: { id },
        include: { listing: { select: { type: true, status: true, mode: true, preorderStatus: true, preorderDeadline: true, stockLeft: true } }, dispute: true },
      });
      if (!current || current.status !== 'PENDING' || !current.reservationExpiresAt) return false;
      if (current.reservationExpiresAt.getTime() > Date.now()) return false;

      const expiredAt = new Date();
      const changed = await tx.transaction.updateMany({
        where: { id, status: 'PENDING', reservationExpiresAt: { lte: expiredAt } },
        data: {
          status: 'CANCELLED',
          cancelledAt: expiredAt,
          cancelledBy: 'SYSTEM',
          cancellationReason: 'Reservasi pembayaran kedaluwarsa.',
          isEscrowHeld: false,
        },
      });
      if (!changed.count) return false;

      if ((tx as any).payment) {
        await tx.payment.updateMany({ where: { transactionId: id, status: 'PENDING' }, data: { status: 'EXPIRED' } });
      }

      const itemType = current.listingTypeSnapshot ?? current.listing.type;
      if (itemType === 'PRODUCT') {
        await tx.listing.update({
          where: { id: current.listingId },
          data: {
            stockLeft: { increment: current.quantity },
            ...(current.listing.mode === 'ONE_OFF' && current.listing.status === 'SOLD' ? { status: 'ACTIVE' as const } : {}),
          },
        });
      }
      return true;
    }, { maxWait: 2_000, timeout: 5_000 });
  }

  async expirePendingReservations(limit = 100): Promise<number> {
    if (this.reservationCleanupRunning) return 0;
    this.reservationCleanupRunning = true;
    try {
      const expired = await this.prisma.transaction.findMany({
        where: { status: 'PENDING', reservationExpiresAt: { lte: new Date() } },
        orderBy: { reservationExpiresAt: 'asc' },
        take: Math.max(1, Math.min(limit, 100)),
        select: { id: true },
      });
      let count = 0;
      for (const { id } of expired) {
        if (await this.expirePendingReservation(id)) count += 1;
      }
      if (count) this.logger.log(`${count} checkout reservation kedaluwarsa dikembalikan ke stok.`);
      return count;
    } finally {
      this.reservationCleanupRunning = false;
    }
  }

  private handoverHash(transactionId: string, code: string) {
    const secret = process.env.OTP_HASH_SECRET || process.env.JWT_SECRET || 'bmarket-development-secret';
    return createHmac('sha256', secret).update(`${transactionId}:${code}`).digest('hex');
  }

  async findByUserId(userId: string, role?: 'buyer' | 'seller') {
    const where: Prisma.TransactionWhereInput = role === 'buyer'
      ? { buyerId: userId }
      : role === 'seller'
        ? { sellerId: userId }
        : { OR: [{ buyerId: userId }, { sellerId: userId }] };
    const transactions = await this.prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        listing: true,
        buyer: { select: { id: true, name: true, avatarUrl: true } },
        seller: { select: { id: true, name: true, avatarUrl: true } },
        review: true,
        dispute: true,
      },
    });
    return transactions.map(transaction => this.withParsedListing(transaction));
  }

  async findById(id: string, userId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        listing: true,
        buyer: { select: { id: true, name: true, email: true, avatarUrl: true, phone: true } },
        seller: { select: { id: true, name: true, email: true, avatarUrl: true, phone: true } },
        review: true,
        dispute: true,
        deliverables: { orderBy: { createdAt: 'asc' }, select: deliverableSelect },
      },
    });
    if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan.');
    if (transaction.buyerId !== userId && transaction.sellerId !== userId) throw new ForbiddenException('Akses ditolak.');
    return this.withParsedListing(transaction);
  }

  private async ledger(tx: any, input: { userId: string; transactionId?: string; type: 'TOPUP' | 'PURCHASE_HOLD' | 'REFUND' | 'ESCROW_RELEASE' | 'SELLER_PAYOUT'; balanceDelta?: number | string | object; escrowDelta?: number | string | object; description?: string; idempotencyKey: string }) {
    const account = await tx.user.findUniqueOrThrow({ where: { id: input.userId }, select: { balance: true, escrow: true } });
    await tx.walletLedger.upsert({ where: { idempotencyKey: input.idempotencyKey }, update: {}, create: {
      userId: input.userId, transactionId: input.transactionId ?? null, type: input.type,
      balanceDelta: input.balanceDelta ?? 0, escrowDelta: input.escrowDelta ?? 0,
      balanceAfter: account.balance, escrowAfter: account.escrow, description: input.description ?? null, idempotencyKey: input.idempotencyKey,
    } });
  }

  async create(buyerId: string, dto: CreateTransactionDto) {
    const result = await this.serializable(async tx => {
      const listing = await tx.listing.findUnique({ where: { id: dto.listingId } });
      if (!listing || listing.status !== 'ACTIVE') throw new BadRequestException('Listing tidak tersedia.');
      if (listing.sellerId === buyerId) throw new BadRequestException('Anda tidak dapat membeli listing sendiri.');
      if (listing.mode === 'STOCKED' && listing.stockLeft === 0) throw new BadRequestException('Stok produk sedang habis.');
      if (listing.mode === 'PREORDER') {
        if (listing.preorderStatus !== 'OPEN' || !listing.preorderDeadline || listing.preorderDeadline.getTime() <= Date.now()) {
          throw new BadRequestException('Pre-order sudah ditutup.');
        }
        if ((listing.stockLeft ?? 0) < 1) throw new BadRequestException('Kuota pre-order sudah penuh.');
      }
      // Jasa tidak memiliki metode penyerahan. Transaksinya tetap dicatat sebagai CAMPUS_MEETUP karena
      // kolom tersebut wajib dan penyelesaiannya memakai kode serah-terima yang diatur lewat chat.
      if (dto.fulfillmentMethod && dto.fulfillmentMethod !== 'CAMPUS_MEETUP') {
        throw new BadRequestException('BMarket hanya mendukung Meetup untuk transaksi baru.');
      }
      // Semua transaksi baru memakai Meetup. Waktu dan lokasi dikoordinasikan lewat chat.
      const fulfillmentMethod = 'CAMPUS_MEETUP' as const;

      const duplicate = await tx.transaction.findFirst({
        where: {
          listingId: listing.id,
          buyerId,
          status: { in: ['PENDING', 'PAID', 'CONFIRMED'] },
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new BadRequestException('Kamu masih memiliki transaksi aktif untuk listing ini. Buka menu Transaksi untuk melanjutkan.');
      }

      const quantity = dto.quantity ?? 1;
      if (!Number.isInteger(quantity) || quantity < 1) throw new BadRequestException('Jumlah pembelian minimal 1.');
      if (listing.mode === 'ONE_OFF' && quantity !== 1) throw new BadRequestException('Barang satuan hanya dapat dibeli 1 unit.');
      if (listing.mode === 'PREORDER' && listing.preorderMaxPerBuyer && quantity > listing.preorderMaxPerBuyer) {
        throw new BadRequestException(`Maksimal ${listing.preorderMaxPerBuyer} unit per buyer untuk pre-order ini.`);
      }
      if (listing.type === 'PRODUCT' && listing.stockLeft !== null) {
        const reserved = await tx.listing.updateMany({
          where: { id: listing.id, status: 'ACTIVE', stockLeft: { gte: quantity } },
          data: { stockLeft: { decrement: quantity } },
        });
        if (!reserved.count) throw new BadRequestException(listing.mode === 'PREORDER' ? 'Kuota pre-order tidak cukup.' : 'Stok tidak cukup. Muat ulang listing dan coba lagi.');
        const remaining = listing.stockLeft - quantity;
        if (remaining === 0 && listing.mode === 'ONE_OFF') {
          await tx.listing.update({ where: { id: listing.id }, data: { status: 'SOLD' } });
        }
      }

      const setting = await tx.commissionSetting.findFirst({ orderBy: { createdAt: 'desc' } });
      const price = Number(listing.price);
      const totalPrice = price * quantity;
      const shippingFee = 0;
      const grandTotal = totalPrice + shippingFee;
      const commissionRate = Number(setting?.rate ?? 5);
      const commissionAmt = totalPrice * commissionRate / 100;
      return tx.transaction.create({
        data: {
          listingId: listing.id,
          buyerId,
          sellerId: listing.sellerId,
          reservationExpiresAt: this.reservationExpiry(),
          listingTitleSnapshot: listing.title,
          listingImageSnapshot: this.parseImages(listing.images)[0] ?? null,
          listingTypeSnapshot: listing.type,
          listingModeSnapshot: listing.mode,
          listingConditionSnapshot: listing.condition,
          price,
          quantity,
          totalPrice,
          fulfillmentMethod,
          meetupCampus: null,
          meetupLocation: null,
          meetupSchedule: null,
          courierProvider: null,
          deliveryAddress: null,
          recipientPhone: null,
          shippingFee,
          grandTotal,
          commissionRate,
          commissionAmt,
          sellerReceives: totalPrice - commissionAmt,
          note: dto.note?.trim() || null,
        },
        include: {
          listing: true,
          buyer: { select: { id: true, name: true, avatarUrl: true } },
          seller: { select: { id: true, name: true, avatarUrl: true } },
        },
      });
    });
    return this.withParsedListing(result);
  }

  async pay(id: string, buyerId: string) {
    void id; void buyerId;
    throw new BadRequestException('Pembayaran saldo BMarket sudah dinonaktifkan. Gunakan Midtrans Snap.');
  }

  async updateStatus(id: string, userId: string, status: TransactionStatus, cancellationReason?: string) {
    const result = await this.serializable(async tx => {
      const current = await tx.transaction.findUnique({
        where: { id },
        include: { listing: { select: { type: true, status: true, mode: true, preorderStatus: true, preorderDeadline: true, stockLeft: true } }, dispute: true, payments: { where: { provider: 'MIDTRANS', status: 'SETTLED' }, select: { id: true, orderId: true, amount: true, providerStatus: true }, take: 1 } },
      });
      if (!current) throw new NotFoundException('Transaksi tidak ditemukan.');
      const escrowTotal = current.grandTotal || current.totalPrice;

      const actor: TransactionActor | null = current.buyerId === userId
        ? 'buyer'
        : current.sellerId === userId
          ? 'seller'
          : null;
      if (!actor) throw new ForbiddenException('Akses ditolak.');
      if (current.dispute && ['OPEN', 'IN_REVIEW'].includes(current.dispute.status)) {
        throw new BadRequestException('Transaksi sedang dalam sengketa. Status dikunci sampai admin memberi keputusan.');
      }
      if (current.fulfillmentMethod === 'CAMPUS_MEETUP' && status === 'CONFIRMED') {
        throw new BadRequestException('Meetup tidak perlu dikonfirmasi. Atur waktu dan lokasi melalui chat, lalu selesaikan menggunakan kode serah-terima buyer.');
      }
      if (current.listing.mode === 'PREORDER' && status === 'CONFIRMED' && !['READY', 'COMPLETED'].includes(current.listing.preorderStatus || '')) {
        throw new BadRequestException('Pre-order belum siap. Tandai batch pre-order sebagai siap sebelum memproses pengiriman.');
      }
      if (!canTransition(current.status, status, actor)) {
        throw new ForbiddenException(`Anda tidak dapat mengubah status ${current.status} menjadi ${status}.`);
      }

      // Once the seller has delivered service files, the buyer could keep the work and still get a refund
      // by cancelling. Disagreements about the result go through a dispute instead.
      if (status === 'CANCELLED' && actor === 'buyer' && (current.listingModeSnapshot ?? current.listing.mode) === 'SERVICE') {
        const delivered = await tx.transactionDeliverable.count({ where: { transactionId: id } });
        if (delivered) {
          throw new BadRequestException('Penjual sudah mengunggah hasil jasa, jadi transaksi tidak dapat dibatalkan sepihak. Jika hasil tidak sesuai, buka sengketa agar admin meninjau.');
        }
      }

      const reason = cancellationReason?.trim();
      if (status === 'CANCELLED' && (!reason || reason.length < 3)) {
        throw new BadRequestException('Pilih atau tulis alasan pembatalan.');
      }
      if (status === 'CANCELLED' && current.isEscrowHeld && this.isMidtransFunded(current)) {
        if (!this.midtrans) throw new BadRequestException('Layanan refund Midtrans tidak tersedia.');
        const payment = current.payments[0];
        if (payment.providerStatus === 'capture') await this.midtrans.cancel(payment.orderId);
        else await this.midtrans.refund(payment.orderId, Number(payment.amount), reason!, `BMARKET-REFUND-${id.replace(/-/g, '').slice(0, 24)}`);
      }

      const milestone = status === 'CONFIRMED'
        ? { confirmedAt: new Date() }
        : status === 'COMPLETED'
          ? { completedAt: new Date(), isEscrowHeld: false }
          : status === 'CANCELLED'
            ? {
                cancelledAt: new Date(),
                cancelledBy: actor.toUpperCase(),
                cancellationReason: reason,
                isEscrowHeld: false,
              }
            : {};
      const changed = await tx.transaction.updateMany({
        where: { id, status: current.status },
        data: { status, ...milestone },
      });
      if (!changed.count) throw new BadRequestException('Status transaksi sudah berubah. Muat ulang halaman.');

      if (status === 'COMPLETED') {
        if (current.listing.mode === 'PREORDER' && !['READY', 'COMPLETED'].includes(current.listing.preorderStatus || '')) {
          throw new BadRequestException('Pre-order belum ditandai siap oleh seller.');
        }
        if (current.fulfillmentMethod === 'CAMPUS_MEETUP') {
          throw new BadRequestException('Meetup harus diselesaikan menggunakan kode serah-terima buyer.');
        }
        if (!current.isEscrowHeld) throw new BadRequestException('Dana escrow tidak ditemukan.');
        if (!this.isMidtransFunded(current)) {
          const released = await tx.user.updateMany({
            where: { id: current.buyerId, escrow: { gte: escrowTotal } },
            data: { escrow: { decrement: escrowTotal } },
          });
          if (!released.count) throw new BadRequestException('Saldo escrow tidak konsisten.');
          await this.ledger(tx, { userId: current.buyerId, transactionId: id, type: 'ESCROW_RELEASE', escrowDelta: Number(escrowTotal) * -1, description: 'Escrow dilepas setelah transaksi selesai.', idempotencyKey: `COMPLETE:BUYER:${id}` });
        }
        await tx.user.update({
          where: { id: current.sellerId },
          data: { balance: { increment: current.sellerReceives } },
        });
        await this.ledger(tx, { userId: current.sellerId, transactionId: id, type: 'SELLER_PAYOUT', balanceDelta: Number(current.sellerReceives), description: 'Pendapatan seller setelah biaya layanan.', idempotencyKey: `COMPLETE:SELLER:${id}` });
      }

      if (status === 'CANCELLED') {
        if ((tx as any).payment) {
          await tx.payment.updateMany({ where: { transactionId: id, status: 'PENDING' }, data: { status: 'CANCELLED' } });
        }
        if (current.isEscrowHeld && !this.isMidtransFunded(current)) {
          const refunded = await tx.user.updateMany({
            where: { id: current.buyerId, escrow: { gte: escrowTotal } },
            data: { balance: { increment: escrowTotal }, escrow: { decrement: escrowTotal } },
          });
          if (!refunded.count) throw new BadRequestException('Saldo escrow tidak konsisten.');
          await this.ledger(tx, { userId: current.buyerId, transactionId: id, type: 'REFUND', balanceDelta: Number(escrowTotal), escrowDelta: Number(escrowTotal) * -1, description: 'Refund pembatalan transaksi.', idempotencyKey: `CANCEL:REFUND:${id}` });
        }
        if (current.isEscrowHeld && this.isMidtransFunded(current)) {
          await tx.payment.updateMany({ where: { transactionId: id, provider: 'MIDTRANS', status: 'SETTLED' }, data: { status: 'CANCELLED', refundRequestedAt: new Date() } });
        }
        const itemType = current.listingTypeSnapshot ?? current.listing.type;
        if (itemType === 'PRODUCT') {
          await tx.listing.update({
            where: { id: current.listingId },
            data: {
              stockLeft: { increment: current.quantity },
              ...(current.listing.mode === 'ONE_OFF' && current.listing.status === 'SOLD' ? { status: 'ACTIVE' as const } : {}),
            },
          });
        }
      }

      return tx.transaction.findUniqueOrThrow({
        where: { id },
        include: {
          listing: true,
          buyer: { select: { id: true, name: true, email: true, avatarUrl: true, phone: true } },
          seller: { select: { id: true, name: true, email: true, avatarUrl: true, phone: true } },
          review: true,
          dispute: true,
        },
      });
    });
    const recipient = userId === result.buyerId ? result.sellerId : result.buyerId;
    await this.notifications.create(recipient, 'TRANSACTION', result.status === 'CANCELLED' ? 'Transaksi dibatalkan' : result.status === 'CONFIRMED' ? 'Pesanan sedang diproses' : 'Transaksi selesai', `${result.listingTitleSnapshot || result.listing.title} · ${result.status}`, 'TRANSACTION', result.id).catch(() => undefined);
    return this.withParsedListing(result);
  }

  async issueHandoverCode(id: string, buyerId: string) {
    const transaction = await this.prisma.transaction.findUnique({ where: { id }, include: { dispute: true, listing: { select: { mode: true, preorderStatus: true } } } });
    if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan.');
    if (transaction.buyerId !== buyerId) throw new ForbiddenException('Hanya buyer yang dapat membuat kode serah-terima.');
    if (transaction.dispute && ['OPEN','IN_REVIEW'].includes(transaction.dispute.status)) throw new BadRequestException('Kode serah-terima dinonaktifkan selama sengketa berlangsung.');
    if (transaction.listing.mode === 'PREORDER' && !['READY', 'COMPLETED'].includes(transaction.listing.preorderStatus || '')) {
      throw new BadRequestException('Kode serah-terima baru tersedia setelah seller menandai pre-order siap diambil.');
    }
    if ((transaction.listingModeSnapshot ?? transaction.listing.mode) === 'SERVICE') {
      throw new BadRequestException('Transaksi jasa diselesaikan dengan menerima file hasil jasa, bukan kode serah-terima.');
    }
    if (transaction.fulfillmentMethod !== 'CAMPUS_MEETUP' || !['PAID', 'CONFIRMED'].includes(transaction.status)) {
      throw new BadRequestException('Kode hanya tersedia untuk meetup yang sudah dibayar dan dananya berada di escrow.');
    }
    if (!transaction.isEscrowHeld) throw new BadRequestException('Dana escrow tidak ditemukan.');
    const code = randomInt(100000, 1_000_000).toString();
    const expiresAt = new Date(Date.now() + HANDOVER_CODE_TTL_MS);
    await this.prisma.transaction.update({
      where: { id },
      data: { handoverCodeHash: this.handoverHash(id, code), handoverCodeExpiresAt: expiresAt },
    });
    return { code, expiresAt, expiresInSeconds: 900 };
  }

  async confirmHandover(id: string, sellerId: string, code: string) {
    const result = await this.serializable(async tx => {
      const current = await tx.transaction.findUnique({ where: { id }, include: { dispute: true, listing: { select: { mode: true, preorderStatus: true } }, payments: { where: { provider: 'MIDTRANS', status: 'SETTLED' }, select: { id: true }, take: 1 } } });
      if (!current) throw new NotFoundException('Transaksi tidak ditemukan.');
      if (current.sellerId !== sellerId) throw new ForbiddenException('Hanya seller yang dapat mengonfirmasi kode serah-terima.');
      if (current.dispute && ['OPEN','IN_REVIEW'].includes(current.dispute.status)) throw new BadRequestException('Transaksi sedang dalam sengketa. Penyelesaian meetup dikunci.');
      if (current.listing.mode === 'PREORDER' && !['READY', 'COMPLETED'].includes(current.listing.preorderStatus || '')) {
        throw new BadRequestException('Pre-order belum ditandai siap diambil oleh seller.');
      }
      if ((current.listingModeSnapshot ?? current.listing.mode) === 'SERVICE') {
        throw new BadRequestException('Transaksi jasa diselesaikan dengan menerima file hasil jasa, bukan kode serah-terima.');
      }
      if (current.fulfillmentMethod !== 'CAMPUS_MEETUP' || !['PAID', 'CONFIRMED'].includes(current.status)) {
        throw new BadRequestException('Transaksi ini tidak sedang menunggu serah-terima meetup.');
      }
      if (!current.handoverCodeHash || !current.handoverCodeExpiresAt) {
        throw new BadRequestException('Buyer belum membuat kode serah-terima.');
      }
      if (current.handoverCodeExpiresAt.getTime() < Date.now()) {
        throw new BadRequestException('Kode sudah kedaluwarsa. Minta buyer membuat kode baru.');
      }
      if (this.handoverHash(id, code) !== current.handoverCodeHash) {
        throw new BadRequestException('Kode serah-terima tidak benar.');
      }
      if (!current.isEscrowHeld) throw new BadRequestException('Dana escrow tidak ditemukan.');

      const completedAt = new Date();
      const changed = await tx.transaction.updateMany({
        where: { id, status: current.status, handoverCodeHash: current.handoverCodeHash },
        data: {
          status: 'COMPLETED', completedAt, handoverVerifiedAt: completedAt,
          isEscrowHeld: false, handoverCodeHash: null, handoverCodeExpiresAt: null,
        },
      });
      if (!changed.count) throw new BadRequestException('Transaksi sudah diproses oleh permintaan lain.');
      if (!this.isMidtransFunded(current)) {
        const released = await tx.user.updateMany({
          where: { id: current.buyerId, escrow: { gte: current.grandTotal } },
          data: { escrow: { decrement: current.grandTotal } },
        });
        if (!released.count) throw new BadRequestException('Saldo escrow tidak konsisten.');
        await this.ledger(tx, { userId: current.buyerId, transactionId: id, type: 'ESCROW_RELEASE', escrowDelta: Number(current.grandTotal) * -1, description: 'Escrow dilepas setelah kode serah-terima valid.', idempotencyKey: `HANDOVER:BUYER:${id}` });
      }
      await tx.user.update({ where: { id: current.sellerId }, data: { balance: { increment: current.sellerReceives } } });
      await this.ledger(tx, { userId: current.sellerId, transactionId: id, type: 'SELLER_PAYOUT', balanceDelta: Number(current.sellerReceives), description: 'Pendapatan seller setelah meetup selesai.', idempotencyKey: `HANDOVER:SELLER:${id}` });
      return tx.transaction.findUniqueOrThrow({
        where: { id },
        include: {
          listing: true,
          buyer: { select: { id: true, name: true, email: true, avatarUrl: true, phone: true } },
          seller: { select: { id: true, name: true, email: true, avatarUrl: true, phone: true } },
          review: true,
          dispute: true,
        },
      });
    });
    await this.notifications.createMany([
      { userId: result.buyerId, type: 'TRANSACTION', title: 'Transaksi selesai', body: `${result.listingTitleSnapshot || result.listing.title} berhasil diselesaikan.`, entityType: 'TRANSACTION', entityId: result.id },
      { userId: result.sellerId, type: 'TRANSACTION', title: 'Dana seller diterima', body: `Pendapatan ${Number(result.sellerReceives).toLocaleString('id-ID')} telah masuk ke saldo BMarket.`, entityType: 'TRANSACTION', entityId: result.id },
    ]).catch(() => undefined);
    return this.withParsedListing(result);
  }

  // ---------------------------------------------------------------------------
  // Service deliverables: the seller uploads result files while the transaction is in progress,
  // the buyer downloads them and accepts the result, which completes the transaction.
  // ---------------------------------------------------------------------------

  private deliverableLinkSecret() {
    return process.env.OTP_HASH_SECRET || process.env.JWT_SECRET || 'bmarket-development-secret';
  }

  private deliverableSignature(deliverableId: string, expires: number, mode: DeliverableLinkMode) {
    return createHmac('sha256', this.deliverableLinkSecret()).update(`deliverable:${deliverableId}:${expires}:${mode}`).digest('base64url');
  }

  private deliverableFileName(original: string) {
    let name = original || 'file';
    // Multer exposes multipart filenames as latin1; recover UTF-8 names when possible.
    const decoded = Buffer.from(name, 'latin1').toString('utf8');
    if (!decoded.includes('�')) name = decoded;
    name = (name.split(/[\\/]/).pop() || 'file').replace(/[ -"]/g, '').trim();
    return (name || 'file').slice(-180);
  }

  private async serviceTransactionFor(id: string, userId: string) {
    const transaction = await this.prisma.transaction.findUnique({ where: { id }, include: { listing: { select: { mode: true, title: true } }, dispute: true } });
    if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan.');
    if (transaction.buyerId !== userId && transaction.sellerId !== userId) throw new ForbiddenException('Akses ditolak.');
    if ((transaction.listingModeSnapshot ?? transaction.listing.mode) !== 'SERVICE') {
      throw new BadRequestException('Hasil jasa hanya tersedia untuk transaksi jasa.');
    }
    return transaction;
  }

  private assertSellerCanManageDeliverables(transaction: Awaited<ReturnType<TransactionsService['serviceTransactionFor']>>, sellerId: string) {
    if (transaction.sellerId !== sellerId) throw new ForbiddenException('Hanya penjual yang dapat mengelola file hasil jasa.');
    if (transaction.dispute && ['OPEN', 'IN_REVIEW'].includes(transaction.dispute.status)) {
      throw new BadRequestException('File hasil jasa dikunci selama sengketa berlangsung.');
    }
    if (!['PAID', 'CONFIRMED'].includes(transaction.status) || !transaction.isEscrowHeld) {
      throw new BadRequestException('File hasil jasa hanya dapat diubah saat transaksi sedang diproses.');
    }
  }

  async listDeliverables(id: string, userId: string) {
    await this.serviceTransactionFor(id, userId);
    return this.prisma.transactionDeliverable.findMany({ where: { transactionId: id }, orderBy: { createdAt: 'asc' }, select: deliverableSelect });
  }

  async addDeliverables(id: string, sellerId: string, files: PrivateUploadFile[]) {
    const transaction = await this.serviceTransactionFor(id, sellerId);
    this.assertSellerCanManageDeliverables(transaction, sellerId);
    const existing = await this.prisma.transactionDeliverable.count({ where: { transactionId: id } });
    if (existing + files.length > DELIVERABLE_MAX_PER_TRANSACTION) {
      throw new BadRequestException(`Maksimal ${DELIVERABLE_MAX_PER_TRANSACTION} file hasil jasa per transaksi.`);
    }

    const stored: { file: PrivateUploadFile; storageKey: string }[] = [];
    try {
      for (const file of files) {
        stored.push({ file, storageKey: await this.uploads.storePrivateFile(file, `transaction-deliverables/${id}`) });
      }
      await this.prisma.transactionDeliverable.createMany({
        data: stored.map(({ file, storageKey }) => ({
          transactionId: id,
          uploaderId: sellerId,
          fileName: this.deliverableFileName(file.originalname),
          mimeType: file.mimetype || 'application/octet-stream',
          size: file.size ?? file.buffer.length,
          storageKey,
        })),
      });
    } catch (error) {
      await Promise.all(stored.map(item => this.uploads.deletePrivateFile(item.storageKey).catch(() => undefined)));
      throw error;
    }

    const title = transaction.listingTitleSnapshot || transaction.listing.title;
    await this.notifications.create(transaction.buyerId, 'TRANSACTION', 'Hasil jasa dikirim', `${title}: ${files.length} file hasil jasa siap diperiksa.`, 'TRANSACTION', id).catch(() => undefined);
    return this.listDeliverables(id, sellerId);
  }

  async removeDeliverable(id: string, deliverableId: string, sellerId: string) {
    const transaction = await this.serviceTransactionFor(id, sellerId);
    this.assertSellerCanManageDeliverables(transaction, sellerId);
    const deliverable = await this.prisma.transactionDeliverable.findFirst({ where: { id: deliverableId, transactionId: id } });
    if (!deliverable) throw new NotFoundException('File hasil jasa tidak ditemukan.');
    await this.prisma.transactionDeliverable.delete({ where: { id: deliverable.id } });
    await this.uploads.deletePrivateFile(deliverable.storageKey).catch(() => undefined);
    return this.listDeliverables(id, sellerId);
  }

  // The seller can always download. The buyer only gets an inline preview until the result is accepted,
  // so the original file is not handed over before the escrow is released.
  async createDeliverableLink(id: string, deliverableId: string, userId: string) {
    const transaction = await this.serviceTransactionFor(id, userId);
    const deliverable = await this.prisma.transactionDeliverable.findFirst({ where: { id: deliverableId, transactionId: id }, select: { id: true, fileName: true } });
    if (!deliverable) throw new NotFoundException('File hasil jasa tidak ditemukan.');
    const mode: DeliverableLinkMode = transaction.sellerId === userId || transaction.status === 'COMPLETED' ? 'download' : 'preview';
    if (mode === 'preview' && !deliverablePreviewType(deliverable.fileName)) {
      throw new BadRequestException('File ini tidak dapat dipratinjau. File asli dapat diunduh setelah kamu menerima hasil jasa.');
    }
    return this.signDeliverableLink(deliverable, mode);
  }

  private signDeliverableLink(deliverable: { id: string; fileName: string }, mode: DeliverableLinkMode) {
    const expires = Date.now() + DELIVERABLE_LINK_TTL_MS;
    return {
      token: `${deliverable.id}.${expires}.${mode}.${this.deliverableSignature(deliverable.id, expires, mode)}`,
      expiresAt: new Date(expires).toISOString(),
      fileName: deliverable.fileName,
      mode,
    };
  }

  // Admin dispute review: any deliverable can be previewed or downloaded, whatever the transaction status.
  async createAdminDeliverableLink(deliverableId: string, mode: DeliverableLinkMode) {
    const deliverable = await this.prisma.transactionDeliverable.findUnique({ where: { id: deliverableId }, select: { id: true, fileName: true } });
    if (!deliverable) throw new NotFoundException('File hasil jasa tidak ditemukan.');
    if (mode === 'preview' && !deliverablePreviewType(deliverable.fileName)) {
      throw new BadRequestException('File ini tidak dapat dipratinjau di browser. Unduh file atau lihat isi ZIP.');
    }
    return this.signDeliverableLink(deliverable, mode);
  }

  private async readZipDeliverable(deliverableId: string) {
    const deliverable = await this.prisma.transactionDeliverable.findUnique({ where: { id: deliverableId } });
    if (!deliverable) throw new NotFoundException('File hasil jasa tidak ditemukan.');
    if (!/\.zip$/i.test(deliverable.fileName)) throw new BadRequestException('Isi arsip hanya dapat dilihat untuk file ZIP.');
    return { deliverable, buffer: await this.uploads.readPrivateFile(deliverable.storageKey) };
  }

  // PDFs inside an archive are not previewed inline; the admin downloads the ZIP for those.
  private archiveEntryPreviewType(path: string) {
    const type = deliverablePreviewType(path);
    return type && type !== 'application/pdf' ? type : null;
  }

  async listDeliverableArchive(deliverableId: string) {
    const { deliverable, buffer } = await this.readZipDeliverable(deliverableId);
    try {
      const { entries, truncated } = listZipEntries(buffer);
      return {
        fileName: deliverable.fileName,
        truncated,
        entries: entries.map(entry => ({
          path: entry.path,
          size: entry.size,
          compressedSize: entry.compressedSize,
          isDirectory: entry.isDirectory,
          previewable: !entry.isDirectory && !entry.encrypted && entry.size <= ARCHIVE_ENTRY_PREVIEW_MAX_BYTES && Boolean(this.archiveEntryPreviewType(entry.path)),
        })),
      };
    } catch (error) {
      throw error instanceof ZipReadError ? new BadRequestException(error.message) : error;
    }
  }

  async readDeliverableArchiveEntry(deliverableId: string, path: string) {
    const { buffer } = await this.readZipDeliverable(deliverableId);
    try {
      const entry = listZipEntries(buffer, Number.MAX_SAFE_INTEGER).entries.find(item => item.path === path);
      if (!entry) throw new NotFoundException('File tidak ditemukan di dalam ZIP.');
      const mimeType = this.archiveEntryPreviewType(entry.path);
      if (!mimeType) throw new BadRequestException('Jenis file ini tidak dapat dipratinjau. Unduh ZIP untuk memeriksanya.');
      const content = readZipEntry(buffer, entry, ARCHIVE_ENTRY_PREVIEW_MAX_BYTES);
      const image = mimeType.startsWith('image/');
      return { path: entry.path, kind: image ? 'image' as const : 'text' as const, mimeType, content: content.toString(image ? 'base64' : 'utf8') };
    } catch (error) {
      throw error instanceof ZipReadError ? new BadRequestException(error.message) : error;
    }
  }

  async readDeliverableByToken(token: string) {
    const [deliverableId, expiresRaw, modeRaw, signature] = String(token || '').split('.');
    const expires = Number(expiresRaw);
    const mode = modeRaw as DeliverableLinkMode;
    if (!deliverableId || !signature || !Number.isFinite(expires) || !['preview', 'download'].includes(mode)) throw new NotFoundException('Tautan file tidak valid.');
    if (expires < Date.now()) throw new BadRequestException('Tautan file sudah kedaluwarsa. Buka lagi dari halaman transaksi.');
    const provided = Buffer.from(signature);
    const expected = Buffer.from(this.deliverableSignature(deliverableId, expires, mode));
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) throw new NotFoundException('Tautan file tidak valid.');

    const deliverable = await this.prisma.transactionDeliverable.findUnique({ where: { id: deliverableId } });
    if (!deliverable) throw new NotFoundException('File hasil jasa tidak ditemukan.');
    const previewType = mode === 'preview' ? deliverablePreviewType(deliverable.fileName) : null;
    if (mode === 'preview' && !previewType) throw new NotFoundException('Tautan file tidak valid.');
    const buffer = await this.uploads.readPrivateFile(deliverable.storageKey);
    return { deliverable, buffer, mode, previewType };
  }

  async acceptDeliverables(id: string, buyerId: string) {
    const result = await this.serializable(async tx => {
      const current = await tx.transaction.findUnique({ where: { id }, include: { listing: { select: { mode: true } }, dispute: true, payments: { where: { provider: 'MIDTRANS', status: 'SETTLED' }, select: { id: true }, take: 1 } } });
      if (!current) throw new NotFoundException('Transaksi tidak ditemukan.');
      if (current.buyerId !== buyerId) throw new ForbiddenException('Hanya pembeli yang dapat menerima hasil jasa.');
      if ((current.listingModeSnapshot ?? current.listing.mode) !== 'SERVICE') throw new BadRequestException('Hasil jasa hanya tersedia untuk transaksi jasa.');
      if (current.dispute && ['OPEN', 'IN_REVIEW'].includes(current.dispute.status)) {
        throw new BadRequestException('Transaksi sedang dalam sengketa. Penyelesaian dikunci sampai admin memberi keputusan.');
      }
      if (!['PAID', 'CONFIRMED'].includes(current.status) || !current.isEscrowHeld) {
        throw new BadRequestException('Transaksi ini tidak sedang menunggu hasil jasa.');
      }
      const files = await tx.transactionDeliverable.count({ where: { transactionId: id } });
      if (!files) throw new BadRequestException('Penjual belum mengunggah file hasil jasa.');

      const changed = await tx.transaction.updateMany({
        where: { id, status: current.status, isEscrowHeld: true },
        data: { status: 'COMPLETED', completedAt: new Date(), isEscrowHeld: false },
      });
      if (!changed.count) throw new BadRequestException('Transaksi sudah diproses oleh permintaan lain.');
      if (!this.isMidtransFunded(current)) {
        const released = await tx.user.updateMany({
          where: { id: current.buyerId, escrow: { gte: current.grandTotal } },
          data: { escrow: { decrement: current.grandTotal } },
        });
        if (!released.count) throw new BadRequestException('Saldo escrow tidak konsisten.');
        await this.ledger(tx, { userId: current.buyerId, transactionId: id, type: 'ESCROW_RELEASE', escrowDelta: Number(current.grandTotal) * -1, description: 'Escrow dilepas setelah buyer menerima hasil jasa.', idempotencyKey: `DELIVERABLE:BUYER:${id}` });
      }
      await tx.user.update({ where: { id: current.sellerId }, data: { balance: { increment: current.sellerReceives } } });
      await this.ledger(tx, { userId: current.sellerId, transactionId: id, type: 'SELLER_PAYOUT', balanceDelta: Number(current.sellerReceives), description: 'Pendapatan seller setelah hasil jasa diterima.', idempotencyKey: `DELIVERABLE:SELLER:${id}` });
      return tx.transaction.findUniqueOrThrow({
        where: { id },
        include: {
          listing: true,
          buyer: { select: { id: true, name: true, email: true, avatarUrl: true, phone: true } },
          seller: { select: { id: true, name: true, email: true, avatarUrl: true, phone: true } },
          review: true,
          dispute: true,
          deliverables: { orderBy: { createdAt: 'asc' }, select: deliverableSelect },
        },
      });
    });
    await this.notifications.createMany([
      { userId: result.buyerId, type: 'TRANSACTION', title: 'Transaksi selesai', body: `${result.listingTitleSnapshot || result.listing.title} berhasil diselesaikan.`, entityType: 'TRANSACTION', entityId: result.id },
      { userId: result.sellerId, type: 'TRANSACTION', title: 'Hasil jasa diterima', body: `Buyer menerima hasil jasa. Pendapatan ${Number(result.sellerReceives).toLocaleString('id-ID')} telah masuk ke saldo BMarket.`, entityType: 'TRANSACTION', entityId: result.id },
    ]).catch(() => undefined);
    return this.withParsedListing(result);
  }

  async topup(userId: string, dto: TopupDto) {
    if (dto.amount > 10_000_000) throw new BadRequestException('Maksimal top up Rp 10.000.000.');
    return this.prisma.$transaction(async tx => {
      const updated = await tx.user.update({ where: { id: userId }, data: { balance: { increment: dto.amount } }, select: { id: true, name: true, balance: true, escrow: true } });
      await this.ledger(tx, { userId, type: 'TOPUP', balanceDelta: dto.amount, description: 'Top up saldo simulasi BMarket.', idempotencyKey: `TOPUP:${userId}:${randomUUID()}` });
      return updated;
    });
  }

  async getWalletLedger(userId: string) {
    return this.prisma.walletLedger.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async getBalance(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true, escrow: true },
    });
    if (!user) throw new NotFoundException('User tidak ditemukan.');
    return { balance: Number(user.balance), escrow: Number(user.escrow) };
  }

  count() { return this.prisma.transaction.count(); }

  async totalCommissionCollected() {
    const value = await this.prisma.transaction.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { commissionAmt: true },
    });
    return Number(value._sum.commissionAmt ?? 0);
  }
}
