import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MidtransService } from './midtrans/midtrans.service';
import type { MidtransItemDetail, MidtransNotification, MidtransSnapRequest, MidtransStatus } from './midtrans/midtrans.types';

const paymentSelect = {
  id: true, orderId: true, amount: true, status: true, snapToken: true,
  redirectUrl: true, paymentType: true, expiresAt: true, settledAt: true,
  createdAt: true, updatedAt: true,
} as const;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly midtrans: MidtransService,
    private readonly notifications: NotificationsService,
  ) {}

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

  private safe<T extends Record<string, unknown>>(payment: T) {
    return { ...payment, amount: Number(payment.amount) };
  }

  private created(payment: any) {
    return {
      paymentId: payment.id, orderId: payment.orderId, token: payment.snapToken,
      redirectUrl: payment.redirectUrl, status: payment.status, amount: Number(payment.amount), expiresAt: payment.expiresAt,
    };
  }

  private publicStatus(payment: any) {
    const { snapToken: _snapToken, id, ...safe } = payment;
    return { paymentId: id, ...this.safe(safe) };
  }

  private idr(value: Prisma.Decimal | number | string, label: string) {
    const amount = Number(value);
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new BadRequestException(`${label} transaksi tidak valid untuk pembayaran IDR.`);
    return amount;
  }

  private wibTimestamp(date: Date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(date).reduce<Record<string, string>>((all, part) => ({ ...all, [part.type]: part.value }), {});
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} +0700`;
  }

  private orderId(transactionId: string) {
    return `BMARKET-${transactionId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 18)}-${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  }

  private finishUrl(transactionId: string, orderId: string) {
    const template = process.env.MIDTRANS_FINISH_URL?.trim();
    if (!template) return undefined;
    return template
      .split('{transactionId}').join(encodeURIComponent(transactionId))
      .split('{orderId}').join(encodeURIComponent(orderId));
  }

  private payload(transaction: any, orderId: string, duration: number): MidtransSnapRequest {
    const grossAmount = this.idr(transaction.grandTotal, 'Total');
    const unitPrice = this.idr(transaction.price, 'Harga');
    const totalPrice = this.idr(transaction.totalPrice, 'Subtotal');
    const shippingFee = Number(transaction.shippingFee);
    if (!Number.isSafeInteger(shippingFee) || shippingFee < 0 || totalPrice + shippingFee !== grossAmount) {
      throw new BadRequestException('Rincian transaksi tidak sama dengan total pembayaran. Hubungi dukungan BMarket.');
    }

    const itemDetails: MidtransItemDetail[] = unitPrice * transaction.quantity === totalPrice
      ? [{ id: transaction.listingId.slice(0, 50), price: unitPrice, quantity: transaction.quantity, name: String(transaction.listingTitleSnapshot || transaction.listing.title).slice(0, 50) }]
      : [{ id: transaction.listingId.slice(0, 50), price: totalPrice, quantity: 1, name: `${transaction.quantity}x ${transaction.listingTitleSnapshot || transaction.listing.title}`.slice(0, 50) }];
    if (shippingFee > 0) itemDetails.push({ id: `SHIP-${transaction.id.slice(0, 24)}`, price: shippingFee, quantity: 1, name: 'Ongkos kirim' });

    const finish = this.finishUrl(transaction.id, orderId);
    return {
      transaction_details: { order_id: orderId, gross_amount: grossAmount },
      customer_details: {
        first_name: String(transaction.buyer.name).slice(0, 50),
        email: transaction.buyer.email,
        ...(transaction.buyer.phone ? { phone: transaction.buyer.phone } : {}),
      },
      item_details: itemDetails,
      credit_card: { secure: true },
      expiry: { start_time: this.wibTimestamp(new Date()), duration, unit: 'minutes' },
      page_expiry: { duration, unit: 'minutes' },
      ...(finish ? { callbacks: { finish } } : {}),
    };
  }

  private async expireReservation(transactionId: string) {
    return this.serializable(async tx => {
      const current = await tx.transaction.findUnique({ where: { id: transactionId }, include: { listing: { select: { type: true, mode: true, status: true } } } });
      if (!current || current.status !== 'PENDING' || !current.reservationExpiresAt || current.reservationExpiresAt.getTime() > Date.now()) return false;
      const now = new Date();
      const changed = await tx.transaction.updateMany({
        where: { id: transactionId, status: 'PENDING', reservationExpiresAt: { lte: now } },
        data: { status: 'CANCELLED', cancelledAt: now, cancelledBy: 'SYSTEM', cancellationReason: 'Reservasi pembayaran kedaluwarsa.', isEscrowHeld: false },
      });
      if (!changed.count) return false;
      if ((current.listingTypeSnapshot ?? current.listing.type) === 'PRODUCT') {
        await tx.listing.update({
          where: { id: current.listingId },
          data: { stockLeft: { increment: current.quantity }, ...((current.listingModeSnapshot ?? current.listing.mode) === 'ONE_OFF' && current.listing.status === 'SOLD' ? { status: 'ACTIVE' as const } : {}) },
        });
      }
      return true;
    });
  }

  async create(transactionId: string, buyerId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { listing: { select: { title: true } }, buyer: { select: { name: true, email: true, phone: true } } },
    });
    if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan.');
    if (transaction.buyerId !== buyerId) throw new ForbiddenException('Kamu bukan pembeli transaksi ini.');
    if (transaction.status !== 'PENDING' || transaction.isEscrowHeld) throw new BadRequestException('Transaksi sudah dibayar atau tidak dapat dibayar.');
    if (!transaction.reservationExpiresAt || transaction.reservationExpiresAt.getTime() <= Date.now()) {
      await this.expireReservation(transactionId);
      throw new BadRequestException('Reservasi pembayaran sudah kedaluwarsa. Stok telah dikembalikan; buat checkout baru.');
    }

    const now = new Date();
    await this.prisma.payment.updateMany({
      where: { transactionId, status: 'PENDING', expiresAt: { lte: now } }, data: { status: 'EXPIRED' },
    });
    const reusable = await this.prisma.payment.findFirst({
      where: { transactionId, status: 'PENDING', expiresAt: { gt: now }, snapToken: { not: null }, redirectUrl: { not: null } },
      orderBy: { createdAt: 'desc' }, select: paymentSelect,
    });
    if (reusable) return this.created(reusable);

    const remainingMinutes = Math.floor((transaction.reservationExpiresAt.getTime() - now.getTime()) / 60_000);
    if (remainingMinutes < 5) {
      throw new BadRequestException('Sisa waktu reservasi kurang dari 5 menit. Batalkan pesanan dan buat checkout baru agar sesi pembayaran aman.');
    }
    const orderId = this.orderId(transactionId);
    let payment: any;
    try {
      payment = await this.prisma.payment.create({
        data: { transactionId, provider: 'MIDTRANS', orderId, amount: transaction.grandTotal, expiresAt: new Date(now.getTime() + remainingMinutes * 60_000) },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const concurrent = await this.prisma.payment.findFirst({ where: { transactionId, status: 'PENDING' }, select: paymentSelect });
        if (concurrent?.snapToken && concurrent.redirectUrl) return this.created(concurrent);
        throw new ConflictException('Sesi pembayaran sedang dibuat. Coba lagi beberapa detik.');
      }
      throw error;
    }

    try {
      const snap = await this.midtrans.createSnap(this.payload(transaction, orderId, remainingMinutes));
      const updated = await this.prisma.payment.update({
        where: { id: payment.id }, data: { snapToken: snap.token, redirectUrl: snap.redirect_url }, select: paymentSelect,
      });
      return this.created(updated);
    } catch (error) {
      await this.prisma.payment.updateMany({ where: { id: payment.id, status: 'PENDING', snapToken: null }, data: { status: 'FAILED' } });
      throw error;
    }
  }

  async findForBuyer(transactionId: string, buyerId: string) {
    const transaction = await this.prisma.transaction.findUnique({ where: { id: transactionId }, select: { buyerId: true } });
    if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan.');
    if (transaction.buyerId !== buyerId) throw new ForbiddenException('Kamu bukan pembeli transaksi ini.');
    const payment = await this.prisma.payment.findFirst({ where: { transactionId }, orderBy: { createdAt: 'desc' }, select: paymentSelect });
    return payment ? this.publicStatus(payment) : null;
  }

  private mappedStatus(status: MidtransStatus): PaymentStatus {
    const value = status.transaction_status?.toLowerCase();
    if (value === 'settlement') return status.fraud_status === 'deny' ? 'FAILED' : 'SETTLED';
    if (value === 'capture') return status.fraud_status === 'accept' ? 'SETTLED' : status.fraud_status === 'deny' ? 'FAILED' : 'PENDING';
    if (value === 'pending' || value === 'authorize') return 'PENDING';
    if (value === 'expire') return 'EXPIRED';
    if (value === 'cancel' || value === 'refund' || value === 'partial_refund') return 'CANCELLED';
    return 'FAILED';
  }

  async handleNotification(notification: MidtransNotification) {
    if (!this.midtrans.verifySignature(notification)) throw new UnauthorizedException('Signature Midtrans tidak valid.');
    const provider = await this.midtrans.getStatus(notification.order_id);
    if (provider.order_id !== notification.order_id) throw new BadRequestException('Order ID hasil verifikasi Midtrans tidak cocok.');

    const payment = await this.prisma.payment.findUnique({
      where: { orderId: notification.order_id },
      include: { transaction: { include: { listing: { select: { title: true, type: true, mode: true, status: true } } } } },
    });
    if (!payment) throw new NotFoundException('Payment tidak ditemukan.');
    const providerAmount = Number(provider.gross_amount);
    const notificationAmount = Number(notification.gross_amount);
    if (!Number.isFinite(providerAmount) || !Number.isFinite(notificationAmount) || providerAmount !== notificationAmount || providerAmount !== Number(payment.amount) || providerAmount !== Number(payment.transaction.grandTotal)) {
      throw new BadRequestException('Nominal notifikasi Midtrans tidak cocok.');
    }
    const mapped = this.mappedStatus(provider);
    const transaction = payment.transaction;

    if (mapped === 'SETTLED' && (transaction.status === 'CANCELLED' || !transaction.reservationExpiresAt || transaction.reservationExpiresAt.getTime() <= Date.now())) {
      if (payment.refundRequestedAt) {
        return { paymentId: payment.id, status: 'CANCELLED', transactionStatus: transaction.status, action: 'REFUND_ALREADY_REQUESTED' };
      }
      const refundKey = `BMARKET-REFUND-${transaction.id.replace(/-/g, '').slice(0, 24)}`;
      if (provider.transaction_status === 'capture') await this.midtrans.cancel(payment.orderId);
      else await this.midtrans.refund(payment.orderId, Number(payment.amount), 'Checkout BMarket sudah kedaluwarsa atau dibatalkan', refundKey);
      await this.prisma.payment.update({ where: { id: payment.id }, data: {
        status: 'CANCELLED', refundRequestedAt: new Date(), paymentType: provider.payment_type, providerStatus: provider.transaction_status, providerTransactionId: provider.transaction_id, fraudStatus: provider.fraud_status,
      } });
      await this.expireReservation(transaction.id);
      this.logger.warn(`Pembayaran ${payment.orderId} diterima setelah checkout tidak valid dan dikirim untuk refund/cancel.`);
      return { paymentId: payment.id, status: 'CANCELLED', transactionStatus: transaction.status, action: 'REFUNDED_OR_CANCELLED' };
    }

    const result = await this.serializable(async tx => {
      const current = await tx.transaction.findUnique({ where: { id: transaction.id } });
      if (!current) throw new NotFoundException('Transaksi tidak ditemukan.');
      const paymentData = {
        status: mapped, paymentType: provider.payment_type, providerStatus: provider.transaction_status, providerTransactionId: provider.transaction_id,
        fraudStatus: provider.fraud_status, ...(mapped === 'SETTLED' ? { settledAt: payment.settledAt ?? new Date() } : {}),
      };

      if (mapped !== 'SETTLED') {
        if (payment.status !== mapped) await tx.payment.update({ where: { id: payment.id }, data: paymentData });
        if (current.status === 'PAID' && ['FAILED', 'CANCELLED'].includes(mapped)) {
          const cancelledAt = new Date();
          const changed = await tx.transaction.updateMany({
            where: { id: current.id, status: 'PAID', isEscrowHeld: true },
            data: { status: 'CANCELLED', isEscrowHeld: false, cancelledAt, cancelledBy: 'SYSTEM', cancellationReason: 'Pembayaran dibatalkan atau dibalik oleh Midtrans.' },
          });
          if (changed.count && (transaction.listingTypeSnapshot ?? transaction.listing.type) === 'PRODUCT') {
            await tx.listing.update({
              where: { id: transaction.listingId },
              data: { stockLeft: { increment: transaction.quantity }, ...((transaction.listingModeSnapshot ?? transaction.listing.mode) === 'ONE_OFF' && transaction.listing.status === 'SOLD' ? { status: 'ACTIVE' as const } : {}) },
            });
          }
          return { transitioned: false, reversed: Boolean(changed.count), transactionStatus: changed.count ? 'CANCELLED' as const : current.status };
        }
        return { transitioned: false, reversed: false, transactionStatus: current.status };
      }
      if (current.status !== 'PENDING') {
        if (payment.status !== 'SETTLED') await tx.payment.update({ where: { id: payment.id }, data: paymentData });
        return { transitioned: false, reversed: false, transactionStatus: current.status };
      }
      const changed = await tx.transaction.updateMany({
        where: { id: current.id, status: 'PENDING', isEscrowHeld: false, reservationExpiresAt: { gt: new Date() } },
        data: { status: 'PAID', isEscrowHeld: true, paidAt: new Date() },
      });
      if (!changed.count) throw new ConflictException('Transaksi berubah saat pembayaran dikonfirmasi.');
      await tx.payment.update({ where: { id: payment.id }, data: paymentData });
      return { transitioned: true, reversed: false, transactionStatus: 'PAID' as const };
    });

    if (result.transitioned) {
      await this.notifications.create(transaction.sellerId, 'TRANSACTION', 'Pembayaran diterima', `${transaction.listingTitleSnapshot || transaction.listing.title} sudah dibayar melalui Midtrans. Dana aman di escrow.`, 'TRANSACTION', transaction.id).catch(() => undefined);
    }
    if (result.reversed) {
      await this.notifications.createMany([transaction.buyerId, transaction.sellerId].map(userId => ({
        userId, type: 'TRANSACTION' as const, title: 'Pembayaran dibatalkan Midtrans',
        body: `${transaction.listingTitleSnapshot || transaction.listing.title} dibatalkan karena pembayaran dibalik oleh penyedia.`, entityType: 'TRANSACTION', entityId: transaction.id,
      }))).catch(() => undefined);
    }
    if (mapped === 'EXPIRED') await this.expireReservation(transaction.id);
    return { paymentId: payment.id, status: mapped, transactionStatus: result.transactionStatus };
  }
}
