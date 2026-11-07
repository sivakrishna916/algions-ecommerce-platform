const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const audit = require('./auditService');
const { AppError, unauthorized, conflict, notFound } = require('../utils/AppError');

const BCRYPT_ROUNDS = process.env.NODE_ENV === 'test' ? 4 : 10;
// Compared against when the email does not exist, so response time does not reveal whether it does.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

const signToken = (user) =>
  jwt.sign({ sub: user._id.toString(), role: user.role }, env.jwtSecret, { algorithm: 'HS256', expiresIn: env.jwtExpiresIn });

async function register({ name, email, password, phone }) {
  if (await User.exists({ email })) throw conflict('EMAIL_TAKEN', 'An account with this email already exists');
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  // Role is never taken from the request: public registration always creates a customer.
  const user = await User.create({ name, email, phone, passwordHash, role: 'customer' });
  await audit.record(user, 'auth.register', 'User', user._id, `Customer registered: ${email}`);
  return { user: user.toSafeJSON(), token: signToken(user) };
}

async function login({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash');
  const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !ok) throw new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password');
  if (!user.isActive) throw new AppError(403, 'ACCOUNT_DISABLED', 'This account has been disabled');
  return { user: user.toSafeJSON(), token: signToken(user) };
}

async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw notFound('User');
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw unauthorized('Current password is incorrect');
  user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await user.save();
}

const hashPassword = (pw) => bcrypt.hash(pw, BCRYPT_ROUNDS);

module.exports = { register, login, changePassword, hashPassword, signToken };
