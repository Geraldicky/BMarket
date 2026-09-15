// src/chat/chat.service.ts

import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Chat history is kept for 7 days; older messages are permanently deleted.
export const CHAT_RETENTION_DAYS = 7;
const CHAT_RETENTION_MS = CHAT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const PURGE_INTERVAL_MS = 60 * 60 * 1000;

@Injectable()
export class ChatService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChatService.name);
  private purgeTimer?: NodeJS.Timeout;

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    const purge = () => void this.purgeExpiredMessages().catch(error =>
      this.logger.warn(`Pembersihan chat gagal: ${error instanceof Error ? error.message : String(error)}`),
    );
    purge();
    this.purgeTimer = setInterval(purge, PURGE_INTERVAL_MS);
    this.purgeTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.purgeTimer) clearInterval(this.purgeTimer);
  }

  retentionCutoff(now = new Date()) {
    return new Date(now.getTime() - CHAT_RETENTION_MS);
  }

  async purgeExpiredMessages(now = new Date()) {
    const { count } = await this.prisma.message.deleteMany({ where: { createdAt: { lt: this.retentionCutoff(now) } } });
    if (count) this.logger.log(`${count} pesan chat lebih dari ${CHAT_RETENTION_DAYS} hari dihapus.`);
    return count;
  }

  async getMyChatRooms(userId: string) {
    // Queries also filter by the cutoff so expired messages never show between purge runs.
    const cutoff = this.retentionCutoff();
    const rooms = await this.prisma.chatRoom.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      include: {
        userA: { select: { id: true, name: true, avatarUrl: true } },
        userB: { select: { id: true, name: true, avatarUrl: true } },
        messages: { where: { createdAt: { gte: cutoff } }, orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { messages: { where: { isRead: false, senderId: { not: userId }, createdAt: { gte: cutoff } } } } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return rooms.map(({ _count, ...room }) => ({ ...room, unreadCount: _count.messages }));
  }

  async getOrCreateRoom(userId: string, otherUserId: string) {
    if (userId === otherUserId) throw new BadRequestException('Tidak bisa chat dengan diri sendiri.');

    const otherUser = await this.prisma.user.findUnique({ where: { id: otherUserId } });
    if (!otherUser) throw new NotFoundException('User tidak ditemukan.');

    const blocked = await this.prisma.userBlock.count({ where: { OR: [{ blockerId: userId, blockedId: otherUserId }, { blockerId: otherUserId, blockedId: userId }] } });
    if (blocked) throw new ForbiddenException('Chat tidak tersedia karena salah satu pengguna memblokir akun lainnya.');

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
      where: { chatRoomId: roomId, createdAt: { gte: this.retentionCutoff() } },
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
