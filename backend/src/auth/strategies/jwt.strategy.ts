// src/auth/strategies/jwt.strategy.ts
// Strategy untuk memvalidasi JWT token
// Dipakai oleh JwtAuthGuard secara otomatis

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService, config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  // Dipanggil otomatis setelah token terverifikasi
  // Return value akan di-inject ke request.user
  async validate(payload: { userId: string; tokenVersion?: number }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        isVerified: true,
        avatarUrl: true,
        tokenVersion: true,
      },
    });

    if (!user || !user.isActive || user.tokenVersion !== (payload.tokenVersion ?? 0)) {
      throw new UnauthorizedException('Sesi sudah tidak berlaku. Silakan masuk kembali.');
    }
    const { tokenVersion: _tokenVersion, ...authenticatedUser } = user;
    return authenticatedUser;
  }
}
