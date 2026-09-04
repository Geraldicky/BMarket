// src/complaints/dto/complaint.dto.ts

import { IsString, IsEnum, IsOptional, IsUUID, MinLength, MaxLength } from 'class-validator';
import { ComplaintTarget } from '@prisma/client';

export class CreateComplaintDto {
  @IsEnum(ComplaintTarget)
  targetType: ComplaintTarget;

  @IsString()
  @IsUUID()
  targetId: string;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;
}
