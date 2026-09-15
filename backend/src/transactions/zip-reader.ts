// src/transactions/zip-reader.ts
// Minimal read-only ZIP reader so admins can inspect archived service deliverables during a dispute
// without extracting anything to disk. Supports stored/deflated entries and ZIP64 archives.

import { inflateRawSync } from 'node:zlib';

export interface ZipEntry {
  path: string;
  size: number;
  compressedSize: number;
  isDirectory: boolean;
  encrypted: boolean;
  method: number;
  localHeaderOffset: number;
}

export class ZipReadError extends Error {}

const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const ZIP64_LOCATOR = 0x07064b50;
const ZIP64_END_OF_CENTRAL_DIRECTORY = 0x06064b50;
const CENTRAL_DIRECTORY_HEADER = 0x02014b50;
const LOCAL_FILE_HEADER = 0x04034b50;
const MAX_UINT32 = 0xffffffff;
const CORRUPT = 'File ZIP rusak atau tidak valid.';

function findEndOfCentralDirectory(buffer: Buffer) {
  const stop = Math.max(0, buffer.length - 22 - 0xffff);
  for (let offset = buffer.length - 22; offset >= stop; offset--) {
    if (buffer.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY) return offset;
  }
  throw new ZipReadError(CORRUPT);
}

export function listZipEntries(buffer: Buffer, limit = 2000): { entries: ZipEntry[]; truncated: boolean } {
  if (buffer.length < 22) throw new ZipReadError(CORRUPT);
  try {
    const end = findEndOfCentralDirectory(buffer);
    let total = buffer.readUInt16LE(end + 10);
    let offset = buffer.readUInt32LE(end + 16);
    if ((total === 0xffff || offset === MAX_UINT32) && end >= 20 && buffer.readUInt32LE(end - 20) === ZIP64_LOCATOR) {
      const zip64End = Number(buffer.readBigUInt64LE(end - 20 + 8));
      if (buffer.readUInt32LE(zip64End) !== ZIP64_END_OF_CENTRAL_DIRECTORY) throw new ZipReadError(CORRUPT);
      total = Number(buffer.readBigUInt64LE(zip64End + 32));
      offset = Number(buffer.readBigUInt64LE(zip64End + 48));
    }

    const entries: ZipEntry[] = [];
    for (let index = 0; index < total && entries.length < limit; index++) {
      if (buffer.readUInt32LE(offset) !== CENTRAL_DIRECTORY_HEADER) throw new ZipReadError(CORRUPT);
      const flags = buffer.readUInt16LE(offset + 8);
      const method = buffer.readUInt16LE(offset + 10);
      let compressedSize = buffer.readUInt32LE(offset + 20);
      let size = buffer.readUInt32LE(offset + 24);
      const nameLength = buffer.readUInt16LE(offset + 28);
      const extraLength = buffer.readUInt16LE(offset + 30);
      const commentLength = buffer.readUInt16LE(offset + 32);
      let localHeaderOffset = buffer.readUInt32LE(offset + 42);
      const nameEnd = offset + 46 + nameLength;
      if (nameEnd + extraLength > buffer.length) throw new ZipReadError(CORRUPT);
      const path = buffer.toString(flags & 0x800 ? 'utf8' : 'latin1', offset + 46, nameEnd);

      // ZIP64 extra field: 64-bit values appear, in this order, only for fields saturated at 0xFFFFFFFF.
      for (let extra = nameEnd; extra + 4 <= nameEnd + extraLength;) {
        const id = buffer.readUInt16LE(extra);
        const length = buffer.readUInt16LE(extra + 2);
        if (id === 0x0001) {
          let cursor = extra + 4;
          const next = () => { const value = Number(buffer.readBigUInt64LE(cursor)); cursor += 8; return value; };
          if (size === MAX_UINT32) size = next();
          if (compressedSize === MAX_UINT32) compressedSize = next();
          if (localHeaderOffset === MAX_UINT32) localHeaderOffset = next();
        }
        extra += 4 + length;
      }

      entries.push({ path, size, compressedSize, isDirectory: path.endsWith('/'), encrypted: Boolean(flags & 0x1), method, localHeaderOffset });
      offset = nameEnd + extraLength + commentLength;
    }
    return { entries, truncated: total > entries.length };
  } catch (error) {
    if (error instanceof ZipReadError) throw error;
    throw new ZipReadError(CORRUPT); // out-of-range reads from a truncated or malformed archive
  }
}

export function readZipEntry(buffer: Buffer, entry: ZipEntry, maxBytes: number): Buffer {
  if (entry.isDirectory) throw new ZipReadError('Folder tidak dapat dipratinjau.');
  if (entry.encrypted) throw new ZipReadError('File di dalam ZIP ini terenkripsi. Unduh ZIP untuk memeriksanya.');
  if (entry.size > maxBytes) throw new ZipReadError('File terlalu besar untuk dipratinjau. Unduh ZIP untuk memeriksanya.');
  const header = entry.localHeaderOffset;
  if (header + 30 > buffer.length || buffer.readUInt32LE(header) !== LOCAL_FILE_HEADER) throw new ZipReadError(CORRUPT);
  const start = header + 30 + buffer.readUInt16LE(header + 26) + buffer.readUInt16LE(header + 28);
  const data = buffer.subarray(start, start + entry.compressedSize);
  if (data.length !== entry.compressedSize) throw new ZipReadError(CORRUPT);
  if (entry.method === 0) return data;
  if (entry.method === 8) {
    try {
      // maxOutputLength guards against entries whose header understates the real size (zip bombs).
      return inflateRawSync(data, { maxOutputLength: Math.max(1, maxBytes) });
    } catch {
      throw new ZipReadError('Isi file tidak dapat dibaca atau melebihi batas pratinjau. Unduh ZIP untuk memeriksanya.');
    }
  }
  throw new ZipReadError('Metode kompresi file ini belum didukung. Unduh ZIP untuk memeriksanya.');
}
