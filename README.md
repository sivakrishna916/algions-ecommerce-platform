# Algions Store: E-Commerce Platform

Internship assessment project for ALGIONS AI LABS PRIVATE LIMITED (Full-Stack Web Development).
Submitted by Sivakrishna Reddy, reg. no. 12305362. Repository: https://github.com/sivakrishna916/algions-ecommerce-platform

A MERN e-commerce app with a customer storefront and a separate admin console. I focused on the parts that go wrong in real shops: stock, payments and duplicate orders.

## What it does

- **Customer:** sign up and log in, address book, search, filters, sorting and pagination, product variants, a cart saved on the server, coupons, GST and shipping, checkout with simulated card/UPI payment (success and failure), order tracking, cancellation with refund.
- **Admin:** dashboard with charts, product and category management, stock adjustment, order status updates, customer list, sales report, reconciliation report, audit log. Admin routes are checked on the server, not only hidden in the UI.

## Stack

React 19 + Vite + Tailwind + React Router + Axios + Recharts (frontend); Node 22, Express, Mongoose, zod, JWT, bcryptjs (backend); MongoDB; Jest + Supertest and Vitest for tests.
I used `bcryptjs` instead of `bcrypt` to avoid native build problems on Windows.

## Run it

Needs Node 22 and a running MongoDB (local or Atlas).

```bash
cd backend
cp .env.example .env     # set JWT_SECRET; change MONGO_URI if not local
npm install
npm run seed             # demo data (add -- --reset to wipe first)
npm run dev              # API on :5000, Swagger at /api/docs

cd ../frontend
npm install
npm run dev              # app on :5173
```

Main environment variables (full list in `backend/.env.example`):

| Variable | Purpose |
|---|---|
| `MONGO_URI` | database connection |
| `JWT_SECRET` | signs login tokens (use a long random value) |
| `CLIENT_ORIGIN` | allowed frontend URL (CORS) |
| `TAX_RATE_PERCENT`, `SHIPPING_FLAT_PAISE`, `FREE_SHIPPING_THRESHOLD_PAISE` | pricing rules |

## Demo logins (dummy data)

| Role | Email | Password |
|---|---|---|
| Admin | admin@demo.test | Admin@12345 |
| Customer | customer@demo.test | Customer@12345 |

Test cards: `4242 4242 4242 4242` succeeds, `4000 0000 0000 0002` is declined, `4000 0000 0000 9995` is insufficient funds. A UPI id ending in `@fail` is declined. Coupons: `WELCOME10`, `FLAT100`.

## Folder layout

```
backend/src   routes -> controllers -> services (business rules) -> models
              plus validators, middleware, config, seed scripts, OpenAPI docs
backend/tests API and unit tests (real MongoDB)
frontend/src  pages, components, context (Auth, Cart, Toast), api client, tests
docs/         ER diagram, technical report, test evidence
```

## Tests

```bash
cd backend && npm test        # 108 tests, uses its own test database
cd frontend && npm test       # unit tests; UI journeys need E2E_API_URL (see docs/TEST_EVIDENCE.md)
```

The five acceptance tests from the brief are covered in `backend/tests/orders.test.js` and `admin.test.js`.

## API docs

Swagger UI at `/api/docs` (JSON at `/api/docs.json`). Responses are `{ success, data, meta }` or `{ success: false, error: { code, message } }`. Money is stored as integer paise.

## Main design decisions

1. **No overselling:** stock is checked and reduced in one atomic MongoDB update.
2. **No duplicate orders:** an `Idempotency-Key` header, a unique `(user, key)` index and a short cart lock.
3. **Order state machine:** Placed → Paid → Packed → Shipped → Delivered, or Cancelled; invalid jumps are rejected.
4. **Server decides:** prices, stock and roles are always read from the database, never trusted from the client.

## Limitations

- Unpaid orders keep their stock reserved until cancelled (no auto-expiry yet).
- Payments are simulated; no real gateway, email or SMS.
- Login token is kept in `localStorage`; rate limiting is on login only.
- Product images are generated illustrations, not photos.
- Not deployed; run locally with the steps above.