// src/listings/listings.service.ts

import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import {
  Category, Condition, FulfillmentMethod, ListingMode, ListingStatus, ListingType, PreorderStatus,
} from '@prisma/client';
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

  private isPreorderAccepting(listing: {
    mode?: ListingMode | string | null;
    status?: ListingStatus | string | null;
    preorderStatus?: PreorderStatus | string | null;
    preorderDeadline?: Date | null;
    stockLeft?: number | null;
  }): boolean {
    return listing.mode === 'PREORDER'
      && listing.status === 'ACTIVE'
      && listing.preorderStatus === 'OPEN'
      && (!listing.preorderDeadline || listing.preorderDeadline.getTime() > Date.now())
      && (listing.stockLeft === null || listing.stockLeft === undefined || listing.stockLeft > 0);
  }

  private inventoryState(listing: {
    mode?: ListingMode | string | null;
    status?: ListingStatus | string | null;
    preorderStatus?: PreorderStatus | string | null;
    preorderDeadline?: Date | null;
    stockLeft?: number | null;
  }): 'AVAILABLE' | 'OUT_OF_STOCK' | 'SOLD' | 'PREORDER_OPEN' | 'PREORDER_CLOSED' | 'SERVICE' {
    if (listing.mode === 'SERVICE') return 'SERVICE';
    if (listing.mode === 'PREORDER') return this.isPreorderAccepting(listing) ? 'PREORDER_OPEN' : 'PREORDER_CLOSED';
    if (listing.status === 'SOLD') return 'SOLD';
    if (listing.mode === 'STOCKED' && listing.stockLeft === 0) return 'OUT_OF_STOCK';
    return 'AVAILABLE';
  }

  private withParsedImages<T extends {
    images: string;
    mode?: ListingMode | string | null;
    status?: ListingStatus | string | null;
    preorderStatus?: PreorderStatus | string | null;
    preorderDeadline?: Date | null;
    stockLeft?: number | null;
  }>(listing: T) {
    return {
      ...listing,
      images: this.parseImages(listing.images),
      preorderAccepting: this.isPreorderAccepting(listing),
      inventoryState: this.inventoryState(listing),
    };
  }

  private resolveMode(input: { mode?: ListingMode | null; type: ListingType; stock?: number | null }): ListingMode {
    if (input.mode) return input.mode;
    if (input.type === 'SERVICE') return 'SERVICE';
    return Number(input.stock ?? 1) > 1 ? 'STOCKED' : 'ONE_OFF';
  }

  private typeForMode(mode: ListingMode): ListingType {
    return mode === 'SERVICE' ? 'SERVICE' : 'PRODUCT';
  }

  private conditionApplies(mode: ListingMode, category: Category): boolean {
    if (mode === 'SERVICE' || mode === 'PREORDER') return false;
    return !['FOOD', 'SERVICES'].includes(category);
  }

  private validateListingDetails(input: {
    mode: ListingMode;
    type: ListingType;
    category: Category;
    condition?: Condition | null;
    stock?: number | null;
    images?: string[];
    fulfillmentMethods?: FulfillmentMethod[];
    preorderDeadline?: Date | null;
    preorderReadyAt?: Date | null;
    preorderQuota?: number | null;
    preorderMinOrder?: number | null;
    preorderMaxPerBuyer?: number | null;
  }) {
    if (!input.images?.length) throw new BadRequestException('Tambahkan minimal satu foto listing.');
    if (input.images.length > 4) throw new BadRequestException('Maksimal empat foto untuk setiap listing.');
    if (!input.fulfillmentMethods?.length) throw new BadRequestException('Pilih minimal satu metode penyerahan.');

    const expectedType = this.typeForMode(input.mode);
    if (input.type !== expectedType) {
      throw new BadRequestException(input.mode === 'SERVICE' ? 'Mode jasa harus menggunakan tipe SERVICE.' : 'Mode barang harus menggunakan tipe PRODUCT.');
    }

    if (this.conditionApplies(input.mode, input.category) && !input.condition) throw new BadRequestException('Pilih kondisi barang.');

    if (input.mode === 'ONE_OFF' && input.stock !== 1) {
      throw new BadRequestException('Barang satuan selalu memiliki stok 1.');
    }
    if (input.mode === 'STOCKED' && (!Number.isInteger(input.stock) || Number(input.stock) < 1)) {
      throw new BadRequestException('Stok produk minimal 1.');
    }
    if (input.mode === 'SERVICE' && input.stock !== null && input.stock !== undefined) {
      throw new BadRequestException('Jasa tidak menggunakan stok barang.');
    }

    if (input.mode === 'PREORDER') {
      if (!input.preorderDeadline || input.preorderDeadline.getTime() <= Date.now()) {
        throw new BadRequestException('Deadline pre-order harus berada di masa mendatang.');
      }
      if (!Number.isInteger(input.preorderQuota) || Number(input.preorderQuota) < 1) {
        throw new BadRequestException('Kuota pre-order minimal 1.');
      }
      if (input.preorderMinOrder && input.preorderMinOrder > input.preorderQuota!) {
        throw new BadRequestException('Minimum pesanan tidak boleh melebihi kuota pre-order.');
      }
      if (input.preorderMaxPerBuyer && input.preorderMaxPerBuyer > input.preorderQuota!) {
        throw new BadRequestException('Batas per buyer tidak boleh melebihi kuota pre-order.');
      }
      if (input.preorderReadyAt && input.preorderReadyAt.getTime() <= input.preorderDeadline.getTime()) {
        throw new BadRequestException('Estimasi siap harus setelah deadline pre-order.');
      }
    }
  }

  // ── Public methods ────────────────────────

  async findAll(filter: ListingFilterDto) {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = { status: 'ACTIVE', sellerArchivedAt: null };
    if (filter.category) where.category = filter.category;
    if (filter.type) where.type = filter.type;
    if (filter.mode) where.mode = filter.mode;
    if (filter.condition) where.condition = filter.condition;
    if (filter.fulfillmentMethod) where.fulfillmentMethods = { has: filter.fulfillmentMethod };
    if (filter.keyword) where.OR = [
      { title: { contains: filter.keyword, mode: 'insensitive' } },
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
        include: { seller: { select: { id: true, name: true, avatarUrl: true, isVerified: true } } },
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
      include: { seller: { select: { id: true, name: true, avatarUrl: true, isVerified: true } } },
    });
    if (!listing) throw new NotFoundException('Listing tidak ditemukan.');
    if (listing.sellerArchivedAt && requester?.role !== 'ADMIN') throw new NotFoundException('Listing tidak ditemukan.');
    if (listing.status !== 'ACTIVE' && requester?.id !== listing.sellerId && requester?.role !== 'ADMIN') {
      throw new NotFoundException('Listing tidak ditemukan.');
    }
    return this.withParsedImages(listing);
  }

  async findMySellListings(sellerId: string) {
    const listings = await this.prisma.listing.findMany({
      where: { sellerId, sellerArchivedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return listings.map(l => this.withParsedImages(l));
  }

  async create(sellerId: string, dto: CreateListingDto) {
    const mode = this.resolveMode({ mode: dto.mode, type: dto.type, stock: dto.stock });
    const type = this.typeForMode(mode);
    const preorderDeadline = dto.preorderDeadline ? new Date(dto.preorderDeadline) : null;
    const preorderReadyAt = dto.preorderReadyAt ? new Date(dto.preorderReadyAt) : null;
    const stock = mode === 'SERVICE' ? null : mode === 'ONE_OFF' ? 1 : mode === 'PREORDER' ? (dto.preorderQuota ?? null) : (dto.stock ?? null);

    this.validateListingDetails({
      mode, type, category: dto.category,
      condition: this.conditionApplies(mode, dto.category) ? dto.condition : null,
      stock,
      images: dto.images,
      fulfillmentMethods: dto.fulfillmentMethods,
      preorderDeadline,
      preorderReadyAt,
      preorderQuota: mode === 'PREORDER' ? dto.preorderQuota : null,
      preorderMinOrder: mode === 'PREORDER' ? dto.preorderMinOrder : null,
      preorderMaxPerBuyer: mode === 'PREORDER' ? dto.preorderMaxPerBuyer : null,
    });

    const listing = await this.prisma.listing.create({
      data: {
        title: dto.title,
        description: dto.description,
        price: dto.price,
        category: dto.category,
        type,
        mode,
        condition: this.conditionApplies(mode, dto.category) ? dto.condition : null,
        images: JSON.stringify(dto.images),
        status: 'ACTIVE',
        sellerId,
        stock,
        stockLeft: stock,
        fulfillmentMethods: dto.fulfillmentMethods,
        preorderStatus: mode === 'PREORDER' ? 'OPEN' : null,
        preorderDeadline: mode === 'PREORDER' ? preorderDeadline : null,
        preorderReadyAt: mode === 'PREORDER' ? preorderReadyAt : null,
        preorderQuota: mode === 'PREORDER' ? dto.preorderQuota ?? null : null,
        preorderMinOrder: mode === 'PREORDER' ? dto.preorderMinOrder ?? null : null,
        preorderMaxPerBuyer: mode === 'PREORDER' ? dto.preorderMaxPerBuyer ?? null : null,
        preorderPickupLocation: mode === 'PREORDER' ? dto.preorderPickupLocation?.trim() || null : null,
        preorderPickupNote: mode === 'PREORDER' ? dto.preorderPickupNote?.trim() || null : null,
      },
    });
    return this.withParsedImages(listing);
  }

  async update(id: string, sellerId: string, dto: UpdateListingDto) {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) throw new NotFoundException('Listing tidak ditemukan.');
    if (listing.sellerId !== sellerId) throw new ForbiddenException('Anda tidak berhak mengedit listing ini.');
    if (listing.sellerArchivedAt) throw new NotFoundException('Listing tidak ditemukan.');
    if (['SOLD', 'REJECTED', 'HIDDEN', 'REMOVED'].includes(listing.status)) {
      throw new BadRequestException('Listing yang sudah terjual atau sedang dimoderasi tidak dapat diedit.');
    }

    const allocatedUnits = listing.type === 'PRODUCT' && listing.stock !== null && listing.stockLeft !== null
      ? Math.max(0, listing.stock - listing.stockLeft)
      : 0;
    const nextMode = dto.mode ?? (dto.type && dto.type !== listing.type
      ? this.resolveMode({ type: dto.type, stock: dto.stock ?? listing.stock })
      : listing.mode);
    if (dto.mode && dto.mode !== listing.mode && allocatedUnits > 0) {
      throw new BadRequestException('Mode penjualan tidak dapat diubah setelah listing memiliki reservasi atau pesanan.');
    }
    const nextType = this.typeForMode(nextMode);
    const nextCategory = dto.category ?? listing.category;
    const nextCondition = this.conditionApplies(nextMode, nextCategory) ? (dto.condition ?? listing.condition) : null;
    const nextImages = dto.images ?? this.parseImages(listing.images);
    const nextFulfillmentMethods = dto.fulfillmentMethods ?? listing.fulfillmentMethods;
    const nextDeadline = dto.preorderDeadline ? new Date(dto.preorderDeadline) : listing.preorderDeadline;
    const nextReadyAt = dto.preorderReadyAt === null
      ? null
      : dto.preorderReadyAt
        ? new Date(dto.preorderReadyAt)
        : listing.preorderReadyAt;
    const nextQuota = nextMode === 'PREORDER' ? (dto.preorderQuota ?? listing.preorderQuota) : null;
    const nextStock = nextMode === 'SERVICE'
      ? null
      : nextMode === 'ONE_OFF'
        ? 1
        : nextMode === 'PREORDER'
          ? nextQuota
          : (dto.stock ?? listing.stock);

    this.validateListingDetails({
      mode: nextMode,
      type: nextType,
      category: nextCategory,
      condition: nextCondition,
      stock: nextStock,
      images: nextImages,
      fulfillmentMethods: nextFulfillmentMethods,
      preorderDeadline: nextMode === 'PREORDER' ? nextDeadline : null,
      preorderReadyAt: nextMode === 'PREORDER' ? nextReadyAt : null,
      preorderQuota: nextQuota,
      preorderMinOrder: nextMode === 'PREORDER' ? (dto.preorderMinOrder ?? listing.preorderMinOrder) : null,
      preorderMaxPerBuyer: nextMode === 'PREORDER' ? (dto.preorderMaxPerBuyer ?? listing.preorderMaxPerBuyer) : null,
    });

    let stockUpdate: { stock?: number | null; stockLeft?: number | null } = {};
    if (nextMode === 'SERVICE') {
      stockUpdate = { stock: null, stockLeft: null };
    } else if (nextMode === 'ONE_OFF') {
      if (allocatedUnits > 0 && listing.mode !== 'ONE_OFF') throw new BadRequestException('Barang satuan tidak dapat dipilih setelah ada unit yang terpesan.');
      stockUpdate = { stock: 1, stockLeft: Math.max(0, 1 - allocatedUnits) };
    } else if (dto.stock !== undefined || dto.preorderQuota !== undefined || listing.mode !== nextMode) {
      if (nextStock === null || nextStock < allocatedUnits) {
        throw new BadRequestException(`Kapasitas tidak boleh kurang dari ${allocatedUnits} karena sebagian unit sudah masuk transaksi.`);
      }
      stockUpdate = { stock: nextStock, stockLeft: nextStock - allocatedUnits };
    }

    const updated = await this.prisma.listing.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.description && { description: dto.description }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.category && { category: dto.category }),
        type: nextType,
        mode: nextMode,
        condition: nextCondition,
        ...(dto.images !== undefined && { images: JSON.stringify(dto.images) }),
        ...(dto.fulfillmentMethods !== undefined && { fulfillmentMethods: dto.fulfillmentMethods }),
        ...stockUpdate,
        ...(nextMode === 'PREORDER' ? {
          preorderStatus: listing.mode === 'PREORDER' ? listing.preorderStatus : 'OPEN',
          preorderDeadline: nextDeadline,
          preorderReadyAt: nextReadyAt,
          preorderQuota: nextQuota,
          preorderMinOrder: dto.preorderMinOrder ?? listing.preorderMinOrder,
          preorderMaxPerBuyer: dto.preorderMaxPerBuyer ?? listing.preorderMaxPerBuyer,
          preorderPickupLocation: dto.preorderPickupLocation !== undefined ? dto.preorderPickupLocation.trim() || null : listing.preorderPickupLocation,
          preorderPickupNote: dto.preorderPickupNote !== undefined ? dto.preorderPickupNote.trim() || null : listing.preorderPickupNote,
        } : {
          preorderStatus: null,
          preorderDeadline: null,
          preorderReadyAt: null,
          preorderQuota: null,
          preorderMinOrder: null,
          preorderMaxPerBuyer: null,
          preorderPickupLocation: null,
          preorderPickupNote: null,
        }),
      },
    });
    return this.withParsedImages(updated);
  }

  async restock(id: string, sellerId: string, quantity: number) {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) throw new NotFoundException('Listing tidak ditemukan.');
    if (listing.sellerId !== sellerId) throw new ForbiddenException('Anda tidak berhak mengelola stok listing ini.');
    if (listing.sellerArchivedAt) throw new NotFoundException('Listing tidak ditemukan.');
    if (listing.mode !== 'STOCKED') throw new BadRequestException('Tambah stok hanya tersedia untuk produk dengan stok.');
    if (['HIDDEN', 'REMOVED', 'REJECTED'].includes(listing.status)) throw new BadRequestException('Listing yang sedang dimoderasi tidak dapat direstock.');

    const updated = await this.prisma.listing.update({
      where: { id },
      data: {
        stock: { increment: quantity },
        stockLeft: { increment: quantity },
        ...(listing.status === 'SOLD' ? { status: 'ACTIVE' as const } : {}),
      },
    });
    return this.withParsedImages(updated);
  }

  async updatePreorderStatus(id: string, sellerId: string, status: PreorderStatus) {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) throw new NotFoundException('Listing tidak ditemukan.');
    if (listing.sellerId !== sellerId) throw new ForbiddenException('Anda tidak berhak mengelola pre-order ini.');
    if (listing.mode !== 'PREORDER') throw new BadRequestException('Listing ini bukan pre-order.');
    if (listing.sellerArchivedAt) throw new NotFoundException('Listing tidak ditemukan.');

    const current = listing.preorderStatus ?? 'OPEN';
    const allowed: Record<string, PreorderStatus[]> = {
      OPEN: ['CLOSED'],
      CLOSED: ['OPEN', 'PROCESSING'],
      PROCESSING: ['READY'],
      READY: ['COMPLETED'],
      COMPLETED: [],
      CANCELLED: [],
    };
    if (!allowed[current]?.includes(status)) throw new BadRequestException(`Status pre-order tidak dapat diubah dari ${current} ke ${status}.`);
    if (status === 'OPEN') {
      if (!listing.preorderDeadline || listing.preorderDeadline.getTime() <= Date.now()) throw new BadRequestException('Deadline pre-order sudah lewat.');
      if ((listing.stockLeft ?? 0) < 1) throw new BadRequestException('Kuota pre-order sudah penuh.');
    }
    if (status === 'COMPLETED') {
      const unfinished = await this.prisma.transaction.count({
        where: { listingId: id, status: { in: ['PENDING', 'PAID', 'CONFIRMED'] } },
      });
      if (unfinished > 0) throw new BadRequestException(`Masih ada ${unfinished} pesanan pre-order yang belum selesai.`);
    }

    const updated = await this.prisma.listing.update({ where: { id }, data: { preorderStatus: status } });
    if (['PROCESSING', 'READY'].includes(status)) {
      const buyers = await this.prisma.transaction.findMany({
        where: { listingId: id, status: { in: ['PAID', 'CONFIRMED'] } },
        distinct: ['buyerId'],
        select: { buyerId: true },
      });
      if (buyers.length) {
        const ready = status === 'READY';
        await this.prisma.notification.createMany({
          data: buyers.map(order => ({
            userId: order.buyerId,
            type: 'TRANSACTION' as const,
            title: ready ? 'Pre-order siap diambil/dikirim' : 'Pre-order sedang diproses',
            body: ready
              ? `${listing.title} sudah siap. Buka detail transaksi untuk melanjutkan penyerahan.`
              : `${listing.title} sudah masuk tahap produksi atau persiapan seller.`,
            entityType: 'LISTING',
            entityId: id,
          })),
        }).catch(() => undefined);
      }
    }
    return this.withParsedImages(updated);
  }

  async softDelete(id: string, sellerId: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) throw new NotFoundException('Listing tidak ditemukan.');
    if (listing.sellerId !== sellerId) throw new ForbiddenException('Anda tidak berhak menghapus listing ini.');
    if (listing.sellerArchivedAt) throw new NotFoundException('Listing tidak ditemukan.');
    if (['HIDDEN', 'REMOVED'].includes(listing.status)) throw new BadRequestException('Listing yang sedang dimoderasi tidak dapat diubah oleh seller.');
    return this.prisma.listing.update({ where: { id }, data: { status: 'INACTIVE' } });
  }

  async archiveInactive(id: string, sellerId: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) throw new NotFoundException('Listing tidak ditemukan.');
    if (listing.sellerId !== sellerId) throw new ForbiddenException('Anda tidak berhak mengarsipkan listing ini.');
    if (listing.sellerArchivedAt) return { id: listing.id, archived: true };
    if (!['INACTIVE', 'SOLD'].includes(listing.status) && !(listing.mode === 'PREORDER' && listing.preorderStatus === 'COMPLETED')) {
      throw new BadRequestException('Nonaktifkan, selesaikan, atau jual listing terlebih dahulu sebelum diarsipkan.');
    }

    await this.prisma.listing.update({ where: { id }, data: { sellerArchivedAt: new Date() } });
    return { id: listing.id, archived: true };
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

  async findAllForAdmin(filter: { keyword?: string; status?: string; type?: string; category?: string; mode?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(filter.limit) || 20));
    const skip = (page - 1) * limit;
    const where: any = {};

    const validStatuses = ['PENDING', 'ACTIVE', 'REJECTED', 'SOLD', 'INACTIVE', 'HIDDEN', 'REMOVED'];
    const validTypes = ['PRODUCT', 'SERVICE'];
    const validModes = ['ONE_OFF', 'STOCKED', 'PREORDER', 'SERVICE'];
    const validCategories = ['ELECTRONICS', 'BOOKS', 'FASHION', 'FOOD', 'SERVICES', 'SPORTS', 'OTHER'];

    if (filter.status && validStatuses.includes(filter.status)) where.status = filter.status;
    if (filter.type && validTypes.includes(filter.type)) where.type = filter.type;
    if (filter.mode && validModes.includes(filter.mode)) where.mode = filter.mode;
    if (filter.category && validCategories.includes(filter.category)) where.category = filter.category;
    if (filter.keyword?.trim()) {
      const keyword = filter.keyword.trim();
      where.OR = [
        { title: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
        { seller: { name: { contains: keyword, mode: 'insensitive' } } },
        { seller: { email: { contains: keyword, mode: 'insensitive' } } },
      ];
    }

    const [listings, total, totalAll, active, hidden, removed, sold, inactive, pending, rejected] = await Promise.all([
      this.prisma.listing.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: { seller: { select: { id: true, name: true, email: true, studentId: true, avatarUrl: true, isVerified: true } } },
      }),
      this.prisma.listing.count({ where }),
      this.prisma.listing.count(),
      this.prisma.listing.count({ where: { status: 'ACTIVE' } }),
      this.prisma.listing.count({ where: { status: 'HIDDEN' } }),
      this.prisma.listing.count({ where: { status: 'REMOVED' } }),
      this.prisma.listing.count({ where: { status: 'SOLD' } }),
      this.prisma.listing.count({ where: { status: 'INACTIVE' } }),
      this.prisma.listing.count({ where: { status: 'PENDING' } }),
      this.prisma.listing.count({ where: { status: 'REJECTED' } }),
    ]);

    const ids = listings.map(listing => listing.id);
    const reports = ids.length ? await this.prisma.complaint.findMany({
      where: { targetType: 'LISTING', targetId: { in: ids }, status: { in: ['OPEN', 'IN_REVIEW'] } },
      select: { targetId: true },
    }) : [];
    const reportCount = reports.reduce<Record<string, number>>((acc, report) => {
      acc[report.targetId] = (acc[report.targetId] || 0) + 1;
      return acc;
    }, {});

    return {
      data: listings.map(listing => ({ ...this.withParsedImages(listing), openReportCount: reportCount[listing.id] || 0 })),
      total, page, limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      summary: { total: totalAll, active, hidden, removed, sold, inactive, pending, rejected },
    };
  }

  async findPending() {
    const listings = await this.prisma.listing.findMany({
      where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' },
      include: { seller: { select: { id: true, name: true, email: true, studentId: true, avatarUrl: true, isVerified: true } } },
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
    if (status === 'ACTIVE' && !['ACTIVE', 'HIDDEN'].includes(listing.status)) throw new BadRequestException('Listing ini tidak dapat diaktifkan kembali.');
    return this.prisma.listing.update({ where: { id }, data: { status } });
  }

  async countAll(): Promise<number> { return this.prisma.listing.count(); }
  async countByStatus(status: ListingStatus): Promise<number> { return this.prisma.listing.count({ where: { status } }); }
}
