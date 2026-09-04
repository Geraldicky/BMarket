// src/auth/dto/auth.dto.ts
// Data Transfer Object — validasi input otomatis dengan class-validator
// Menggantikan validasi manual if (!email || !password) di Express

import { IsEmail, IsString, MinLength, MaxLength, IsOptional, Matches } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Format email tidak valid.' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password minimal 8 karakter.' })
  @MaxLength(72, { message: 'Password maksimal 72 karakter.' })
  password: string;

  @IsString({ message: 'Nama wajib diisi.' })
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{8,12}$/, { message: 'NIM harus terdiri dari 8–12 digit.' })
  studentId?: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'Format email tidak valid.' })
  email: string;

  @IsString({ message: 'Password wajib diisi.' })
  @MaxLength(72)
  password: string;
}

export class VerifyEmailDto {
  @IsEmail({}, { message: 'Format email tidak valid.' })
  email: string;

  @IsString({ message: 'Kode OTP wajib diisi.' })
  @Matches(/^\d{6}$/, { message: 'Kode OTP harus terdiri dari 6 digit.' })
  code: string;
}

export class ResendVerificationDto {
  @IsEmail({}, { message: 'Format email tidak valid.' })
  email: string;
}

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Format email tidak valid.' })
  email: string;
}

export class VerifyPasswordResetDto {
  @IsEmail({}, { message: 'Format email tidak valid.' })
  email: string;

  @IsString({ message: 'Kode OTP wajib diisi.' })
  @Matches(/^\d{6}$/, { message: 'Kode OTP harus terdiri dari 6 digit.' })
  code: string;
}

export class ResetPasswordDto {
  @IsEmail({}, { message: 'Format email tidak valid.' })
  email: string;

  @IsString({ message: 'Token reset wajib diisi.' })
  @MinLength(32)
  @MaxLength(256)
  resetToken: string;

  @IsString({ message: 'Password baru wajib diisi.' })
  @MinLength(8, { message: 'Password baru minimal 8 karakter.' })
  @MaxLength(72, { message: 'Password baru maksimal 72 karakter.' })
  password: string;

  @IsString({ message: 'Konfirmasi password wajib diisi.' })
  @MinLength(8)
  @MaxLength(72)
  confirmPassword: string;
}
