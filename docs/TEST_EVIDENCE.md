# Test Evidence

Everything below was produced by actually running the commands in this repository on the commit recorded in `SUBMISSION.md`.
Environment: Node 22, MongoDB 7.0 (standalone `mongod`, no replica set), Jest 30 / Supertest, Vitest 5 + Testing Library + jsdom.

## Backend: `cd backend && npm test`

```
PASS tests/orders.test.js
PASS tests/admin.test.js
PASS tests/payment-race.test.js
PASS tests/cart.test.js
PASS tests/catalog.test.js
PASS tests/auth.test.js
PASS tests/docs.test.js
PASS tests/unit.test.js
Test Suites: 8 passed, 8 total
Tests:       108 passed, 108 total
Time:        8.61 s, estimated 9 s
```

All tests use a real database (`algions_ecommerce_test`, dropped before and after) through the real Express app (Supertest). Nothing is mocked.

### Where each official acceptance test is proven

| Acceptance test | File | Tests that prove it |
|---|---|---|
| AT1 end-to-end order | `tests/orders.test.js` | "full customer journey" (search, cart, checkout, payment, stock, history) |
| AT2 stock re-check, never negative | `tests/orders.test.js`, `tests/admin.test.js` | stale cart refused; all-or-nothing rollback; **8 buyers race for 3 units, exactly 3 orders, stock 0**; **10 simultaneous admin adjustments on stock 4, exactly 4 succeed** |
| AT3 no duplicate orders | `tests/orders.test.js` | sequential retry with same key; **6 simultaneous identical requests, one order, one deduction**; two different keys for one cart, one order |
| AT4 failed payment and cancellation | `tests/orders.test.js`, `tests/payment-race.test.js` | declined card keeps order PLACED/UNPAID then retry pays; double payment does not double charge; cancel unpaid restores stock exactly once under 3 concurrent cancels; cancel paid refunds; a charge that completes after cancellation is reversed and reconciliation still balances |
| AT5 admin protection and reconciliation | `tests/admin.test.js` | 12 admin endpoints x (no token, customer token); forged token; demoted admin; dashboard equals independent recomputation; reconciliation balanced; **reconciliation detects tampering** |

### Mutation check (proving the concurrency test is meaningful)

The atomic stock guard (`stock: { $gte: qty }`) in `inventoryService.reserve` was temporarily removed. The 8-buyer test then failed with `Expected length: 3, Received length: 8` (overselling: 8 orders for 3 units). With the guard restored it passes. This was run once, by hand, during development.

### Negative and edge cases covered

Invalid login (wrong password and unknown email give an identical 401); unauthorised admin access; quantities 0, negative, fractional, 11, string and null; out-of-stock add; unknown product, variant and inactive product; invalid order status transitions (skip, backwards, manual PAID, unknown status); missing or foreign delivery address; missing Idempotency-Key; empty cart; invalid card number/expiry/CVV; declined, insufficient-funds and UPI-fail payments; malformed JSON; unknown routes; regex-injection attempt in search; disabled accounts.

## Frontend: `cd frontend && E2E_API_URL=http://localhost:5055/api npm test`

```
 ✓ src/test/admin-journey.test.jsx (2 tests) 4139ms
   ✓ admin journey through the real UI (2)
     ✓ a customer who opens /admin is turned away (and the API would refuse anyway) 703ms
     ✓ admin logs in, sees KPIs, fulfils an order, creates a product, adjusts stock, reconciliation balances 3432ms
 ✓ src/test/journey.test.jsx (3 tests) 2761ms
   ✓ customer journey through the real UI (3)
     ✓ register → search → add to cart → add address → pay → confirmation 2066ms
     ✓ declined card keeps the order unpaid; retrying with a good card pays it; order history shows it 660ms
 ✓ src/components/RouteGuards.test.jsx (5 tests) 84ms
 ✓ src/utils/format.test.js (4 tests) 18ms
 Test Files  4 passed (4)
      Tests  14 passed (14)
```

The two `journey` files render the real React app in jsdom and drive it with user events (typing, clicking, selecting) against a **running backend and a real, isolated MongoDB database**. They are skipped automatically when `E2E_API_URL` is not set, so `npm test` alone runs only the pure unit tests.

Bugs these tests found in the app and that were fixed (see git history):
1. After a successful checkout the user was sent to "Your cart is empty" instead of the confirmation page (the empty-cart redirect raced the navigation).
2. Add to cart could bounce a logged-in user to the login page if clicked before the saved session finished verifying.

## What was NOT tested here

- **No real browser was available** in the build environment, so layout, responsiveness, colours and the Swagger UI were not visually inspected. jsdom checks behaviour and accessibility roles, not appearance. Please open the app and look at it before submitting.
- No load testing; no deployment to a hosting provider was performed.
