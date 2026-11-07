const env = require('./config/env');
const { connectDB } = require('./config/db');
const { createApp } = require('./app');

(async () => {
  await connectDB();
  const app = createApp();
  app.listen(env.port, () => console.log(`API listening on http://localhost:${env.port}  (docs: /api/docs)`));
})().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
