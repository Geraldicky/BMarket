import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';

export type UploadImageFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

export type PrivateUploadFile = UploadImageFile & { size?: number };

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

  // ---------------------------------------------------------------------------
  // Private files (e.g. service deliverables). They are never served from a public URL:
  // callers keep the opaque storage key and stream the bytes after checking access.
  // ---------------------------------------------------------------------------

  private get privateDir() {
    return resolve(process.env.PRIVATE_UPLOAD_DIR || 'private-uploads');
  }

  private supabaseHeaders(contentType?: string) {
    const key = this.supabaseServiceRoleKey;
    const headers: Record<string, string> = { apikey: key };
    if (contentType) headers['Content-Type'] = contentType;
    if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
    return headers;
  }

  private parseStorageKey(storageKey: string) {
    const index = storageKey.indexOf(':');
    const backend = storageKey.slice(0, index);
    const path = storageKey.slice(index + 1);
    if (index < 1 || !path || (backend !== 'supabase' && backend !== 'local')) throw new NotFoundException('File tidak ditemukan.');
    return { backend, path };
  }

  private privatePath(path: string) {
    const root = this.privateDir;
    const target = resolve(root, path);
    if (target !== root && !target.startsWith(root + sep)) throw new NotFoundException('File tidak ditemukan.');
    return target;
  }

  async storePrivateFile(file: PrivateUploadFile, folder: string) {
    const extension = extname(file.originalname || '').toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 12);
    const objectPath = `${folder}/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${randomUUID()}${extension}`;

    if (this.useSupabaseStorage) {
      const endpoint = `${this.supabaseUrl}/storage/v1/object/${encodeURIComponent(this.bucket)}/${encodedStoragePath(objectPath)}`;
      const body = file.buffer.buffer.slice(file.buffer.byteOffset, file.buffer.byteOffset + file.buffer.byteLength) as ArrayBuffer;
      let response: Response;
      try {
        response = await fetch(endpoint, { method: 'POST', headers: { ...this.supabaseHeaders(file.mimetype || 'application/octet-stream'), 'x-upsert': 'false' }, body });
      } catch (error) {
        console.error('Supabase Storage connection failed', error);
        throw new InternalServerErrorException('Storage file sedang tidak dapat diakses. Coba lagi.');
      }
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        console.error('Supabase Storage private upload failed', response.status, detail);
        throw new InternalServerErrorException('File gagal disimpan ke storage. Coba lagi.');
      }
      return `supabase:${objectPath}`;
    }

    const target = this.privatePath(objectPath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.buffer);
    return `local:${objectPath}`;
  }

  async readPrivateFile(storageKey: string): Promise<Buffer> {
    const { backend, path } = this.parseStorageKey(storageKey);
    if (backend === 'supabase') {
      let response: Response;
      try {
        response = await fetch(`${this.supabaseUrl}/storage/v1/object/${encodeURIComponent(this.bucket)}/${encodedStoragePath(path)}`, { headers: this.supabaseHeaders() });
      } catch (error) {
        console.error('Supabase Storage connection failed', error);
        throw new InternalServerErrorException('Storage file sedang tidak dapat diakses. Coba lagi.');
      }
      if (response.status === 400 || response.status === 404) throw new NotFoundException('File tidak ditemukan di storage.');
      if (!response.ok) throw new InternalServerErrorException('File gagal diambil dari storage. Coba lagi.');
      return Buffer.from(await response.arrayBuffer());
    }
    try {
      return await readFile(this.privatePath(path));
    } catch {
      throw new NotFoundException('File tidak ditemukan di storage.');
    }
  }

  async deletePrivateFile(storageKey: string) {
    const { backend, path } = this.parseStorageKey(storageKey);
    if (backend === 'supabase') {
      await fetch(`${this.supabaseUrl}/storage/v1/object/${encodeURIComponent(this.bucket)}`, {
        method: 'DELETE',
        headers: this.supabaseHeaders('application/json'),
        body: JSON.stringify({ prefixes: [path] }),
      });
      return;
    }
    await unlink(this.privatePath(path)).catch(() => undefined);
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
