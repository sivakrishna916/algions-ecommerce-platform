/** OpenAPI 3.0 description of the API. Served as Swagger UI at /api/docs and raw JSON at /api/docs.json. */
const ref = (n) => ({ $ref: `#/components/schemas/${n}` });
const json = (schema) => ({ 'application/json': { schema } });
const ok = (description, schema) => ({ description, content: schema ? json(schema) : undefined });
const err = (description) => ({ description, content: json(ref('Error')) });
const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'string', pattern: '^[a-f0-9]{24}$' } };
const q = (name, schema = { type: 'string' }, description) => ({ name, in: 'query', required: false, schema, description });
const pageQ = [q('page', { type: 'integer', minimum: 1, default: 1 }), q('limit', { type: 'integer', minimum: 1, maximum: 100 })];
const bearer = [{ bearerAuth: [] }];
const std = { 400: err('Validation error'), 401: err('Missing/invalid token'), 403: err('Wrong role') };

const op = (tag, summary, extra = {}) => ({ tags: [tag], summary, ...extra });
const body = (schema) => ({ required: true, content: json(schema) });

const orderStatuses = ['PLACED', 'PAID', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'Algions E-Commerce API',
    version: '1.0.0',
    description: [
      'REST API for the E-Commerce assessment project.',
      '',
      '**Response envelope** — success: `{ success: true, data, meta? }`; error: `{ success: false, error: { code, message, details? } }`.',
      '**Money** is always an integer number of paise (₹1 = 100 paise).',
      '**Auth** — `Authorization: Bearer <JWT>` from `/auth/login`. Admin routes additionally require role `admin` (checked on the server).',
      '**Idempotency** — `POST /orders/checkout` requires an `Idempotency-Key` header; repeating a key returns the original order.',
      '**Sandbox payments** — card `4242 4242 4242 4242` succeeds; `4000 0000 0000 0002` declined; `4000 0000 0000 9995` insufficient funds; `4000 0000 0000 0119` processing error; UPI ids ending `@fail` are declined.',
    ].join('\n'),
  },
  servers: [{ url: '/api' }],
  tags: ['Auth & Profile', 'Catalogue', 'Cart', 'Orders', 'Admin: Dashboard & Reports', 'Admin: Products & Inventory', 'Admin: Categories', 'Admin: Orders', 'Admin: Customers & Audit'].map((name) => ({ name })),
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Error: { type: 'object', properties: { success: { type: 'boolean', example: false }, error: { type: 'object', properties: { code: { type: 'string', example: 'VALIDATION_ERROR' }, message: { type: 'string' }, details: {} } } } },
      Register: { type: 'object', required: ['name', 'email', 'password'], properties: { name: { type: 'string' }, email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 8, description: 'Needs a letter and a number' }, phone: { type: 'string' } } },
      Login: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string' }, password: { type: 'string' } } },
      Address: { type: 'object', required: ['fullName', 'phone', 'line1', 'city', 'state', 'postalCode'], properties: { label: { type: 'string' }, fullName: { type: 'string' }, phone: { type: 'string' }, line1: { type: 'string' }, line2: { type: 'string' }, city: { type: 'string' }, state: { type: 'string' }, postalCode: { type: 'string' }, country: { type: 'string' }, isDefault: { type: 'boolean' } } },
      Variant: { type: 'object', required: ['sku', 'label', 'price'], properties: { sku: { type: 'string' }, label: { type: 'string' }, price: { type: 'integer', description: 'paise' }, mrp: { type: 'integer' }, stock: { type: 'integer', minimum: 0 } } },
      ProductInput: { type: 'object', required: ['name', 'category', 'variants'], properties: { name: { type: 'string' }, description: { type: 'string' }, brand: { type: 'string' }, category: { type: 'string', description: 'Category id' }, images: { type: 'array', items: { type: 'string' } }, tags: { type: 'array', items: { type: 'string' } }, variants: { type: 'array', items: ref('Variant') }, isActive: { type: 'boolean' } } },
      Payment: { oneOf: [
        { type: 'object', required: ['method', 'number', 'expiry', 'cvv'], properties: { method: { type: 'string', enum: ['card'] }, number: { type: 'string', example: '4242 4242 4242 4242' }, expiry: { type: 'string', example: '12/30' }, cvv: { type: 'string', example: '123' } } },
        { type: 'object', required: ['method', 'vpa'], properties: { method: { type: 'string', enum: ['upi'] }, vpa: { type: 'string', example: 'name@okbank' } } },
      ] },
      Checkout: { type: 'object', required: ['addressId', 'payment'], properties: { addressId: { type: 'string' }, payment: ref('Payment') } },
      OrderStatus: { type: 'string', enum: orderStatuses },
    },
  },
  paths: {
    '/auth/register': { post: op('Auth & Profile', 'Register a customer (role is always `customer`)', { requestBody: body(ref('Register')), responses: { 201: ok('User + JWT'), 400: err('Validation error'), 409: err('EMAIL_TAKEN') } }) },
    '/auth/login': { post: op('Auth & Profile', 'Log in', { requestBody: body(ref('Login')), responses: { 200: ok('User + JWT'), 401: err('INVALID_CREDENTIALS'), 403: err('ACCOUNT_DISABLED'), 429: err('Rate limited') } }) },
    '/auth/me': {
      get: op('Auth & Profile', 'Current user', { security: bearer, responses: { 200: ok('User'), 401: std[401] } }),
      patch: op('Auth & Profile', 'Update name / phone', { security: bearer, requestBody: body({ type: 'object', properties: { name: { type: 'string' }, phone: { type: 'string' } } }), responses: { 200: ok('User'), 400: std[400] } }),
    },
    '/auth/change-password': { post: op('Auth & Profile', 'Change password', { security: bearer, requestBody: body({ type: 'object', required: ['currentPassword', 'newPassword'], properties: { currentPassword: { type: 'string' }, newPassword: { type: 'string' } } }), responses: { 200: ok('Updated'), 401: err('Wrong current password') } }) },
    '/auth/me/addresses': {
      get: op('Auth & Profile', 'List address book', { security: bearer, responses: { 200: ok('Addresses') } }),
      post: op('Auth & Profile', 'Add address (first one becomes default)', { security: bearer, requestBody: body(ref('Address')), responses: { 201: ok('Address'), 400: std[400] } }),
    },
    '/auth/me/addresses/{id}': {
      put: op('Auth & Profile', 'Update address', { security: bearer, parameters: [idParam], requestBody: body(ref('Address')), responses: { 200: ok('Address'), 404: err('Not found') } }),
      delete: op('Auth & Profile', 'Delete address', { security: bearer, parameters: [idParam], responses: { 200: ok('Removed'), 404: err('Not found') } }),
    },

    '/catalog/products': { get: op('Catalogue', 'Search / filter / sort / paginate products', { parameters: [q('q', undefined, 'Search name, brand, tags, description'), q('category', undefined, 'Category slug or id'), q('minPrice', { type: 'integer' }, 'paise'), q('maxPrice', { type: 'integer' }, 'paise'), q('inStock', { type: 'string', enum: ['true', 'false'] }), q('sort', { type: 'string', enum: ['newest', 'price_asc', 'price_desc', 'popular'] }), ...pageQ], responses: { 200: ok('Products + pagination meta'), 400: err('Invalid query') } }) },
    '/catalog/products/{idOrSlug}': { get: op('Catalogue', 'Product detail with variants', { parameters: [{ name: 'idOrSlug', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: ok('Product'), 404: err('Not found / inactive') } }) },
    '/catalog/categories': { get: op('Catalogue', 'Active categories with product counts', { responses: { 200: ok('Categories') } }) },

    '/cart': {
      get: op('Cart', 'Get cart with server-calculated pricing and per-line stock issues', { security: bearer, responses: { 200: ok('Cart') } }),
      delete: op('Cart', 'Empty cart', { security: bearer, responses: { 200: ok('Cart') } }),
    },
    '/cart/items': {
      post: op('Cart', 'Add item (merges duplicates, validates stock and 1–10 quantity)', { security: bearer, requestBody: body({ type: 'object', required: ['productId', 'sku'], properties: { productId: { type: 'string' }, sku: { type: 'string' }, quantity: { type: 'integer', minimum: 1, maximum: 10 } } }), responses: { 201: ok('Cart'), 400: std[400], 409: err('OUT_OF_STOCK / INSUFFICIENT_STOCK'), 404: err('Product not found') } }),
      patch: op('Cart', 'Set quantity of a line', { security: bearer, requestBody: body({ type: 'object', required: ['productId', 'sku', 'quantity'], properties: { productId: { type: 'string' }, sku: { type: 'string' }, quantity: { type: 'integer' } } }), responses: { 200: ok('Cart'), 409: err('Stock') } }),
    },
    '/cart/items/{productId}/{sku}': { delete: op('Cart', 'Remove a line', { security: bearer, parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }, { name: 'sku', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: ok('Cart') } }) },
    '/cart/coupon': {
      post: op('Cart', 'Apply coupon (WELCOME10, FLAT100)', { security: bearer, requestBody: body({ type: 'object', required: ['code'], properties: { code: { type: 'string' } } }), responses: { 200: ok('Cart'), 422: err('INVALID_COUPON / COUPON_NOT_APPLICABLE') } }),
      delete: op('Cart', 'Remove coupon', { security: bearer, responses: { 200: ok('Cart') } }),
    },

    '/orders/checkout': { post: op('Orders', 'Idempotent checkout: re-validates stock, reserves it atomically, creates the order and attempts payment', {
      security: bearer, parameters: [{ name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string', minLength: 8, maxLength: 128 }, description: 'Unique per checkout attempt; reuse it when retrying' }],
      requestBody: body(ref('Checkout')),
      responses: { 201: ok('Order created. `paymentSucceeded:false` means the order is PLACED/UNPAID and can be retried via /pay'), 200: ok('Replay of an earlier request with the same key (`replayed:true`)'), 400: err('Validation / missing Idempotency-Key'), 409: err('INSUFFICIENT_STOCK / ITEM_UNAVAILABLE / CHECKOUT_IN_PROGRESS'), 422: err('CART_EMPTY / ADDRESS_REQUIRED') } }) },
    '/orders': { get: op('Orders', 'My order history', { security: bearer, parameters: [q('status', { type: 'string', enum: orderStatuses }), ...pageQ], responses: { 200: ok('Orders + meta') } }) },
    '/orders/{id}': { get: op('Orders', 'Order detail, payment attempts and allowed actions', { security: bearer, parameters: [idParam], responses: { 200: ok('Order'), 404: err('Not found (also returned for other customers\' orders)') } }) },
    '/orders/{id}/pay': { post: op('Orders', 'Pay / retry payment for a PLACED order (idempotent once paid)', { security: bearer, parameters: [idParam], requestBody: body({ type: 'object', required: ['payment'], properties: { payment: ref('Payment') } }), responses: { 200: ok('Order + payment'), 409: err('ORDER_NOT_PAYABLE') } }) },
    '/orders/{id}/cancel': { post: op('Orders', 'Cancel (customer: PLACED or PAID). Restores stock once and refunds a paid order', { security: bearer, parameters: [idParam], requestBody: body({ type: 'object', properties: { reason: { type: 'string' } } }), responses: { 200: ok('Order'), 409: err('INVALID_TRANSITION') } }) },

    '/admin/dashboard': { get: op('Admin: Dashboard & Reports', 'KPIs, 14-day sales series, status counts, recent orders, low stock', { security: bearer, responses: { 200: ok('Dashboard'), 401: std[401], 403: std[403] } }) },
    '/admin/reports/sales': { get: op('Admin: Dashboard & Reports', 'Sales report for a date range', { security: bearer, parameters: [q('from', undefined, 'YYYY-MM-DD'), q('to', undefined, 'YYYY-MM-DD')], responses: { 200: ok('Report'), 400: std[400] } }) },
    '/admin/reports/reconciliation': { get: op('Admin: Dashboard & Reports', 'Cross-checks orders vs payments vs report totals; `balanced` is true only if every check passes', { security: bearer, responses: { 200: ok('Checks') } }) },

    '/admin/products': {
      get: op('Admin: Products & Inventory', 'List products incl. inactive', { security: bearer, parameters: [q('q'), q('category'), q('status', { type: 'string', enum: ['active', 'inactive', 'all'] }), q('lowStock', { type: 'string', enum: ['true', 'false'] }), ...pageQ], responses: { 200: ok('Products') } }),
      post: op('Admin: Products & Inventory', 'Create product', { security: bearer, requestBody: body(ref('ProductInput')), responses: { 201: ok('Product'), 400: std[400], 409: err('Duplicate SKU') } }),
    },
    '/admin/products/{id}': {
      get: op('Admin: Products & Inventory', 'Product detail', { security: bearer, parameters: [idParam], responses: { 200: ok('Product'), 404: err('Not found') } }),
      put: op('Admin: Products & Inventory', 'Update product (never overwrites existing stock; use /stock)', { security: bearer, parameters: [idParam], requestBody: body(ref('ProductInput')), responses: { 200: ok('Product') } }),
      delete: op('Admin: Products & Inventory', 'Soft-delete (deactivate) product', { security: bearer, parameters: [idParam], responses: { 200: ok('Product') } }),
    },
    '/admin/products/{id}/stock': { post: op('Admin: Products & Inventory', 'Atomic stock adjustment by delta; refuses to go below zero', { security: bearer, parameters: [idParam], requestBody: body({ type: 'object', required: ['sku', 'delta'], properties: { sku: { type: 'string' }, delta: { type: 'integer', example: 10 }, reason: { type: 'string' } } }), responses: { 200: ok('Product'), 409: err('INSUFFICIENT_STOCK'), 404: err('Not found') } }) },

    '/admin/categories': {
      get: op('Admin: Categories', 'List categories', { security: bearer, responses: { 200: ok('Categories') } }),
      post: op('Admin: Categories', 'Create category', { security: bearer, requestBody: body({ type: 'object', required: ['name'], properties: { name: { type: 'string' }, description: { type: 'string' } } }), responses: { 201: ok('Category'), 409: err('Duplicate') } }),
    },
    '/admin/categories/{id}': {
      put: op('Admin: Categories', 'Update category', { security: bearer, parameters: [idParam], requestBody: body({ type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, isActive: { type: 'boolean' } } }), responses: { 200: ok('Category') } }),
      delete: op('Admin: Categories', 'Delete (blocked while products use it)', { security: bearer, parameters: [idParam], responses: { 200: ok('Deleted'), 409: err('CATEGORY_IN_USE') } }),
    },

    '/admin/orders': { get: op('Admin: Orders', 'All orders', { security: bearer, parameters: [q('status', { type: 'string', enum: orderStatuses }), q('q', undefined, 'Order number, customer name or email'), q('from'), q('to'), ...pageQ], responses: { 200: ok('Orders') } }) },
    '/admin/orders/{id}': { get: op('Admin: Orders', 'Order with customer, payments and audit entries', { security: bearer, parameters: [idParam], responses: { 200: ok('Order'), 404: err('Not found') } }) },
    '/admin/orders/{id}/status': { patch: op('Admin: Orders', 'Advance fulfilment (PACKED → SHIPPED → DELIVERED) or CANCELLED. PAID cannot be set manually.', { security: bearer, parameters: [idParam], requestBody: body({ type: 'object', required: ['status'], properties: { status: ref('OrderStatus'), note: { type: 'string' } } }), responses: { 200: ok('Order'), 409: err('INVALID_TRANSITION / ORDER_CHANGED'), 422: err('STATUS_NOT_SETTABLE') } }) },

    '/admin/customers': { get: op('Admin: Customers & Audit', 'Customers with order count and spend', { security: bearer, parameters: [q('q'), ...pageQ], responses: { 200: ok('Customers') } }) },
    '/admin/customers/{id}/status': { patch: op('Admin: Customers & Audit', 'Enable / disable a customer account', { security: bearer, parameters: [idParam], requestBody: body({ type: 'object', required: ['isActive'], properties: { isActive: { type: 'boolean' } } }), responses: { 200: ok('Customer') } }) },
    '/admin/audit-logs': { get: op('Admin: Customers & Audit', 'Audit trail (read-only)', { security: bearer, parameters: [q('action', undefined, 'prefix, e.g. order.'), q('entityType'), q('entityId'), q('from'), q('to'), ...pageQ], responses: { 200: ok('Logs') } }) },
  },
};
