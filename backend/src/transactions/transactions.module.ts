// src/transactions/transactions.module.ts

import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { DeliverableFilesController } from './deliverable-files.controller';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [UploadsModule], // private storage for service deliverables
  controllers: [TransactionsController, DeliverableFilesController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
