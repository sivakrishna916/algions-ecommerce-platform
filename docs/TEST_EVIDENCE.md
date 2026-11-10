# Test Evidence

**Project:** Algions Store (E-Commerce Platform)  
**Commit tested:** `6438034`  
**Environment:** Node.js `v22.23.4`, Mongosh `2.14.1` (standalone MongoDB, no replica set), Jest 30 + Supertest, Vitest 5 + Testing Library.

## 1. Backend Tests

**Command:** `cd backend && npm test`

**Actual output:**

```text
PASS tests/admin.test.js
PASS tests/orders.test.js (5.326 s)
PASS tests/docs.test.js
PASS tests/cart.test.js
PASS tests/payment-race.test.js
PASS tests/auth.test.js
PASS tests/catalog.test.js
PASS tests/unit.test.js

Test Suites: 8 passed, 8 total
Tests:       108 passed, 108 total
Snapshots:   0 total
Time:        15.497 s, estimated 18 s
Ran all test suites.
```

The tests use a separate database (`algions_ecommerce_test`), which is dropped before and after the test run. They call the Express application through Supertest and use a real MongoDB instance. The tests are not mocked, allowing database features such as unique indexes and atomic updates to be tested.

Jest printed a warning about open asynchronous handles after the tests completed. All 108 tests passed successfully.

## 2. Where Each Acceptance Test Is Proven

| Acceptance test | Test file(s) | What the tests check |
|---|---|---|
| AT1: Place an order end to end | `orders.test.js` | Search, add to cart, checkout, payment, stock change and order history |
| AT2: Stock re-checked, never negative | `orders.test.js`, `admin.test.js` | Stale cart is refused; multi-item order is all-or-nothing; 8 buyers for 3 units give exactly 3 orders; 10 simultaneous stock reductions on stock of 4 give exactly 4 successes |
| AT3: No duplicate orders | `orders.test.js` | Same key sent twice returns the same order; 6 simultaneous identical requests give 1 order; two different keys for one cart give 1 order |
| AT4: Failed payment and cancellation | `orders.test.js`, `payment-race.test.js` | Declined card leaves order Placed/Unpaid and retry pays it; paying twice charges once; 3 simultaneous cancellations restore stock once; cancelling a paid order refunds it; payment finishing after cancellation is reversed |
| AT5: Admin protection and reports | `admin.test.js` | 12 admin endpoints return 401 without a token and 403 for a customer; forged token rejected; demoted admin loses access immediately; dashboard totals match an independent calculation; reconciliation balances and turns red when a payment record is deleted |

## 3. Concurrency Test Verification

The stock guard (`stock: { $gte: qty }`) in `inventoryService.reserve` prevents orders from reserving more stock than is available.

If this guard is removed, the 8-buyer concurrency test fails with:

```text
Expected length: 3, Received length: 8
```

This demonstrates that the test checks whether concurrent orders can exceed available stock. With the guard in place, the test passes.

## 4. Negative Cases Covered

The backend tests also cover:

- Wrong password and unknown email returning the same 401 message.
- Admin routes accessed without permission.
- Invalid quantities: `0`, `-1`, `1.5`, `11`, a string and `null`.
- Out-of-stock products.
- Unknown, inactive or missing products and variants.
- Invalid order status changes, including skipping a step, going backwards, manually setting PAID and using an unknown status.
- Missing delivery address or another user's address.
- Missing `Idempotency-Key`.
- Empty cart.
- Invalid card number, expiry and CVV.
- Declined, insufficient-funds and UPI-fail payments.
- Malformed JSON and unknown routes.
- Regex characters in search.
- Disabled accounts.

## 5. Frontend Tests

**Command:** `cd frontend && npm.cmd test`

The frontend has 9 unit tests. The 5 journey tests are skipped when the backend is not running with the E2E configuration.

**Unit test result:**

```text
RUN  v5.1.0

✓ src/utils/format.test.js (4 tests)
✓ src/components/RouteGuards.test.jsx (5 tests)
↓ src/test/admin-journey.test.jsx (2 tests | 2 skipped)
↓ src/test/journey.test.jsx (3 tests | 3 skipped)

Test Files  2 passed | 2 skipped (4)
Tests       9 passed | 5 skipped (14)
Duration    2.75s
```

### End-to-end test setup

The journey tests were run with a separate E2E database and a running backend.

**Seed the database:**

```powershell
cd backend
$env:MONGO_URI="mongodb://127.0.0.1:27017/algions_e2e"
node src/scripts/seed.js --reset
```

The seed operation completed successfully with 5 categories, 24 products, 4 users and 16 orders.

**Start the backend:**

```powershell
$env:PORT="5055"
node src/server.js
```

The API started at `http://localhost:5055`.

**Run the frontend E2E tests in a second terminal:**

```powershell
cd frontend
$env:E2E_API_URL="http://localhost:5055/api"
npm.cmd test
```

**Actual E2E test output:**

```text
RUN  v5.1.0

✓ src/utils/format.test.js (4 tests)
✓ src/components/RouteGuards.test.jsx (5 tests)
✓ src/test/journey.test.jsx (3 tests)
✓ src/test/admin-journey.test.jsx (2 tests)

Test Files  4 passed (4)
Tests       14 passed (14)
Duration    5.51s
```

All 14 frontend tests passed, including the customer and admin journey tests.

The journey tests render the React application in jsdom and interact with it like a user. They cover:

- Customer registration, product search, adding items to cart, adding an address, payment and order confirmation.
- Declined card payment, retrying with a valid card and checking order history.
- Admin access protection, dashboard KPIs, order fulfilment, product creation, stock adjustment and reconciliation.

The admin journey tests printed Recharts warnings about zero-width and zero-height chart containers in the test environment. These warnings did not cause test failures.

## 6. Manual Browser Verification

I opened the application in Chrome and checked the storefront at desktop and responsive mobile widths.

**Desktop homepage:**
- Header, search bar, hero section and action buttons displayed correctly.
- Category section started below the hero section.
- No obvious horizontal overflow or overlapping elements were visible.

**Mobile homepage (390px):**
- Navigation and search bar adapted to separate rows.
- Hero heading and promotional text wrapped correctly.
- Action buttons remained visible.
- No obvious horizontal overflow or overlapping elements were observed.
- Sign up link was not visible in the mobile header.

**Mobile category section (390px):**
- All five category cards displayed in a two-column grid.
- Icons, category names and product counts were readable.
- Spacing between cards appeared consistent.

**Mobile product listing (390px):**
- Product cards displayed in a two-column grid.
- Product images, discount labels, names and prices were visible.
- No obvious horizontal overflow was observed in the screenshots.

**Mobile product details (390px):**
- Product image, title, price and description adapted to the mobile viewport.
- No obvious clipping or horizontal overflow was observed in the visible section.

**Mobile cart (390px):**
- Cart items, quantity controls and order summary were visible.
- Product prices and Remove controls extended beyond the visible card area.
- This is a mobile layout issue that remains to be addressed.

The checkout page and admin dashboard were covered by automated journey tests, but were not separately recorded as manual browser checks.

## 7. Problems Found and Fixed During Development

The following problems were found during development and fixed:

1. After successful checkout, the user was redirected to "Your cart is empty" instead of the order page.
2. Add to cart could send a logged-in user to the login page if clicked before the saved session finished loading.

