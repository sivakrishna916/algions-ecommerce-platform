const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const { notFoundHandler, errorHandler } = require('./middleware/error');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.clientOrigin.split(','), credentials: false }));
  app.use(express.json({ limit: '100kb' }));
  if (!env.isTest) app.use(morgan('dev'));

  app.get('/api/health', (_req, res) => res.json({ success: true, data: { status: 'ok', time: new Date().toISOString() } }));

  // Brute-force protection for credential endpoints (disabled under test)
  if (!env.isTest) {
    app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
      message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many attempts, try again later' } } }));
  }

  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/catalog', require('./routes/catalog'));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
