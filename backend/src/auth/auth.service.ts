import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import {
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResendVerificationDto,
  ResetPasswordDto,
  VerifyEmailDto,
  VerifyPasswordResetDto,
} from './dto/auth.dto';

const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  studentId: true,
  role: true,
  isVerified: true,
  avatarUrl: true,
  tokenVersion: true,
} as const;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  private get otpTtlMinutes(): number {
    return this.positiveInteger('OTP_TTL_MINUTES', 10);
  }

  private get otpResendSeconds(): number {
    return this.positiveInteger('OTP_RESEND_SECONDS', 60);
  }

  private get otpMaxAttempts(): number {
    return this.positiveInteger('OTP_MAX_ATTEMPTS', 5);
  }

  private positiveInteger(key: string, fallback: number): number {
    const value = Number(process.env[key]);
    return Number.isInteger(value) && value > 0 ? value : fallback;
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private verifySSODomain(email: string): boolean {
    const parts = email.split('@');
    const domain = `@${parts[parts.length - 1] || ''}`;
    const allowed = (process.env.SSO_ALLOWED_DOMAINS ?? '@binus.ac.id,@student.binus.ac.id,@binus.edu')
      .split(',')
      .map(value => value.trim().toLowerCase())
      .filter(Boolean);
    return allowed.includes(domain);
  }

  private requireBinusEmail(email: string): void {
    if (!this.verifySSODomain(email)) {
      throw new BadRequestException(
        'Email harus menggunakan domain BINUS (@binus.ac.id atau @student.binus.ac.id).',
      );
    }
  }

  private generateToken(userId: string, tokenVersion: number): string {
    return this.jwtService.sign({ userId, tokenVersion });
  }

  private hashOtp(userId: string, code: string): string {
    const secret = process.env.OTP_HASH_SECRET?.trim() || process.env.JWT_SECRET || '';
    return createHmac('sha256', secret).update(`${userId}:${code}`).digest('hex');
  }

  private hashPasswordReset(userId: string, type: 'code' | 'token', value: string): string {
    const secret = process.env.OTP_HASH_SECRET?.trim() || process.env.JWT_SECRET || '';
    return createHmac('sha256', secret).update(`password-reset:${type}:${userId}:${value}`).digest('hex');
  }

  private otpMatches(expected: string, actual: string): boolean {
    const expectedBuffer = Buffer.from(expected, 'hex');
    const actualBuffer = Buffer.from(actual, 'hex');
    return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return email;
    const visible = local.slice(0, Math.min(2, local.length));
    return `${visible}${'*'.repeat(Math.max(3, local.length - visible.length))}@${domain}`;
  }

  private pendingResponse(email: string) {
    return {
      verificationRequired: true as const,
      email,
      maskedEmail: this.maskEmail(email),
      expiresInSeconds: this.otpTtlMinutes * 60,
      resendAfterSeconds: this.otpResendSeconds,
    };
  }

  private passwordResetPendingResponse(email: string) {
    return {
      email,
      maskedEmail: this.maskEmail(email),
      expiresInSeconds: this.otpTtlMinutes * 60,
      resendAfterSeconds: this.otpResendSeconds,
    };
  }

  private withoutTokenVersion<T extends { tokenVersion: number }>(user: T): Omit<T, 'tokenVersion'> {
    const { tokenVersion: _tokenVersion, ...publicUser } = user;
    return publicUser;
  }

  private async issueVerificationCode(
    user: { id: string; email: string; name: string },
    enforceCooldown: boolean,
  ): Promise<void> {
    const current = await this.prisma.emailVerification.findUnique({ where: { userId: user.id } });
    if (enforceCooldown && current) {
      const elapsedSeconds = Math.floor((Date.now() - current.lastSentAt.getTime()) / 1000);
      const waitSeconds = this.otpResendSeconds - elapsedSeconds;
      if (waitSeconds > 0) {
        throw new HttpException({
          code: 'OTP_RESEND_COOLDOWN',
          message: `Tunggu ${waitSeconds} detik sebelum meminta kode baru.`,
          retryAfterSeconds: waitSeconds,
        }, HttpStatus.TOO_MANY_REQUESTS);
      }
    }

    const code = randomInt(100000, 1_000_000).toString();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.otpTtlMinutes * 60_000);
    const codeHash = this.hashOtp(user.id, code);
    await this.prisma.emailVerification.upsert({
      where: { userId: user.id },
      create: { userId: user.id, codeHash, expiresAt, attempts: 0, lastSentAt: now },
      update: { codeHash, expiresAt, attempts: 0, lastSentAt: now },
    });

    try {
      await this.emailService.sendVerificationCode(user.email, code, user.name);
    } catch (error) {
      await this.prisma.emailVerification.deleteMany({ where: { userId: user.id } });
      throw error;
    }
  }

  async register(dto: RegisterDto) {
    const email = this.normalizeEmail(dto.email);
    this.requireBinusEmail(email);

    const studentId = dto.studentId?.trim() || null;
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing?.isVerified) throw new ConflictException('Email sudah terdaftar. Silakan masuk.');

    if (studentId) {
      const studentIdOwner = await this.prisma.user.findUnique({ where: { studentId } });
      if (studentIdOwner && studentIdOwner.email !== email) {
        throw new ConflictException('NIM sudah digunakan oleh akun lain.');
      }
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: { password: hashedPassword, name: dto.name.trim(), studentId, isActive: true },
          select: publicUserSelect,
        })
      : await this.prisma.user.create({
          data: {
            email,
            password: hashedPassword,
            name: dto.name.trim(),
            studentId,
            isVerified: false,
            role: 'STUDENT',
          },
          select: publicUserSelect,
        });

    await this.issueVerificationCode(user, Boolean(existing));
    return this.pendingResponse(email);
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const email = this.normalizeEmail(dto.email);
    this.requireBinusEmail(email);

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new BadRequestException('Kode verifikasi tidak valid atau sudah kedaluwarsa.');
    if (user.isVerified) throw new ConflictException('Email sudah terverifikasi. Silakan masuk.');

    const verification = await this.prisma.emailVerification.findUnique({ where: { userId: user.id } });
    if (!verification || verification.expiresAt.getTime() <= Date.now()) {
      if (verification) {
        await this.prisma.emailVerification.deleteMany({ where: { userId: user.id } });
      }
      throw new BadRequestException({
        code: 'OTP_EXPIRED',
        message: 'Kode sudah kedaluwarsa. Minta kode baru untuk melanjutkan.',
      });
    }
    if (verification.attempts >= this.otpMaxAttempts) {
      throw new HttpException({
        code: 'OTP_ATTEMPTS_EXCEEDED',
        message: 'Terlalu banyak percobaan. Minta kode baru untuk melanjutkan.',
      }, HttpStatus.TOO_MANY_REQUESTS);
    }

    const suppliedHash = this.hashOtp(user.id, dto.code);
    if (!this.otpMatches(verification.codeHash, suppliedHash)) {
      const attempts = verification.attempts + 1;
      await this.prisma.emailVerification.update({
        where: { userId: user.id },
        data: { attempts },
      });
      const remaining = Math.max(0, this.otpMaxAttempts - attempts);
      throw new BadRequestException({
        code: remaining ? 'OTP_INVALID' : 'OTP_ATTEMPTS_EXCEEDED',
        message: remaining
          ? `Kode verifikasi salah. Tersisa ${remaining} percobaan.`
          : 'Terlalu banyak percobaan. Minta kode baru untuk melanjutkan.',
      });
    }

    const verifiedUser = await this.prisma.$transaction(async transaction => {
      const updated = await transaction.user.update({
        where: { id: user.id },
        data: { isVerified: true },
        select: publicUserSelect,
      });
      await transaction.emailVerification.delete({ where: { userId: user.id } });
      return updated;
    });

    return {
      user: this.withoutTokenVersion(verifiedUser),
      token: this.generateToken(verifiedUser.id, verifiedUser.tokenVersion),
    };
  }

  async resendVerification(dto: ResendVerificationDto) {
    const email = this.normalizeEmail(dto.email);
    this.requireBinusEmail(email);
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Respons generik untuk akun yang tidak ada/sudah aktif agar endpoint tidak
    // bisa dipakai untuk menebak email mana yang terdaftar.
    if (!user || user.isVerified) return this.pendingResponse(email);

    await this.issueVerificationCode(user, true);
    return this.pendingResponse(email);
  }

  async login(dto: LoginDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Email atau password salah.');
    if (!user.isActive) throw new UnauthorizedException('Akun Anda telah dinonaktifkan. Hubungi admin.');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Email atau password salah.');
    if (!this.verifySSODomain(user.email)) throw new UnauthorizedException('Verifikasi domain BINUS gagal.');
    if (!user.isVerified) {
      throw new ForbiddenException({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Email kampus belum diverifikasi. Masukkan kode OTP untuk melanjutkan.',
      });
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        studentId: user.studentId,
        role: user.role,
        isVerified: user.isVerified,
        avatarUrl: user.avatarUrl,
      },
      token: this.generateToken(user.id, user.tokenVersion),
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const startedAt = Date.now();
    const email = this.normalizeEmail(dto.email);
    this.requireBinusEmail(email);
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user?.isVerified && user.isActive) {
      const current = await this.prisma.passwordReset.findUnique({ where: { userId: user.id } });
      const elapsedSeconds = current
        ? Math.floor((Date.now() - current.lastSentAt.getTime()) / 1000)
        : this.otpResendSeconds;

      if (!current || elapsedSeconds >= this.otpResendSeconds) {
        try {
          await this.issuePasswordResetCode(user);
        } catch (error) {
          // Respons tetap generik agar status sebuah akun tidak dapat ditebak.
          this.logger.warn(
            `Permintaan reset untuk ${email} tidak dapat dikirim: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }

    // Mengurangi perbedaan waktu yang mudah diamati untuk email yang tidak terdaftar.
    const configuredDelay = Number(process.env.PASSWORD_RESET_MIN_RESPONSE_MS);
    const minimumResponseMs = Number.isFinite(configuredDelay) && configuredDelay >= 0
      ? configuredDelay
      : 350;
    const remainingDelay = Math.max(0, minimumResponseMs - (Date.now() - startedAt));
    if (remainingDelay) await new Promise(resolve => setTimeout(resolve, remainingDelay));
    return this.passwordResetPendingResponse(email);
  }

  private async issuePasswordResetCode(user: { id: string; email: string; name: string }): Promise<void> {
    const code = randomInt(100000, 1_000_000).toString();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.otpTtlMinutes * 60_000);
    await this.prisma.passwordReset.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        codeHash: this.hashPasswordReset(user.id, 'code', code),
        expiresAt,
        attempts: 0,
        lastSentAt: now,
      },
      update: {
        codeHash: this.hashPasswordReset(user.id, 'code', code),
        expiresAt,
        attempts: 0,
        lastSentAt: now,
        resetTokenHash: null,
        resetTokenExpiresAt: null,
      },
    });

    try {
      await this.emailService.sendPasswordResetCode(user.email, code, user.name);
    } catch (error) {
      await this.prisma.passwordReset.deleteMany({ where: { userId: user.id } });
      throw error;
    }
  }

  async verifyPasswordReset(dto: VerifyPasswordResetDto) {
    const email = this.normalizeEmail(dto.email);
    this.requireBinusEmail(email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isVerified || !user.isActive) {
      throw new BadRequestException('Kode reset tidak valid atau sudah kedaluwarsa.');
    }

    const request = await this.prisma.passwordReset.findUnique({ where: { userId: user.id } });
    if (!request || request.expiresAt.getTime() <= Date.now() || request.resetTokenHash) {
      if (request?.expiresAt.getTime() <= Date.now()) {
        await this.prisma.passwordReset.deleteMany({ where: { userId: user.id } });
      }
      throw new BadRequestException({
        code: 'PASSWORD_RESET_EXPIRED',
        message: 'Kode reset tidak valid atau sudah kedaluwarsa. Minta kode baru.',
      });
    }
    if (request.attempts >= this.otpMaxAttempts) {
      throw new HttpException({
        code: 'PASSWORD_RESET_ATTEMPTS_EXCEEDED',
        message: 'Terlalu banyak percobaan. Minta kode reset baru.',
      }, HttpStatus.TOO_MANY_REQUESTS);
    }

    const suppliedHash = this.hashPasswordReset(user.id, 'code', dto.code);
    if (!this.otpMatches(request.codeHash, suppliedHash)) {
      const attempts = request.attempts + 1;
      await this.prisma.passwordReset.update({
        where: { userId: user.id },
        data: { attempts },
      });
      const remaining = Math.max(0, this.otpMaxAttempts - attempts);
      throw new BadRequestException({
        code: remaining ? 'PASSWORD_RESET_CODE_INVALID' : 'PASSWORD_RESET_ATTEMPTS_EXCEEDED',
        message: remaining
          ? `Kode reset salah. Tersisa ${remaining} percobaan.`
          : 'Terlalu banyak percobaan. Minta kode reset baru.',
      });
    }

    const resetToken = randomBytes(32).toString('hex');
    const resetTokenExpiresAt = new Date(Date.now() + this.otpTtlMinutes * 60_000);
    await this.prisma.passwordReset.update({
      where: { userId: user.id },
      data: {
        codeHash: '',
        expiresAt: new Date(),
        resetTokenHash: this.hashPasswordReset(user.id, 'token', resetToken),
        resetTokenExpiresAt,
      },
    });

    return { resetToken, expiresInSeconds: this.otpTtlMinutes * 60 };
  }

  async resetPassword(dto: ResetPasswordDto) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Konfirmasi password belum sama.');
    }

    const email = this.normalizeEmail(dto.email);
    this.requireBinusEmail(email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isVerified || !user.isActive) {
      throw new BadRequestException('Sesi reset tidak valid atau sudah kedaluwarsa.');
    }
    const request = await this.prisma.passwordReset.findUnique({ where: { userId: user.id } });
    const suppliedHash = this.hashPasswordReset(user.id, 'token', dto.resetToken);
    if (
      !request?.resetTokenHash ||
      !request.resetTokenExpiresAt ||
      request.resetTokenExpiresAt.getTime() <= Date.now() ||
      !this.otpMatches(request.resetTokenHash, suppliedHash)
    ) {
      throw new BadRequestException({
        code: 'PASSWORD_RESET_SESSION_INVALID',
        message: 'Sesi reset tidak valid atau sudah kedaluwarsa. Minta kode baru.',
      });
    }
    if (await bcrypt.compare(dto.password, user.password)) {
      throw new BadRequestException('Password baru tidak boleh sama dengan password sebelumnya.');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    await this.prisma.$transaction(async transaction => {
      await transaction.user.update({
        where: { id: user.id },
        data: { password: hashedPassword, tokenVersion: { increment: 1 } },
      });
      await transaction.passwordReset.delete({ where: { userId: user.id } });
    });

    try {
      await this.emailService.sendPasswordChangedNotice(user.email, user.name);
    } catch (error) {
      // Password sudah aman tersimpan; kegagalan notifikasi tidak membatalkan reset.
      this.logger.warn(
        `Notifikasi perubahan password gagal untuk ${email}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return { passwordReset: true };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, name: true, studentId: true,
        phone: true, bio: true, avatarUrl: true, role: true,
        isVerified: true, balance: true, escrow: true, createdAt: true,
        _count: { select: { listings: true, buyerTransactions: true, sellerTransactions: true, reviewsReceived: true } },
      },
    });
    if (!user) throw new UnauthorizedException('User tidak ditemukan.');
    return user;
  }
}
