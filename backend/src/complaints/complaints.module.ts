// src/complaints/complaints.module.ts

import { Module } from '@nestjs/common';
import { ComplaintsController } from './complaints.controller';
import { ComplaintsService } from './complaints.service';

@Module({
  controllers: [ComplaintsController],
  providers: [ComplaintsService],
  exports: [ComplaintsService], // Ekspor untuk AdminModule
})
export class ComplaintsModule {}
