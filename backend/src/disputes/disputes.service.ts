import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { DisputeResolution, DisputeStatus, ListingType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateDisputeDto } from './dto/dispute.dto';
import { deliverableSelect } from '../transactions/transactions.service';
import { MidtransService } from '../payments/midtrans/midtrans.service';

@Injectable()
export class DisputesService {
  constructor(private prisma: PrismaService, private notifications: NotificationsService, @Optional() private midtrans?: MidtransService) {}

  private isMidtransFunded(transaction: { payments?: { id: string }[] }) { return Boolean(transaction.payments?.length); }

  private parseEvidence(raw: string): string[] { try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; } }
  private include = {
    openedBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
    resolvedBy: { select: { id: true, name: true } },
    transaction: { include: {
      // Full listing content and result files so the admin can judge whether the dispute is valid.
      listing: { select: { id: true, title: true, description: true, price: true, category: true, condition: true, type: true, mode: true, images: true, status: true } },
      buyer: { select: { id: true, name: true, email: true, avatarUrl: true } },
      seller: { select: { id: true, name: true, email: true, avatarUrl: true } },
      deliverables: { orderBy: { createdAt: 'asc' }, select: deliverableSelect },
    } },
  } as const;

  private map<T extends { evidenceUrls: string }>(item: T) {
    const mapped = { ...item, evidenceUrls: this.parseEvidence(item.evidenceUrls) };
    const transaction = (item as { transaction?: { handoverCodeHash?: string | null; listing?: { images: string } } }).transaction;
    if (!transaction) return mapped;
    // The handover code hash is a secret; never send it to participants or admins.
    const { handoverCodeHash: _handoverCodeHash, ...safeTransaction } = transaction;
    const listing = safeTransaction.listing ? { ...safeTransaction.listing, images: this.parseEvidence(safeTransaction.listing.images) } : safeTransaction.listing;
    return { ...mapped, transaction: { ...safeTransaction, listing } };
  }

  async create(userId: string, dto: CreateDisputeDto) {
    const transaction = await this.prisma.transaction.findUnique({ where: { id: dto.transactionId }, include: { dispute: true } });
    if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan.');
    if (![transaction.buyerId, transaction.sellerId].includes(userId)) throw new ForbiddenException('Kamu bukan peserta transaksi ini.');
    if (!['PAID','CONFIRMED'].includes(transaction.status) || !transaction.isEscrowHeld) throw new BadRequestException('Sengketa hanya dapat dibuka saat dana transaksi masih berada di escrow.');
    if (transaction.dispute) throw new ConflictException('Transaksi ini sudah memiliki sengketa.');
    const dispute = await this.prisma.dispute.create({
      data: { transactionId: dto.transactionId, openedById: userId, reason: dto.reason, description: dto.description.trim(), evidenceUrls: JSON.stringify(dto.evidenceUrls || []) },
      include: this.include,
    });
    const otherId = transaction.buyerId === userId ? transaction.sellerId : transaction.buyerId;
    await this.notifications.create(otherId, 'DISPUTE', 'Sengketa transaksi dibuka', 'Dana escrow dibekukan sampai admin memberi keputusan.', 'TRANSACTION', transaction.id).catch(() => undefined);
    return this.map(dispute);
  }

  async findMine(userId: string) {
    const items = await this.prisma.dispute.findMany({
      where: { transaction: { OR: [{ buyerId: userId }, { sellerId: userId }] } },
      orderBy: { createdAt: 'desc' }, include: this.include,
    });
    return items.map(item => this.map(item));
  }

  async findAll(status?: DisputeStatus) {
    const items = await this.prisma.dispute.findMany({ where: status ? { status } : {}, orderBy: { createdAt: 'desc' }, include: this.include });
    return items.map(item => this.map(item));
  }

  private async ledger(tx: any, input: { userId: string; transactionId: string; type: 'REFUND' | 'ESCROW_RELEASE' | 'SELLER_PAYOUT'; balanceDelta?: number; escrowDelta?: number; description: string; idempotencyKey: string }) {
    const account = await tx.user.findUniqueOrThrow({ where: { id: input.userId }, select: { balance: true, escrow: true } });
    await tx.walletLedger.upsert({ where: { idempotencyKey: input.idempotencyKey }, update: {}, create: { ...input, balanceDelta: input.balanceDelta ?? 0, escrowDelta: input.escrowDelta ?? 0, balanceAfter: account.balance, escrowAfter: account.escrow } });
  }

  async resolve(id: string, adminId: string, action: 'START_REVIEW' | 'REFUND_BUYER' | 'RELEASE_SELLER' | 'REJECT', note?: string) {
    // Provider I/O must not hold a database transaction connection. The
    // payment row is claimed first so seller release cannot race the refund;
    // the deterministic refund key makes retries safe after provider success.
    if (action === 'REFUND_BUYER') {
      const prepared = await this.prisma.$transaction(async tx => {
        const pendingRefund = await tx.dispute.findUnique({
          where: { id },
          include: { transaction: { include: { payments: { where: { provider: 'MIDTRANS', status: 'SETTLED' }, select: { id: true, orderId: true, amount: true, providerStatus: true, providerTransactionId: true, refundRequestedAt: true }, take: 1 } } } },
        });
        if (!pendingRefund) throw new NotFoundException('Sengketa tidak ditemukan.');
        if (['RESOLVED', 'REJECTED'].includes(pendingRefund.status)) throw new BadRequestException('Sengketa ini sudah ditutup.');
        const order = pendingRefund.transaction;
        if (!order.isEscrowHeld || !['PAID', 'CONFIRMED'].includes(order.status)) throw new BadRequestException('Dana escrow transaksi sudah tidak tersedia untuk resolusi.');
        const payment = order.payments[0];
        if (!payment) return { orderId: order.id, payment: null, claimAt: null };
        const claimAt = payment.refundRequestedAt ?? new Date();
        if (!payment.refundRequestedAt) {
          const claimed = await tx.payment.updateMany({
            where: { id: payment.id, status: 'SETTLED', refundRequestedAt: null },
            data: { refundRequestedAt: claimAt },
          });
          if (!claimed.count) throw new BadRequestException('Refund sedang diproses oleh permintaan lain.');
        }
        return { orderId: order.id, payment, claimAt };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 2_000, timeout: 5_000 });

      if (prepared.payment) {
        const payment = prepared.payment;
        const reason = note?.trim() || 'Refund melalui resolusi sengketa BMarket';
        try {
          if (!this.midtrans) throw new BadRequestException('Layanan refund Midtrans tidak tersedia.');
          if (payment.providerStatus === 'capture') await this.midtrans.cancel(payment.orderId);
          else await this.midtrans.refund(payment.providerTransactionId || payment.orderId, Number(payment.amount), reason, `BMARKET-DISPUTE-${prepared.orderId.replace(/-/g, '').slice(0, 22)}`);
        } catch (error) {
          if (!payment.refundRequestedAt && prepared.claimAt) {
            await this.prisma.payment.updateMany({ where: { id: payment.id, status: 'SETTLED', refundRequestedAt: prepared.claimAt }, data: { refundRequestedAt: null } }).catch(() => undefined);
          }
          throw error;
        }
      }
    }

    const result = await this.prisma.$transaction(async tx => {
      const dispute = await tx.dispute.findUnique({ where: { id }, include: { transaction: { include: { listing: { select: { type: true, mode: true, status: true } }, payments: { where: { provider: 'MIDTRANS', status: 'SETTLED' }, select: { id: true, orderId: true, amount: true, providerStatus: true, refundRequestedAt: true }, take: 1 } } } } });
      if (!dispute) throw new NotFoundException('Sengketa tidak ditemukan.');
      if (['RESOLVED','REJECTED'].includes(dispute.status)) throw new BadRequestException('Sengketa ini sudah ditutup.');
      if (action === 'START_REVIEW') {
        const updated = await tx.dispute.update({ where: { id }, data: { status: 'IN_REVIEW' } });
        return { dispute: this.map(updated), buyerId: dispute.transaction.buyerId, sellerId: dispute.transaction.sellerId, transactionId: dispute.transactionId, action };
      }

      const order = dispute.transaction;
      const now = new Date();
      if (!order.isEscrowHeld || !['PAID','CONFIRMED'].includes(order.status)) throw new BadRequestException('Dana escrow transaksi sudah tidak tersedia untuk resolusi.');
      const escrowTotal = order.grandTotal || order.totalPrice;
      let status: DisputeStatus = 'RESOLVED';
      let resolution: DisputeResolution;
      let refundAmount: Prisma.Decimal | null = null;

      if (action === 'REFUND_BUYER') {
        if (!this.isMidtransFunded(order)) {
          const refunded = await tx.user.updateMany({ where: { id: order.buyerId, escrow: { gte: escrowTotal } }, data: { escrow: { decrement: escrowTotal }, balance: { increment: escrowTotal } } });
          if (!refunded.count) throw new BadRequestException('Saldo escrow tidak konsisten.');
          await this.ledger(tx, { userId: order.buyerId, transactionId: order.id, type: 'REFUND', balanceDelta: Number(escrowTotal), escrowDelta: Number(escrowTotal) * -1, description: 'Refund melalui resolusi sengketa.', idempotencyKey: `DISPUTE:REFUND:${order.id}` });
        } else {
          await tx.payment.updateMany({ where: { transactionId: order.id, provider: 'MIDTRANS', status: 'SETTLED' }, data: { status: 'CANCELLED', refundRequestedAt: new Date() } });
        }
        const itemType = order.listingTypeSnapshot ?? order.listing.type as ListingType;
        const itemMode = order.listingModeSnapshot ?? order.listing.mode;
        if (itemType === 'PRODUCT') await tx.listing.update({ where: { id: order.listingId }, data: { stockLeft: { increment: order.quantity }, ...(itemMode === 'ONE_OFF' && order.listing.status === 'SOLD' ? { status: 'ACTIVE' as const } : {}) } });
        await tx.transaction.update({ where: { id: order.id }, data: { status: 'CANCELLED', isEscrowHeld: false, cancelledAt: now, cancelledBy: 'ADMIN', cancellationReason: 'Refund melalui resolusi sengketa.', handoverCodeHash: null, handoverCodeExpiresAt: null } });
        resolution = 'REFUND_BUYER'; refundAmount = escrowTotal;
      } else if (action === 'RELEASE_SELLER') {
        if (order.payments?.some(payment => payment.refundRequestedAt)) throw new BadRequestException('Refund Midtrans sedang diproses; dana seller tidak dapat dilepas.');
        if (!this.isMidtransFunded(order)) {
          const released = await tx.user.updateMany({ where: { id: order.buyerId, escrow: { gte: escrowTotal } }, data: { escrow: { decrement: escrowTotal } } });
          if (!released.count) throw new BadRequestException('Saldo escrow tidak konsisten.');
          await this.ledger(tx, { userId: order.buyerId, transactionId: order.id, type: 'ESCROW_RELEASE', escrowDelta: Number(escrowTotal) * -1, description: 'Escrow dilepas oleh keputusan admin.', idempotencyKey: `DISPUTE:RELEASE:BUYER:${order.id}` });
        }
        await tx.user.update({ where: { id: order.sellerId }, data: { balance: { increment: order.sellerReceives } } });
        await this.ledger(tx, { userId: order.sellerId, transactionId: order.id, type: 'SELLER_PAYOUT', balanceDelta: Number(order.sellerReceives), description: 'Payout seller melalui resolusi sengketa.', idempotencyKey: `DISPUTE:RELEASE:SELLER:${order.id}` });
        await tx.transaction.update({ where: { id: order.id }, data: { status: 'COMPLETED', isEscrowHeld: false, completedAt: now, handoverCodeHash: null, handoverCodeExpiresAt: null } });
        resolution = 'RELEASE_SELLER';
      } else {
        status = 'REJECTED'; resolution = 'REJECT_DISPUTE';
      }

      const updated = await tx.dispute.update({ where: { id }, data: { status, resolution, resolutionNote: note?.trim() || null, refundAmount, resolvedById: adminId, resolvedAt: now } });
      return { dispute: this.map(updated), buyerId: order.buyerId, sellerId: order.sellerId, transactionId: order.id, action };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 2_000, timeout: 5_000 });

    if (result.action !== 'START_REVIEW') {
      const title = result.action === 'REFUND_BUYER' ? 'Sengketa: refund buyer' : result.action === 'RELEASE_SELLER' ? 'Sengketa: dana dilepas ke seller' : 'Sengketa ditolak';
      await this.notifications.createMany([result.buyerId, result.sellerId].map(userId => ({ userId, type: 'DISPUTE' as const, title, body: note?.trim() || 'Keputusan admin tersedia di detail transaksi.', entityType: 'TRANSACTION', entityId: result.transactionId }))).catch(() => undefined);
    }
    return result.dispute;
  }

  async hasOpen(transactionId: string) {
    return (await this.prisma.dispute.count({ where: { transactionId, status: { in: ['OPEN','IN_REVIEW'] } } })) > 0;
  }
}
