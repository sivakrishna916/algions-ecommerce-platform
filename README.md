# Algions Store: E-Commerce Platform (MERN)

Individual internship assessment project for **ALGIONS AI LABS PRIVATE LIMITED**.

A full-stack e-commerce application with a customer storefront and a separate admin console, built around reliable inventory, payment and order handling.

**Project maintainer:** Sivakrishna Reddy
**GitHub:** [@sivakrishna916](https://github.com/sivakrishna916)
**Repository:** [algions-ecommerce-platform](https://github.com/sivakrishna916/algions-ecommerce-platform)

**Contents**

| Section | What it covers |
|---|---|
| Features | What the application does for customers and admins |
| Tech stack | Libraries and why |
| Quick start | Exact commands to run everything locally from a clean machine |
| Demo accounts | Dummy logins and the sandbox payment cards |
| Project structure | Where each responsibility lives |
| Running the tests | Backend suite, frontend unit tests, and the UI journey tests |
| API documentation | Swagger UI location and response conventions |
| Key design decisions | The five decisions that matter most (full list in `docs/ARCHITECTURE.md`) |
| Deployment | Free-tier deployment instructions (the application is not currently deployed) |
| Known limitations | Honest list of what is simplified or missing |
| Documentation index | Every document in `docs/` and what it contains |

## Features

**Customer:** register and log in, profile and address book, product catalogue with search, category and price filters, sorting (newest, popularity, price) and pagination, product variants, persistent server-side cart with stock validation, coupons, server-calculated subtotal / discount / 18% GST / shipping / total, checkout with simulated card or UPI payment (success and failure paths), retry payment, order history and tracking (Placed, Paid, Packed, Shipped, Delivered), cancellation with automatic refund and stock restore.

**Admin (separate console, role enforced on the server):** dashboard (revenue, orders, customers, products, 14-day sales chart, status chart, recent orders, low stock), product CRUD with variants, atomic stock adjustment, category management, order management with validated status changes, customer list with enable/disable, sales report, **reconciliation report** (orders vs payments vs reports), read-only audit log.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS 3, React Router 7, Axios, Recharts, Context API |
| Backend | Node.js 22, Express 4, Mongoose 8, zod (validation), jsonwebtoken, bcryptjs, helmet, cors, express-rate-limit, swagger-ui-express |
| Database | MongoDB (local `mongod` or Atlas free tier). Standalone is enough; no replica set is required |
| Tests | Jest + Supertest (backend), Vitest + Testing Library (frontend) |

## Quick start

Prerequisites: Node.js 22 (what this was built and tested on) and a running MongoDB (local install or an Atlas free-tier connection string).

```bash
# 1. Backend
cd backend
cp .env.example .env            # edit JWT_SECRET (and MONGO_URI if not local)
npm install
npm run seed                    # demo categories, 24 products, users and orders
npm run dev                     # API on http://localhost:5000  (Swagger: /api/docs)

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev                     # http://localhost:5173  (proxies /api to :5000)
```

`npm run seed -- --reset` wipes the database first. Product pictures are generated SVG files in `frontend/public/products/`; regenerate them with `npm run art` in `frontend/`.

## Demo accounts (dummy data, created by the seed script)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@demo.test` | `Admin@12345` |
| Customer | `customer@demo.test` | `Customer@12345` |

Sandbox payment instruments (no real money, no real gateway):

| Input | Result |
|---|---|
| Card `4242 4242 4242 4242` (any future expiry, any 3-digit CVV) | Success |
| Card `4000 0000 0000 0002` | Declined |
| Card `4000 0000 0000 9995` | Insufficient funds |
| Card `4000 0000 0000 0119` | Processing error |
| UPI id ending in `@fail` (for example `a@fail`) | Declined |
| Any other UPI id (for example `a@okbank`) | Success |

Coupons: `WELCOME10` (10% off, max Rs 500, minimum order Rs 500) and `FLAT100` (Rs 100 off, minimum order Rs 1000).

## Project structure

```
backend/src
  config/        env validation, db connection, coupons
  models/        User, Category, Product, Cart, Order, Payment, AuditLog
  routes/        URL wiring + validation + role guards
  controllers/   thin HTTP handlers
  services/      business rules (orderService, inventoryService, pricingService,
                 paymentService, orderStateMachine, reportService, ...)
  validators/    zod schemas
  middleware/    auth (JWT + RBAC), validate, central error handler
  scripts/       seed.js, seedData.js
  docs/          OpenAPI description
backend/tests    8 suites, 108 tests (real MongoDB)
frontend/src
  api/           axios client + service functions
  context/       Auth, Cart, Toast
  components/    shared UI (forms, layout, guards, product card)
  pages/         customer pages;  pages/admin/  admin console (lazy-loaded bundle)
  test/          UI journey tests
docs/            design, report, evidence, interview prep, demo script
```

## Running the tests

```bash
# Backend (needs MongoDB; uses its own database algions_ecommerce_test, which is dropped by the tests)
cd backend && npm test

# Frontend unit tests
cd frontend && npm test

# Frontend UI journey tests (React app -> real API -> real MongoDB)
# (bash syntax below; in Windows PowerShell set variables first, e.g. $env:MONGO_URI="mongodb://127.0.0.1:27017/algions_e2e")
cd backend
MONGO_URI=mongodb://127.0.0.1:27017/algions_e2e node src/scripts/seed.js --reset
MONGO_URI=mongodb://127.0.0.1:27017/algions_e2e PORT=5055 node src/server.js &     # separate shell is fine
cd ../frontend
E2E_API_URL=http://localhost:5055/api npm test      # on Windows PowerShell: $env:E2E_API_URL="http://localhost:5055/api"; npm test
```

Set `MONGO_URI_TEST` to point the backend tests at a different database. Recorded results: `docs/TEST_EVIDENCE.md`.

## API documentation

Swagger UI at `http://localhost:5000/api/docs`, raw OpenAPI JSON at `/api/docs.json`. Success responses are `{ success: true, data, meta? }`; errors are `{ success: false, error: { code, message, details? } }`. Money is always an integer number of paise.

## Key design decisions

1. **Oversell-proof stock:** one atomic MongoDB update both checks and decrements (`stock >= qty` is part of the filter), with rollback if a later line fails.
2. **No duplicate orders:** `Idempotency-Key` header + a unique `(user, idempotencyKey)` index + a short per-cart lock.
3. **Single order state machine** and conditional status updates, so concurrent admins or a cancel racing a payment cannot corrupt an order. Only the request that wins the transition restores stock or refunds.
4. **Server is the source of truth:** prices, stock, totals and roles are always re-read from the database; the client only sends ids and quantities.
5. **Reconciliation report** cross-checks orders, payments and report totals, and the test suite proves it detects tampering.

## Deployment (free tiers; instructions only)

The application is currently configured for local development. No live deployment URL is available yet.

1. **Database:** create a free MongoDB Atlas cluster, a database user, allow network access, and copy the connection string.
2. **Backend (Render / Railway / similar):** root directory `backend`, build `npm install`, start `npm start`. Set environment variables `NODE_ENV=production`, `MONGO_URI`, a long random `JWT_SECRET`, and `CLIENT_ORIGIN=https://<your-frontend-url>`. Run `npm run seed` once (from a shell or locally against the Atlas URI) to load demo data.
3. **Frontend (Vercel / Netlify):** root directory `frontend`, build `npm run build`, output `dist`. Set `VITE_API_URL=https://<your-backend-url>/api`. `public/_redirects` already provides the single-page-app fallback for Netlify; on Vercel add a rewrite of `/(.*)` to `/index.html`.

## Known limitations (honest list)

- **Unpaid orders hold stock until cancelled.** There is no automatic expiry of abandoned PLACED orders.
- The maximum quantity per line (10) is defined in three places (`config/env.js`, the zod schema in `validators/shop.js`, and the `Cart` model); changing it means editing all three.
- A concurrent duplicate checkout request is answered with `409 CHECKOUT_IN_PROGRESS` (retry returns the original order) rather than blocking until the first finishes.
- JWT is stored in `localStorage` (simple, but exposed to XSS); there are no refresh tokens or logout-everywhere. Rate limiting is applied to login only.
- Search is a case-insensitive escaped regex over name, brand, tags and description; a text index exists but is not used.
- Coupons live in code (`config/coupons.js`), not the database. Revenue by day is attributed to the order creation date.
- Payments are simulated; there are no webhooks, emails or SMS. Product images are locally generated illustrations; admins can also enter image URLs.
- Admin accounts can only be created by the seed script (by design: public registration always creates a customer).
- The automated UI tests run in jsdom. Manual verification across real browsers and device sizes remains to be completed.
- `bcryptjs` (pure JavaScript bcrypt) is used instead of native `bcrypt` to avoid native build failures on Windows.

## Documentation index

| File | Contents |
|---|---|
| `docs/TECHNICAL_REPORT.md` | Design, flows, security, testing, trade-offs |
| `docs/ER_DIAGRAM.md` | ER diagram, embed/reference reasoning, indexes, validation |
| `docs/ARCHITECTURE.md` | Architecture decision records |
| `docs/REQUIREMENTS.md` | Requirement-by-requirement checklist with evidence |
| `docs/TEST_EVIDENCE.md` | Recorded test output and what each acceptance test proves |
| `docs/DEMO_SCRIPT.md` | 3 to 5 minute walkthrough script and video plan |
| `docs/SUBMISSION.md` | Repository record: URL, branch, commit SHA, checklist |
