// src/chat/chat.service.ts

import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async getMyChatRooms(userId: string) {
    const rooms = await this.prisma.chatRoom.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      include: {
        userA: { select: { id: true, name: true, avatarUrl: true } },
        userB: { select: { id: true, name: true, avatarUrl: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { messages: { where: { isRead: false, senderId: { not: userId } } } } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return rooms.map(({ _count, ...room }) => ({ ...room, unreadCount: _count.messages }));
  }

  async getOrCreateRoom(userId: string, otherUserId: string) {
    if (userId === otherUserId) throw new BadRequestException('Tidak bisa chat dengan diri sendiri.');

    const otherUser = await this.prisma.user.findUnique({ where: { id: otherUserId } });
    if (!otherUser) throw new NotFoundException('User tidak ditemukan.');

    // Enforce ordering: ID terkecil selalu jadi userA
    const [userAId, userBId] = [userId, otherUserId].sort();

    const existing = await this.prisma.chatRoom.findUnique({
      where: { userAId_userBId: { userAId, userBId } },
      include: {
        userA: { select: { id: true, name: true, avatarUrl: true } },
        userB: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
    if (existing) return existing;

    return this.prisma.chatRoom.create({
      data: { userAId, userBId },
      include: {
        userA: { select: { id: true, name: true, avatarUrl: true } },
        userB: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  }

  async getRoomMessages(roomId: string, userId: string, page = 1, limit = 50) {
    const room = await this.prisma.chatRoom.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Chat room tidak ditemukan.');
    if (room.userAId !== userId && room.userBId !== userId) throw new ForbiddenException('Akses ditolak.');

    const messages = await this.prisma.message.findMany({
      where: { chatRoomId: roomId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
    });

    await this.prisma.message.updateMany({
      where: { chatRoomId: roomId, senderId: { not: userId }, isRead: false },
      data: { isRead: true },
    });

    return messages.reverse();
  }
}
