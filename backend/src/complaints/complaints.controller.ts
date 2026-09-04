// src/complaints/complaints.controller.ts

import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ComplaintsService } from './complaints.service';
import { CreateComplaintDto } from './dto/complaint.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('complaints')
@UseGuards(JwtAuthGuard)
export class ComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  @Post()
  async create(@CurrentUser() user: any, @Body() dto: CreateComplaintDto) {
    const data = await this.complaintsService.create(user.id, dto);
    return { success: true, message: 'Pengaduan berhasil dikirim.', data };
  }
}
