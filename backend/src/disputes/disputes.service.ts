import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DisputeResolution, DisputeStatus, ListingType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateDisputeDto } from './dto/dispute.dto';

@Injectable()
export class DisputesService {
  constructor(private prisma: PrismaService, private notifications: NotificationsService) {}

  private parseEvidence(raw: string): string[] { try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; } }
  private include = {
    openedBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
    resolvedBy: { select: { id: true, name: true } },
    transaction: { include: {
      listing: { select: { id: true, title: true, type: true, images: true, status: true } },
      buyer: { select: { id: true, name: true, email: true, avatarUrl: true } },
      seller: { select: { id: true, name: true, email: true, avatarUrl: true } },
    } },
  } as const;

  private map<T extends { evidenceUrls: string }>(item: T) { return { ...item, evidenceUrls: this.parseEvidence(item.evidenceUrls) }; }

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
    const result = await this.prisma.$transaction(async tx => {
      const dispute = await tx.dispute.findUnique({ where: { id }, include: { transaction: { include: { listing: { select: { type: true, status: true } } } } } });
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
        const refunded = await tx.user.updateMany({ where: { id: order.buyerId, escrow: { gte: escrowTotal } }, data: { escrow: { decrement: escrowTotal }, balance: { increment: escrowTotal } } });
        if (!refunded.count) throw new BadRequestException('Saldo escrow tidak konsisten.');
        await this.ledger(tx, { userId: order.buyerId, transactionId: order.id, type: 'REFUND', balanceDelta: Number(escrowTotal), escrowDelta: Number(escrowTotal) * -1, description: 'Refund melalui resolusi sengketa.', idempotencyKey: `DISPUTE:REFUND:${order.id}` });
        const itemType = order.listingTypeSnapshot ?? order.listing.type as ListingType;
        if (itemType === 'PRODUCT') await tx.listing.update({ where: { id: order.listingId }, data: { stockLeft: { increment: order.quantity }, ...(order.listing.status === 'SOLD' ? { status: 'ACTIVE' as const } : {}) } });
        await tx.transaction.update({ where: { id: order.id }, data: { status: 'CANCELLED', isEscrowHeld: false, cancelledAt: now, cancelledBy: 'ADMIN', cancellationReason: 'Refund melalui resolusi sengketa.', handoverCodeHash: null, handoverCodeExpiresAt: null } });
        resolution = 'REFUND_BUYER'; refundAmount = escrowTotal;
      } else if (action === 'RELEASE_SELLER') {
        const released = await tx.user.updateMany({ where: { id: order.buyerId, escrow: { gte: escrowTotal } }, data: { escrow: { decrement: escrowTotal } } });
        if (!released.count) throw new BadRequestException('Saldo escrow tidak konsisten.');
        await tx.user.update({ where: { id: order.sellerId }, data: { balance: { increment: order.sellerReceives } } });
        await this.ledger(tx, { userId: order.buyerId, transactionId: order.id, type: 'ESCROW_RELEASE', escrowDelta: Number(escrowTotal) * -1, description: 'Escrow dilepas oleh keputusan admin.', idempotencyKey: `DISPUTE:RELEASE:BUYER:${order.id}` });
        await this.ledger(tx, { userId: order.sellerId, transactionId: order.id, type: 'SELLER_PAYOUT', balanceDelta: Number(order.sellerReceives), description: 'Payout seller melalui resolusi sengketa.', idempotencyKey: `DISPUTE:RELEASE:SELLER:${order.id}` });
        await tx.transaction.update({ where: { id: order.id }, data: { status: 'COMPLETED', isEscrowHeld: false, completedAt: now, handoverCodeHash: null, handoverCodeExpiresAt: null } });
        resolution = 'RELEASE_SELLER';
      } else {
        status = 'REJECTED'; resolution = 'REJECT_DISPUTE';
      }

      const updated = await tx.dispute.update({ where: { id }, data: { status, resolution, resolutionNote: note?.trim() || null, refundAmount, resolvedById: adminId, resolvedAt: now } });
      return { dispute: this.map(updated), buyerId: order.buyerId, sellerId: order.sellerId, transactionId: order.id, action };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

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
