import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
@Controller('notifications') @UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}
  @Get() async list(@CurrentUser() user: any) { return { success: true, data: await this.notifications.list(user.id) }; }
  @Get('unread-count') async count(@CurrentUser() user: any) { return { success: true, data: await this.notifications.unreadCount(user.id) }; }
  @Patch('read-all') async all(@CurrentUser() user: any) { return { success: true, data: await this.notifications.markAllRead(user.id) }; }
  @Patch(':id/read') async read(@CurrentUser() user: any, @Param('id') id: string) { return { success: true, data: await this.notifications.markRead(user.id, id) }; }
}
