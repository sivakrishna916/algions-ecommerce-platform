# Technical Report: Algions E-Commerce Platform

Assessment: ALGIONS AI LABS PRIVATE LIMITED, Full-Stack Web Development, project "E-Commerce Platform".

## Table of contents

| Section | What it covers |
|---|---|
| 1. Summary | What was built, what was verified, and what was not |
| 2. Scope and requirement coverage | How the assessment scope maps to the implementation (details in REQUIREMENTS.md) |
| 3. Architecture | Layers, request flow, why a modular monolith, folder responsibilities |
| 4. Data model | Collections, relationships, embedding choices, indexes (diagram in ER_DIAGRAM.md) |
| 5. Core business flows | Cart pricing, idempotent checkout, payment, cancellation, order state machine, admin stock changes |
| 6. Consistency and concurrency | Exactly how overselling, duplicate orders and double refunds are prevented, and how that was tested |
| 7. Security | Authentication, authorisation, input handling, secrets, and the remaining weaknesses |
| 8. Reporting and reconciliation | Dashboard definitions and the seven integrity checks |
| 9. Frontend | Structure, state handling, accessibility, customer and admin separation |
| 10. Testing strategy and results | What each layer tests, the mutation check, bugs the tests found |
| 11. Trade-offs and limitations | Deliberate simplifications and what would be done next |
| 12. AI assistance and ownership | How AI help was used and what the candidate must be able to explain |

## 1. Summary

A MERN e-commerce application with a customer storefront and a separate admin console. The backend exposes 43 documented REST operations. Orders move through Placed, Paid, Packed, Shipped and Delivered (or Cancelled) with server-side validation of every transition. Stock, duplicate-order and payment safety rely on atomic MongoDB operations rather than client behaviour.

Verified by running: 108 backend tests (real MongoDB) and 14 frontend tests, including two UI journeys that drive the real React app against the real API (see TEST_EVIDENCE.md). Not verified: appearance in a real browser, deployment to a hosting provider, behaviour under load.

## 2. Scope and requirement coverage

The five official acceptance tests are each covered by named automated tests (TEST_EVIDENCE.md, section "Where each official acceptance test is proven"). The full requirement-by-requirement table with file references is in REQUIREMENTS.md.

## 3. Architecture

Single repository with two applications. The browser talks only to the Express API over JSON. In development Vite proxies `/api` to the backend, so there is no CORS configuration to manage; in production the frontend uses `VITE_API_URL` and the API restricts CORS to `CLIENT_ORIGIN`.

Backend request path: route (URL, validation with zod, role guard) -> controller (translate HTTP to a service call) -> service (all business rules) -> Mongoose model. Controllers contain no rules, which keeps services testable and makes a live code change easy to locate.

A modular monolith was chosen because the domain is small and the hard problems here are consistency problems, which are simpler inside one process and one database than across services.

## 4. Data model

Seven collections: users (with embedded addresses), categories, products (with embedded variants carrying price and stock), carts (one per user), orders (embedded snapshot of items, address and pricing, plus embedded status history), payments (one row per attempt) and audit logs. The reasoning for each embed or reference and the full index list are in ER_DIAGRAM.md.

Money is stored as integer paise everywhere. Totals are computed by one pure function (`pricingService.computePricing`): subtotal, then coupon discount, then GST on the discounted amount, then shipping (free above the threshold), then total. A database-free unit test covers it, and the reconciliation report re-checks `total = subtotal - discount + tax + shipping` for every stored order.

## 5. Core business flows

**Cart.** The cart is stored on the server per user. Every read re-prices from current product data and flags lines whose stock has dropped (`OUT_OF_STOCK`, `INSUFFICIENT_STOCK`, `UNAVAILABLE`). Adding or changing a quantity is validated against stock and a per-line maximum of 10.

**Checkout** (`orderService.checkout`):
1. If an order already exists for this user and `Idempotency-Key`, return it (HTTP 200, `replayed: true`).
2. Validate that the chosen address belongs to the user.
3. Acquire a per-cart lock (an atomic conditional update of `checkoutLockedAt`, expiring after 30 seconds). If it is already held, answer `409 CHECKOUT_IN_PROGRESS`.
4. Re-read the cart, re-resolve every line from the database, refuse unavailable or short lines, recompute pricing.
5. Reserve stock line by line with atomic conditional decrements. If any line fails, release the lines already taken.
6. Insert the order. The unique `(user, idempotencyKey)` index is the final guard; on a duplicate-key error the stock is released and the existing order is returned.
7. Empty the cart (only in the request that created the order); the lock is released in a `finally` block on every path.
8. Attempt payment.

**Payment (simulated).** `paymentService.simulateCharge` is deterministic (documented test cards). Each attempt is recorded as a Payment row; only the last four digits of a card are stored. On success the order moves PLACED to PAID through a conditional update. If the order was cancelled while the charge was in flight, the conditional update matches nothing and the charge is immediately marked refunded (compensation). On failure the order stays PLACED and UNPAID with its stock reserved; the customer can retry payment (`POST /orders/:id/pay`, idempotent once paid) or cancel.

**Cancellation.** Customers may cancel PLACED and PAID orders; admins also PACKED. The status change to CANCELLED is a conditional update, so exactly one of several concurrent cancels wins; only the winner restores stock, marks `stockRestored`, and marks successful payments REFUNDED.

**State machine** (`orderStateMachine.js`): PLACED -> PAID or CANCELLED; PAID -> PACKED or CANCELLED; PACKED -> SHIPPED or CANCELLED; SHIPPED -> DELIVERED; DELIVERED and CANCELLED are final. Admins cannot set PAID manually (only a successful payment can), which keeps payments and orders reconcilable.

**Admin stock.** Stock is changed only through `POST /admin/products/:id/stock` with a delta, using a conditional atomic update that refuses a result below zero. Editing a product never overwrites the stock of existing SKUs, so a stale edit form cannot undo stock movements caused by orders.

## 6. Consistency and concurrency

| Risk | Mechanism | Test |
|---|---|---|
| Two buyers take the last unit | Single conditional `updateOne` (`stock >= qty` in the filter) | 8 concurrent buyers, 3 units: exactly 3 orders |
| Partial reservation on a multi-item cart | Compensating release of lines already reserved | "all-or-nothing" test |
| Duplicate order from retry or double click | Idempotency key + unique index + cart lock | 6 simultaneous identical requests: 1 order; 2 keys, 1 cart: 1 order |
| Stock restored twice on cancel | Only the conditional status-change winner restores | 3 concurrent cancels: 1 succeeds, stock restored once |
| Two admins change the same order | Conditional update on expected current status | 3 concurrent PACKED requests: exactly 1 wins |
| Payment completes after the order was cancelled | Conditional PLACED to PAID; if it matches nothing the charge is reversed and the order marked REFUNDED | `tests/payment-race.test.js` (deterministic: stale order object, cancel, then late charge; also asserts reconciliation stays balanced) |
| Negative stock from admin | Guarded `$inc` | 10 concurrent -1 on stock 4: exactly 4 succeed |

Multi-document transactions were deliberately not used (they require a replica set). Every critical invariant is protected by a single-document atomic operation, with explicit compensation where several documents are involved. The trade-off is that a process crash between two steps could leave stock reserved without an order; the design limits the window, but a production system would add a reconciliation job (the reconciliation report is a first step).

## 7. Security

- **Passwords:** bcrypt (bcryptjs, 10 rounds), 8 to 72 characters with a letter and a number, never returned (`select: false`). Login failures for unknown email and wrong password return the same message, and a dummy hash comparison equalises timing.
- **Tokens:** HS256 JWT, 7-day expiry, secret required from the environment (the server refuses to start without it). Every request reloads the user, so role changes and account disabling take effect immediately (tested).
- **Authorisation:** all `/api/admin/*` routes use `authenticate` then `requireRole('admin')` on the server; cart and order routes are customer-only. The frontend route guards are only a convenience. Customers receive 404 (not 403) for other customers' orders, so ids are not confirmed to exist. Public registration always creates a `customer`.
- **Input:** zod validation on every route with field-level errors; unknown fields are stripped; Mongoose validators as a second layer; ObjectId format checks; search input is regex-escaped; JSON body limit 100 KB.
- **HTTP hardening:** helmet, CORS limited to the configured origin, login rate limit (30 per 15 minutes per IP), `x-powered-by` removed, production error messages hide internals.
- **Secrets:** `.env` is git-ignored; `.env.example` contains only placeholders and dummy demo credentials.
- **Payments:** raw card numbers are validated (Luhn) and used only to choose the simulated outcome; they are neither stored nor logged; responses expose only the last four digits.
- **Remaining weaknesses:** token in `localStorage`; no refresh tokens or revocation list; rate limiting only on login; no CSRF protection needed for Bearer tokens but also no Content-Security-Policy tuned for the SPA; no account lockout or email verification.

## 8. Reporting and reconciliation

"Revenue" is defined once: the sum of `pricing.total` of orders whose `paymentStatus` is PAID. Cancelled or refunded and unpaid orders are excluded. The dashboard, the sales report and the reconciliation report all use this definition.

The reconciliation report runs seven checks: (1) revenue of paid orders equals the sum of successful payments; (2) counts match; (3) refunded orders equal refunded payments; (4) the daily sales series sums to the dashboard revenue; (5) no paid order lacks a successful payment; (6) no cancelled order has unrestored stock; (7) every order total equals its components. `balanced` is true only if all pass. The test suite deletes a payment record directly in the database and confirms the report turns red.

## 9. Frontend

React with route-level code splitting: the admin console is a separate lazy-loaded bundle that customers never download. Server state is fetched with a small `useFetch` hook that ignores stale responses; the only global state is Auth, Cart (a mirror of the server cart) and Toasts (an `aria-live` region). The checkout page generates one idempotency key per attempt, reuses it only after a network error or 5xx (so the server can recognise the retry), and creates a new one after any definitive answer; a synchronous guard blocks double clicks.

Accessibility measures: labelled form fields wired with `aria-describedby` errors, a skip link, visible focus rings, `aria-current` on pagination and progress steps, `role="alert"` on errors, modal focus handling and Escape to close, reduced-motion support, text alternatives for charts (a visually hidden table). Loading, empty, error and success states exist on every data screen. These were checked through Testing Library role queries, not with a screen reader or an automated audit tool.

## 10. Testing strategy and results

Pure logic (pricing, state machine, payment simulator) is unit tested without a database. Everything else is tested through the real Express app against a real MongoDB with no mocks, because the important behaviours (unique indexes, atomic updates, concurrency) only exist in the real database. Results: 108 of 108 backend and 14 of 14 frontend tests pass (TEST_EVIDENCE.md). A mutation check showed the oversell test fails (8 orders for 3 units) when the atomic stock guard is removed. The UI journey tests found two real defects that were then fixed (redirect to an empty cart after a successful order; add-to-cart during session restore). Writing the payment-race test found a third (an order stayed UNPAID although its late payment had been refunded, which reconciliation would have flagged); it was fixed on its own branch.

## 11. Trade-offs and limitations

See the "Known limitations" list in the README. The most important: unpaid orders hold stock until someone cancels them (a scheduled expiry job is the obvious next step); payments are simulated; the UI was not inspected in a real browser by the build tooling; nothing was deployed.
