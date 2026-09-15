import { deflateRawSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { listZipEntries, readZipEntry } from './zip-reader';
import { TransactionsService } from './transactions.service';

function buildZip(files: { name: string; data?: Buffer; deflate?: boolean }[]) {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8');
    const data = file.data ?? Buffer.alloc(0);
    const body = file.deflate ? deflateRawSync(data) : data;
    const method = file.deflate ? 8 : 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(0x800, 6); local.writeUInt16LE(method, 8);
    local.writeUInt32LE(body.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(0x800, 8); central.writeUInt16LE(method, 10);
    central.writeUInt32LE(body.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, name, body);
    centrals.push(central, name);
    offset += 30 + name.length + body.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

const zip = buildZip([
  { name: 'src/' },
  { name: 'src/main.py', data: Buffer.from('print("halo")\n'.repeat(50)), deflate: true },
  { name: 'README.md', data: Buffer.from('# Tugas') },
  { name: 'laporan.docx', data: Buffer.from('binary') },
]);

describe('zip-reader', () => {
  it('lists files and folders in the archive', () => {
    const { entries, truncated } = listZipEntries(zip);
    expect(truncated).toBe(false);
    expect(entries.map(entry => [entry.path, entry.isDirectory])).toEqual([['src/', true], ['src/main.py', false], ['README.md', false], ['laporan.docx', false]]);
  });

  it('reads stored and deflated entries', () => {
    const { entries } = listZipEntries(zip);
    expect(readZipEntry(zip, entries[1], 1024 * 1024).toString()).toBe('print("halo")\n'.repeat(50));
    expect(readZipEntry(zip, entries[2], 1024 * 1024).toString()).toBe('# Tugas');
  });

  it('refuses entries above the preview limit and malformed archives', () => {
    const { entries } = listZipEntries(zip);
    expect(() => readZipEntry(zip, entries[1], 10)).toThrow(/terlalu besar/i);
    expect(() => listZipEntries(Buffer.from('bukan zip sama sekali, hanya teks biasa'))).toThrow(/tidak valid/i);
  });
});

describe('TransactionsService — admin archive review', () => {
  function setup(fileName = 'hasil.zip') {
    const prisma = { transactionDeliverable: { findUnique: vi.fn().mockResolvedValue({ id: 'file-1', fileName, storageKey: 'local:a/b.zip' }) } };
    const uploads = { readPrivateFile: vi.fn().mockResolvedValue(zip) };
    return new TransactionsService(prisma as never, {} as never, uploads as never);
  }

  it('lists archive entries with which ones can be previewed', async () => {
    const archive = await setup().listDeliverableArchive('file-1');
    expect(archive.entries.find(entry => entry.path === 'src/main.py')?.previewable).toBe(true);
    expect(archive.entries.find(entry => entry.path === 'laporan.docx')?.previewable).toBe(false);
  });

  it('returns the text of a file inside the archive', async () => {
    await expect(setup().readDeliverableArchiveEntry('file-1', 'README.md')).resolves.toEqual(expect.objectContaining({ kind: 'text', content: '# Tugas' }));
    await expect(setup().readDeliverableArchiveEntry('file-1', 'laporan.docx')).rejects.toThrow(/tidak dapat dipratinjau/i);
  });

  it('only opens ZIP deliverables as archives', async () => {
    await expect(setup('hasil.pdf').listDeliverableArchive('file-1')).rejects.toThrow(/hanya dapat dilihat untuk file ZIP/i);
  });

  it('lets an admin download any deliverable', async () => {
    const service = setup('source.rar');
    await expect(service.createAdminDeliverableLink('file-1', 'download')).resolves.toEqual(expect.objectContaining({ mode: 'download' }));
    await expect(service.createAdminDeliverableLink('file-1', 'preview')).rejects.toThrow(/tidak dapat dipratinjau/i);
  });
});
