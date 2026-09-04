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
import { mkdirSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { diskStorage } from 'multer';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

const uploadDir = resolve(process.env.UPLOAD_DIR || 'uploads');
mkdirSync(uploadDir, { recursive: true });

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const extensionByMime: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  @Post('images')
  @UseInterceptors(FilesInterceptor('images', 4, {
    storage: diskStorage({
      destination: uploadDir,
      filename: (_req, file, callback) => {
        const suppliedExtension = extname(file.originalname || '').toLowerCase();
        const extension = extensionByMime[file.mimetype] || suppliedExtension || '.jpg';
        callback(null, `${Date.now()}-${randomUUID()}${extension}`);
      },
    }),
    limits: { fileSize: 5 * 1024 * 1024, files: 4 },
    fileFilter: (_req, file, callback) => {
      if (!allowedMimeTypes.has(file.mimetype)) {
        return callback(new BadRequestException('Format gambar harus JPG, PNG, atau WebP.'), false);
      }
      callback(null, true);
    },
  }))
  uploadImages(@UploadedFiles() files: Array<{ filename: string }>, @Req() request: Request) {
    if (!files?.length) throw new BadRequestException('Pilih minimal satu gambar untuk diunggah.');

    const configuredBaseUrl = process.env.PUBLIC_BASE_URL?.trim().replace(/\/$/, '');
    const requestBaseUrl = `${request.protocol}://${request.get('host')}`;
    const baseUrl = process.env.NODE_ENV === 'production' && configuredBaseUrl ? configuredBaseUrl : requestBaseUrl;
    const urls = files.map(file => `${baseUrl}/uploads/${encodeURIComponent(file.filename)}`);

    return {
      success: true,
      data: { urls },
      message: `${files.length} gambar berhasil diunggah.`,
    };
  }
}
