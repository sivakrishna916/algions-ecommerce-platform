const { z } = require('zod');
const { luhnValid } = require('../services/paymentService');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const sku = z.string().trim().min(1).max(40);
const qty = z.number({ error: 'Quantity must be a number' }).int('Quantity must be a whole number').min(1, 'Quantity must be at least 1').max(10, 'Quantity cannot exceed 10');

const addItem = z.object({ productId: objectId, sku, quantity: qty.default(1) });
const setQuantity = z.object({ productId: objectId, sku, quantity: qty });
const itemParams = z.object({ productId: objectId, sku });
const coupon = z.object({ code: z.string().trim().min(1).max(30) });

const card = z.object({
  method: z.literal('card'),
  number: z.string().transform((s) => s.replace(/[\s-]/g, '')).pipe(
    z.string().regex(/^\d{13,19}$/, 'Card number must be 13–19 digits').refine(luhnValid, 'Card number is invalid')),
  expiry: z.string().regex(
  /^(0[1-9]|1[0-2])\/\d{2}$/,
  'Expiry must be MM/YY'
),
  cvv: z.string().regex(/^\d{3,4}$/, 'CVV must be 3 or 4 digits'),
});
const upi = z.object({ method: z.literal('upi'), vpa: z.string().trim().regex(
  /^[\w.-]{2,}@[a-zA-Z]{2,}$/,
  'Enter a valid UPI id (name@bank)'
) });
const payment = z.discriminatedUnion('method', [card, upi]);

const checkout = z.object({ addressId: objectId, payment });
const pay = z.object({ payment });
const cancel = z.object({ reason: z.string().trim().max(200).optional() });
const orderList = z.object({
  status: z.enum(['PLACED', 'PAID', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
const idempotencyHeader = z.object({ 'idempotency-key': z.string().trim().min(8, 'Idempotency-Key must be 8–128 characters').max(128) }).passthrough();

module.exports = { addItem, setQuantity, itemParams, coupon, checkout, pay, cancel, orderList, idempotencyHeader, payment };
