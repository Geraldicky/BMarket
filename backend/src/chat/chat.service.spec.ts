import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatService } from './chat.service';

function createPrisma() {
  return {
    user: { findUnique: vi.fn() },
    userBlock: { count: vi.fn() },
    chatRoom: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    message: { findMany: vi.fn(), updateMany: vi.fn() },
  };
}

describe('ChatService — meetup coordination safety', () => {
  let prisma: ReturnType<typeof createPrisma>;
  let service: ChatService;

  beforeEach(() => {
    prisma = createPrisma();
    service = new ChatService(prisma as never);
  });

  it('rejects chatting with yourself', async () => {
    await expect(service.getOrCreateRoom('user-1', 'user-1')).rejects.toThrow(/diri sendiri/i);
  });

  it('rejects chat if either participant has blocked the other', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-2' });
    prisma.userBlock.count.mockResolvedValue(1);

    await expect(service.getOrCreateRoom('user-1', 'user-2')).rejects.toThrow(/memblokir/i);
    expect(prisma.chatRoom.create).not.toHaveBeenCalled();
  });

  it('normalizes participant ordering so one pair maps to one room', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'z-user' });
    prisma.userBlock.count.mockResolvedValue(0);
    prisma.chatRoom.findUnique.mockResolvedValue(null);
    prisma.chatRoom.create.mockResolvedValue({ id: 'room-1', userAId: 'a-user', userBId: 'z-user' });

    await service.getOrCreateRoom('a-user', 'z-user');
    expect(prisma.chatRoom.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { userAId_userBId: { userAId: 'a-user', userBId: 'z-user' } },
    }));
    expect(prisma.chatRoom.create).toHaveBeenCalledWith(expect.objectContaining({ data: { userAId: 'a-user', userBId: 'z-user' } }));
  });

  it('reuses an existing room instead of creating a duplicate', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-2' });
    prisma.userBlock.count.mockResolvedValue(0);
    prisma.chatRoom.findUnique.mockResolvedValue({ id: 'room-existing', userAId: 'user-1', userBId: 'user-2' });

    await expect(service.getOrCreateRoom('user-2', 'user-1')).resolves.toEqual(expect.objectContaining({ id: 'room-existing' }));
    expect(prisma.chatRoom.create).not.toHaveBeenCalled();
  });

  it('rejects message history access by a non-participant', async () => {
    prisma.chatRoom.findUnique.mockResolvedValue({ id: 'room-1', userAId: 'user-1', userBId: 'user-2' });
    await expect(service.getRoomMessages('room-1', 'intruder')).rejects.toThrow(/akses ditolak/i);
  });

  it('returns messages oldest-to-newest and marks incoming messages read', async () => {
    prisma.chatRoom.findUnique.mockResolvedValue({ id: 'room-1', userAId: 'user-1', userBId: 'user-2' });
    prisma.message.findMany.mockResolvedValue([
      { id: 'm-2', createdAt: new Date('2026-09-04T10:02:00Z') },
      { id: 'm-1', createdAt: new Date('2026-09-04T10:01:00Z') },
    ]);
    prisma.message.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.getRoomMessages('room-1', 'user-1', 1, 50);
    expect(result.map(message => message.id)).toEqual(['m-1', 'm-2']);
    expect(prisma.message.updateMany).toHaveBeenCalledWith({
      where: { chatRoomId: 'room-1', senderId: { not: 'user-1' }, isRead: false },
      data: { isRead: true },
    });
  });
});
