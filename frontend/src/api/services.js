import { http, unwrap } from './client';

const get = (url, params) => http.get(url, { params }).then(unwrap);
const post = (url, body, headers) => http.post(url, body, { headers }).then(unwrap);
const put = (url, body) => http.put(url, body).then(unwrap);
const patch = (url, body) => http.patch(url, body).then(unwrap);
const del = (url) => http.delete(url).then(unwrap);

export const authApi = {
  register: (b) => post('/auth/register', b),
  login: (b) => post('/auth/login', b),
  me: () => get('/auth/me'),
  updateMe: (b) => patch('/auth/me', b),
  changePassword: (b) => post('/auth/change-password', b),
  addresses: () => get('/auth/me/addresses'),
  addAddress: (b) => post('/auth/me/addresses', b),
  updateAddress: (id, b) => put(`/auth/me/addresses/${id}`, b),
  deleteAddress: (id) => del(`/auth/me/addresses/${id}`),
};

export const catalogApi = {
  products: (params) => get('/catalog/products', params),
  product: (idOrSlug) => get(`/catalog/products/${idOrSlug}`),
  categories: () => get('/catalog/categories'),
};

export const cartApi = {
  get: () => get('/cart'),
  add: (b) => post('/cart/items', b),
  setQty: (b) => patch('/cart/items', b),
  remove: (productId, sku) => del(`/cart/items/${productId}/${encodeURIComponent(sku)}`),
  applyCoupon: (code) => post('/cart/coupon', { code }),
  removeCoupon: () => del('/cart/coupon'),
};

export const orderApi = {
  checkout: (body, idempotencyKey) => post('/orders/checkout', body, { 'Idempotency-Key': idempotencyKey }),
  list: (params) => get('/orders', params),
  get: (id) => get(`/orders/${id}`),
  pay: (id, payment) => post(`/orders/${id}/pay`, { payment }),
  cancel: (id, reason) => post(`/orders/${id}/cancel`, { reason }),
};

export const adminApi = {
  dashboard: () => get('/admin/dashboard'),
  sales: (params) => get('/admin/reports/sales', params),
  reconciliation: () => get('/admin/reports/reconciliation'),
  products: (params) => get('/admin/products', params),
  product: (id) => get(`/admin/products/${id}`),
  createProduct: (b) => post('/admin/products', b),
  updateProduct: (id, b) => put(`/admin/products/${id}`, b),
  deleteProduct: (id) => del(`/admin/products/${id}`),
  adjustStock: (id, b) => post(`/admin/products/${id}/stock`, b),
  categories: () => get('/admin/categories'),
  createCategory: (b) => post('/admin/categories', b),
  updateCategory: (id, b) => put(`/admin/categories/${id}`, b),
  deleteCategory: (id) => del(`/admin/categories/${id}`),
  orders: (params) => get('/admin/orders', params),
  order: (id) => get(`/admin/orders/${id}`),
  setOrderStatus: (id, status, note) => patch(`/admin/orders/${id}/status`, { status, note }),
  customers: (params) => get('/admin/customers', params),
  setCustomerActive: (id, isActive) => patch(`/admin/customers/${id}/status`, { isActive }),
  auditLogs: (params) => get('/admin/audit-logs', params),
};
