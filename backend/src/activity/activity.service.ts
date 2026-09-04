import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ActivityService {
  constructor(private prisma: PrismaService) {}

  private parseImages(raw: string): string[] {
    try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  }

  private listingInclude = {
    seller: { select: { id: true, name: true, avatarUrl: true, isVerified: true } },
  } as const;

  private mapEntry<T extends { listing: { images: string } }>(entry: T) {
    return { ...entry, listing: { ...entry.listing, images: this.parseImages(entry.listing.images) } };
  }

  private async ensureListing(listingId: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId }, select: { id: true, sellerId: true, status: true } });
    if (!listing || listing.status !== 'ACTIVE') throw new NotFoundException('Listing tidak ditemukan.');
    return listing;
  }

  async wishlist(userId: string) {
    const items = await this.prisma.wishlist.findMany({
      where: { userId, listing: { status: 'ACTIVE' } },
      orderBy: { createdAt: 'desc' },
      include: { listing: { include: this.listingInclude } },
    });
    return items.map(item => this.mapEntry(item));
  }

  async save(userId: string, listingId: string) {
    const listing = await this.ensureListing(listingId);
    if (listing.sellerId === userId) throw new BadRequestException('Listing milik sendiri tidak perlu disimpan.');
    return this.prisma.wishlist.upsert({
      where: { userId_listingId: { userId, listingId } },
      create: { userId, listingId },
      update: {},
    });
  }

  async unsave(userId: string, listingId: string) {
    await this.prisma.wishlist.deleteMany({ where: { userId, listingId } });
  }

  async savedStatus(userId: string, listingId: string) {
    return { saved: Boolean(await this.prisma.wishlist.findUnique({
      where: { userId_listingId: { userId, listingId } }, select: { id: true },
    })) };
  }

  async recordView(userId: string, listingId: string) {
    const listing = await this.ensureListing(listingId);
    if (listing.sellerId === userId) return { recorded: false };
    await this.prisma.recentlyViewed.upsert({
      where: { userId_listingId: { userId, listingId } },
      create: { userId, listingId },
      update: { viewedAt: new Date() },
    });
    return { recorded: true };
  }

  async recent(userId: string) {
    const items = await this.prisma.recentlyViewed.findMany({
      where: { userId, listing: { status: 'ACTIVE' } },
      orderBy: { viewedAt: 'desc' }, take: 30,
      include: { listing: { include: this.listingInclude } },
    });
    return items.map(item => this.mapEntry(item));
  }
}
