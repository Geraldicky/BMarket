// src/listings/listings.module.ts

import { Module } from '@nestjs/common';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';

@Module({
  controllers: [ListingsController],
  providers: [ListingsService],
  exports: [ListingsService], // Ekspor untuk TransactionsModule & AdminModule
})
export class ListingsModule {}
