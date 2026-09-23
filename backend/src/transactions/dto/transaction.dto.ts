// src/transactions/dto/transaction.dto.ts

import { IsString, IsOptional, IsInt, Min, MaxLength, IsNumber, IsUUID, Max, IsEnum, IsIn, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { FulfillmentMethod, TransactionStatus } from '@prisma/client';

export class CreateTransactionDto {
  @IsString()
  @IsUUID()
  listingId: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999)
  quantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  // Kompatibel dengan klien Meetup lama; nilai courier ditolak.
  @IsOptional() @IsIn(['CAMPUS_MEETUP'])
  fulfillmentMethod?: FulfillmentMethod;
}

export class ConfirmHandoverDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Kode serah-terima harus terdiri dari 6 angka.' })
  code: string;
}

export class TopupDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1000, { message: 'Minimal topup Rp 1.000.' })
  amount: number;
}

export class UpdateTransactionStatusDto {
  @IsEnum(TransactionStatus)
  status: TransactionStatus;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  cancellationReason?: string;
}
