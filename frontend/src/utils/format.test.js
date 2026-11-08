import { describe, expect, test } from 'vitest';
import { discountPercent, formatMoney, newIdempotencyKey, paiseToRupees, rupeesToPaise } from './format';

describe('format utils', () => {
  test('formats paise as Indian rupees without float drift', () => {
    expect(formatMoney(49900)).toBe('₹499');
    expect(formatMoney(123456)).toBe('₹1,234.56');
    expect(formatMoney(0)).toBe('₹0');
    expect(formatMoney(undefined)).toBe('₹0');
  });
  test('rupee/paise conversion rounds correctly', () => {
    expect(rupeesToPaise('19.99')).toBe(1999);
    expect(rupeesToPaise(0.1 + 0.2)).toBe(30);
    expect(paiseToRupees(1999)).toBe(19.99);
  });
  test('discount percent', () => {
    expect(discountPercent(75, 100)).toBe(25);
    expect(discountPercent(100, 100)).toBe(0);
    expect(discountPercent(100, undefined)).toBe(0);
  });
  test('idempotency keys are unique and long enough for the API (>= 8 chars)', () => {
    const a = newIdempotencyKey(); const b = newIdempotencyKey();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(8);
  });
});
