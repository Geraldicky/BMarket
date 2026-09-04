// src/auth/auth.controller.ts
// =============================================
// Controller NestJS vs Express:
//
// Express:
//   router.post('/register', authController.register)
//   const { email } = req.body  // manual extract
//
// NestJS:
//   @Post('register')           // decorator langsung di method
//   register(@Body() dto)       // otomatis di-parse & divalidasi
// =============================================

import { Controller, Post, Get, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResendVerificationDto,
  ResetPasswordDto,
  VerifyEmailDto,
  VerifyPasswordResetDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('auth')  // Prefix: /api/auth
export class AuthController {
  // Dependency Injection otomatis oleh NestJS
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    // @Body() otomatis parse + validasi dengan class-validator
    // Tidak perlu cek manual if (!email || !password)
    const result = await this.authService.register(dto);
    return {
      success: true,
      message: 'Kode verifikasi telah dikirim ke email BINUS kamu.',
      data: result,
    };
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    const result = await this.authService.verifyEmail(dto);
    return {
      success: true,
      message: 'Email berhasil diverifikasi. Selamat datang di BMarket!',
      data: result,
    };
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Body() dto: ResendVerificationDto) {
    const result = await this.authService.resendVerification(dto);
    return {
      success: true,
      message: 'Jika akun menunggu verifikasi, kode baru telah dikirim.',
      data: result,
    };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    const result = await this.authService.forgotPassword(dto);
    return {
      success: true,
      message: 'Jika email terdaftar dan aktif, kode reset telah dikirim.',
      data: result,
    };
  }

  @Post('verify-reset-code')
  @HttpCode(HttpStatus.OK)
  async verifyPasswordReset(@Body() dto: VerifyPasswordResetDto) {
    const result = await this.authService.verifyPasswordReset(dto);
    return {
      success: true,
      message: 'Kode benar. Silakan buat password baru.',
      data: result,
    };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    const result = await this.authService.resetPassword(dto);
    return {
      success: true,
      message: 'Password berhasil diubah. Silakan masuk kembali.',
      data: result,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto);
    return {
      success: true,
      message: `Selamat datang kembali, ${result.user.name}!`,
      data: result,
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)  // Proteksi endpoint, menggantikan authenticate middleware
  async getMe(@CurrentUser() user: any) {
    const result = await this.authService.getMe(user.id);
    return { success: true, data: result };
  }
}
