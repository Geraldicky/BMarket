// src/transactions/transactions.controller.ts

import {
  BadRequestException, Controller, Get, Post, Patch, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { ConfirmHandoverDto, CreateTransactionDto, TopupDto, UpdateTransactionStatusDto } from './dto/transaction.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TransactionStatus } from '@prisma/client';

@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  // Route statis HARUS sebelum route dinamis (:id)
  @Get('balance')
  async getBalance(@CurrentUser() user: any) {
    const data = await this.transactionsService.getBalance(user.id);
    return { success: true, data };
  }

  @Post('topup')
  async topup(@CurrentUser() user: any, @Body() dto: TopupDto) {
    const data = await this.transactionsService.topup(user.id, dto);
    return { success: true, message: `Topup Rp ${dto.amount.toLocaleString('id-ID')} berhasil!`, data };
  }

  @Get('wallet/ledger')
  async walletLedger(@CurrentUser() user: any) { return { success: true, data: await this.transactionsService.getWalletLedger(user.id) }; }

  @Get()
  async findAll(@CurrentUser() user: any, @Query('role') role?: 'buyer' | 'seller') {
    const data = await this.transactionsService.findByUserId(user.id, role);
    return { success: true, data };
  }

  @Get('checkout-options/:listingId')
  async checkoutOptions(@Param('listingId') listingId: string) {
    const data = await this.transactionsService.getCheckoutOptions(listingId);
    return { success: true, data };
  }

  @Get(':id')
  async findById(@Param('id') id: string, @CurrentUser() user: any) {
    const data = await this.transactionsService.findById(id, user.id);
    return { success: true, data };
  }

  @Post()
  async create(@CurrentUser() user: any, @Body() dto: CreateTransactionDto) {
    const data = await this.transactionsService.create(user.id, dto);
    return {
      success: true,
      message: 'Permintaan pembelian dibuat. Silakan lakukan pembayaran untuk melanjutkan.',
      data,
    };
  }

  @Post(':id/pay')
  async pay(@Param('id') id: string, @CurrentUser() user: any) {
    const data = await this.transactionsService.pay(id, user.id);
    return { success: true, message: 'Pembayaran berhasil! Dana masuk ke escrow.', data };
  }

  @Post(':id/handover-code')
  async issueHandoverCode(@Param('id') id: string, @CurrentUser() user: any) {
    const data = await this.transactionsService.issueHandoverCode(id, user.id);
    return { success: true, message: 'Kode serah-terima dibuat dan berlaku 15 menit.', data };
  }

  @Post(':id/confirm-handover')
  async confirmHandover(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: ConfirmHandoverDto) {
    const data = await this.transactionsService.confirmHandover(id, user.id, dto.code);
    return { success: true, message: 'Meetup selesai. Dana escrow sudah dilepas ke seller.', data };
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateTransactionStatusDto,
  ) {
    const validStatuses: TransactionStatus[] = ['CONFIRMED', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(dto.status)) {
      throw new BadRequestException('Status tidak valid.');
    }
    const data = await this.transactionsService.updateStatus(id, user.id, dto.status, dto.cancellationReason);
    const messages: Partial<Record<TransactionStatus, string>> = {
      CONFIRMED: 'Pesanan dikonfirmasi dan sedang diproses.',
      COMPLETED: 'Transaksi selesai dan dana sudah dilepas ke seller.',
      CANCELLED: 'Transaksi dibatalkan.',
    };
    return { success: true, message: messages[dto.status], data };
  }
}
