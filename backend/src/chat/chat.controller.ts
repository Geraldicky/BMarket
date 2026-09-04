// src/chat/chat.controller.ts

import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('rooms')
  async getMyChatRooms(@CurrentUser() user: any) {
    const data = await this.chatService.getMyChatRooms(user.id);
    return { success: true, data };
  }

  @Post('rooms')
  async getOrCreateRoom(@CurrentUser() user: any, @Body('otherUserId') otherUserId: string) {
    const data = await this.chatService.getOrCreateRoom(user.id, otherUserId);
    return { success: true, data };
  }

  @Get('rooms/:roomId/messages')
  async getRoomMessages(
    @Param('roomId') roomId: string,
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.chatService.getRoomMessages(
      roomId, user.id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
    );
    return { success: true, data };
  }
}
