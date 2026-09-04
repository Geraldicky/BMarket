import { describe, expect, it } from 'vitest'; import { canTransition } from './transaction-policy';
describe('transaction policy', () => {
  it('only buyer can pay through the dedicated payment action', () => {
    expect(canTransition('PENDING', 'CONFIRMED', 'seller')).toBe(false);
    expect(canTransition('PENDING', 'COMPLETED', 'buyer')).toBe(false);
  });
  it('seller confirms a paid order', () => {
    expect(canTransition('PAID', 'CONFIRMED', 'seller')).toBe(true);
    expect(canTransition('PAID', 'CONFIRMED', 'buyer')).toBe(false);
  });
  it('buyer releases escrow after receiving the order', () => expect(canTransition('CONFIRMED', 'COMPLETED', 'buyer')).toBe(true));
  it('seller cannot release their own escrow', () => expect(canTransition('CONFIRMED', 'COMPLETED', 'seller')).toBe(false));
  it('allows either participant to cancel an active order', () => {
    expect(canTransition('PENDING', 'CANCELLED', 'buyer')).toBe(true);
    expect(canTransition('PAID', 'CANCELLED', 'seller')).toBe(true);
    expect(canTransition('CONFIRMED', 'CANCELLED', 'buyer')).toBe(true);
  });
  it('terminal statuses cannot transition', () => { expect(canTransition('COMPLETED', 'CANCELLED', 'buyer')).toBe(false); expect(canTransition('CANCELLED', 'CONFIRMED', 'seller')).toBe(false); });
});
