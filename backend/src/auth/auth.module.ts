// src/auth/auth.module.ts
// =============================================
// MODULE PATTERN — AuthModule
// =============================================
// Module adalah "wadah" yang mendaftarkan:
// - controllers: yang menangani HTTP request
// - providers: service yang berisi business logic
// - imports: module lain yang dibutuhkan
// - exports: apa yang bisa dipakai module lain
//
// Dengan Module, NestJS tahu persis apa yang
// dibutuhkan AuthModule dan melakukan Dependency
// Injection secara otomatis.
// =============================================

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule], inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ secret: config.getOrThrow<string>('JWT_SECRET'), signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '7d') as any } }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, EmailService, JwtStrategy],
  exports: [JwtModule],  // Ekspor JwtModule agar modul lain bisa pakai JwtService
})
export class AuthModule {}
