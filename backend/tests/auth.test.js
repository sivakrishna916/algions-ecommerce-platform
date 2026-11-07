const { api, setupDb, teardownDb, createAdmin, registerCustomer, auth } = require('./helpers');

beforeAll(setupDb);
afterAll(teardownDb);

describe('Authentication', () => {
  test('registers a customer, hashes the password and never returns the hash', async () => {
    const res = await api().post('/api/auth/register').send({ name: 'Asha Rao', email: 'ASHA@Test.dev', password: 'Secret@123' });
    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe('asha@test.dev');
    expect(res.body.data.user.role).toBe('customer');
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.token).toEqual(expect.any(String));
    const User = require('../src/models/User');
    const stored = await User.findOne({ email: 'asha@test.dev' }).select('+passwordHash');
    expect(stored.passwordHash).not.toContain('Secret@123');
    expect(stored.passwordHash.startsWith('$2')).toBe(true); // bcrypt
  });

  test('cannot self-assign the admin role at registration', async () => {
    const res = await api().post('/api/auth/register').send({ name: 'Evil', email: 'evil@test.dev', password: 'Secret@123', role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('customer');
  });

  test('rejects weak password and bad email with field-level details', async () => {
    const res = await api().post('/api/auth/register').send({ name: 'X', email: 'nope', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const fields = res.body.error.details.map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });

  test('rejects duplicate email with 409', async () => {
    const res = await api().post('/api/auth/register').send({ name: 'Asha Two', email: 'asha@test.dev', password: 'Secret@123' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  test('login succeeds with correct credentials', async () => {
    const res = await api().post('/api/auth/login').send({ email: 'asha@test.dev', password: 'Secret@123' });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
  });

  test('invalid login: wrong password and unknown email give the same generic 401', async () => {
    const a = await api().post('/api/auth/login').send({ email: 'asha@test.dev', password: 'WrongPass1' });
    const b = await api().post('/api/auth/login').send({ email: 'ghost@test.dev', password: 'WrongPass1' });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(a.body.error.message).toBe(b.body.error.message);
  });

  test('protected route requires a valid token', async () => {
    expect((await api().get('/api/auth/me')).status).toBe(401);
    expect((await api().get('/api/auth/me').set('Authorization', 'Bearer garbage')).status).toBe(401);
    const { token } = await registerCustomer('me@test.dev');
    const ok = await api().get('/api/auth/me').set(auth(token));
    expect(ok.status).toBe(200);
    expect(ok.body.data.user.email).toBe('me@test.dev');
  });

  test('disabled accounts are locked out even with a previously valid token', async () => {
    const { token, user } = await registerCustomer('gone@test.dev');
    await require('../src/models/User').updateOne({ _id: user._id }, { isActive: false });
    expect((await api().get('/api/auth/me').set(auth(token))).status).toBe(401);
  });
});

describe('Profile and address book', () => {
  let token;
  beforeAll(async () => { ({ token } = await registerCustomer('addr@test.dev')); });
  const addr = { fullName: 'Asha Rao', phone: '9876543210', line1: '12 MG Road', city: 'Pune', state: 'Maharashtra', postalCode: '411001' };

  test('first address becomes default; adding a second default switches it', async () => {
    const a1 = await api().post('/api/auth/me/addresses').set(auth(token)).send(addr);
    expect(a1.status).toBe(201);
    expect(a1.body.data.address.isDefault).toBe(true);
    const a2 = await api().post('/api/auth/me/addresses').set(auth(token)).send({ ...addr, label: 'Work', isDefault: true });
    const list = await api().get('/api/auth/me/addresses').set(auth(token));
    expect(list.body.data.addresses).toHaveLength(2);
    expect(list.body.data.addresses.filter((x) => x.isDefault)).toHaveLength(1);
    expect(list.body.data.addresses.find((x) => x.isDefault)._id).toBe(a2.body.data.address._id);
  });

  test('rejects an invalid address', async () => {
    const res = await api().post('/api/auth/me/addresses').set(auth(token)).send({ ...addr, postalCode: '!' });
    expect(res.status).toBe(400);
  });

  test('updates profile and deletes an address', async () => {
    const up = await api().patch('/api/auth/me').set(auth(token)).send({ name: 'Asha R', phone: '9000000000' });
    expect(up.body.data.user.name).toBe('Asha R');
    const list = await api().get('/api/auth/me/addresses').set(auth(token));
    const id = list.body.data.addresses[0]._id;
    const del = await api().delete(`/api/auth/me/addresses/${id}`).set(auth(token));
    expect(del.status).toBe(200);
    expect((await api().delete(`/api/auth/me/addresses/${id}`).set(auth(token))).status).toBe(404);
  });
});

describe('Authorization helper', () => {
  test('admin token carries admin role', async () => {
    const { token } = await createAdmin();
    const res = await api().get('/api/auth/me').set(auth(token));
    expect(res.body.data.user.role).toBe('admin');
  });
});
