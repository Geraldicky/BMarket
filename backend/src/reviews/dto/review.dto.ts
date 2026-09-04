// src/reviews/dto/review.dto.ts

import { IsString, IsInt, Min, Max, IsOptional, IsUUID, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateReviewDto {
  @IsString()
  @IsUUID()
  transactionId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1) @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
