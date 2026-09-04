import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  private listingInclude = { seller: { select: { id: true, name: true, avatarUrl: true, isVerified: true } } } as const;

  async wishlist(userId: string) {
    const items = await this.prisma.wishlist.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, include: { listing: { include: this.listingInclude } } });
    return items.map(item => ({ ...item, listing: this.parseListing(item.listing) }));
  }

  async save(userId: string, listingId: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId }, select: { id: true, status: true, sellerId: true } });
    if (!listing || !['ACTIVE', 'SOLD'].includes(listing.status)) throw new NotFoundException('Listing tidak ditemukan.');
    if (listing.sellerId === userId) throw new BadRequestException('Listing milik sendiri tidak perlu disimpan.');
    return this.prisma.wishlist.upsert({ where: { userId_listingId: { userId, listingId } }, create: { userId, listingId }, update: {} });
  }

  async remove(userId: string, listingId: string) {
    await this.prisma.wishlist.deleteMany({ where: { userId, listingId } });
    return { saved: false };
  }

  async status(userId: string, listingId: string) {
    return { saved: Boolean(await this.prisma.wishlist.findUnique({ where: { userId_listingId: { userId, listingId } }, select: { id: true } })) };
  }

  async recordView(userId: string, listingId: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId }, select: { id: true } });
    if (!listing) throw new NotFoundException('Listing tidak ditemukan.');
    return this.prisma.recentlyViewed.upsert({ where: { userId_listingId: { userId, listingId } }, create: { userId, listingId }, update: { viewedAt: new Date() } });
  }

  async recent(userId: string) {
    const items = await this.prisma.recentlyViewed.findMany({ where: { userId }, orderBy: { viewedAt: 'desc' }, take: 30, include: { listing: { include: this.listingInclude } } });
    return items.map(item => ({ ...item, listing: this.parseListing(item.listing) }));
  }

  private parseListing<T extends { images: string }>(listing: T) {
    try { return { ...listing, images: JSON.parse(listing.images) as string[] }; }
    catch { return { ...listing, images: [] as string[] }; }
  }
}
