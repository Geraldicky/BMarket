// src/reviews/reviews.service.ts

import {
  Injectable, NotFoundException, ForbiddenException,
  BadRequestException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/review.dto';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async create(reviewerId: string, dto: CreateReviewDto) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: dto.transactionId },
      include: { review: true },
    });
    if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan.');
    if (transaction.buyerId !== reviewerId) throw new ForbiddenException('Hanya pembeli yang dapat memberikan review.');
    if (transaction.status !== 'COMPLETED') throw new BadRequestException('Review hanya dapat diberikan setelah transaksi selesai.');
    if (transaction.review) throw new ConflictException('Anda sudah memberikan review untuk transaksi ini.');

    return this.prisma.review.create({
      data: {
        transactionId: dto.transactionId,
        reviewerId,
        revieweeId: transaction.sellerId,
        rating: dto.rating,
        comment: dto.comment ?? null,
      },
    });
  }

  async getUserReviews(revieweeId: string) {
    const [reviews, aggregate] = await Promise.all([
      this.prisma.review.findMany({
        where: { revieweeId },
        orderBy: { createdAt: 'desc' },
        include: {
          reviewer: { select: { id: true, name: true, avatarUrl: true } },
          transaction: { include: { listing: { select: { title: true } } } },
        },
      }),
      this.prisma.review.aggregate({
        where: { revieweeId },
        _avg: { rating: true },
        _count: true,
      }),
    ]);
    return { reviews, avgRating: aggregate._avg.rating ?? 0, totalReviews: aggregate._count };
  }
}
