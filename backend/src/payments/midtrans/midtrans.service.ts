import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { MidtransNotification, MidtransSnapRequest, MidtransSnapResponse, MidtransStatus } from './midtrans.types';

@Injectable()
export class MidtransService {
  private get serverKey() {
    const value = process.env.MIDTRANS_SERVER_KEY?.trim();
    if (!value) throw new ServiceUnavailableException('Midtrans Sandbox belum dikonfigurasi.');
    return value;
  }

  private headers() {
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${this.serverKey}:`).toString('base64')}`,
    };
  }

  private async response<T>(response: Response): Promise<T> {
    const data = await response.json().catch(() => ({})) as T & { error_messages?: string[]; status_message?: string };
    if (!response.ok) {
      const message = data.error_messages?.join(', ') || data.status_message || `HTTP ${response.status}`;
      throw new BadGatewayException(`Midtrans menolak permintaan: ${message}`);
    }
    return data;
  }

  async createSnap(payload: MidtransSnapRequest): Promise<MidtransSnapResponse> {
    const response = await fetch('https://app.sandbox.midtrans.com/snap/v1/transactions', {
      method: 'POST', headers: this.headers(), body: JSON.stringify(payload), signal: AbortSignal.timeout(15_000),
    });
    return this.response<MidtransSnapResponse>(response);
  }

  async getStatus(orderId: string): Promise<MidtransStatus> {
    const response = await fetch(`https://api.sandbox.midtrans.com/v2/${encodeURIComponent(orderId)}/status`, {
      method: 'GET', headers: this.headers(), signal: AbortSignal.timeout(15_000),
    });
    return this.response<MidtransStatus>(response);
  }

  async refund(orderId: string, amount: number, reason: string, refundKey: string): Promise<MidtransStatus> {
    const response = await fetch(`https://api.sandbox.midtrans.com/v2/${encodeURIComponent(orderId)}/refund`, {
      method: 'POST', headers: this.headers(), signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({ refund_key: refundKey, amount, reason: reason.slice(0, 255) }),
    });
    return this.response<MidtransStatus>(response);
  }

  async cancel(orderId: string): Promise<MidtransStatus> {
    const response = await fetch(`https://api.sandbox.midtrans.com/v2/${encodeURIComponent(orderId)}/cancel`, {
      method: 'POST', headers: this.headers(), signal: AbortSignal.timeout(15_000),
    });
    return this.response<MidtransStatus>(response);
  }

  verifySignature(notification: MidtransNotification): boolean {
    if (!notification.order_id || !notification.status_code || !notification.gross_amount || !notification.signature_key) return false;
    const expected = createHash('sha512')
      .update(`${notification.order_id}${notification.status_code}${notification.gross_amount}${this.serverKey}`)
      .digest('hex');
    const provided = String(notification.signature_key).toLowerCase();
    const expectedBuffer = Buffer.from(expected);
    const providedBuffer = Buffer.from(provided);
    return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
  }
}
