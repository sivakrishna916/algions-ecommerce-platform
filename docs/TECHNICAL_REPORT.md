# Technical Report: Algions Store (E-Commerce Platform)

Assessment: ALGIONS AI LABS PRIVATE LIMITED, Full-Stack Web Development.
Candidate: Sivakrishna Reddy

## 1. Summary

I built a MERN e-commerce application with a customer storefront and a separate admin console. The API has 43 documented REST operations (Swagger at `/api/docs`). Orders move through Placed, Paid, Packed, Shipped and Delivered, or Cancelled, and the server checks every change of state. Stock, duplicate-order and payment safety depend on atomic MongoDB operations, not on the client behaving well.

All 108 backend tests and 14 frontend tests pass (see `TEST_EVIDENCE.md`). Not covered: load testing and deployment.

## 2. Requirements and acceptance tests

Every item in the assessment scope is implemented. The five acceptance tests are each covered by named automated tests, listed in section 2 of `TEST_EVIDENCE.md`.

## 3. Architecture

One repository, two applications. The React app talks to the Express API over JSON. In development Vite proxies `/api` to the backend; in production the frontend uses `VITE_API_URL` and the API allows only `CLIENT_ORIGIN` in CORS.

Backend request path: route (URL, zod validation, role check) -> controller (turns HTTP into a service call) -> service (all business rules) -> Mongoose model. Controllers contain no rules, so the logic is easy to test and easy to find.

I chose a modular monolith because the domain is small and the hard problems here are about consistency, which is simpler in one process with one database.

Main decisions:
1. **No multi-document transactions.** They need a MongoDB replica set, which a plain local install does not have. I used single-document atomic updates plus compensation (undo) steps instead. It works on a standalone server, Docker and the Atlas free tier.
2. **Idempotent checkout.** The client sends an `Idempotency-Key`; a unique index on `(user, idempotencyKey)` means two simultaneous retries cannot both create an order.
3. **Money as integer paise** to avoid floating point errors.
4. **Stock is reserved when the order is placed** and given back on cancellation, exactly once.
5. **One order state machine.** Each status change is a `findOneAndUpdate` that includes the expected current status, so two admins cannot both succeed.
6. **Soft delete for products**, so old orders keep their history. Orders also store a copy of name, price and address.
7. **JWT (HS256), 7 days, Bearer header.** The token is kept in `localStorage`, which is simple but exposed to XSS; an httpOnly cookie would need CSRF handling.
8. **`bcryptjs`** instead of `bcrypt` to avoid native build problems on Windows.

## 4. Data model

Seven collections: users (with embedded addresses), categories, products (embedded variants carrying price and stock), carts (one per user), orders (embedded copy of items, address, pricing and status history), payments (one row per attempt) and audit logs. The diagram, the embed-or-reference reasoning and the index list are in `ER_DIAGRAM.md`.

Totals come from one pure function, `pricingService.computePricing`: subtotal, then coupon discount, then GST on the discounted amount, then shipping (free above the threshold), then total. A unit test covers it, and the reconciliation report re-checks `total = subtotal - discount + tax + shipping` for every stored order.

## 5. Main flows

**Cart.** Stored on the server per user. Every read re-prices from current product data and flags lines whose stock dropped. Quantity is checked against stock and a maximum of 10 per line.

**Checkout** (`orderService.checkout`):
1. If an order with this user and key already exists, return it (`replayed: true`).
2. Check the address belongs to the user.
3. Take a per-cart lock (30 second expiry). If it is held, answer `409 CHECKOUT_IN_PROGRESS`.
4. Re-read the cart and every product, refuse unavailable or short lines, recompute prices.
5. Reserve stock line by line with atomic updates; if one line fails, release the ones already taken.
6. Insert the order. The unique index is the last safeguard.
7. Empty the cart and release the lock.
8. Attempt payment.

**Payment (simulated).** `paymentService.simulateCharge` gives fixed results for the documented test cards. Each attempt is saved as a Payment row, with only the last 4 digits of a card. Success moves the order PLACED to PAID with a conditional update. If the order was cancelled while the charge was running, that update matches nothing and the charge is marked refunded. On failure the order stays PLACED and UNPAID with its stock reserved, and the customer can retry or cancel.

**Cancellation.** Customers can cancel PLACED and PAID orders; admins can also cancel PACKED. The change to CANCELLED is conditional, so only one of several simultaneous cancels wins, and only that one restores stock and refunds.

**State machine.** PLACED to PAID or CANCELLED; PAID to PACKED or CANCELLED; PACKED to SHIPPED or CANCELLED; SHIPPED to DELIVERED. DELIVERED and CANCELLED are final. Admins cannot set PAID by hand, so every PAID order has a real payment.

**Admin stock.** Changed only with `POST /admin/products/:id/stock` and a +/- amount, using an update that refuses a result below zero. Editing a product ignores the stock value for existing variants.

## 6. Consistency and concurrency

| Risk | How it is handled | Test |
|---|---|---|
| Two buyers take the last unit | One `updateOne` with `stock >= qty` in the filter | 8 buyers, 3 units: exactly 3 orders |
| Half-reserved multi-item cart | Release the lines already reserved | all-or-nothing test |
| Duplicate order from retry or double click | Idempotency key + unique index + cart lock | 6 identical simultaneous requests: 1 order |
| Stock restored twice on cancel | Only the winner of the status change restores | 3 simultaneous cancels: stock restored once |
| Two admins change one order | Update includes the expected current status | 3 simultaneous PACKED requests: 1 wins |
| Payment finishes after cancellation | Conditional PLACED to PAID; otherwise refund | `payment-race.test.js` |
| Negative stock from admin | Guarded `$inc` | 10 simultaneous -1 on stock 4: 4 succeed |

Because there are no transactions, a crash between two steps could leave stock reserved without an order. A real system would add a cleanup job; the reconciliation report is a first step.

## 7. Security

- **Passwords:** bcrypt, 10 rounds, 8 to 72 characters with a letter and a number, never returned by the API. Wrong password and unknown email give the same message.
- **Tokens:** HS256 JWT; the server will not start without `JWT_SECRET`. Every request reloads the user, so a disabled account or changed role takes effect immediately.
- **Authorisation:** all `/api/admin/*` routes run `authenticate` then `requireRole('admin')` on the server; cart and order routes are customer-only. Frontend route guards are only for convenience. A customer asking for another customer's order gets 404. Public sign-up always creates a `customer`.
- **Input:** zod on every route, Mongoose validators as a second layer, ObjectId checks, escaped search input, 100 KB JSON limit.
- **HTTP:** helmet, CORS limited to the configured origin, login rate limit (30 per 15 minutes per IP), no `x-powered-by`.
- **Secrets:** `.env` is git-ignored; `.env.example` has placeholders and dummy demo logins.
- **Cards:** numbers are checked with the Luhn algorithm and used only to pick the simulated result; they are not stored or logged.

## 8. Reporting and reconciliation

Revenue means the sum of `pricing.total` of orders whose `paymentStatus` is PAID. The dashboard, sales report and reconciliation report all use that one definition.

Reconciliation runs seven checks: paid-order revenue equals successful payments; the counts match; refunded orders equal refunded payments; the daily series adds up to dashboard revenue; no paid order lacks a successful payment; no cancelled order has unrestored stock; every order total equals its parts. A test deletes a payment record and confirms the report fails.

## 9. Frontend

React with the admin console as a separate lazy-loaded bundle, so customers never download it. Data is fetched with a small `useFetch` hook that ignores stale responses. Global state is only Auth, Cart (a copy of the server cart) and Toasts. The checkout page makes one idempotency key per attempt, reuses it after a network error or 5xx, and uses a new one after a definite answer. A flag blocks double clicks. Forms have labels, error messages tied to fields, a skip link, focus rings, and loading, empty and error states.

## 10. Testing

Pure logic (pricing, state machine, payment simulator) has unit tests. Everything else is tested through the real Express app on a real MongoDB with no mocks. Results are in `TEST_EVIDENCE.md`.

## 11. Limitations and known issues

- Unpaid orders keep their stock reserved until cancelled; an expiry job is the obvious next step.
- Payments are simulated; there are no webhooks, emails or SMS.
- The token is in `localStorage`; there are no refresh tokens; rate limiting covers login only.
- Search uses an escaped regex; a text index exists but is not used.
- Coupons are in code, not in the database.
- Product images are generated illustrations, not photos.
- Not deployed.
- Known issues I found on review (remove a line once it is fixed):
  - An admin editing a product at the exact moment an order is placed can overwrite that order's stock change.
  - A second checkout with a different idempotency key sent in the same instant can create a second order.
  - Behind a reverse proxy, `trust proxy` must be set or all users share one login rate limit.
  - Refreshing the `/checkout` page sends the user back to `/cart`.

## 12. AI assistance

Tool used: Claude (Anthropic).
How I used it: for each module I described the workflow I wanted. The AI generated code, and I read it, ran it, tested it and added it to the project.
Libraries: all third-party packages are listed in the `package.json` files.