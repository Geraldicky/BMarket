import { Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ActivityService } from './activity.service';

@Controller('activity')
@UseGuards(JwtAuthGuard)
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get('wishlist') async wishlist(@CurrentUser() user: any) { return { success: true, data: await this.activity.wishlist(user.id) }; }
  @Post('wishlist/:listingId') async save(@CurrentUser() user: any, @Param('listingId') id: string) { return { success: true, data: await this.activity.save(user.id, id) }; }
  @Delete('wishlist/:listingId') async remove(@CurrentUser() user: any, @Param('listingId') id: string) { return { success: true, data: await this.activity.remove(user.id, id) }; }
  @Get('wishlist/:listingId/status') async status(@CurrentUser() user: any, @Param('listingId') id: string) { return { success: true, data: await this.activity.status(user.id, id) }; }
  @Post('recent/:listingId') async record(@CurrentUser() user: any, @Param('listingId') id: string) { return { success: true, data: await this.activity.recordView(user.id, id) }; }
  @Get('recent') async recent(@CurrentUser() user: any) { return { success: true, data: await this.activity.recent(user.id) }; }
}
