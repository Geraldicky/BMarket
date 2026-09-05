// src/listings/dto/listing.dto.ts

import {
  ArrayMaxSize, ArrayMinSize, ArrayUnique,
  IsArray, IsDateString, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUrl,
  Max, MaxLength, Min, MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  Category, Condition, FulfillmentMethod, ListingMode, ListingType, PreorderStatus,
} from '@prisma/client';

export class CreateListingDto {
  @IsString() @MinLength(3) @MaxLength(120)
  title: string;

  @IsString() @MinLength(10) @MaxLength(5000)
  description: string;

  @Type(() => Number) @IsNumber() @Min(1, { message: 'Harga harus lebih dari 0.' })
  price: number;

  @IsEnum(Category)
  category: Category;

  // Dipertahankan untuk kompatibilitas API lama. Frontend baru juga mengirim mode.
  @IsEnum(ListingType)
  type: ListingType;

  @IsOptional() @IsEnum(ListingMode)
  mode?: ListingMode;

  @IsOptional() @IsEnum(Condition)
  condition?: Condition;

  @IsArray()
  @ArrayMinSize(1, { message: 'Tambahkan minimal satu foto listing.' })
  @ArrayMaxSize(4)
  @IsUrl({ require_protocol: true, require_tld: false, protocols: ['http', 'https'] }, { each: true })
  images: string[];

  @IsOptional() @Type(() => Number) @IsInt() @Min(1, { message: 'Stok minimal 1.' })
  stock?: number;

  @IsArray()
  @ArrayMinSize(1, { message: 'Pilih minimal satu metode penyerahan.' })
  @ArrayUnique()
  @IsEnum(FulfillmentMethod, { each: true })
  fulfillmentMethods: FulfillmentMethod[];

  // PREORDER only
  @IsOptional() @IsDateString()
  preorderDeadline?: string;

  @IsOptional() @IsDateString()
  preorderReadyAt?: string | null;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(9999)
  preorderQuota?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(9999)
  preorderMinOrder?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(999)
  preorderMaxPerBuyer?: number;

  @IsOptional() @IsString() @MaxLength(180)
  preorderPickupLocation?: string;

  @IsOptional() @IsString() @MaxLength(1000)
  preorderPickupNote?: string;
}

export class UpdateListingDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MinLength(10) @MaxLength(5000) description?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) price?: number;
  @IsOptional() @IsEnum(Category) category?: Category;
  @IsOptional() @IsEnum(ListingType) type?: ListingType;
  @IsOptional() @IsEnum(ListingMode) mode?: ListingMode;
  @IsOptional() @IsEnum(Condition) condition?: Condition;
  @IsOptional() @IsArray() @ArrayMinSize(1, { message: 'Listing harus memiliki minimal satu foto.' }) @ArrayMaxSize(4) @IsUrl({ require_protocol: true, require_tld: false, protocols: ['http', 'https'] }, { each: true }) images?: string[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) stock?: number;
  @IsOptional() @IsArray() @ArrayMinSize(1, { message: 'Pilih minimal satu metode penyerahan.' }) @ArrayUnique() @IsEnum(FulfillmentMethod, { each: true }) fulfillmentMethods?: FulfillmentMethod[];
  @IsOptional() @IsDateString() preorderDeadline?: string;
  @IsOptional() @IsDateString() preorderReadyAt?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(9999) preorderQuota?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(9999) preorderMinOrder?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(999) preorderMaxPerBuyer?: number;
  @IsOptional() @IsString() @MaxLength(180) preorderPickupLocation?: string;
  @IsOptional() @IsString() @MaxLength(1000) preorderPickupNote?: string;
}

export class RestockListingDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(9999)
  quantity: number;
}

export class UpdatePreorderStatusDto {
  @IsEnum(PreorderStatus)
  @IsIn(['OPEN', 'CLOSED', 'PROCESSING', 'READY', 'COMPLETED'])
  status: PreorderStatus;
}

export class ListingFilterDto {
  @IsOptional() @IsEnum(Category) category?: Category;
  @IsOptional() @IsEnum(ListingType) type?: ListingType;
  @IsOptional() @IsEnum(ListingMode) mode?: ListingMode;
  @IsOptional() @IsEnum(Condition) condition?: Condition;
  @IsOptional() @IsEnum(FulfillmentMethod) fulfillmentMethod?: FulfillmentMethod;
  @IsOptional() @IsIn(['newest', 'price_asc', 'price_desc']) sort?: 'newest' | 'price_asc' | 'price_desc';
  @IsOptional() @IsString() @MaxLength(120) keyword?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minPrice?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) maxPrice?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
