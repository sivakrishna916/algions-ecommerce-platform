const mongoose = require('mongoose');
const env = require('../config/env');

const notFoundHandler = (req, res) =>
  res.status(404).json({ success: false, error: { code: 'ROUTE_NOT_FOUND', message: `Cannot ${req.method} ${req.originalUrl}` } });

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  let status = err.status || 500;
  let code = err.code && typeof err.code === 'string' ? err.code : 'INTERNAL_ERROR';
  let message = err.message || 'Something went wrong';
  let details = err.details;

  if (err instanceof mongoose.Error.ValidationError) {
    status = 400; code = 'VALIDATION_ERROR'; message = 'Data validation failed';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400; code = 'INVALID_ID'; message = `Invalid ${err.path}`;
  } else if (err.code === 11000) {
    status = 409; code = 'DUPLICATE_KEY';
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    message = `A record with this ${field} already exists`;
  } else if (err.type === 'entity.parse.failed') {
    status = 400; code = 'INVALID_JSON'; message = 'Request body is not valid JSON';
  }

  if (status >= 500) {
    if (!env.isTest) console.error(err);
    if (env.nodeEnv === 'production') message = 'Internal server error';
  }
  const error = { code, message };
  if (details) error.details = details;
  return res.status(status).json({ success: false, error });
};

module.exports = { notFoundHandler, errorHandler };
