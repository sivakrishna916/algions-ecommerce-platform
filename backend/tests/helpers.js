const mongoose = require('mongoose');
const request = require('supertest');
const { connectDB } = require('../src/config/db');
const { createApp } = require('../src/app');
const authService = require('../src/services/authService');
const User = require('../src/models/User');

const app = createApp();
const api = () => request(app);

async function setupDb() {
  await connectDB();
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.init())); // build indexes (unique constraints) before tests
}
async function teardownDb() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

async function createAdmin(email = 'admin@test.dev') {
  const user = await User.create({ name: 'Test Admin', email, role: 'admin', passwordHash: await authService.hashPassword('Admin@12345') });
  return { user, token: authService.signToken(user) };
}
async function registerCustomer(email = 'cust@test.dev') {
  const res = await api().post('/api/auth/register').send({ name: 'Test Customer', email, password: 'Customer@123' });
  return { token: res.body.data.token, user: res.body.data.user };
}
const auth = (token) => ({ Authorization: `Bearer ${token}` });

module.exports = { app, api, setupDb, teardownDb, createAdmin, registerCustomer, auth };
