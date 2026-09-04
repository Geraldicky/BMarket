// src/app.module.ts
// =============================================
// ROOT MODULE — Pusat dari seluruh aplikasi NestJS
// =============================================
// AppModule mendaftarkan semua module yang ada.
// Ini seperti "daftar isi" dari seluruh aplikasi.
//
// Alur dependency antar module:
//   PrismaModule   → @Global, tersedia di mana saja
//   AuthModule     → JwtModule, PrismaModule
//   UsersModule    → PrismaModule
//   ListingsModule → PrismaModule
//   TransactionsModule → ListingsModule, PrismaModule
//   ReviewsModule  → PrismaModule
//   ChatModule     → AuthModule (JwtModule), PrismaModule
//   ComplaintsModule → PrismaModule
//   AdminModule    → ListingsModule, ComplaintsModule, TransactionsModule
// =============================================

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ListingsModule } from './listings/listings.module';
import { TransactionsModule } from './transactions/transactions.module';
import { ReviewsModule } from './reviews/reviews.module';
import { ChatModule } from './chat/chat.module';
import { ComplaintsModule } from './complaints/complaints.module';
import { AdminModule } from './admin/admin.module';
import { UploadsModule } from './uploads/uploads.module';
import { HealthController } from './health.controller';
import { validateEnvironment } from './config/environment';

@Module({
  imports: [
    // Load .env otomatis ke seluruh aplikasi
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnvironment }),

    // Database — @Global, tidak perlu import ulang di module lain
    PrismaModule,

    // Feature modules
    AuthModule,
    UsersModule,
    ListingsModule,
    TransactionsModule,
    ReviewsModule,
    ChatModule,
    ComplaintsModule,
    AdminModule,
    UploadsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
