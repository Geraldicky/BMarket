import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { MidtransService } from './midtrans/midtrans.service';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, MidtransService],
  exports: [PaymentsService, MidtransService],
})
export class PaymentsModule {}
