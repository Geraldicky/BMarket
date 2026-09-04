// src/admin/admin.service.ts

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListingsService } from '../listings/listings.service';
import { ComplaintsService } from '../complaints/complaints.service';
import { TransactionsService } from '../transactions/transactions.service';
import { DisputesService } from '../disputes/disputes.service';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private listingsService: ListingsService,
    private complaintsService: ComplaintsService,
    private transactionsService: TransactionsService,
    private disputesService: DisputesService,
  ) {}

  async getDashboardStats() {
    const [
      totalUsers, totalListings, reportedListings,
      totalTransactions, openComplaints, totalRevenue,
      commissionSetting,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: 'STUDENT' } }),
      this.listingsService.countByStatus('ACTIVE'),
      this.complaintsService.countReportedListings(),
      this.transactionsService.count(),
      this.complaintsService.countUnresolved(),
      this.transactionsService.totalCommissionCollected(),
      this.prisma.commissionSetting.findFirst({ orderBy: { createdAt: 'desc' } }),
    ]);

    return {
      totalUsers, totalListings, reportedListings,
      totalTransactions, openComplaints, totalRevenue,
      currentCommissionRate: commissionSetting ? Number(commissionSetting.rate) : 5.0,
    };
  }

  // ── Listings ──────────────────────────────

  getPendingListings() {
    return this.listingsService.findPending();
  }

  moderateListing(id: string, action: 'approve' | 'reject') {
    return this.listingsService.moderate(id, action);
  }

  // ── Users ─────────────────────────────────

  async getAllUsers(keyword?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: any = { role: 'STUDENT' };
    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { email: { contains: keyword, mode: 'insensitive' } },
        { studentId: { contains: keyword, mode: 'insensitive' } },
      ];
    }
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, email: true, studentId: true,
          role: true, isActive: true, isVerified: true, createdAt: true,
          _count: { select: { listings: true, buyerTransactions: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { users, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async toggleUserStatus(targetId: string, adminId: string) {
    if (targetId === adminId) throw new BadRequestException('Tidak dapat menonaktifkan akun sendiri.');
    const user = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!user) throw new NotFoundException('User tidak ditemukan.');
    return this.prisma.user.update({
      where: { id: targetId },
      data: { isActive: !user.isActive },
      select: { id: true, name: true, isActive: true },
    });
  }

  // ── Complaints ────────────────────────────

  getComplaints(status?: string, targetType?: string, unresolvedOnly = false) {
    return this.complaintsService.findAll(status, targetType, unresolvedOnly);
  }

  async updateComplaintStatus(
    id: string,
    status: string,
    adminNote?: string,
    listingAction?: 'KEEP_ACTIVE' | 'HIDE_LISTING' | 'REMOVE_LISTING',
  ) {
    if (listingAction) {
      const complaint = await this.complaintsService.findById(id);
      if (complaint.targetType !== 'LISTING') throw new BadRequestException('Aksi listing hanya berlaku untuk laporan listing.');
      const statusByAction = {
        KEEP_ACTIVE: 'ACTIVE',
        HIDE_LISTING: 'HIDDEN',
        REMOVE_LISTING: 'REMOVED',
      } as const;
      await this.listingsService.setModerationStatus(complaint.targetId, statusByAction[listingAction]);
      if (listingAction !== 'KEEP_ACTIVE') {
        await this.complaintsService.resolveOpenReportsForListing(complaint.targetId, adminNote);
        return this.complaintsService.findById(id);
      }
    }
    return this.complaintsService.updateStatus(id, status, adminNote);
  }

  // ── Disputes ──────────────────────────────
  getDisputes(status?: any) { return this.disputesService.findAll(status); }
  resolveDispute(id: string, adminId: string, action: 'START_REVIEW' | 'REFUND_BUYER' | 'RELEASE_SELLER' | 'REJECT', note?: string) { return this.disputesService.resolve(id, adminId, action, note); }

  // ── Commission ────────────────────────────

  async getCurrentCommission() {
    const setting = await this.prisma.commissionSetting.findFirst({ orderBy: { createdAt: 'desc' } });
    return { rate: setting ? Number(setting.rate) : 5.0 };
  }

  async setCommissionRate(rate: number) {
    if (rate < 0 || rate > 100) throw new BadRequestException('Komisi harus antara 0% sampai 100%.');
    return this.prisma.commissionSetting.create({ data: { rate } });
  }

  async getCommissionHistory() {
    return this.prisma.commissionSetting.findMany({ orderBy: { createdAt: 'desc' }, take: 10 });
  }
}
