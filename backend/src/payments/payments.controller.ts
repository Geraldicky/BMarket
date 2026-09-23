import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PaymentsService } from './payments.service';
import type { MidtransNotification } from './midtrans/midtrans.types';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('transactions/:transactionId')
  @UseGuards(JwtAuthGuard)
  async create(@Param('transactionId') transactionId: string, @CurrentUser() user: any) {
    return { success: true, data: await this.payments.create(transactionId, user.id) };
  }

  @Get('transactions/:transactionId')
  @UseGuards(JwtAuthGuard)
  async status(@Param('transactionId') transactionId: string, @CurrentUser() user: any) {
    return { success: true, data: await this.payments.findForBuyer(transactionId, user.id) };
  }

  // Public by design: authenticity is established with Midtrans' SHA-512 signature
  // and a server-to-server status lookup, never with a browser/JWT callback.
  @Post('midtrans/notification')
  async notification(@Body() body: MidtransNotification) {
    return { success: true, data: await this.payments.handleNotification(body) };
  }
}
