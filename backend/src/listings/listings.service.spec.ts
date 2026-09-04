import { describe, expect, it, vi } from 'vitest';
import { ListingsService } from './listings.service';

const productDto = {
  title: 'Kalkulator scientific',
  description: 'Kalkulator masih berfungsi dengan sangat baik.',
  price: 125000,
  category: 'ELECTRONICS' as const,
  type: 'PRODUCT' as const,
  condition: 'GOOD' as const,
  stock: 5,
  images: ['http://localhost:3000/uploads/kalkulator.jpg'],
  fulfillmentMethods: ['CAMPUS_MEETUP', 'INSTANT_COURIER'] as const,
};

describe('ListingsService', () => {
  it('publishes a complete listing immediately', async () => {
    const create = vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'listing-1', ...data }));
    const service = new ListingsService({ listing: { create } } as never);

    const result = await service.create('seller-1', productDto);

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'ACTIVE', sellerId: 'seller-1', stockLeft: 5 }),
    }));
    expect(result.images).toEqual(productDto.images);
  });

  it('requires at least one photo', async () => {
    const create = vi.fn();
    const service = new ListingsService({ listing: { create } } as never);

    await expect(service.create('seller-1', { ...productDto, images: [] })).rejects.toThrow(/minimal satu foto/i);
    expect(create).not.toHaveBeenCalled();
  });

  it('requires condition and stock for a product', async () => {
    const create = vi.fn();
    const service = new ListingsService({ listing: { create } } as never);

    await expect(service.create('seller-1', { ...productDto, condition: undefined })).rejects.toThrow(/kondisi/i);
    await expect(service.create('seller-1', { ...productDto, stock: undefined })).rejects.toThrow(/stok/i);
  });

  it('keeps allocated units unavailable when total stock changes', async () => {
    const listing = {
      id: 'listing-1', sellerId: 'seller-1', title: productDto.title,
      description: productDto.description, price: productDto.price,
      category: productDto.category, type: productDto.type, condition: productDto.condition,
      stock: 5, stockLeft: 3, images: JSON.stringify(productDto.images), status: 'ACTIVE',
      fulfillmentMethods: [...productDto.fulfillmentMethods],
    };
    const update = vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...listing, ...data }));
    const service = new ListingsService({ listing: { findUnique: vi.fn().mockResolvedValue(listing), update } } as never);

    const result = await service.update('listing-1', 'seller-1', { stock: 8 });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ stock: 8, stockLeft: 6 }),
    }));
    expect(result.stockLeft).toBe(6);
  });

  it('clears product-only fields when changed to a service', async () => {
    const listing = {
      id: 'listing-1', sellerId: 'seller-1', title: productDto.title,
      description: productDto.description, price: productDto.price,
      category: productDto.category, type: productDto.type, condition: productDto.condition,
      stock: 5, stockLeft: 5, images: JSON.stringify(productDto.images), status: 'ACTIVE',
      fulfillmentMethods: [...productDto.fulfillmentMethods],
    };
    const update = vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...listing, ...data }));
    const service = new ListingsService({ listing: { findUnique: vi.fn().mockResolvedValue(listing), update } } as never);

    await service.update('listing-1', 'seller-1', { type: 'SERVICE' });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: 'SERVICE', condition: null, stock: null, stockLeft: null }),
    }));
  });
});
