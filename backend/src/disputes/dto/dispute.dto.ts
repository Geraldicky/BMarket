import { DisputeReason } from '@prisma/client';
import { ArrayMaxSize, IsArray, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateDisputeDto {
  @IsUUID() transactionId: string;
  @IsEnum(DisputeReason) reason: DisputeReason;
  @IsString() @MinLength(10) @MaxLength(2000) description: string;
  @IsOptional() @IsArray() @ArrayMaxSize(4) @IsString({ each: true }) evidence?: string[];
}
