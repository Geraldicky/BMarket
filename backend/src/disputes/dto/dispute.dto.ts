import { ArrayMaxSize, IsArray, IsEnum, IsIn, IsOptional, IsString, IsUrl, IsUUID, MaxLength, MinLength } from 'class-validator';
import { DisputeReason } from '@prisma/client';

export class CreateDisputeDto {
  @IsUUID() transactionId: string;
  @IsEnum(DisputeReason) reason: DisputeReason;
  @IsString() @MinLength(10) @MaxLength(2000) description: string;
  @IsOptional() @IsArray() @ArrayMaxSize(4) @IsUrl({ require_protocol: true, require_tld: false }, { each: true }) evidenceUrls?: string[];
}

export class ResolveDisputeDto {
  @IsIn(['START_REVIEW','REFUND_BUYER','RELEASE_SELLER','REJECT']) action: 'START_REVIEW' | 'REFUND_BUYER' | 'RELEASE_SELLER' | 'REJECT';
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}
