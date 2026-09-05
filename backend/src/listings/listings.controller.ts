// src/listings/listings.controller.ts

import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ListingsService } from './listings.service';
import { CreateListingDto, UpdateListingDto, ListingFilterDto, RestockListingDto, UpdatePreorderStatusDto } from './dto/listing.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('listings')
@UseGuards(JwtAuthGuard)
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Get()
  async findAll(@Query() filter: ListingFilterDto) {
    const result = await this.listingsService.findAll(filter);
    return { success: true, data: result };
  }

  // PENTING: route statis sebelum :id
  @Get('my/listings')
  async getMyListings(@CurrentUser() user: any) {
    const data = await this.listingsService.findMySellListings(user.id);
    return { success: true, data };
  }

  @Get(':id')
  async findById(@Param('id') id: string, @CurrentUser() user: any) {
    const data = await this.listingsService.findById(id, user);
    return { success: true, data };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser() user: any, @Body() dto: CreateListingDto) {
    const data = await this.listingsService.create(user.id, dto);
    return { success: true, message: 'Listing berhasil dipublikasikan.', data };
  }


  @Post(':id/restock')
  async restock(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: RestockListingDto) {
    const data = await this.listingsService.restock(id, user.id, dto.quantity);
    return { success: true, message: `Stok berhasil ditambah ${dto.quantity}.`, data };
  }

  @Put(':id/preorder-status')
  async updatePreorderStatus(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: UpdatePreorderStatusDto) {
    const data = await this.listingsService.updatePreorderStatus(id, user.id, dto.status);
    return { success: true, message: 'Status pre-order berhasil diperbarui.', data };
  }

  @Put(':id')
  async update(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: UpdateListingDto) {
    const data = await this.listingsService.update(id, user.id, dto);
    return { success: true, message: 'Perubahan listing berhasil disimpan.', data };
  }

  @Delete(':id/archive')
  async archiveInactive(@Param('id') id: string, @CurrentUser() user: any) {
    const data = await this.listingsService.archiveInactive(id, user.id);
    return { success: true, message: 'Listing berhasil diarsipkan.', data };
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser() user: any) {
    await this.listingsService.softDelete(id, user.id);
    return { success: true, message: 'Listing berhasil dinonaktifkan.' };
  }
}
