const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const { unauthorized, forbidden } = require('../utils/AppError');
const { asyncHandler } = require('../utils/helpers');

/** Verifies the Bearer token AND re-loads the user, so role changes / deactivation take effect immediately. */
const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw unauthorized();
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    throw unauthorized('Invalid or expired token');
  }
  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) throw unauthorized('Account not found or disabled');
  req.user = user;
  next();
});

/** Role check is enforced on the server for every protected route. */
const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  if (!roles.includes(req.user.role)) return next(forbidden());
  return next();
};

module.exports = { authenticate, requireRole };
