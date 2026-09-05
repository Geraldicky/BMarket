// src/admin/admin.controller.ts

import { BadRequestException, Controller, Get, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResolveDisputeDto } from '../disputes/dto/dispute.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard) // Semua endpoint admin butuh JWT + role ADMIN
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  async getDashboard() {
    const data = await this.adminService.getDashboardStats();
    return { success: true, data };
  }

  // ── Listings ──────────────────────────────

  @Get('listings')
  async getAllListings(
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('category') category?: string,
    @Query('mode') mode?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.adminService.getAllListings({
      keyword,
      status,
      type,
      category,
      mode,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
    return { success: true, data };
  }

  @Patch('listings/:id/status')
  async setListingStatus(
    @Param('id') id: string,
    @Body('status') status: 'ACTIVE' | 'HIDDEN' | 'REMOVED',
  ) {
    if (!['ACTIVE', 'HIDDEN', 'REMOVED'].includes(status)) {
      throw new BadRequestException('Status moderasi listing tidak valid.');
    }
    const data = await this.adminService.setListingStatus(id, status);
    const message = status === 'ACTIVE'
      ? 'Listing berhasil diaktifkan kembali.'
      : status === 'HIDDEN'
        ? 'Listing berhasil disembunyikan dari marketplace.'
        : 'Listing berhasil dihapus oleh admin.';
    return { success: true, message, data };
  }

  @Get('listings/pending')
  async getPendingListings() {
    const data = await this.adminService.getPendingListings();
    return { success: true, data, total: data.length };
  }

  @Patch('listings/:id/moderate')
  async moderateListing(
    @Param('id') id: string,
    @Body('action') action: 'approve' | 'reject',
  ) {
    if (!['approve', 'reject'].includes(action)) {
      throw new BadRequestException('Action harus approve atau reject.');
    }
    await this.adminService.moderateListing(id, action);
    const msg = action === 'approve' ? 'Listing berhasil disetujui.' : 'Listing berhasil ditolak.';
    return { success: true, message: msg };
  }

  // ── Users ─────────────────────────────────

  @Get('users')
  async getAllUsers(
    @Query('keyword') keyword?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.adminService.getAllUsers(
      keyword,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
    return { success: true, data: result };
  }

  @Patch('users/:id/toggle')
  async toggleUserStatus(@Param('id') id: string, @CurrentUser() admin: any) {
    const result = await this.adminService.toggleUserStatus(id, admin.id);
    const msg = (result as any).isActive ? 'User berhasil diaktifkan.' : 'User berhasil dinonaktifkan.';
    return { success: true, message: msg, data: result };
  }

  // ── Complaints ────────────────────────────

  @Get('complaints')
  async getComplaints(
    @Query('status') status?: string,
    @Query('targetType') targetType?: string,
    @Query('unresolved') unresolved?: string,
  ) {
    const data = await this.adminService.getComplaints(status, targetType, unresolved === 'true');
    return { success: true, data };
  }

  @Patch('complaints/:id')
  async updateComplaintStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Body('adminNote') adminNote?: string,
    @Body('listingAction') listingAction?: 'KEEP_ACTIVE' | 'HIDE_LISTING' | 'REMOVE_LISTING',
  ) {
    const validStatuses = ['IN_REVIEW', 'RESOLVED', 'DISMISSED'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException('Status tidak valid.');
    }
    const validActions = ['KEEP_ACTIVE', 'HIDE_LISTING', 'REMOVE_LISTING'];
    if (listingAction && !validActions.includes(listingAction)) throw new BadRequestException('Aksi listing tidak valid.');
    if (listingAction === 'KEEP_ACTIVE' && status !== 'DISMISSED') throw new BadRequestException('Listing dipertahankan harus menolak laporan.');
    if (listingAction && listingAction !== 'KEEP_ACTIVE' && status !== 'RESOLVED') throw new BadRequestException('Moderasi listing harus menyelesaikan laporan.');
    const data = await this.adminService.updateComplaintStatus(id, status, adminNote, listingAction);
    return { success: true, message: 'Laporan dan status listing berhasil diperbarui.', data };
  }

  // ── Disputes ──────────────────────────────
  @Get('disputes')
  async disputes(@Query('status') status?: any) { return { success: true, data: await this.adminService.getDisputes(status) }; }

  @Patch('disputes/:id')
  async resolveDispute(@Param('id') id: string, @CurrentUser() admin: any, @Body() dto: ResolveDisputeDto) {
    return { success: true, message: 'Keputusan sengketa berhasil disimpan.', data: await this.adminService.resolveDispute(id, admin.id, dto.action, dto.note) };
  }

  // ── Commission ────────────────────────────

  @Get('commission')
  async getCommission() {
    const data = await this.adminService.getCurrentCommission();
    return { success: true, data };
  }

  @Patch('commission')
  async setCommission(@Body('rate') rate: number) {
    const data = await this.adminService.setCommissionRate(rate);
    return { success: true, message: `Komisi berhasil diubah menjadi ${rate}%.`, data };
  }

  @Get('commission/history')
  async getCommissionHistory() {
    const data = await this.adminService.getCommissionHistory();
    return { success: true, data };
  }
}
