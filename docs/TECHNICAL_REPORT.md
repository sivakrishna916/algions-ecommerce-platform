# Technical Report: Algions Store (E-Commerce Platform)

**Assessment:** ALGIONS AI LABS PRIVATE LIMITED – Full-Stack Web Development  
**Candidate:** Sivakrishna Reddy

## 1. Summary

I built a MERN e-commerce application with a customer storefront and a separate admin console. The API has 43 documented REST operations (Swagger at `/api/docs`). Orders move through Placed, Paid, Packed, Shipped and Delivered, or Cancelled, and the server checks every change of state. Stock, duplicate-order and payment safety depend on atomic MongoDB operations rather than on the client behaving correctly.

All 108 backend tests and 14 frontend tests passed. The results are included in `TEST_EVIDENCE.md`. Load testing and production deployment were not covered.

## 2. Requirements and Acceptance Tests

I implemented the assessment requirements through the customer storefront, backend API and admin console. The five acceptance tests are covered by named automated tests, listed in Section 2 of `TEST_EVIDENCE.md`.

## 3. Architecture

The project uses one repository with two applications. The React frontend communicates with the Express API through JSON requests. During development, Vite proxies `/api` to the backend. In production, the frontend uses `VITE_API_URL`, and the API restricts CORS to the configured `CLIENT_ORIGIN`.

The backend request flow is:

**Route → Controller → Service → Mongoose Model**

Routes handle URLs, Zod validation and role checks. Controllers convert HTTP requests into service calls. Services contain the business rules, keeping the logic easier to test and maintain.

I chose a modular monolith because the application's domain is relatively small, and its main challenges involve data consistency. Keeping the application in one backend with one database makes these operations easier to manage.

### Design Decisions

1. **No multi-document transactions:** Transactions require a MongoDB replica set, which a plain local installation does not provide. I used single-document atomic updates and compensation steps to undo operations when a later step fails. This supports the standalone MongoDB setup used for testing.

2. **Idempotent checkout:** The client sends an `Idempotency-Key`. A unique index on `(user, idempotencyKey)` prevents duplicate orders for the same user and key.

3. **Money as integer paise:** I store monetary values as integer paise to avoid floating-point calculation errors.

4. **Stock reservation at order placement:** Stock is reserved when an order is placed and restored during cancellation, with safeguards against restoring it more than once.

5. **One order state machine:** Each status change uses `findOneAndUpdate` with the expected current status. This prevents multiple admins from successfully making conflicting transitions.

6. **Soft delete for products:** Products are soft-deleted so existing orders retain their history. Orders also store copies of product names, prices and delivery addresses.

7. **JWT authentication:** I use HS256 JWTs with a seven-day expiry and the Bearer authorization header. Tokens are stored in `localStorage`, which is simple but exposes them to XSS risks. An httpOnly cookie would require additional CSRF protection.

8. **bcryptjs:** I use `bcryptjs` instead of `bcrypt` to avoid native build problems on Windows.

## 4. Data Model

The application uses seven MongoDB collections:

- **Users:** User information with embedded delivery addresses.
- **Categories:** Product categories.
- **Products:** Product information with embedded variants containing price and stock.
- **Carts:** One cart per user.
- **Orders:** Embedded copies of ordered items, address, pricing and status history.
- **Payments:** One document for each payment attempt.
- **Audit Logs:** Records of important administrative and system actions.

The entity relationship diagram, embed-or-reference decisions and index list are included in `ER_DIAGRAM.md`.

All order totals are calculated through the pure function `pricingService.computePricing`. The calculation order is subtotal, coupon discount, GST on the discounted amount, shipping charges (free above the configured threshold), and final total.

A unit test covers the pricing calculation. The reconciliation report also checks that:

`total = subtotal - discount + tax + shipping`

for every stored order.

## 5. Main Flows

### Cart

The cart is stored on the server for each user. Whenever the cart is read, prices are recalculated using current product data, and lines affected by stock reductions are flagged. Quantity is checked against available stock and a maximum of 10 per line.

### Checkout (`orderService.checkout`)

1. If an order already exists for the user and idempotency key, return it with `replayed: true`.
2. Check that the delivery address belongs to the user.
3. Acquire a per-cart lock with a 30-second expiry. If another checkout holds the lock, return `409 CHECKOUT_IN_PROGRESS`.
4. Re-read the cart and products, check availability and stock, and calculate prices again.
5. Reserve stock line by line using atomic updates. If one line fails, release the stock already reserved.
6. Create the order. A unique index on `(user, idempotencyKey)` provides an additional duplicate-order safeguard.
7. Release the cart lock in the `finally` block, including on error paths.
8. After successful order creation, clear the cart items and coupon, then record the audit event.
9. Attempt payment.

### Payment (Simulated)

`paymentService.simulateCharge` returns fixed results for the documented test cards. Each attempt is saved as a Payment document, with only the last four card digits retained.

A successful payment moves the order from PLACED to PAID through a conditional update. If the order was cancelled while the charge was running, the update does not match, and the charge is marked refunded.

On payment failure, the order remains PLACED and UNPAID, with its stock reserved. The customer can retry payment or cancel the order.

### Cancellation

Customers can cancel PLACED and PAID orders. Admins can also cancel PACKED orders. The transition to CANCELLED is conditional, so only one of several simultaneous cancellation requests succeeds. Only the successful request restores stock and processes the refund.

### Order State Machine

The allowed transitions are:

- PLACED → PAID or CANCELLED
- PAID → PACKED or CANCELLED
- PACKED → SHIPPED or CANCELLED
- SHIPPED → DELIVERED

DELIVERED and CANCELLED are final states. Admins cannot manually set an order to PAID, ensuring that every PAID order has a corresponding successful payment.

### Admin Stock Management

Stock is changed through `POST /admin/products/:id/stock`, using positive or negative adjustments that cannot reduce stock below zero.

When editing a product, I preserve the stock value read for existing SKUs. However, if an order updates stock between that read and the product save, the newer stock value can be overwritten. This is a known concurrency issue described in Section 11.

## 6. Consistency and Concurrency

| Risk | How it is handled | Test evidence |
|---|---|---|
| Two buyers take the last unit | One `updateOne` with `stock >= qty` in the filter | 8 buyers for 3 units: exactly 3 orders |
| Partial reservation of a multi-item cart | Release the lines already reserved | All-or-nothing test |
| Duplicate order from retry or double-click | Idempotency key, unique index and cart lock | 6 identical simultaneous requests: 1 order |
| Stock restored twice on cancellation | Only the winner of the status change restores stock | 3 simultaneous cancellations: stock restored once |
| Two admins change one order | Update includes the expected current status | 3 simultaneous PACKED requests: 1 succeeds |
| Payment finishes after cancellation | Conditional PLACED-to-PAID update; otherwise refund | `payment-race.test.js` |
| Negative stock from admin adjustment | Guarded `$inc` operation | 10 simultaneous -1 adjustments on stock of 4: 4 succeed |

The tests cover the concurrency scenarios described above. However, they do not eliminate every possible race condition. A second checkout using a different idempotency key at almost exactly the same time may still create a duplicate order, as described in Section 11.

Because I do not use multi-document transactions, a server crash between two steps could leave stock reserved without a corresponding order. A cleanup job would be needed in a production system. The reconciliation report provides an initial way to identify inconsistencies.

## 7. Security

- **Passwords:** I use `bcryptjs` with 10 rounds. Passwords must be 8 to 72 characters and contain a letter and a number. Passwords are never returned by the API. Wrong passwords and unknown email addresses return the same error message.

- **Tokens:** The application uses HS256 JWTs. The server will not start without `JWT_SECRET`. Every request reloads the user, so disabled accounts and role changes take effect immediately.

- **Authorisation:** All `/api/admin/` routes run `authenticate` followed by `requireRole('admin')` on the server. Cart and order routes are customer-only. Frontend route guards are for convenience and are not treated as security controls. A customer requesting another customer's order receives a 404 response. Public registration always creates a customer account.

- **Input validation:** Zod validation is applied to routes, with Mongoose validators as an additional layer. The application also checks ObjectIds, escapes search input and limits JSON request bodies to 100 KB.

- **HTTP security:** The application uses Helmet, restricts CORS to the configured origin, applies a login rate limit of 30 requests per 15 minutes per IP, and disables `x-powered-by`.

- **Secrets:** `.env` is git-ignored. `.env.example` contains placeholders and demo credentials.

- **Card handling:** Card numbers are checked using the Luhn algorithm and used only to determine the simulated payment result. Full card numbers are not stored or logged.

## 8. Reporting and Reconciliation

Revenue is calculated as the sum of `pricing.total` for orders whose `paymentStatus` is PAID. The dashboard, sales report and reconciliation report use the same definition.

The reconciliation report performs seven checks:

1. Paid-order revenue equals successful payment totals.
2. Paid-order and successful-payment counts match.
3. Refunded orders match refunded payments.
4. The daily revenue series adds up to dashboard revenue.
5. No paid order lacks a successful payment.
6. No cancelled order has unrestored stock.
7. Every order total equals the sum of its pricing components.

A test deletes a payment record and confirms that the reconciliation report detects the mismatch.

## 9. Frontend

The frontend uses React. The admin console is a separate lazy-loaded bundle, so customer pages do not need to load it.

Data is fetched through a small `useFetch` hook that ignores stale responses. Global state is limited to Auth, Cart (a copy of the server cart) and Toasts.

The checkout page creates one idempotency key per attempt, reuses it after a network error or 5xx response, and uses a new key after a definite response. A flag also prevents double-clicking the checkout action.

Forms include labels, field-specific error messages and loading, empty and error states. The interface also includes a skip link and visible focus rings.

## 10. Testing

I tested pure logic such as pricing, the order state machine and the payment simulator with unit tests.

The backend integration tests run through the real Express application using Supertest and a real MongoDB database. The frontend includes unit tests and customer/admin journey tests.

The latest test results were:

- Backend: 8 test suites passed, 108 tests passed.
- Frontend unit tests: 9 passed; 5 journey tests were skipped because the backend was not running for that test run.
- Frontend with the E2E backend running: 4 test files passed, 14 tests passed.

The detailed commands, outputs and manual browser observations are in `TEST_EVIDENCE.md`.

## 11. Limitations and Known Issues

The following are limitations or issues identified during development and review:

- Unpaid orders keep their stock reserved until they are cancelled. An expiry job would be a useful next improvement.
- Payments are simulated. There are no real payment gateway webhooks, emails or SMS notifications.
- JWTs are stored in `localStorage`. There are no refresh tokens, and rate limiting currently covers login only.
- Search uses an escaped regular expression. A text index exists but is not currently used.
- Coupons are defined in code rather than stored in the database.
- Product images are generated illustrations rather than product photographs.
- The application has not been deployed to production.
- An admin editing a product at the same time an order is placed can overwrite the order's stock change.
- A second checkout with a different idempotency key sent at almost exactly the same time can create a second order.
- Behind a reverse proxy, `trust proxy` must be configured correctly; otherwise, users may share the same login rate-limit IP.
- Refreshing the `/checkout` page redirects the user to `/cart`.
- In the manual mobile browser check at 390px, the cart page's product prices and Remove controls extended beyond the visible card area. This mobile layout issue remains unresolved.
- The Sign up link was not visible in the mobile header during the manual check.

Load testing, production deployment and a complete manual review of every page were not performed.

## 12. AI Assistance

**Tool used:** Claude (Anthropic).

I used AI assistance while developing the project. For each module, I described the workflow and functionality I wanted. The AI generated code suggestions, which I reviewed, ran and tested before incorporating them into the project.

All third-party libraries and packages used in the project are listed in the respective `package.json` files.