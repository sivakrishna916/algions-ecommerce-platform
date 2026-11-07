require('dotenv').config({ quiet: true });

const required = ['MONGO_URI', 'JWT_SECRET'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}. Copy .env.example to .env.`);
}

const int = (name, fallback) => {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : parseInt(v, 10);
};

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isTest: process.env.NODE_ENV === 'test',
  port: int('PORT', 5000),
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  pricing: {
    taxRatePercent: int('TAX_RATE_PERCENT', 18),
    shippingFlat: int('SHIPPING_FLAT_PAISE', 4900),
    freeShippingThreshold: int('FREE_SHIPPING_THRESHOLD_PAISE', 99900),
  },
  lowStockThreshold: int('LOW_STOCK_THRESHOLD', 5),
  maxQtyPerLine: 10,
};
