import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}
  list(userId: string) { return this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100 }); }
  async unreadCount(userId: string) { return { count: await this.prisma.notification.count({ where: { userId, isRead: false } }) }; }
  async markRead(userId: string, id: string) {
    const item = await this.prisma.notification.findUnique({ where: { id } });
    if (!item || item.userId !== userId) throw new NotFoundException('Notifikasi tidak ditemukan.');
    return this.prisma.notification.update({ where: { id }, data: { isRead: true } });
  }
  async markAllRead(userId: string) { const result = await this.prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } }); return { updated: result.count }; }
  create(userId: string, type: NotificationType, title: string, body: string, entityType?: string, entityId?: string) { return this.prisma.notification.create({ data: { userId, type, title, body, entityType, entityId } }); }
  createMany(rows: { userId: string; type: NotificationType; title: string; body: string; entityType?: string; entityId?: string }[]) { return rows.length ? this.prisma.notification.createMany({ data: rows }) : Promise.resolve({ count: 0 }); }
}
