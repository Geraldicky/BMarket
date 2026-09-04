// src/users/users.service.ts

import { Injectable, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto, ChangePasswordDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getPublicProfile(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, avatarUrl: true,
        bio: true, isVerified: true, createdAt: true,
        _count: { select: { listings: true, reviewsReceived: true } },
      },
    });
    if (!user) throw new NotFoundException('User tidak ditemukan.');

    const avg = await this.prisma.review.aggregate({
      where: { revieweeId: id },
      _avg: { rating: true },
    });

    return { ...user, avgRating: avg._avg.rating ?? 0 };
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
