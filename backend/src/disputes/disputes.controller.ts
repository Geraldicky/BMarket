import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateDisputeDto } from './dto/dispute.dto';
import { DisputesService } from './disputes.service';

@Controller('disputes')
@UseGuards(JwtAuthGuard)
export class DisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @Post()
  async create(@CurrentUser() user: any, @Body() dto: CreateDisputeDto) {
    return { success: true, message: 'Sengketa dibuka. Dana escrow dibekukan sampai ada keputusan.', data: await this.disputes.create(user.id, dto) };
  }

  @Get('mine')
  async mine(@CurrentUser() user: any) { return { success: true, data: await this.disputes.findMine(user.id) }; }
}
