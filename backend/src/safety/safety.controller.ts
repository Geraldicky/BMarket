import { Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SafetyService } from './safety.service';
@Controller('safety') @UseGuards(JwtAuthGuard)
export class SafetyController {
  constructor(private readonly safety: SafetyService) {}
  @Get('blocks') async blocks(@CurrentUser() user: any) { return { success: true, data: await this.safety.blocks(user.id) }; }
  @Get('blocks/:userId/status') async status(@CurrentUser() user: any, @Param('userId') userId: string) { return { success: true, data: await this.safety.status(user.id, userId) }; }
  @Post('blocks/:userId') async block(@CurrentUser() user: any, @Param('userId') userId: string) { return { success: true, message: 'Pengguna diblokir.', data: await this.safety.block(user.id, userId) }; }
  @Delete('blocks/:userId') async unblock(@CurrentUser() user: any, @Param('userId') userId: string) { await this.safety.unblock(user.id, userId); return { success: true, message: 'Blokir dibuka.' }; }
}
