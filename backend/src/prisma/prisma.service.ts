// src/prisma/prisma.service.ts
// =============================================
// SINGLETON PATTERN — PrismaService
// =============================================
// Di NestJS, Singleton diimplementasikan dengan
// mendeklarasikan service sebagai @Injectable()
// dan mendaftarkannya di Module dengan scope DEFAULT.
// NestJS secara otomatis memastikan hanya ada
// satu instance yang dibuat dan dipakai seluruh aplikasi.
// =============================================

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
    });
  }

  // Dipanggil otomatis saat module NestJS diinisialisasi
  async onModuleInit() {
    await this.$connect();
  }

  // Dipanggil otomatis saat aplikasi shutdown
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
