import { describe, expect, it, vi } from 'vitest';
import { ComplaintsService } from './complaints.service';
import { ListingsService } from '../listings/listings.service';

const reportDto = {
  targetType: 'LISTING' as const,
  targetId: 'd0d13ac9-b998-4f36-a5f8-643c85003a88',
  reason: 'Informasi menyesatkan',
  description: 'Deskripsi listing tidak sesuai dengan foto yang ditampilkan.',
};

function complaintPrisma() {
  return {
    listing: { findUnique: vi.fn() },
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    complaint: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
  };
}

describe('post-moderation listing flow', () => {
  it('publishes a new listing immediately', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'listing-1',
      images: '[]',
      status: 'ACTIVE',
    });
    const service = new ListingsService({ listing: { create } } as never);

    const result = await service.create('seller-1', {
      title: 'Kalkulator scientific',
      description: 'Kalkulator masih berfungsi dengan baik.',
      price: 125000,
      category: 'ELECTRONICS',
      type: 'PRODUCT',
      condition: 'GOOD',
      stock: 1,
      images: ['http://localhost:3000/uploads/kalkulator.jpg'],
      fulfillmentMethods: ['CAMPUS_MEETUP', 'INSTANT_COURIER'],
    });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'ACTIVE', sellerId: 'seller-1' }),
    }));
    expect(result.status).toBe('ACTIVE');
  });

  it('prevents a seller from reporting their own listing', async () => {
    const prisma = complaintPrisma();
    prisma.listing.findUnique.mockResolvedValue({ id: reportDto.targetId, sellerId: 'student-1', status: 'ACTIVE' });
    const service = new ComplaintsService(prisma as never);

    await expect(service.create('student-1', reportDto)).rejects.toThrow(/milik sendiri/);
    expect(prisma.complaint.create).not.toHaveBeenCalled();
  });

  it('prevents duplicate reports from the same account', async () => {
    const prisma = complaintPrisma();
    prisma.listing.findUnique.mockResolvedValue({ id: reportDto.targetId, sellerId: 'seller-1', status: 'ACTIVE' });
    prisma.complaint.findUnique.mockResolvedValue({ id: 'existing-report' });
    const service = new ComplaintsService(prisma as never);

    await expect(service.create('student-1', reportDto)).rejects.toThrow(/sudah pernah melaporkan/);
    expect(prisma.complaint.create).not.toHaveBeenCalled();
  });

  it('creates a report for another seller listing', async () => {
    const prisma = complaintPrisma();
    prisma.listing.findUnique.mockResolvedValue({ id: reportDto.targetId, sellerId: 'seller-1', status: 'ACTIVE' });
    prisma.complaint.findUnique.mockResolvedValue(null);
    prisma.complaint.create.mockResolvedValue({ id: 'report-1', reporterId: 'student-1', ...reportDto, status: 'OPEN' });
    const service = new ComplaintsService(prisma as never);

    const result = await service.create('student-1', reportDto);

    expect(result.status).toBe('OPEN');
    expect(prisma.complaint.create).toHaveBeenCalledWith({ data: { reporterId: 'student-1', ...reportDto } });
  });
});
