const env = require('../config/env');
const coupons = require('../config/coupons');

/**
 * Pure function — easy to unit test. All amounts are integers in paise.
 * lines: [{ unitPrice, quantity }]
 * Order of operations: subtotal → coupon discount → tax on (subtotal - discount) → shipping → total.
 */
function computePricing(lines, couponCode, cfg = env.pricing) {
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  let discount = 0;
  let couponError = null;

  if (couponCode) {
    const c = coupons[couponCode.toUpperCase()];
    if (!c) couponError = 'Invalid coupon code';
    else if (subtotal < c.minSubtotal) couponError = `Coupon needs a minimum order of ₹${c.minSubtotal / 100}`;
    else {
      discount = c.type === 'percent' ? Math.min(Math.round((subtotal * c.value) / 100), c.maxDiscount ?? Infinity) : c.value;
      discount = Math.min(discount, subtotal);
    }
  }

  const taxable = subtotal - discount;
  const tax = Math.round((taxable * cfg.taxRatePercent) / 100);
  const shipping = subtotal === 0 || taxable >= cfg.freeShippingThreshold ? 0 : cfg.shippingFlat;
  const total = taxable + tax + shipping;
  return { subtotal, discount, tax, shipping, total, couponError };
}

module.exports = { computePricing };
