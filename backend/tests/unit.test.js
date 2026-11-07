const { computePricing } = require('../src/services/pricingService');
const sm = require('../src/services/orderStateMachine');
const { simulateCharge, luhnValid } = require('../src/services/paymentService');

const cfg = { taxRatePercent: 18, shippingFlat: 4900, freeShippingThreshold: 99900 };

describe('pricing (pure)', () => {
  test('subtotal, 18% tax and flat shipping below the free-shipping threshold', () => {
    const p = computePricing([{ unitPrice: 20000, quantity: 2 }], null, cfg); // ₹400
    expect(p).toMatchObject({ subtotal: 40000, discount: 0, tax: 7200, shipping: 4900, total: 52100 });
  });
  test('free shipping at or above the threshold', () => {
    const p = computePricing([{ unitPrice: 99900, quantity: 1 }], null, cfg);
    expect(p.shipping).toBe(0);
    expect(p.total).toBe(99900 + Math.round(99900 * 0.18));
  });
  test('percent coupon is capped and tax applies after discount', () => {
    const p = computePricing([{ unitPrice: 1000000, quantity: 1 }], 'welcome10', cfg); // 10% = 100000 → capped at 50000
    expect(p.discount).toBe(50000);
    expect(p.tax).toBe(Math.round((1000000 - 50000) * 0.18));
  });
  test('flat coupon below minimum is reported, not applied', () => {
    const p = computePricing([{ unitPrice: 50000, quantity: 1 }], 'FLAT100', cfg);
    expect(p.discount).toBe(0);
    expect(p.couponError).toMatch(/minimum/i);
  });
  test('unknown coupon is reported', () => {
    expect(computePricing([{ unitPrice: 50000, quantity: 1 }], 'NOPE', cfg).couponError).toBe('Invalid coupon code');
  });
  test('empty cart totals zero with no shipping', () => {
    expect(computePricing([], null, cfg)).toMatchObject({ subtotal: 0, shipping: 0, total: 0 });
  });
  test('amounts are always integers', () => {
    const p = computePricing([{ unitPrice: 3333, quantity: 3 }], null, cfg);
    [p.subtotal, p.tax, p.shipping, p.total].forEach((n) => expect(Number.isInteger(n)).toBe(true));
  });
});

describe('order state machine (pure)', () => {
  test('allows the happy path in order', () => {
    expect(sm.canTransition('PLACED', 'PAID')).toBe(true);
    expect(sm.canTransition('PAID', 'PACKED')).toBe(true);
    expect(sm.canTransition('PACKED', 'SHIPPED')).toBe(true);
    expect(sm.canTransition('SHIPPED', 'DELIVERED')).toBe(true);
  });
  test('forbids skipping steps and going backwards', () => {
    expect(sm.canTransition('PLACED', 'SHIPPED')).toBe(false);
    expect(sm.canTransition('PAID', 'DELIVERED')).toBe(false);
    expect(sm.canTransition('SHIPPED', 'PACKED')).toBe(false);
  });
  test('terminal states have no exits', () => {
    expect(sm.allowedNext('DELIVERED')).toEqual([]);
    expect(sm.allowedNext('CANCELLED')).toEqual([]);
  });
  test('cancellation rules differ by role', () => {
    expect(sm.canCancel('customer', 'PAID')).toBe(true);
    expect(sm.canCancel('customer', 'PACKED')).toBe(false);
    expect(sm.canCancel('admin', 'PACKED')).toBe(true);
    expect(sm.canCancel('admin', 'SHIPPED')).toBe(false);
  });
});

describe('payment simulator (pure)', () => {
  test('luhn', () => {
    expect(luhnValid('4242424242424242')).toBe(true);
    expect(luhnValid('4242424242424241')).toBe(false);
  });
  test('success, declines and last-4 masking (card number is not echoed)', () => {
    const ok = simulateCharge({ method: 'card', number: '4242424242424242' });
    expect(ok.status).toBe('SUCCEEDED');
    expect(ok.instrument).toBe('•••• 4242');
    expect(JSON.stringify(ok)).not.toContain('4242424242424242');
    expect(simulateCharge({ method: 'card', number: '4000000000000002' })).toMatchObject({ status: 'FAILED', failureCode: 'CARD_DECLINED' });
    expect(simulateCharge({ method: 'card', number: '4000000000009995' }).failureCode).toBe('INSUFFICIENT_FUNDS');
    expect(simulateCharge({ method: 'upi', vpa: 'a@fail' }).status).toBe('FAILED');
    expect(simulateCharge({ method: 'upi', vpa: 'a@okbank' }).status).toBe('SUCCEEDED');
  });
});
