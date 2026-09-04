import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DisputeStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDisputeDto } from './dto/dispute.dto';

@Injectable()
export class DisputesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateDisputeDto) {
    const transaction = await this.prisma.transaction.findUnique({ where: { id: dto.transactionId }, include: { dispute: true, listing: { select: { title: true } } } });
    if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan.');
    if (transaction.buyerId !== userId && transaction.sellerId !== userId) throw new ForbiddenException('Akses ditolak.');
    if (!['PAID', 'CONFIRMED'].includes(transaction.status) || !transaction.isEscrowHeld) throw new BadRequestException('Sengketa hanya dapat dibuka saat dana masih berada di escrow.');
    if (transaction.dispute) throw new BadRequestException('Sengketa untuk transaksi ini sudah pernah dibuat.');

    const otherId = transaction.buyerId === userId ? transaction.sellerId : transaction.buyerId;
    return this.prisma.$transaction(async tx => {
      const dispute = await tx.dispute.create({
        data: { transactionId: transaction.id, openedById: userId, reason: dto.reason, description: dto.description.trim(), evidence: JSON.stringify(dto.evidence || []) },
      });
      await tx.transaction.update({ where: { id: transaction.id }, data: { isDisputed: true } });
      await tx.notification.create({ data: { userId: otherId, type: 'DISPUTE', title: 'Sengketa transaksi dibuka', body: `Transaksi ${transaction.listing.title} sedang ditinjau admin.`, entityType: 'TRANSACTION', entityId: transaction.id } });
      return dispute;
    });
  }

  mine(userId: string) {
    return this.prisma.dispute.findMany({
      where: { transaction: { OR: [{ buyerId: userId }, { sellerId: userId }] } },
      orderBy: { createdAt: 'desc' },
      include: { openedBy: { select: { id: true, name: true } }, transaction: { include: { listing: { select: { id: true, title: true } } } } },
    });
  }

  list(status?: DisputeStatus) {
    return this.prisma.dispute.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        openedBy: { select: { id: true, name: true, email: true } },
        transaction: { include: { listing: { select: { id: true, title: true } }, buyer: { select: { id: true, name: true } }, seller: { select: { id: true, name: true } } } },
      },
    });
  }

  async resolve(id: string, adminId: string, action: 'START_REVIEW' | 'REFUND_BUYER' | 'RELEASE_SELLER' | 'REJECT', resolution?: string) {
    return this.prisma.$transaction(async tx => {
      const dispute = await tx.dispute.findUnique({ where: { id }, include: { transaction: { include: { listing: { select: { type: true, status: true, title: true } } } } } });
      if (!dispute) throw new NotFoundException('Sengketa tidak ditemukan.');
      if (!['OPEN', 'IN_REVIEW'].includes(dispute.status)) throw new BadRequestException('Sengketa ini sudah ditutup.');
      if (action === 'START_REVIEW') return tx.dispute.update({ where: { id }, data: { status: 'IN_REVIEW' } });

      const order = dispute.transaction;
      const note = resolution?.trim();
      if (!note || note.length < 5) throw new BadRequestException('Catatan keputusan admin minimal 5 karakter.');
      const now = new Date();
      let status: DisputeStatus;
      if (action === 'REFUND_BUYER') {
        if (!order.isEscrowHeld) throw new BadRequestException('Dana escrow sudah tidak tersedia.');
        const refunded = await tx.user.updateMany({ where: { id: order.buyerId, escrow: { gte: order.grandTotal } }, data: { escrow: { decrement: order.grandTotal }, balance: { increment: order.grandTotal } } });
        if (!refunded.count) throw new BadRequestException('Saldo escrow tidak konsisten.');
        await tx.transaction.update({ where: { id: order.id }, data: { status: 'CANCELLED', isEscrowHeld: false, isDisputed: false, cancelledAt: now, cancelledBy: 'ADMIN', cancellationReason: note } });
        if (order.listing.type === 'PRODUCT') await tx.listing.update({ where: { id: order.listingId }, data: { stockLeft: { increment: order.quantity }, ...(order.listing.status === 'SOLD' ? { status: 'ACTIVE' as const } : {}) } });
        await tx.payment.updateMany({ where: { transactionId: order.id, status: 'PAID' }, data: { status: 'REFUNDED', refundedAt: now } });
        status = 'RESOLVED_BUYER';
      } else if (action === 'RELEASE_SELLER') {
        if (!order.isEscrowHeld) throw new BadRequestException('Dana escrow sudah tidak tersedia.');
        const released = await tx.user.updateMany({ where: { id: order.buyerId, escrow: { gte: order.grandTotal } }, data: { escrow: { decrement: order.grandTotal } } });
        if (!released.count) throw new BadRequestException('Saldo escrow tidak konsisten.');
        await tx.user.update({ where: { id: order.sellerId }, data: { balance: { increment: order.sellerReceives } } });
        await tx.transaction.update({ where: { id: order.id }, data: { status: 'COMPLETED', isEscrowHeld: false, isDisputed: false, completedAt: now } });
        status = 'RESOLVED_SELLER';
      } else {
        await tx.transaction.update({ where: { id: order.id }, data: { isDisputed: false } });
        status = 'REJECTED';
      }

      await tx.notification.createMany({ data: [order.buyerId, order.sellerId].map(userId => ({ userId, type: 'DISPUTE' as const, title: 'Keputusan sengketa tersedia', body: `${order.listing.title}: ${note}`, entityType: 'TRANSACTION', entityId: order.id })) });
      return tx.dispute.update({ where: { id }, data: { status, resolution: note, refundAmount: action === 'REFUND_BUYER' ? order.grandTotal : null, resolvedById: adminId, resolvedAt: now } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
