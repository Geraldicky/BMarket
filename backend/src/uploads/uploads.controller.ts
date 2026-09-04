import { BadRequestException, Controller, Post, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
const extensions: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private config: ConfigService) {}

  @Post('images')
  @UseInterceptors(FilesInterceptor('images', 4, {
    storage: diskStorage({
      destination: process.env.UPLOAD_DIR || 'uploads',
      filename: (_request, file, callback) => callback(null, `${randomUUID()}${extensions[file.mimetype]}`),
    }),
    limits: { fileSize: 5 * 1024 * 1024, files: 4 },
    fileFilter: (_request, file, callback) => allowed.has(file.mimetype)
      ? callback(null, true)
      : callback(new BadRequestException('Hanya JPG, PNG, atau WebP yang diperbolehkan.'), false),
  }))
  upload(@UploadedFiles() files: Express.Multer.File[], @Req() request: Request) {
    if (!files?.length) throw new BadRequestException('Pilih minimal satu gambar.');
    const configured = this.config.get<string>('PUBLIC_BASE_URL')?.replace(/\/$/, '');
    const base = configured || `${request.protocol}://${request.get('host')}`;
    return { success: true, data: { urls: files.map(file => `${base}/uploads/${file.filename}`) } };
  }
}
