import { Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ActivityService } from './activity.service';

@Controller('activity')
@UseGuards(JwtAuthGuard)
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get('wishlist')
  async wishlist(@CurrentUser() user: any) { return { success: true, data: await this.activity.wishlist(user.id) }; }

  @Post('wishlist/:listingId')
  async save(@CurrentUser() user: any, @Param('listingId') listingId: string) {
    return { success: true, message: 'Listing disimpan.', data: await this.activity.save(user.id, listingId) };
  }

  @Delete('wishlist/:listingId')
  async unsave(@CurrentUser() user: any, @Param('listingId') listingId: string) {
    await this.activity.unsave(user.id, listingId);
    return { success: true, message: 'Listing dihapus dari tersimpan.' };
  }

  @Get('wishlist/:listingId/status')
  async savedStatus(@CurrentUser() user: any, @Param('listingId') listingId: string) {
    return { success: true, data: await this.activity.savedStatus(user.id, listingId) };
  }

  @Get('recent')
  async recent(@CurrentUser() user: any) { return { success: true, data: await this.activity.recent(user.id) }; }

  @Post('recent/:listingId')
  async recordView(@CurrentUser() user: any, @Param('listingId') listingId: string) {
    return { success: true, data: await this.activity.recordView(user.id, listingId) };
  }
}
