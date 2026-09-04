import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsUUID, Min } from 'class-validator';

export class CreateOfferDto {
  @IsUUID() listingId: string;
  @Type(() => Number) @IsNumber() @Min(1000) amount: number;
}

export class RespondOfferDto {
  @IsIn(['ACCEPT', 'REJECT', 'CANCEL']) action: 'ACCEPT' | 'REJECT' | 'CANCEL';
}
