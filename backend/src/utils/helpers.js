const crypto = require('crypto');
const mongoose = require('mongoose');
const { badRequest } = require('./AppError');

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Consistent success envelope: { success, data, meta? } */
const send = (res, status, data, meta) => {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const slugify = (s) =>
  s.toString().toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const randomCode = (len = 6) => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no look-alike chars
  const bytes = crypto.randomBytes(len);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
};

const generateOrderNumber = () => {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  return `ALG-${ymd}-${randomCode(6)}`;
};

const assertObjectId = (id, label = 'id') => {
  if (!mongoose.isValidObjectId(id)) throw badRequest('INVALID_ID', `Invalid ${label}`);
  return id;
};

const paginate = (query) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 12, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
};

const pageMeta = (page, limit, total) => ({ page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) });

module.exports = { asyncHandler, send, escapeRegex, slugify, randomCode, generateOrderNumber, assertObjectId, paginate, pageMeta };
