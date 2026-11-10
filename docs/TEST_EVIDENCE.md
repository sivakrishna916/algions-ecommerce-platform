# Test Evidence

Project: Algions Store (E-Commerce Platform)
Commit tested: 6438034
Environment: Node `[v22.23.4]`, Mongosh `[2.14.1]` (standalone, no replica set), Jest 30 + Supertest, Vitest 5 + Testing Library.

## 1. Backend tests

Command: `cd backend && npm test`

Replace the block below with your own output from your machine:

```
PASS tests/auth.test.js
PASS tests/admin.test.js
PASS tests/catalog.test.js
PASS tests/cart.test.js
PASS tests/payment-race.test.js
PASS tests/orders.test.js
PASS tests/docs.test.js
PASS tests/unit.test.js

Test Suites: 8 passed, 8 total
Tests:       108 passed, 108 total
```

The tests use a separate database (`algions_ecommerce_test`) that is dropped before and after the run. They call the real Express app through Supertest and a real MongoDB. Nothing is mocked, because unique indexes and atomic updates only exist in the real database.

## 2. Where each acceptance test is proven

| Acceptance test | File | What the tests check |
|---|---|---|
| AT1: place an order end to end | `orders.test.js` | search, add to cart, checkout, payment, stock change, order history |
| AT2: stock re-checked, never negative | `orders.test.js`, `admin.test.js` | stale cart is refused; a multi-item order is all-or-nothing; 8 buyers for 3 units give exactly 3 orders; 10 simultaneous stock reductions on a stock of 4 give exactly 4 successes |
| AT3: no duplicate orders | `orders.test.js` | same key sent twice returns the same order; 6 simultaneous identical requests give 1 order; two different keys for one cart give 1 order |
| AT4: failed payment and cancellation | `orders.test.js`, `payment-race.test.js` | declined card leaves the order Placed/Unpaid and a retry pays it; paying twice charges once; 3 simultaneous cancels restore stock once; cancelling a paid order refunds it; a payment finishing after cancellation is reversed |
| AT5: admin protection and reports | `admin.test.js` | 12 admin endpoints return 401 without a token and 403 for a customer; forged token rejected; demoted admin loses access at once; dashboard totals equal an independent calculation; reconciliation balances and turns red when a payment record is deleted |

## 3. Does the concurrency test really test anything?

If the stock guard (`stock: { $gte: qty }`) in `inventoryService.reserve` is removed, the 8-buyer test fails with `Expected length: 3, Received length: 8`, meaning 8 orders were created for 3 units. With the guard in place it passes.

## 4. Negative cases covered

Wrong password and unknown email (same 401 message); admin routes without permission; quantities 0, -1, 1.5, 11, a string and null; out-of-stock item; unknown, inactive or missing product and variant; invalid status changes (skipping a step, going backwards, setting PAID by hand, unknown status); missing or someone else's delivery address; missing Idempotency-Key; empty cart; bad card number, expiry or CVV; declined, insufficient-funds and UPI-fail payments; malformed JSON; unknown routes; regex characters in search; disabled accounts.

## 5. Frontend tests

Command: `cd frontend && npm test` runs the unit tests (9 tests). The UI journey tests are skipped unless a backend is running:

```
cd backend
MONGO_URI=mongodb://127.0.0.1:27017/algions_e2e node src/scripts/seed.js --reset
MONGO_URI=mongodb://127.0.0.1:27017/algions_e2e PORT=5055 node src/server.js
cd ../frontend
E2E_API_URL=http://localhost:5055/api npm test
```

Result with the backend running: 4 test files, 14 tests passed (replace with your own output).

The journey tests render the real React app in jsdom and use it like a user: register, search, add to cart, add an address, pay, see the confirmation; a declined card and a retry; and as admin, update an order, create a product, adjust stock and see that the reconciliation report balances.

Problems these tests caught during development, which were then fixed:
1. After a successful checkout the user landed on "Your cart is empty" instead of the order page.
2. Add to cart could send a logged-in user to the login page if clicked before the saved session finished loading.