// Test-only configuration. Uses a dedicated database so dev data is never touched.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-not-used-anywhere-else';
process.env.MONGO_URI = process.env.MONGO_URI_TEST || 'mongodb://127.0.0.1:27017/algions_ecommerce_test';
