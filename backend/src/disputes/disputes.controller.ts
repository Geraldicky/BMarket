import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateDisputeDto } from './dto/dispute.dto';
import { DisputesService } from './disputes.service';

@Controller('disputes')
@UseGuards(JwtAuthGuard)
export class DisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @Post() async create(@CurrentUser() user: any, @Body() dto: CreateDisputeDto) { return { success: true, message: 'Sengketa dibuka dan dana tetap ditahan di escrow.', data: await this.disputes.create(user.id, dto) }; }
  @Get('mine') async mine(@CurrentUser() user: any) { return { success: true, data: await this.disputes.mine(user.id) }; }
}
