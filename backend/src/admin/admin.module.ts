// src/admin/admin.module.ts
// =============================================
// AdminModule mengimport module lain yang
// dibutuhkan untuk mengelola semua fitur admin
// =============================================

import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ListingsModule } from '../listings/listings.module';
import { ComplaintsModule } from '../complaints/complaints.module';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({
  imports: [
    ListingsModule,     // untuk moderate listing
    ComplaintsModule,   // untuk kelola pengaduan
    TransactionsModule, // untuk statistik transaksi & komisi
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
