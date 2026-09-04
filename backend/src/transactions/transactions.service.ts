import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHmac, randomInt } from 'node:crypto';
import { CourierProvider, FulfillmentMethod, Prisma, TransactionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto, TopupDto } from './dto/transaction.dto';
import { canTransition, TransactionActor } from './transaction-policy';

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  private readonly campuses = ['BINUS @Kemanggisan', 'BINUS @Alam Sutera', 'BINUS @Bekasi', 'BINUS @Bandung', 'BINUS @Malang', 'BINUS @Semarang'];
  private readonly couriers: Record<CourierProvider, { label: string; fee: number; eta: string }> = {
    GOSEND: { label: 'GoSend Instant (simulasi)', fee: 18_000, eta: '1–3 jam' },
    GRABEXPRESS: { label: 'GrabExpress Instant (simulasi)', fee: 17_000, eta: '1–3 jam' },
  };

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

  private withParsedListing<T extends { listing: { images: string } }>(transaction: T) {
    const safeTransaction = { ...transaction } as T & { handoverCodeHash?: string | null };
    delete safeTransaction.handoverCodeHash;
    return {
      ...safeTransaction,
      listing: { ...transaction.listing, images: this.parseImages(transaction.listing.images) },
    };
  }

  private handoverHash(transactionId: string, code: string) {
    const secret = process.env.OTP_HASH_SECRET || process.env.JWT_SECRET || 'bmarket-development-secret';
    return createHmac('sha256', secret).update(`${transactionId}:${code}`).digest('hex');
  }

  async getCheckoutOptions(listingId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true, status: true, fulfillmentMethods: true },
    });
    if (!listing || listing.status !== 'ACTIVE') throw new NotFoundException('Listing tidak tersedia.');
    return {
      fulfillmentMethods: listing.fulfillmentMethods,
      campuses: this.campuses,
      couriers: Object.entries(this.couriers).map(([provider, detail]) => ({ provider, ...detail })),
    };
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
      },
    });
    if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan.');
    if (transaction.buyerId !== userId && transaction.sellerId !== userId) throw new ForbiddenException('Akses ditolak.');
    return this.withParsedListing(transaction);
  }

  async create(buyerId: string, dto: CreateTransactionDto) {
    const result = await this.serializable(async tx => {
      const listing = await tx.listing.findUnique({ where: { id: dto.listingId } });
      if (!listing || listing.status !== 'ACTIVE') throw new BadRequestException('Listing tidak tersedia.');
      if (listing.sellerId === buyerId) throw new BadRequestException('Anda tidak dapat membeli listing sendiri.');
      if (!listing.fulfillmentMethods.includes(dto.fulfillmentMethod)) {
        throw new BadRequestException('Metode penyerahan tidak tersedia untuk listing ini.');
      }

      const fulfillmentMethod = dto.fulfillmentMethod;
      if (fulfillmentMethod === 'CAMPUS_MEETUP') {
        if (!dto.meetupCampus?.trim() || !dto.meetupLocation?.trim() || !dto.meetupSchedule?.trim()) {
          throw new BadRequestException('Lengkapi kampus, titik temu, dan jadwal meetup.');
        }
      }
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
      if (listing.type === 'PRODUCT' && listing.stockLeft !== null) {
        const reserved = await tx.listing.updateMany({
          where: { id: listing.id, status: 'ACTIVE', stockLeft: { gte: quantity } },
          data: { stockLeft: { decrement: quantity } },
        });
        if (!reserved.count) throw new BadRequestException('Stok tidak cukup. Muat ulang listing dan coba lagi.');
        const remaining = listing.stockLeft - quantity;
        if (remaining === 0) await tx.listing.update({ where: { id: listing.id }, data: { status: 'SOLD' } });
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
          price,
          quantity,
          totalPrice,
          fulfillmentMethod,
          meetupCampus: fulfillmentMethod === 'CAMPUS_MEETUP' ? dto.meetupCampus?.trim() : null,
          meetupLocation: fulfillmentMethod === 'CAMPUS_MEETUP' ? dto.meetupLocation?.trim() : null,
          meetupSchedule: fulfillmentMethod === 'CAMPUS_MEETUP' ? dto.meetupSchedule?.trim() : null,
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
    const result = await this.serializable(async tx => {
      const transaction = await tx.transaction.findUnique({ where: { id } });
      if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan.');
      if (transaction.buyerId !== buyerId) throw new ForbiddenException('Akses ditolak.');
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
      return tx.transaction.findUniqueOrThrow({
        where: { id },
        include: {
          listing: true,
          buyer: { select: { id: true, name: true, email: true, avatarUrl: true, phone: true } },
          seller: { select: { id: true, name: true, email: true, avatarUrl: true, phone: true } },
          review: true,
        },
      });
    });
    return this.withParsedListing(result);
  }

  async updateStatus(id: string, userId: string, status: TransactionStatus, cancellationReason?: string) {
    const result = await this.serializable(async tx => {
      const current = await tx.transaction.findUnique({
        where: { id },
        include: { listing: { select: { type: true, status: true } } },
      });
      if (!current) throw new NotFoundException('Transaksi tidak ditemukan.');
      const escrowTotal = current.grandTotal || current.totalPrice;

      const actor: TransactionActor | null = current.buyerId === userId
        ? 'buyer'
        : current.sellerId === userId
          ? 'seller'
          : null;
      if (!actor) throw new ForbiddenException('Akses ditolak.');
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
      }

      if (status === 'CANCELLED') {
        if (current.isEscrowHeld) {
          const refunded = await tx.user.updateMany({
            where: { id: current.buyerId, escrow: { gte: escrowTotal } },
            data: { balance: { increment: escrowTotal }, escrow: { decrement: escrowTotal } },
          });
          if (!refunded.count) throw new BadRequestException('Saldo escrow tidak konsisten.');
        }
        if (current.listing.type === 'PRODUCT') {
          await tx.listing.update({
            where: { id: current.listingId },
            data: {
              stockLeft: { increment: current.quantity },
              ...(current.listing.status === 'SOLD' ? { status: 'ACTIVE' as const } : {}),
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
        },
      });
    });
    return this.withParsedListing(result);
  }

  async issueHandoverCode(id: string, buyerId: string) {
    const transaction = await this.prisma.transaction.findUnique({ where: { id } });
    if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan.');
    if (transaction.buyerId !== buyerId) throw new ForbiddenException('Hanya buyer yang dapat membuat kode serah-terima.');
    if (transaction.fulfillmentMethod !== 'CAMPUS_MEETUP' || transaction.status !== 'CONFIRMED') {
      throw new BadRequestException('Kode hanya tersedia untuk meetup yang sudah dikonfirmasi seller.');
    }
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
      const current = await tx.transaction.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Transaksi tidak ditemukan.');
      if (current.sellerId !== sellerId) throw new ForbiddenException('Hanya seller yang dapat mengonfirmasi kode serah-terima.');
      if (current.fulfillmentMethod !== 'CAMPUS_MEETUP' || current.status !== 'CONFIRMED') {
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
        where: { id, status: 'CONFIRMED', handoverCodeHash: current.handoverCodeHash },
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
      return tx.transaction.findUniqueOrThrow({
        where: { id },
        include: {
          listing: true,
          buyer: { select: { id: true, name: true, email: true, avatarUrl: true, phone: true } },
          seller: { select: { id: true, name: true, email: true, avatarUrl: true, phone: true } },
          review: true,
        },
      });
    });
    return this.withParsedListing(result);
  }

  async topup(userId: string, dto: TopupDto) {
    if (dto.amount > 10_000_000) throw new BadRequestException('Maksimal top up Rp 10.000.000.');
    return this.prisma.user.update({
      where: { id: userId },
      data: { balance: { increment: dto.amount } },
      select: { id: true, name: true, balance: true, escrow: true },
    });
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
