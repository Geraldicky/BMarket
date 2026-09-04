import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SafetyService } from './safety.service';

function createPrisma() {
  return {
    user: { findUnique: vi.fn() },
    userBlock: {
      upsert: vi.fn(), deleteMany: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(),
    },
  };
}

describe('SafetyService — block/unblock rules', () => {
  let prisma: ReturnType<typeof createPrisma>;
  let service: SafetyService;

  beforeEach(() => {
    prisma = createPrisma();
    service = new SafetyService(prisma as never);
  });

  it('rejects blocking yourself', async () => {
    await expect(service.block('user-1', 'user-1')).rejects.toThrow(/diri sendiri/i);
  });

  it('rejects blocking a user that does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.block('user-1', 'missing')).rejects.toThrow(/pengguna tidak ditemukan/i);
  });

  it('persists one block relationship using upsert', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-2' });
    prisma.userBlock.upsert.mockResolvedValue({ id: 'block-1' });

    await service.block('user-1', 'user-2');
    expect(prisma.userBlock.upsert).toHaveBeenCalledWith({
      where: { blockerId_blockedId: { blockerId: 'user-1', blockedId: 'user-2' } },
      create: { blockerId: 'user-1', blockedId: 'user-2' },
      update: {},
    });
  });

  it('unblocks only the requested relationship', async () => {
    prisma.userBlock.deleteMany.mockResolvedValue({ count: 1 });
    await service.unblock('user-1', 'user-2');
    expect(prisma.userBlock.deleteMany).toHaveBeenCalledWith({ where: { blockerId: 'user-1', blockedId: 'user-2' } });
  });

  it('returns direct block status', async () => {
    prisma.userBlock.findUnique.mockResolvedValue({ id: 'block-1' });
    await expect(service.status('user-1', 'user-2')).resolves.toEqual({ blocked: true });
  });

  it('detects a block in either direction for chat enforcement', async () => {
    prisma.userBlock.count.mockResolvedValue(1);
    await expect(service.isBlockedEitherWay('user-1', 'user-2')).resolves.toBe(true);
    expect(prisma.userBlock.count).toHaveBeenCalledWith({ where: { OR: [
      { blockerId: 'user-1', blockedId: 'user-2' },
      { blockerId: 'user-2', blockedId: 'user-1' },
    ] } });
  });

  it('lists users blocked by the current user newest first', async () => {
    prisma.userBlock.findMany.mockResolvedValue([]);
    await service.blocks('user-1');
    expect(prisma.userBlock.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { blockerId: 'user-1' }, orderBy: { createdAt: 'desc' } }));
  });
});
