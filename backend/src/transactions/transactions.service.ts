import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createHmac, randomInt, randomUUID } from 'node:crypto';
import { CourierProvider, FulfillmentMethod, Prisma, TransactionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateTransactionDto, TopupDto } from './dto/transaction.dto';
import { canTransition, TransactionActor } from './transaction-policy';

@Injectable()
export class TransactionsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TransactionsService.name);
  private reservationTimer?: NodeJS.Timeout;

  constructor(private prisma: PrismaService, private notifications: NotificationsService) {}

  private readonly couriers: Record<CourierProvider, { label: string; fee: number; eta: string }> = {
    GOSEND: { label: 'GoSend Instant (simulasi)', fee: 18_000, eta: '1–3 jam' },
    GRABEXPRESS: { label: 'GrabExpress Instant (simulasi)', fee: 17_000, eta: '1–3 jam' },
  };

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
    }, 60_000);
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
      return await this.prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < 2) {
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
    return this.serializable(async tx => {
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
    });
  }

  async expirePendingReservations(limit = 100): Promise<number> {
    const expired = await this.prisma.transaction.findMany({
      where: { status: 'PENDING', reservationExpiresAt: { lte: new Date() } },
      orderBy: { reservationExpiresAt: 'asc' },
      take: Math.max(1, Math.min(limit, 500)),
      select: { id: true },
    });
    let count = 0;
    for (const { id } of expired) {
      if (await this.expirePendingReservation(id)) count += 1;
    }
    if (count) this.logger.log(`${count} checkout reservation kedaluwarsa dikembalikan ke stok.`);
    return count;
  }

  private handoverHash(transactionId: string, code: string) {
    const secret = process.env.OTP_HASH_SECRET || process.env.JWT_SECRET || 'bmarket-development-secret';
    return createHmac('sha256', secret).update(`${transactionId}:${code}`).digest('hex');
  }

  async getCheckoutOptions(listingId: string) {
    await this.expirePendingReservations();
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true, status: true, mode: true, stockLeft: true, preorderStatus: true, preorderDeadline: true, fulfillmentMethods: true },
    });
    if (!listing || listing.status !== 'ACTIVE') throw new NotFoundException('Listing tidak tersedia.');
    if (listing.mode === 'STOCKED' && listing.stockLeft === 0) throw new BadRequestException('Stok produk sedang habis.');
    if (listing.mode === 'PREORDER') {
      if (listing.preorderStatus !== 'OPEN' || !listing.preorderDeadline || listing.preorderDeadline.getTime() <= Date.now()) {
        throw new BadRequestException('Pre-order sudah ditutup.');
      }
      if ((listing.stockLeft ?? 0) < 1) throw new BadRequestException('Kuota pre-order sudah penuh.');
    }
    return {
      fulfillmentMethods: listing.fulfillmentMethods,
      couriers: Object.entries(this.couriers).map(([provider, detail]) => ({ provider, ...detail })),
    };
  }

  async findByUserId(userId: string, role?: 'buyer' | 'seller') {
    await this.expirePendingReservations();
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
    await this.expirePendingReservation(id);
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        listing: true,
        buyer: { select: { id: true, name: true, email: true, avatarUrl: true, phone: true } },
        seller: { select: { id: true, name: true, email: true, avatarUrl: true, phone: true } },
        review: true,
        dispute: true,
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
    await this.expirePendingReservations();
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
      if (!listing.fulfillmentMethods.includes(dto.fulfillmentMethod)) {
        throw new BadRequestException('Metode penyerahan tidak tersedia untuk listing ini.');
      }

      const fulfillmentMethod = dto.fulfillmentMethod;
      // Meetup V21.2 tidak mengunci lokasi/jadwal di checkout. Buyer dan seller
      // menyepakati waktu serta tempat melalui chat setelah checkout.
      if (fulfillmentMethod === 'INSTANT_COURIER') {
        if (!dto.courierProvider || !dto.deliveryAddress?.trim() || !dto.recipientPhone?.trim()) {
          throw new BadRequestException('Lengkapi kurir, alamat penerima, dan nomor telepon.');
        }
      }

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
      const shippingFee = fulfillmentMethod === 'INSTANT_COURIER' && dto.courierProvider
        ? this.couriers[dto.courierProvider].fee
        : 0;
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
          courierProvider: fulfillmentMethod === 'INSTANT_COURIER' ? dto.courierProvider : null,
          deliveryAddress: fulfillmentMethod === 'INSTANT_COURIER' ? dto.deliveryAddress?.trim() : null,
          recipientPhone: fulfillmentMethod === 'INSTANT_COURIER' ? dto.recipientPhone?.trim() : null,
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
    const expiredNow = await this.expirePendingReservation(id);
    if (expiredNow) {
      throw new BadRequestException('Reservasi pembayaran sudah kedaluwarsa. Stok telah dikembalikan; buat checkout baru.');
    }
    const result = await this.serializable(async tx => {
      const transaction = await tx.transaction.findUnique({ where: { id } });
      if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan.');
      if (transaction.buyerId !== buyerId) throw new ForbiddenException('Akses ditolak.');
      if (transaction.status === 'CANCELLED' && transaction.cancelledBy === 'SYSTEM') {
        throw new BadRequestException('Reservasi pembayaran sudah kedaluwarsa. Buat checkout baru.');
      }
      if (transaction.status === 'PENDING' && transaction.reservationExpiresAt && transaction.reservationExpiresAt.getTime() <= Date.now()) {
        throw new BadRequestException('Reservasi pembayaran sudah kedaluwarsa. Muat ulang transaksi untuk mengembalikan stok.');
      }
      if (transaction.status !== 'PENDING' || transaction.isEscrowHeld) {
        throw new BadRequestException('Transaksi sudah dibayar atau tidak valid.');
      }

      const total = transaction.grandTotal;
      const debited = await tx.user.updateMany({
        where: { id: buyerId, balance: { gte: total } },
        data: { balance: { decrement: total }, escrow: { increment: total } },
      });
      if (!debited.count) throw new BadRequestException('Saldo tidak cukup. Tambah saldo dari menu Profil.');

      const advanced = await tx.transaction.updateMany({
        where: { id, buyerId, status: 'PENDING', isEscrowHeld: false },
        data: { status: 'PAID', isEscrowHeld: true, paidAt: new Date() },
      });
      if (!advanced.count) throw new BadRequestException('Transaksi sudah diproses oleh permintaan lain.');
      await this.ledger(tx, { userId: buyerId, transactionId: id, type: 'PURCHASE_HOLD', balanceDelta: Number(total) * -1, escrowDelta: Number(total), description: 'Pembayaran ditahan di escrow BMarket.', idempotencyKey: `PAY:${id}` });
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
    await this.notifications.create(result.sellerId, 'TRANSACTION', 'Pembayaran diterima', `${result.listingTitleSnapshot || result.listing.title} sudah dibayar. Dana aman di escrow.`, 'TRANSACTION', result.id).catch(() => undefined);
    return this.withParsedListing(result);
  }

  async updateStatus(id: string, userId: string, status: TransactionStatus, cancellationReason?: string) {
    const result = await this.serializable(async tx => {
      const current = await tx.transaction.findUnique({
        where: { id },
        include: { listing: { select: { type: true, status: true, mode: true, preorderStatus: true, preorderDeadline: true, stockLeft: true } }, dispute: true },
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

      const reason = cancellationReason?.trim();
      if (status === 'CANCELLED' && (!reason || reason.length < 3)) {
        throw new BadRequestException('Pilih atau tulis alasan pembatalan.');
      }

      const milestone = status === 'CONFIRMED'
        ? {
            confirmedAt: new Date(),
            ...(current.fulfillmentMethod === 'INSTANT_COURIER'
              ? { trackingNumber: `SIM-${current.id.slice(0, 8).toUpperCase()}` }
              : {}),
          }
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
        const released = await tx.user.updateMany({
          where: { id: current.buyerId, escrow: { gte: escrowTotal } },
          data: { escrow: { decrement: escrowTotal } },
        });
        if (!released.count) throw new BadRequestException('Saldo escrow tidak konsisten.');
        await tx.user.update({
          where: { id: current.sellerId },
          data: { balance: { increment: current.sellerReceives } },
        });
        await this.ledger(tx, { userId: current.buyerId, transactionId: id, type: 'ESCROW_RELEASE', escrowDelta: Number(escrowTotal) * -1, description: 'Escrow dilepas setelah transaksi selesai.', idempotencyKey: `COMPLETE:BUYER:${id}` });
        await this.ledger(tx, { userId: current.sellerId, transactionId: id, type: 'SELLER_PAYOUT', balanceDelta: Number(current.sellerReceives), description: 'Pendapatan seller setelah biaya layanan.', idempotencyKey: `COMPLETE:SELLER:${id}` });
      }

      if (status === 'CANCELLED') {
        if (current.isEscrowHeld) {
          const refunded = await tx.user.updateMany({
            where: { id: current.buyerId, escrow: { gte: escrowTotal } },
            data: { balance: { increment: escrowTotal }, escrow: { decrement: escrowTotal } },
          });
          if (!refunded.count) throw new BadRequestException('Saldo escrow tidak konsisten.');
          await this.ledger(tx, { userId: current.buyerId, transactionId: id, type: 'REFUND', balanceDelta: Number(escrowTotal), escrowDelta: Number(escrowTotal) * -1, description: 'Refund pembatalan transaksi.', idempotencyKey: `CANCEL:REFUND:${id}` });
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
    if (transaction.fulfillmentMethod !== 'CAMPUS_MEETUP' || !['PAID', 'CONFIRMED'].includes(transaction.status)) {
      throw new BadRequestException('Kode hanya tersedia untuk meetup yang sudah dibayar dan dananya berada di escrow.');
    }
    if (!transaction.isEscrowHeld) throw new BadRequestException('Dana escrow tidak ditemukan.');
    const code = randomInt(100000, 1_000_000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await this.prisma.transaction.update({
      where: { id },
      data: { handoverCodeHash: this.handoverHash(id, code), handoverCodeExpiresAt: expiresAt },
    });
    return { code, expiresAt, expiresInSeconds: 900 };
  }

  async confirmHandover(id: string, sellerId: string, code: string) {
    const result = await this.serializable(async tx => {
      const current = await tx.transaction.findUnique({ where: { id }, include: { dispute: true, listing: { select: { mode: true, preorderStatus: true } } } });
      if (!current) throw new NotFoundException('Transaksi tidak ditemukan.');
      if (current.sellerId !== sellerId) throw new ForbiddenException('Hanya seller yang dapat mengonfirmasi kode serah-terima.');
      if (current.dispute && ['OPEN','IN_REVIEW'].includes(current.dispute.status)) throw new BadRequestException('Transaksi sedang dalam sengketa. Penyelesaian meetup dikunci.');
      if (current.listing.mode === 'PREORDER' && !['READY', 'COMPLETED'].includes(current.listing.preorderStatus || '')) {
        throw new BadRequestException('Pre-order belum ditandai siap diambil oleh seller.');
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
      const released = await tx.user.updateMany({
        where: { id: current.buyerId, escrow: { gte: current.grandTotal } },
        data: { escrow: { decrement: current.grandTotal } },
      });
      if (!released.count) throw new BadRequestException('Saldo escrow tidak konsisten.');
      await tx.user.update({ where: { id: current.sellerId }, data: { balance: { increment: current.sellerReceives } } });
      await this.ledger(tx, { userId: current.buyerId, transactionId: id, type: 'ESCROW_RELEASE', escrowDelta: Number(current.grandTotal) * -1, description: 'Escrow dilepas setelah kode serah-terima valid.', idempotencyKey: `HANDOVER:BUYER:${id}` });
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
