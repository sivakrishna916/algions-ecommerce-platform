const env = require('./config/env');
const { connectDB } = require('./config/db');
const { createApp } = require('./app');

(async () => {
  await connectDB();
  const app = createApp();
  app.listen(env.port, '0.0.0.0', () => {
    console.log(`API listening on port ${env.port}  (docs: /api/docs)`);
  });
})().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
