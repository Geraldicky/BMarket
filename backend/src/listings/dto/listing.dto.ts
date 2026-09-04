// src/listings/dto/listing.dto.ts

import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsString, IsNumber, IsEnum, IsOptional, Min, Max, MinLength, MaxLength, IsInt, IsUrl } from 'class-validator';
import { Type } from 'class-transformer';
import { Category, ListingType, Condition, FulfillmentMethod } from '@prisma/client';

export class CreateListingDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title: string;

  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: 'Harga harus lebih dari 0.' })
  price: number;

  @IsEnum(Category)
  category: Category;

  @IsEnum(ListingType)
  type: ListingType;

  @IsOptional()
  @IsEnum(Condition)
  condition?: Condition;

  @IsArray()
  @ArrayMinSize(1, { message: 'Tambahkan minimal satu foto listing.' })
  @ArrayMaxSize(4)
  @IsUrl({ require_protocol: true, require_tld: false, protocols: ['http', 'https'] }, { each: true })
  images: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Stok minimal 1.' })
  stock?: number;

  @IsArray()
  @ArrayMinSize(1, { message: 'Pilih minimal satu metode penyerahan.' })
  @ArrayUnique()
  @IsEnum(FulfillmentMethod, { each: true })
  fulfillmentMethods: FulfillmentMethod[];
}

export class UpdateListingDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MinLength(10) @MaxLength(5000) description?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) price?: number;
  @IsOptional() @IsEnum(Category) category?: Category;
  @IsOptional() @IsEnum(ListingType) type?: ListingType;
  @IsOptional() @IsEnum(Condition) condition?: Condition;
  @IsOptional() @IsArray() @ArrayMinSize(1, { message: 'Listing harus memiliki minimal satu foto.' }) @ArrayMaxSize(4) @IsUrl({ require_protocol: true, require_tld: false, protocols: ['http', 'https'] }, { each: true }) images?: string[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) stock?: number;
  @IsOptional() @IsArray() @ArrayMinSize(1, { message: 'Pilih minimal satu metode penyerahan.' }) @ArrayUnique() @IsEnum(FulfillmentMethod, { each: true }) fulfillmentMethods?: FulfillmentMethod[];
}

export class ListingFilterDto {
  @IsOptional() @IsEnum(Category) category?: Category;
  @IsOptional() @IsEnum(ListingType) type?: ListingType;
  @IsOptional() @IsString() keyword?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minPrice?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) maxPrice?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
