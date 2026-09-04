// src/listings/listings.service.ts

import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { Condition, FulfillmentMethod, ListingStatus, ListingType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateListingDto, UpdateListingDto, ListingFilterDto } from './dto/listing.dto';

@Injectable()
export class ListingsService {
  constructor(private prisma: PrismaService) {}

  // ── Helper ────────────────────────────────
  private parseImages(raw: string): string[] {
    try {
      return JSON.parse(raw) as string[];
    } catch {
      return [];
    }
  }

  private withParsedImages<T extends { images: string }>(listing: T) {
    return { ...listing, images: this.parseImages(listing.images) };
  }

  private validateListingDetails(input: {
    type: ListingType;
    condition?: Condition | null;
    stock?: number | null;
    images?: string[];
    fulfillmentMethods?: FulfillmentMethod[];
  }) {
    if (!input.images?.length) {
      throw new BadRequestException('Tambahkan minimal satu foto listing.');
    }
    if (input.images.length > 4) {
      throw new BadRequestException('Maksimal empat foto untuk setiap listing.');
    }
    if (input.type === 'PRODUCT' && !input.condition) {
      throw new BadRequestException('Pilih kondisi barang.');
    }
    if (input.type === 'PRODUCT' && (!Number.isInteger(input.stock) || Number(input.stock) < 1)) {
      throw new BadRequestException('Stok barang minimal 1.');
    }
    if (!input.fulfillmentMethods?.length) {
      throw new BadRequestException('Pilih minimal satu metode penyerahan.');
    }
  }

  // ── Public methods ────────────────────────

  async findAll(filter: ListingFilterDto) {
    const page  = filter.page  ?? 1;
    const limit = filter.limit ?? 20;
    const skip  = (page - 1) * limit;

    const where: any = { status: 'ACTIVE' };
    if (filter.category) where.category = filter.category;
    if (filter.type)     where.type     = filter.type;
    if (filter.condition) where.condition = filter.condition;
    if (filter.fulfillmentMethod) where.fulfillmentMethods = { has: filter.fulfillmentMethod };
    if (filter.keyword)  where.OR = [
      { title:       { contains: filter.keyword, mode: 'insensitive' } },
      { description: { contains: filter.keyword, mode: 'insensitive' } },
    ];
    if (filter.minPrice !== undefined || filter.maxPrice !== undefined) {
      where.price = {};
      if (filter.minPrice !== undefined) where.price.gte = filter.minPrice;
      if (filter.maxPrice !== undefined) where.price.lte = filter.maxPrice;
    }

    const orderBy = filter.sort === 'price_asc'
      ? { price: 'asc' as const }
      : filter.sort === 'price_desc'
        ? { price: 'desc' as const }
        : { createdAt: 'desc' as const };

    const [listings, total] = await Promise.all([
      this.prisma.listing.findMany({
        where, skip, take: limit,
        orderBy,
        include: {
          seller: { select: { id: true, name: true, avatarUrl: true, isVerified: true } },
        },
      }),
      this.prisma.listing.count({ where }),
    ]);

    return {
      data: listings.map(l => this.withParsedImages(l)),
      total, page, limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string, requester?: { id: string; role: string }) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: {
        seller: { select: { id: true, name: true, avatarUrl: true, isVerified: true } },
      },
    });
    if (!listing) throw new NotFoundException('Listing tidak ditemukan.');
    if (listing.status !== 'ACTIVE' && requester?.id !== listing.sellerId && requester?.role !== 'ADMIN') {
      throw new NotFoundException('Listing tidak ditemukan.');
    }
    return this.withParsedImages(listing);
  }

  async findMySellListings(sellerId: string) {
    const listings = await this.prisma.listing.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
    });
    return listings.map(l => this.withParsedImages(l));
  }

  async create(sellerId: string, dto: CreateListingDto) {
    this.validateListingDetails(dto);
    const stockLeft = dto.type === 'PRODUCT' && dto.stock ? dto.stock : null;
    const listing = await this.prisma.listing.create({
      data: {
        title: dto.title,
        description: dto.description,
        price: dto.price,
        category: dto.category,
        type: dto.type,
        condition: dto.type === 'PRODUCT' ? dto.condition : null,
        images: JSON.stringify(dto.images),
        status: 'ACTIVE',
        sellerId,
        stock:     dto.type === 'PRODUCT' ? (dto.stock ?? null) : null,
        stockLeft,
        fulfillmentMethods: dto.fulfillmentMethods,
      },
    });
    return this.withParsedImages(listing);
  }

  async update(id: string, sellerId: string, dto: UpdateListingDto) {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) throw new NotFoundException('Listing tidak ditemukan.');
    if (listing.sellerId !== sellerId) throw new ForbiddenException('Anda tidak berhak mengedit listing ini.');
    if (['SOLD', 'REJECTED', 'HIDDEN', 'REMOVED'].includes(listing.status)) {
      throw new BadRequestException('Listing yang sudah terjual atau sedang dimoderasi tidak dapat diedit.');
    }

    const nextType = dto.type ?? listing.type;
    const allocatedUnits = listing.type === 'PRODUCT' && listing.stock !== null && listing.stockLeft !== null
      ? Math.max(0, listing.stock - listing.stockLeft)
      : 0;
    if (listing.type === 'PRODUCT' && nextType === 'SERVICE' && allocatedUnits > 0) {
      throw new BadRequestException('Tipe listing tidak dapat diubah menjadi jasa selama masih ada stok yang direservasi/transaksikan.');
    }
    const nextCondition = nextType === 'PRODUCT' ? (dto.condition ?? listing.condition) : null;
    const nextStock = nextType === 'PRODUCT' ? (dto.stock ?? listing.stock) : null;
    const nextImages = dto.images ?? this.parseImages(listing.images);
    const nextFulfillmentMethods = dto.fulfillmentMethods ?? listing.fulfillmentMethods;
    this.validateListingDetails({
      type: nextType,
      condition: nextCondition,
      stock: nextStock,
      images: nextImages,
      fulfillmentMethods: nextFulfillmentMethods,
    });

    let stockUpdate: { stock?: number | null; stockLeft?: number | null } = {};
    if (nextType === 'SERVICE') {
      stockUpdate = { stock: null, stockLeft: null };
    } else if (dto.stock !== undefined || listing.type !== nextType) {
      if (nextStock! < allocatedUnits) {
        throw new BadRequestException(`Stok tidak boleh kurang dari ${allocatedUnits} karena sebagian unit sudah masuk transaksi.`);
      }
      stockUpdate = { stock: nextStock, stockLeft: nextStock! - allocatedUnits };
    }

    const updated = await this.prisma.listing.update({
      where: { id },
      data: {
        ...(dto.title       && { title:       dto.title }),
        ...(dto.description && { description: dto.description }),
        ...(dto.price       !== undefined && { price: dto.price }),
        ...(dto.category    && { category:    dto.category }),
        ...(dto.type        && { type:        dto.type }),
        ...(nextType === 'SERVICE'
          ? { condition: null }
          : dto.condition !== undefined
            ? { condition: dto.condition }
            : {}),
        ...(dto.images      !== undefined && { images: JSON.stringify(dto.images) }),
        ...(dto.fulfillmentMethods !== undefined && { fulfillmentMethods: dto.fulfillmentMethods }),
        ...stockUpdate,
      },
    });
    return this.withParsedImages(updated);
  }

  async softDelete(id: string, sellerId: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) throw new NotFoundException('Listing tidak ditemukan.');
    if (listing.sellerId !== sellerId) throw new ForbiddenException('Anda tidak berhak menghapus listing ini.');
    if (['HIDDEN', 'REMOVED'].includes(listing.status)) {
      throw new BadRequestException('Listing yang sedang dimoderasi tidak dapat diubah oleh seller.');
    }
    return this.prisma.listing.update({ where: { id }, data: { status: 'INACTIVE' } });
  }

  async decrementStock(id: string, qty: number) {
    await this.prisma.listing.update({ where: { id }, data: { stockLeft: { decrement: qty } } });
  }

  async incrementStock(id: string, qty: number) {
    await this.prisma.listing.update({ where: { id }, data: { stockLeft: { increment: qty } } });
  }

  async markAsSold(id: string) {
    await this.prisma.listing.update({ where: { id }, data: { status: 'SOLD' } });
  }

  // ── Admin ──────────────────────────────────

  async findPending() {
    const listings = await this.prisma.listing.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      include: {
        seller: { select: { id: true, name: true, email: true, studentId: true, avatarUrl: true, isVerified: true } },
      },
    });
    return listings.map(l => this.withParsedImages(l));
  }

  async moderate(id: string, action: 'approve' | 'reject') {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) throw new NotFoundException('Listing tidak ditemukan.');
    const newStatus: ListingStatus = action === 'approve' ? 'ACTIVE' : 'REJECTED';
    return this.prisma.listing.update({ where: { id }, data: { status: newStatus } });
  }

  async setModerationStatus(id: string, status: 'ACTIVE' | 'HIDDEN' | 'REMOVED') {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) throw new NotFoundException('Listing tidak ditemukan.');
    if (status === 'ACTIVE' && !['ACTIVE', 'HIDDEN'].includes(listing.status)) {
      throw new BadRequestException('Listing ini tidak dapat diaktifkan kembali.');
    }
    return this.prisma.listing.update({ where: { id }, data: { status } });
  }

  async countByStatus(status: ListingStatus): Promise<number> {
    return this.prisma.listing.count({ where: { status } });
  }
}
