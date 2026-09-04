import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActivityService } from './activity.service';

function createPrisma() {
  return {
    listing: { findUnique: vi.fn() },
    wishlist: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      findUnique: vi.fn(),
    },
    recentlyViewed: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
  };
}

describe('ActivityService — wishlist & recently viewed', () => {
  let prisma: ReturnType<typeof createPrisma>;
  let service: ActivityService;

  beforeEach(() => {
    prisma = createPrisma();
    service = new ActivityService(prisma as never);
  });

  it('saves an active listing exactly once using the compound unique key', async () => {
    prisma.listing.findUnique.mockResolvedValue({ id: 'listing-1', sellerId: 'seller-1', status: 'ACTIVE' });
    prisma.wishlist.upsert.mockResolvedValue({ id: 'wish-1', userId: 'buyer-1', listingId: 'listing-1' });

    await service.save('buyer-1', 'listing-1');

    expect(prisma.wishlist.upsert).toHaveBeenCalledWith({
      where: { userId_listingId: { userId: 'buyer-1', listingId: 'listing-1' } },
      create: { userId: 'buyer-1', listingId: 'listing-1' },
      update: {},
    });
  });

  it('rejects saving your own listing', async () => {
    prisma.listing.findUnique.mockResolvedValue({ id: 'listing-1', sellerId: 'buyer-1', status: 'ACTIVE' });

    await expect(service.save('buyer-1', 'listing-1')).rejects.toThrow(/milik sendiri/i);
    expect(prisma.wishlist.upsert).not.toHaveBeenCalled();
  });

  it('rejects wishlist/recent activity for unavailable listings', async () => {
    prisma.listing.findUnique.mockResolvedValue({ id: 'listing-1', sellerId: 'seller-1', status: 'HIDDEN' });

    await expect(service.save('buyer-1', 'listing-1')).rejects.toThrow(/tidak ditemukan/i);
    await expect(service.recordView('buyer-1', 'listing-1')).rejects.toThrow(/tidak ditemukan/i);
  });

  it('returns persisted wishlist entries with parsed listing images', async () => {
    prisma.wishlist.findMany.mockResolvedValue([
      { id: 'wish-1', listing: { id: 'listing-1', images: '["one.jpg","two.jpg"]' } },
    ]);

    const result = await service.wishlist('buyer-1');

    expect(result[0].listing.images).toEqual(['one.jpg', 'two.jpg']);
    expect(prisma.wishlist.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'buyer-1', listing: { status: 'ACTIVE' } },
    }));
  });

  it('unsaves only the requested user/listing pair', async () => {
    prisma.wishlist.deleteMany.mockResolvedValue({ count: 1 });

    await service.unsave('buyer-1', 'listing-1');

    expect(prisma.wishlist.deleteMany).toHaveBeenCalledWith({ where: { userId: 'buyer-1', listingId: 'listing-1' } });
  });

  it('reports saved status from the persisted wishlist row', async () => {
    prisma.wishlist.findUnique.mockResolvedValue({ id: 'wish-1' });
    await expect(service.savedStatus('buyer-1', 'listing-1')).resolves.toEqual({ saved: true });

    prisma.wishlist.findUnique.mockResolvedValue(null);
    await expect(service.savedStatus('buyer-1', 'listing-1')).resolves.toEqual({ saved: false });
  });

  it('does not record the seller viewing their own listing', async () => {
    prisma.listing.findUnique.mockResolvedValue({ id: 'listing-1', sellerId: 'seller-1', status: 'ACTIVE' });

    await expect(service.recordView('seller-1', 'listing-1')).resolves.toEqual({ recorded: false });
    expect(prisma.recentlyViewed.upsert).not.toHaveBeenCalled();
  });

  it('upserts recently viewed and returns newest active listings first', async () => {
    prisma.listing.findUnique.mockResolvedValue({ id: 'listing-1', sellerId: 'seller-1', status: 'ACTIVE' });
    prisma.recentlyViewed.upsert.mockResolvedValue({});

    await expect(service.recordView('buyer-1', 'listing-1')).resolves.toEqual({ recorded: true });
    expect(prisma.recentlyViewed.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_listingId: { userId: 'buyer-1', listingId: 'listing-1' } },
      update: { viewedAt: expect.any(Date) },
    }));

    prisma.recentlyViewed.findMany.mockResolvedValue([
      { id: 'recent-1', listing: { id: 'listing-1', images: 'not-json' } },
    ]);
    const recent = await service.recent('buyer-1');
    expect(recent[0].listing.images).toEqual([]);
    expect(prisma.recentlyViewed.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { viewedAt: 'desc' },
      take: 30,
    }));
  });
});
