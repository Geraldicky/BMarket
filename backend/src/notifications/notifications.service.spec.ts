import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationsService } from './notifications.service';

function createPrisma() {
  return {
    notification: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
    },
  };
}

describe('NotificationsService — in-app notifications', () => {
  let prisma: ReturnType<typeof createPrisma>;
  let service: NotificationsService;

  beforeEach(() => {
    prisma = createPrisma();
    service = new NotificationsService(prisma as never);
  });

  it('lists only the current user notifications newest first', async () => {
    prisma.notification.findMany.mockResolvedValue([{ id: 'n-1' }]);
    await service.list('user-1');
    expect(prisma.notification.findMany).toHaveBeenCalledWith({ where: { userId: 'user-1' }, orderBy: { createdAt: 'desc' }, take: 100 });
  });

  it('returns unread count', async () => {
    prisma.notification.count.mockResolvedValue(3);
    await expect(service.unreadCount('user-1')).resolves.toEqual({ count: 3 });
  });

  it('marks an owned notification as read', async () => {
    prisma.notification.findUnique.mockResolvedValue({ id: 'n-1', userId: 'user-1', isRead: false });
    prisma.notification.update.mockResolvedValue({ id: 'n-1', userId: 'user-1', isRead: true });

    await service.markRead('user-1', 'n-1');
    expect(prisma.notification.update).toHaveBeenCalledWith({ where: { id: 'n-1' }, data: { isRead: true } });
  });

  it('does not let another user mark a notification as read', async () => {
    prisma.notification.findUnique.mockResolvedValue({ id: 'n-1', userId: 'user-2', isRead: false });
    await expect(service.markRead('user-1', 'n-1')).rejects.toThrow(/tidak ditemukan/i);
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  it('marks all unread notifications for one user only', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 4 });
    await expect(service.markAllRead('user-1')).resolves.toEqual({ updated: 4 });
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({ where: { userId: 'user-1', isRead: false }, data: { isRead: true } });
  });

  it('creates a transaction notification with entity context', async () => {
    prisma.notification.create.mockResolvedValue({ id: 'n-1' });
    await service.create('user-1', 'TRANSACTION', 'Pembayaran diterima', 'Dana aman di escrow.', 'TRANSACTION', 'tx-1');
    expect(prisma.notification.create).toHaveBeenCalledWith({ data: {
      userId: 'user-1', type: 'TRANSACTION', title: 'Pembayaran diterima', body: 'Dana aman di escrow.', entityType: 'TRANSACTION', entityId: 'tx-1',
    } });
  });

  it('does not issue an empty createMany query', async () => {
    await expect(service.createMany([])).resolves.toEqual({ count: 0 });
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });
});
