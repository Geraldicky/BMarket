// src/reviews/reviews.controller.ts

import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/review.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('reviews')
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  async create(@CurrentUser() user: any, @Body() dto: CreateReviewDto) {
    const data = await this.reviewsService.create(user.id, dto);
    return { success: true, message: 'Review berhasil dikirim.', data };
  }

  @Get('user/:userId')
  async getUserReviews(@Param('userId') userId: string) {
    const result = await this.reviewsService.getUserReviews(userId);
    return { success: true, ...result };
  }
}
