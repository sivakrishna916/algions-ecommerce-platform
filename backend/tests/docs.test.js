const { api } = require('./helpers');

describe('API documentation and platform basics', () => {
  test('OpenAPI JSON is served and describes core endpoints', async () => {
    const res = await api().get('/api/docs.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toMatch(/^3\./);
    ['/orders/checkout', '/admin/dashboard', '/catalog/products', '/auth/login'].forEach((p) => expect(res.body.paths[p]).toBeDefined());
    expect(res.body.paths['/orders/checkout'].post.parameters.some((x) => x.name === 'Idempotency-Key' && x.required)).toBe(true);
  });
  test('unknown routes and malformed JSON give the standard error envelope', async () => {
    const nf = await api().get('/api/nope');
    expect(nf.status).toBe(404);
    expect(nf.body).toMatchObject({ success: false, error: { code: 'ROUTE_NOT_FOUND' } });
    const bad = await api().post('/api/auth/login').set('Content-Type', 'application/json').send('{not json');
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('INVALID_JSON');
  });
  test('security headers are set and x-powered-by is hidden', async () => {
    const res = await api().get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
