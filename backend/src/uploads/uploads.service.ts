import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

export type UploadImageFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

const extensionByMime: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

function encodedStoragePath(path: string) {
  return path.split('/').map(segment => encodeURIComponent(segment)).join('/');
}

@Injectable()
export class UploadsService {
  private get supabaseUrl() {
    return process.env.SUPABASE_URL?.trim().replace(/\/$/, '') || '';
  }

  private get supabaseServiceRoleKey() {
    return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
  }

  private get bucket() {
    return process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'bmarket-public';
  }

  private get useSupabaseStorage() {
    return Boolean(this.supabaseUrl && this.supabaseServiceRoleKey && this.bucket);
  }

  async uploadImages(files: UploadImageFile[], fallbackBaseUrl: string) {
    if (this.useSupabaseStorage) {
      return Promise.all(files.map(file => this.uploadToSupabase(file)));
    }

    return Promise.all(files.map(file => this.uploadToLocalDisk(file, fallbackBaseUrl)));
  }

  private makeObjectName(file: UploadImageFile) {
    const suppliedExtension = extname(file.originalname || '').toLowerCase();
    const extension = extensionByMime[file.mimetype] || suppliedExtension || '.jpg';
    const datePrefix = new Date().toISOString().slice(0, 10);
    return `listing-images/${datePrefix}/${Date.now()}-${randomUUID()}${extension}`;
  }

  private async uploadToSupabase(file: UploadImageFile) {
    const objectPath = this.makeObjectName(file);
    const encodedPath = encodedStoragePath(objectPath);
    const endpoint = `${this.supabaseUrl}/storage/v1/object/${encodeURIComponent(this.bucket)}/${encodedPath}`;

    const uploadBody = file.buffer.buffer.slice(
      file.buffer.byteOffset,
      file.buffer.byteOffset + file.buffer.byteLength,
    ) as ArrayBuffer;

    const key = this.supabaseServiceRoleKey;

    // Supabase's new sb_secret_* keys are API keys, not JWTs. They belong in the
    // apikey header. Legacy service_role keys are JWTs and can additionally be
    // sent as Authorization: Bearer <jwt>.
    const headers: Record<string, string> = {
      apikey: key,
      'Content-Type': file.mimetype,
      'Cache-Control': '3600',
      'x-upsert': 'false',
    };

    if (!key.startsWith('sb_secret_')) {
      headers.Authorization = `Bearer ${key}`;
    }

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: uploadBody,
      });
    } catch (error) {
      console.error('Supabase Storage connection failed', error);
      throw new InternalServerErrorException('Storage gambar sedang tidak dapat diakses. Coba lagi.');
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error('Supabase Storage upload failed', response.status, detail);
      throw new InternalServerErrorException('Gambar gagal disimpan ke storage. Coba lagi.');
    }

    return `${this.supabaseUrl}/storage/v1/object/public/${encodeURIComponent(this.bucket)}/${encodedPath}`;
  }

  private async uploadToLocalDisk(file: UploadImageFile, baseUrl: string) {
    const uploadDir = resolve(process.env.UPLOAD_DIR || 'uploads');
    await mkdir(uploadDir, { recursive: true });

    const suppliedExtension = extname(file.originalname || '').toLowerCase();
    const extension = extensionByMime[file.mimetype] || suppliedExtension || '.jpg';
    const filename = `${Date.now()}-${randomUUID()}${extension}`;
    await writeFile(resolve(uploadDir, filename), file.buffer);

    return `${baseUrl.replace(/\/$/, '')}/uploads/${encodeURIComponent(filename)}`;
  }
}
