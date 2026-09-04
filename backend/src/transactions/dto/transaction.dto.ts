// src/transactions/dto/transaction.dto.ts

import { IsString, IsOptional, IsInt, Min, MaxLength, IsNumber, IsUUID, Max, IsEnum, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { CourierProvider, FulfillmentMethod, TransactionStatus } from '@prisma/client';

export class CreateTransactionDto {
  @IsString()
  @IsUUID()
  listingId: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  quantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsEnum(FulfillmentMethod)
  fulfillmentMethod: FulfillmentMethod;

  @IsOptional() @IsString() @MaxLength(100) meetupCampus?: string;
  @IsOptional() @IsString() @MaxLength(160) meetupLocation?: string;
  @IsOptional() @IsString() @MaxLength(120) meetupSchedule?: string;
  @IsOptional() @IsEnum(CourierProvider) courierProvider?: CourierProvider;
  @IsOptional() @IsString() @MaxLength(500) deliveryAddress?: string;
  @IsOptional() @IsString() @MaxLength(30) recipientPhone?: string;
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
