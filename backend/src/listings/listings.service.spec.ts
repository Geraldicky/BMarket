import { describe, expect, it, vi } from 'vitest';
import { ListingsService } from './listings.service';

const productDto = {
  title: 'Kalkulator scientific',
  description: 'Kalkulator masih berfungsi dengan sangat baik.',
  price: 125000,
  category: 'ELECTRONICS' as const,
  type: 'PRODUCT' as const,
  mode: 'STOCKED' as const,
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

  it('does not require condition for food listings', async () => {
    const create = vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'food-1', ...data }));
    const service = new ListingsService({ listing: { create } } as never);

    await service.create('seller-1', {
      ...productDto,
      category: 'FOOD',
      condition: undefined,
    });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ category: 'FOOD', condition: null }),
    }));
  });

  it('does not require condition for preorder listings', async () => {
    const create = vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'po-conditionless', ...data }));
    const service = new ListingsService({ listing: { create } } as never);
    const deadline = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

    await service.create('seller-1', {
      ...productDto,
      mode: 'PREORDER',
      stock: undefined,
      condition: undefined,
      preorderDeadline: deadline,
      preorderQuota: 20,
    });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ mode: 'PREORDER', condition: null }),
    }));
  });

  it('keeps allocated units unavailable when total stock changes', async () => {
    const listing = {
      id: 'listing-1', sellerId: 'seller-1', title: productDto.title,
      description: productDto.description, price: productDto.price,
      category: productDto.category, type: productDto.type, mode: productDto.mode, condition: productDto.condition,
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
      category: productDto.category, type: productDto.type, mode: productDto.mode, condition: productDto.condition,
      stock: 5, stockLeft: 5, images: JSON.stringify(productDto.images), status: 'ACTIVE',
      fulfillmentMethods: [...productDto.fulfillmentMethods],
    };
    const update = vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...listing, ...data }));
    const service = new ListingsService({ listing: { findUnique: vi.fn().mockResolvedValue(listing), update } } as never);

    await service.update('listing-1', 'seller-1', { type: 'SERVICE', mode: 'SERVICE' });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: 'SERVICE', condition: null, stock: null, stockLeft: null }),
    }));
  });
  it('creates a one-off listing with exactly one unit', async () => {
    const create = vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'one-off', ...data }));
    const service = new ListingsService({ listing: { create } } as never);

    const result = await service.create('seller-1', { ...productDto, mode: 'ONE_OFF', stock: undefined });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ mode: 'ONE_OFF', stock: 1, stockLeft: 1 }),
    }));
    expect(result.inventoryState).toBe('AVAILABLE');
  });

  it('creates a campus preorder with quota-backed inventory', async () => {
    const create = vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'po-1', ...data }));
    const service = new ListingsService({ listing: { create } } as never);
    const deadline = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const readyAt = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString();

    const result = await service.create('seller-1', {
      ...productDto,
      mode: 'PREORDER',
      stock: undefined,
      preorderDeadline: deadline,
      preorderReadyAt: readyAt,
      preorderQuota: 30,
      preorderMinOrder: 10,
      preorderMaxPerBuyer: 5,
      preorderPickupLocation: 'BINUS Anggrek',
    });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ mode: 'PREORDER', preorderStatus: 'OPEN', stock: 30, stockLeft: 30, preorderQuota: 30 }),
    }));
    expect(result.preorderAccepting).toBe(true);
  });

  it('adds stock to a stocked catalog without creating a new listing', async () => {
    const listing = { ...productDto, id: 'stocked-1', sellerId: 'seller-1', status: 'ACTIVE', stock: 5, stockLeft: 0, images: JSON.stringify(productDto.images), sellerArchivedAt: null };
    const update = vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...listing, stock: 15, stockLeft: 10, ...data }));
    const service = new ListingsService({ listing: { findUnique: vi.fn().mockResolvedValue(listing), update } } as never);

    await service.restock('stocked-1', 'seller-1', 10);

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'stocked-1' },
      data: expect.objectContaining({ stock: { increment: 10 }, stockLeft: { increment: 10 } }),
    }));
  });

  it('blocks completing a preorder batch while orders are still unfinished', async () => {
    const listing = {
      id: 'po-1', sellerId: 'seller-1', title: 'Dimsum PO', mode: 'PREORDER', status: 'ACTIVE',
      preorderStatus: 'READY', preorderDeadline: new Date(Date.now() + 86_400_000), stockLeft: 10,
      images: JSON.stringify(productDto.images), sellerArchivedAt: null,
    };
    const update = vi.fn();
    const service = new ListingsService({
      listing: { findUnique: vi.fn().mockResolvedValue(listing), update },
      transaction: { count: vi.fn().mockResolvedValue(2) },
    } as never);

    await expect(service.updatePreorderStatus('po-1', 'seller-1', 'COMPLETED' as never)).rejects.toThrow(/2 pesanan/i);
    expect(update).not.toHaveBeenCalled();
  });

  it('notifies paid buyers when a preorder becomes ready', async () => {
    const listing = {
      id: 'po-1', sellerId: 'seller-1', title: 'Dimsum PO', mode: 'PREORDER', status: 'ACTIVE',
      preorderStatus: 'PROCESSING', preorderDeadline: new Date(Date.now() + 86_400_000), stockLeft: 10,
      images: JSON.stringify(productDto.images), sellerArchivedAt: null,
    };
    const updated = { ...listing, preorderStatus: 'READY' };
    const createMany = vi.fn().mockResolvedValue({ count: 2 });
    const service = new ListingsService({
      listing: { findUnique: vi.fn().mockResolvedValue(listing), update: vi.fn().mockResolvedValue(updated) },
      transaction: { findMany: vi.fn().mockResolvedValue([{ buyerId: 'buyer-1' }, { buyerId: 'buyer-2' }]) },
      notification: { createMany },
    } as never);

    await service.updatePreorderStatus('po-1', 'seller-1', 'READY' as never);

    expect(createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.arrayContaining([expect.objectContaining({ userId: 'buyer-1', title: 'Pre-order siap diambil/dikirim' })]),
    }));
  });

  it('hides seller-archived listings from My Listings', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new ListingsService({ listing: { findMany } } as never);

    await service.findMySellListings('seller-1');

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { sellerId: 'seller-1', sellerArchivedAt: null },
    }));
  });

  it('archives only an inactive listing owned by the seller', async () => {
    const listing = { id: 'listing-1', sellerId: 'seller-1', mode: 'STOCKED', status: 'INACTIVE', sellerArchivedAt: null };
    const update = vi.fn().mockResolvedValue({ ...listing, sellerArchivedAt: new Date() });
    const service = new ListingsService({
      listing: { findUnique: vi.fn().mockResolvedValue(listing), update },
    } as never);

    await expect(service.archiveInactive('listing-1', 'seller-1')).resolves.toEqual({ id: 'listing-1', archived: true });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'listing-1' },
      data: { sellerArchivedAt: expect.any(Date) },
    }));
  });

  it('archives a sold listing owned by the seller', async () => {
    const listing = { id: 'listing-sold', sellerId: 'seller-1', mode: 'ONE_OFF', status: 'SOLD', sellerArchivedAt: null };
    const update = vi.fn().mockResolvedValue({ ...listing, sellerArchivedAt: new Date() });
    const service = new ListingsService({
      listing: { findUnique: vi.fn().mockResolvedValue(listing), update },
    } as never);

    await expect(service.archiveInactive('listing-sold', 'seller-1')).resolves.toEqual({ id: 'listing-sold', archived: true });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'listing-sold' },
      data: { sellerArchivedAt: expect.any(Date) },
    }));
  });

  it('rejects archiving an active listing', async () => {
    const listing = { id: 'listing-1', sellerId: 'seller-1', mode: 'STOCKED', status: 'ACTIVE', sellerArchivedAt: null };
    const update = vi.fn();
    const service = new ListingsService({
      listing: { findUnique: vi.fn().mockResolvedValue(listing), update },
    } as never);

    await expect(service.archiveInactive('listing-1', 'seller-1')).rejects.toThrow(/nonaktifkan, selesaikan, atau jual/i);
    expect(update).not.toHaveBeenCalled();
  });

});
