const { z } = require('zod');

const listProducts = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.string().trim().max(80).optional(), // slug or id
  minPrice: z.coerce.number().int().min(0).optional(), // paise
  maxPrice: z.coerce.number().int().min(0).optional(),
  inStock: z.enum(['true', 'false']).optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'popular']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(60).default(12),
}).refine((v) => v.minPrice === undefined || v.maxPrice === undefined || v.minPrice <= v.maxPrice, {
  message: 'minPrice cannot exceed maxPrice', path: ['minPrice'],
});

module.exports = { listProducts };
