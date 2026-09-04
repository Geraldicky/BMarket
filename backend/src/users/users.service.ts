import { Injectable, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto, ChangePasswordDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  private parseImages(raw: string): string[] {
    try {
      const value = JSON.parse(raw);
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  async getPublicProfile(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        bio: true,
        isVerified: true,
        isActive: true,
        createdAt: true,
      },
    });
    if (!user || !user.isActive) throw new NotFoundException('User tidak ditemukan.');

    const [rating, completedSales, activeListingCount, activeListings, reviews] = await Promise.all([
      this.prisma.review.aggregate({
        where: { revieweeId: id },
        _avg: { rating: true },
        _count: true,
      }),
      this.prisma.transaction.count({ where: { sellerId: id, status: 'COMPLETED' } }),
      this.prisma.listing.count({ where: { sellerId: id, status: 'ACTIVE' } }),
      this.prisma.listing.findMany({
        where: { sellerId: id, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        take: 12,
        select: {
          id: true,
          title: true,
          description: true,
          price: true,
          category: true,
          type: true,
          images: true,
          status: true,
          condition: true,
          stock: true,
          stockLeft: true,
          fulfillmentMethods: true,
          sellerId: true,
          createdAt: true,
        },
      }),
      this.prisma.review.findMany({
        where: { revieweeId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          reviewer: { select: { id: true, name: true, avatarUrl: true } },
          transaction: {
            select: {
              listingTitleSnapshot: true,
              listing: { select: { title: true } },
            },
          },
        },
      }),
    ]);

    return {
      id: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      avgRating: Number(rating._avg.rating ?? 0),
      totalReviews: rating._count,
      completedSales,
      activeListingCount,
      listings: activeListings.map(listing => ({ ...listing, images: this.parseImages(listing.images) })),
      reviews: reviews.map(review => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        reviewer: review.reviewer,
        listingTitle: review.transaction.listingTitleSnapshot || review.transaction.listing.title,
      })),
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.name !== undefined && dto.name.trim().length === 0) {
      throw new BadRequestException('Nama tidak boleh kosong.');
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
      },
      select: {
        id: true, email: true, name: true, phone: true,
        bio: true, avatarUrl: true, studentId: true,
      },
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User tidak ditemukan.');

    const valid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!valid) throw new UnauthorizedException('Password lama tidak sesuai.');

    const hashed = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashed, tokenVersion: { increment: 1 } },
    });
    return { message: 'Password berhasil diubah.' };
  }
}
