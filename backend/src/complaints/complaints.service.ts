// src/complaints/complaints.service.ts

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ComplaintStatus, ComplaintTarget } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateComplaintDto } from './dto/complaint.dto';

@Injectable()
export class ComplaintsService {
  constructor(private prisma: PrismaService) {}

  async create(reporterId: string, dto: CreateComplaintDto) {
    if (dto.targetType === 'LISTING') {
      const listing = await this.prisma.listing.findUnique({
        where: { id: dto.targetId },
        select: { id: true, sellerId: true, status: true },
      });
      if (!listing || ['INACTIVE', 'REMOVED'].includes(listing.status)) {
        throw new NotFoundException('Listing tidak ditemukan.');
      }
      if (listing.sellerId === reporterId) {
        throw new BadRequestException('Kamu tidak dapat melaporkan listing milik sendiri.');
      }
    } else {
      const targetUser = await this.prisma.user.findUnique({ where: { id: dto.targetId }, select: { id: true } });
      if (!targetUser) throw new NotFoundException('Pengguna tidak ditemukan.');
      if (targetUser.id === reporterId) throw new BadRequestException('Kamu tidak dapat melaporkan akun sendiri.');
    }

    const existing = await this.prisma.complaint.findUnique({
      where: {
        reporterId_targetType_targetId: {
          reporterId,
          targetType: dto.targetType,
          targetId: dto.targetId,
        },
      },
    });
    if (existing) throw new ConflictException('Kamu sudah pernah melaporkan listing atau akun ini.');

    return this.prisma.complaint.create({
      data: { reporterId, ...dto },
    });
  }

  async findAll(status?: string, targetType?: string, unresolvedOnly = false) {
    if (status && !Object.values(ComplaintStatus).includes(status as ComplaintStatus)) throw new BadRequestException('Status laporan tidak valid.');
    if (targetType && !Object.values(ComplaintTarget).includes(targetType as ComplaintTarget)) throw new BadRequestException('Target laporan tidak valid.');

    const complaints = await this.prisma.complaint.findMany({
      where: {
        ...(status ? { status: status as ComplaintStatus } : {}),
        ...(unresolvedOnly ? { status: { in: ['OPEN', 'IN_REVIEW'] as ComplaintStatus[] } } : {}),
        ...(targetType ? { targetType: targetType as ComplaintTarget } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: { select: { id: true, name: true, email: true } },
      },
    });

    const listingIds = complaints.filter(item => item.targetType === 'LISTING').map(item => item.targetId);
    const userIds = complaints.filter(item => item.targetType === 'USER').map(item => item.targetId);
    const [listings, users] = await Promise.all([
      this.prisma.listing.findMany({
        where: { id: { in: listingIds } },
        include: { seller: { select: { id: true, name: true, email: true, isVerified: true } } },
      }),
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true, isActive: true, isVerified: true },
      }),
    ]);
    const listingById = new Map(listings.map(listing => [listing.id, {
      ...listing,
      images: this.parseImages(listing.images),
    }]));
    const userById = new Map(users.map(user => [user.id, user]));

    return complaints.map(complaint => ({
      ...complaint,
      targetListing: complaint.targetType === 'LISTING' ? (listingById.get(complaint.targetId) ?? null) : null,
      targetUser: complaint.targetType === 'USER' ? (userById.get(complaint.targetId) ?? null) : null,
    }));
  }

  async findById(id: string) {
    const complaint = await this.prisma.complaint.findUnique({ where: { id } });
    if (!complaint) throw new NotFoundException('Laporan tidak ditemukan.');
    return complaint;
  }

  async updateStatus(id: string, status: string, adminNote?: string) {
    if (!Object.values(ComplaintStatus).includes(status as ComplaintStatus)) throw new BadRequestException('Status laporan tidak valid.');
    return this.prisma.complaint.update({
      where: { id },
      data: { status: status as any, ...(adminNote && { adminNote }) },
    });
  }

  async resolveOpenReportsForListing(targetId: string, adminNote?: string) {
    await this.prisma.complaint.updateMany({
      where: {
        targetType: 'LISTING',
        targetId,
        status: { in: ['OPEN', 'IN_REVIEW'] },
      },
      data: { status: 'RESOLVED', ...(adminNote && { adminNote }) },
    });
  }

  async countByStatus(status: string): Promise<number> {
    return this.prisma.complaint.count({ where: { status: status as any } });
  }

  async countUnresolved(): Promise<number> {
    return this.prisma.complaint.count({ where: { status: { in: ['OPEN', 'IN_REVIEW'] } } });
  }

  async countReportedListings(): Promise<number> {
    const rows = await this.prisma.complaint.findMany({
      where: { targetType: 'LISTING', status: { in: ['OPEN', 'IN_REVIEW'] } },
      distinct: ['targetId'],
      select: { targetId: true },
    });
    return rows.length;
  }

  private parseImages(raw: string): string[] {
    try {
      return JSON.parse(raw) as string[];
    } catch {
      return [];
    }
  }
}
