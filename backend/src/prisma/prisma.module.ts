// src/prisma/prisma.module.ts
// =============================================
// MODULE PATTERN — PrismaModule
// =============================================
// Module adalah "wadah" yang mengelompokkan
// provider (service) yang berkaitan.
//
// @Global() berarti PrismaModule tidak perlu
// di-import ulang di setiap module lain —
// PrismaService langsung tersedia di mana saja.
// =============================================

import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // PrismaService tersedia di seluruh aplikasi tanpa perlu import ulang
@Module({
  providers: [PrismaService],
  exports: [PrismaService],  // Ekspor agar module lain bisa inject PrismaService
})
export class PrismaModule {}
