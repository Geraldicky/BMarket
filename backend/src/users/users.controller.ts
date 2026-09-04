// src/users/users.controller.ts

import { Controller, Get, Put, Param, Body, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateProfileDto, ChangePasswordDto } from './dto/user.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard)  // Semua endpoint di controller ini butuh auth
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // PENTING: route statis (/me) harus SEBELUM route dinamis (/:id)
  @Put('me')
  async updateProfile(@CurrentUser() user: any, @Body() dto: UpdateProfileDto) {
    const result = await this.usersService.updateProfile(user.id, dto);
    return { success: true, message: 'Profil berhasil diperbarui.', data: result };
  }

  @Put('me/password')
  async changePassword(@CurrentUser() user: any, @Body() dto: ChangePasswordDto) {
    const result = await this.usersService.changePassword(user.id, dto);
    return { success: true, ...result };
  }

  @Get(':id')
  async getPublicProfile(@Param('id') id: string) {
    const result = await this.usersService.getPublicProfile(id);
    return { success: true, data: result };
  }
}
