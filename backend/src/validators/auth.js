const { z } = require('zod');

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

const phone = z.string().trim().regex(/^[0-9+\-\s]{7,15}$/, 'Enter a valid phone number');

const register = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email')),
  password,
  phone: phone.optional(),
});

const login = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email')),
  password: z.string().min(1, 'Password is required'),
});

const updateProfile = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: phone.optional(),
});

const changePassword = z.object({ currentPassword: z.string().min(1), newPassword: password });

const address = z.object({
  label: z.string().trim().max(30).optional(),
  fullName: z.string().trim().min(2).max(80),
  phone,
  line1: z.string().trim().min(3).max(120),
  line2: z.string().trim().max(120).optional(),
  city: z.string().trim().min(2).max(60),
  state: z.string().trim().min(2).max(60),
  postalCode: z.string().trim().regex(/^[0-9A-Za-z\- ]{4,10}$/, 'Enter a valid postal code'),
  country: z.string().trim().max(60).optional(),
  isDefault: z.boolean().optional(),
});

const idParam = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id') });

module.exports = { register, login, updateProfile, changePassword, address, idParam };
