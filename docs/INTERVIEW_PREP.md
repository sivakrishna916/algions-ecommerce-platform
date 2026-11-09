# Interview Preparation

The assessment includes a 15-minute technical walkthrough and a 10-minute live change/debugging task. Reviewers are told that code you cannot explain will not count. Read the files below yourself, run the tests, and break things on purpose until the answers feel like yours.

## Table of contents

| Section | What it covers |
|---|---|
| 1. Read these files first | The ten files that contain most of the interesting logic, in reading order |
| 2. The 60-second architecture pitch | A short spoken summary to start the walkthrough |
| 3. Twenty-five likely questions | Questions with answers that match the actual implementation |
| 4. Live-change cheat sheet | Where to edit for common change requests, including traps |
| 5. Debugging approach | How to locate a failing behaviour quickly |
| 6. Things to try before the interview | Hands-on experiments that build real understanding |

## 1. Read these files first

1. `backend/src/services/orderService.js`: checkout, payment, cancel, admin status change
2. `backend/src/services/inventoryService.js`: the atomic stock operations
3. `backend/src/services/orderStateMachine.js`: the lifecycle rules
4. `backend/src/models/Order.js` and `Product.js`: schema and indexes
5. `backend/src/services/pricingService.js` and `cartService.js`: money and cart
6. `backend/src/middleware/auth.js`: JWT and role check
7. `backend/src/services/reportService.js`: dashboard and reconciliation
8. `backend/tests/orders.test.js`: the concurrency tests (read how they fire parallel requests)
9. `frontend/src/pages/Checkout.jsx`: idempotency key handling and the `placed` guard
10. `frontend/src/api/client.js` and `context/`: token handling and state

## 2. The 60-second architecture pitch

"It is a MERN modular monolith. The React app talks to an Express REST API; the API is layered as routes, thin controllers, services that hold every business rule, and Mongoose models. The hard part of e-commerce is consistency, so I solved that in the database: stock is decremented with one conditional atomic update so it can never go negative, checkout is idempotent through an `Idempotency-Key` plus a unique index, and order status changes are conditional updates guarded by a state machine. Roles are enforced on the server for every admin route. I proved the five acceptance tests with automated tests against a real MongoDB, including concurrent requests, and there is a reconciliation report that cross-checks orders against payments."

## 3. Twenty-five likely questions

**1. Why this architecture?**
A modular monolith: one deployable, clear layers (route, controller, service, model). The domain is small and the hard problems are consistency problems, which are easier in one process and one database. Controllers have no rules, so rules live in services and are testable.

**2. Why MongoDB, and how did you decide what to embed?**
Documents fit the data: variants and addresses are always read with their parent. Variants are embedded in Product so price and stock change atomically with the product. Orders embed a snapshot of items, address and prices so history never changes when the catalogue does. Things that grow without bound or are queried alone (payments, audit logs) are separate collections. See `docs/ER_DIAGRAM.md`.

**3. How do you prevent overselling?**
`inventoryService.reserve` runs one `updateOne` whose filter includes `variants: { $elemMatch: { sku, stock: { $gte: qty } } }` and whose update is `$inc: -qty`. Check and decrement are one atomic operation, so two buyers cannot both succeed for the last unit. If the update matches nothing, the reservation failed. The test with 8 buyers for 3 units proves exactly 3 orders; removing the `$gte` makes it create 8.

**4. Why not MongoDB transactions?**
Transactions need a replica set, and a plain local `mongod` or a simple setup does not have one. Single-document atomic updates plus explicit compensation (release reserved lines if a later line fails) give the same guarantees for these cases and work everywhere. The trade-off: a crash between steps could leave stock reserved without an order, which a production system would reconcile with a job.

**5. How does duplicate-order prevention work?**
Three layers. (a) The client sends `Idempotency-Key`; if an order with that key exists for the user, it is returned. (b) A per-cart lock (`checkoutLockedAt`, set by an atomic conditional update, 30-second expiry) stops two checkouts of one cart running simultaneously. (c) A unique index on `(user, idempotencyKey)` is the final guarantee: if two requests slip through, the second insert fails and the code releases its stock and returns the first order.

**6. What does the client do with the idempotency key?**
`Checkout.jsx` creates one key per attempt. After a network error or 5xx it reuses the same key so the server can recognise the retry. After any definitive answer (success or a 4xx) it generates a new key. A `useRef` flag blocks double clicks synchronously.

**7. What happens when two identical requests arrive at the same instant?**
One wins the cart lock and creates the order (201). The other either sees the finished order (200, `replayed: true`) or gets `409 CHECKOUT_IN_PROGRESS`; a retry then returns the original order. Never two orders. (Limitation: I chose not to make the second request wait.)

**8. What happens when payment fails?**
The order is created and stock stays reserved, but the order remains PLACED and UNPAID; a FAILED Payment row records the reason. The customer can retry payment on the order page (`POST /orders/:id/pay`) or cancel, which restores stock. Paying an already-paid order returns the existing result and does not charge again.

**9. How is the payment gateway simulated, and is it safe?**
`paymentService.simulateCharge` is deterministic: documented test cards succeed or fail with specific codes. Card numbers are Luhn-validated, never stored or logged; only the last four digits are kept. It is explicitly not a real gateway.

**10. How do you make sure stock is restored exactly once on cancel?**
Cancellation first does a conditional update `{ _id, status in cancellable }` to CANCELLED. Only the request that wins that update continues to restore stock and refund; the others get a 409. A test fires three concurrent cancels and checks stock is restored once.

**11. What if a payment completes after the order was cancelled?**
The PLACED to PAID update is conditional; it matches nothing, so the code marks that payment REFUNDED, marks the order REFUNDED and throws `ORDER_NOT_PAYABLE`. `tests/payment-race.test.js` covers it, and writing it exposed a bug where the order stayed UNPAID while its payment was refunded.

**12. Explain the order state machine.**
PLACED to PAID or CANCELLED; PAID to PACKED or CANCELLED; PACKED to SHIPPED or CANCELLED; SHIPPED to DELIVERED; DELIVERED and CANCELLED are final. It is defined once in `orderStateMachine.js`. Customers can cancel PLACED and PAID; admins also PACKED. Admins cannot set PAID manually, so every PAID order has a real payment behind it.

**13. Why are status changes `findOneAndUpdate` with the old status in the filter?**
So concurrent changes cannot both win. If two admins press "packed" together, one update matches and the other matches nothing and returns 409. This is optimistic concurrency without a version field.

**14. How is pricing calculated and why paise?**
`computePricing` is a pure function: subtotal, then coupon discount, then 18% GST on the discounted amount, then shipping (free at or above the threshold), then total. Everything is integer paise to avoid floating-point errors. The client never sends prices; the server re-reads them from the database in the cart view and again at checkout.

**15. How does authentication work?**
Register or login returns a JWT (HS256, 7 days, payload has user id and role). The client sends it as a Bearer header. The `authenticate` middleware verifies it and then loads the user from the database, so a disabled user or a changed role takes effect immediately even with an old token (tested). Passwords are bcrypt hashed with 10 rounds.

**16. Where and how is authorisation enforced?**
On the server: `routes/admin.js` starts with `router.use(authenticate, requireRole('admin'))`, so no admin handler can run without it. Cart and order routes require the customer role. Frontend guards are only for user experience. Tests hit 12 admin endpoints with no token and with a customer token and expect 401 and 403.

**17. Why does a customer get 404, not 403, for someone else's order?**
So the API does not confirm that an order id exists. `findOwned` queries by both `_id` and `user`.

**18. How does the admin product edit avoid overwriting stock?**
`updateProduct` keeps the stored stock for existing SKUs and ignores the stock value in the request; stock only changes via the delta endpoint with a non-negative guard. Otherwise an admin editing a form for a minute could erase stock movements caused by orders meanwhile.

**19. What does the reconciliation report check?**
Seven things: revenue equals successful payments; counts match; refunded orders equal refunded payments; the daily series equals the dashboard revenue; no paid order lacks a payment; no cancelled order with unrestored stock; every order total equals its parts. A test deletes a payment record and confirms the report fails.

**20. How is the audit log designed?**
`auditService.record(actor, action, entityType, entityId, summary, meta)` is called from services for material actions. There is no write or delete API for logs. A failure to write a log is swallowed, so logging can never break a purchase (the trade-off is a possible missing entry).

**21. How are errors handled?**
Services throw `AppError(status, code, message, details)`. One error middleware converts it, plus Mongoose validation errors, cast errors and duplicate-key errors, into `{ success: false, error: { code, message, details } }`. Clients switch on the stable `code`, not the message.

**22. What validation do you do and where?**
zod schemas at the route edge (types, ranges, formats; unknown fields are stripped) and Mongoose schema validators as a second layer. Business validation (stock, ownership, state) is in services.

**23. List the security measures and the weaknesses.**
Measures: bcrypt, JWT secret required, server-side RBAC, validation, regex-escaped search, helmet, restricted CORS, login rate limit, no secrets in git, card data never stored. Weaknesses: token in `localStorage`, no refresh or revocation, rate limit only on login, no email verification, no CSP tuned for the SPA.

**24. What is your testing strategy?**
Pure logic is unit tested (pricing, state machine, payment simulator). Everything else runs through the real Express app on a real MongoDB with no mocks, since unique indexes and atomic updates only exist in the database. Concurrency tests fire parallel requests. I verified the main oversell test is meaningful by removing the guard and watching it fail. Frontend journeys drive the real React app against the real API.

**25. What would you improve next, and what is incomplete?**
Expire unpaid orders and release their stock; use text search or Atlas Search; refresh tokens and httpOnly cookies; rate limit more endpoints; coupons in the database; real payment webhooks; email notifications; a reconciliation job that repairs stock; load testing; a visual and accessibility audit in real browsers and deployment (not done).

## 4. Live-change cheat sheet

| Request | Where to change | Watch out for |
|---|---|---|
| Change GST rate | `TAX_RATE_PERCENT` in `backend/.env` | The label "GST (18%)" in `frontend/src/pages/Cart.jsx` and text in `ProductDetail.jsx` are hard-coded |
| Change shipping fee or free threshold | `SHIPPING_FLAT_PAISE`, `FREE_SHIPPING_THRESHOLD_PAISE` | Banner text on `Home.jsx` says Rs 999 |
| Add a coupon | `backend/src/config/coupons.js` | Add a unit test in `tests/unit.test.js` |
| Change low-stock threshold | `LOW_STOCK_THRESHOLD` | Dashboard and admin filter both use it |
| Change max quantity per line | `config/env.js` (`maxQtyPerLine`), `validators/shop.js` (`.max(10)`), `models/Cart.js` (`max: 10`) | Three places; frontend caps at `Math.min(10, stock)` in `Cart.jsx` and `ProductDetail.jsx` |
| Add a sort option | `productService.js` (`SORTS`), `validators/catalog.js` (enum), `Catalog.jsx` (`SORTS`) | Add a test in `catalog.test.js` |
| Let customers cancel PACKED orders | `CANCELLABLE_BY.customer` in `orderStateMachine.js` | Update the test "customer cannot cancel once packed" and the UI hint in `OrderDetail.jsx` |
| Add a new order status | `ORDER_STATUSES` in `models/Order.js`, `TRANSITIONS`, enums in `validators/admin.js` and `shop.js`, `STATUS_STYLES` and `FLOW` in `frontend/src/utils/format.js`, `OrderTimeline` | Reports group by status; reconciliation assumes PAID definition |
| Add a field to Product | `models/Product.js`, `validators/admin.js` (`productBase`), `ProductForm` in `pages/admin/Products.jsx` | Update seed data if required |
| New simulated card outcome | `FAIL_CARDS` in `paymentService.js` | Add to `TEST_CARDS` in `components/forms.jsx` and the README table |
| Log a new action | Call `audit.record(...)` in the relevant service | Add the prefix to `GROUPS` in `AuditLogs.jsx` to filter it |
| Make search also match SKU | `productService.list` (`filter.$or`) | Admin search already includes SKU |
| Change JWT lifetime | `JWT_EXPIRES_IN` | Existing tokens keep their old expiry |

## 5. Debugging approach

1. Read the `error.code` in the response; search for it with `grep -rn "CODE_NAME" backend/src`.
2. Reproduce with a test: copy the closest test in `backend/tests` and shrink it.
3. For stock or order mismatches, call `GET /api/admin/reports/reconciliation` first; the failing check names the invariant that broke.
4. For per-order history, open the order in the admin console: it shows status history, payments and its audit entries.
5. Run one suite: `npx jest --runInBand tests/orders.test.js -t "name of test"`.

## 6. Things to try before the interview

- Remove `stock: { $gte: qty }` in `inventoryService.reserve`, run the orders suite, and read the failure. Restore it.
- Remove the unique `(user, idempotencyKey)` index and the cart lock and run the 6-simultaneous-requests test.
- Add a coupon and a new sort option yourself, with tests, without looking at the cheat sheet.
- Use Swagger UI at `/api/docs` to send checkout twice with the same `Idempotency-Key` and compare the responses.
- Trace one order through the admin audit log and the Payment collection in MongoDB Compass or `mongosh`.
