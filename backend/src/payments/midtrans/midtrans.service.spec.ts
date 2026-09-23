import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MidtransService } from './midtrans.service';

describe('MidtransService endpoint configuration', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.MIDTRANS_SERVER_KEY = 'test-server-key';
    process.env.MIDTRANS_IS_PRODUCTION = 'false';
    process.env.MIDTRANS_TIMEOUT_MS = '3000';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('uses Sandbox endpoints when production mode is disabled', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ token: 'snap-token', redirect_url: 'https://sandbox.test' }), { status: 200 }));
    const service = new MidtransService();

    await service.createSnap({ transaction_details: { order_id: 'order-1', gross_amount: 1000 } });

    expect(fetchMock).toHaveBeenCalledWith('https://app.sandbox.midtrans.com/snap/v1/transactions', expect.objectContaining({ method: 'POST' }));
  });

  it('uses live API endpoints only when production mode is enabled', async () => {
    process.env.MIDTRANS_IS_PRODUCTION = 'true';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ transaction_status: 'settlement' }), { status: 200 }));
    const service = new MidtransService();

    await service.getStatus('BMARKET-order');

    expect(fetchMock).toHaveBeenCalledWith('https://api.midtrans.com/v2/BMARKET-order/status', expect.objectContaining({ method: 'GET' }));
  });
});
