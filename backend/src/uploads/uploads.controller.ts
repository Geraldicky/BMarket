import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UploadsService, type UploadImageFile } from './uploads.service';

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('images')
  @UseInterceptors(FilesInterceptor('images', 4, {
    storage: memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 4 },
    fileFilter: (_req, file, callback) => {
      if (!allowedMimeTypes.has(file.mimetype)) {
        return callback(new BadRequestException('Format gambar harus JPG, PNG, atau WebP.'), false);
      }
      callback(null, true);
    },
  }))
  async uploadImages(@UploadedFiles() files: UploadImageFile[], @Req() request: Request) {
    if (!files?.length) throw new BadRequestException('Pilih minimal satu gambar untuk diunggah.');

    const configuredBaseUrl = process.env.PUBLIC_BASE_URL?.trim().replace(/\/$/, '');
    const requestBaseUrl = `${request.protocol}://${request.get('host')}`;
    const baseUrl = configuredBaseUrl || requestBaseUrl;
    const urls = await this.uploadsService.uploadImages(files, baseUrl);

    return {
      success: true,
      data: { urls },
      message: `${files.length} gambar berhasil diunggah.`,
    };
  }
}
