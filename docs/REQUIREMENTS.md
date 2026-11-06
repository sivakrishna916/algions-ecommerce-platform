# Requirement Checklist (Official Assessment → Implementation)

Source of truth: *ALGIONS AI LABS – Internship Project Assessment, E-Commerce Platform*.
Status values are updated as work lands: `TODO` → `DONE (tests: …)`. Nothing is marked DONE until it ran.

## A. Scope (Section 1)
| # | Requirement | Where it is implemented | Status |
|---|---|---|---|
| 1.1 | Registration / login | `routes/auth`, `services/authService` | TODO |
| 1.2 | Customer profile + address book | `routes/me`, `User.addresses` | TODO |
| 1.3 | Categories, searchable catalogue, detail page | `routes/catalog`, `Product`, `Category` | TODO |
| 1.4 | Search, filters, sorting, pagination, variants | `productService.list`, `Product.variants` | TODO |
| 1.5 | Persistent cart, qty/stock validation, subtotal/discount/tax/shipping/total | `Cart`, `pricingService` | TODO |
| 1.6 | Checkout: address, order, simulated payment, no duplicates on retry | `orderService.checkout`, `paymentService`, idempotency key | TODO |
| 1.7 | Inventory safe updates + lifecycle (placed→paid→packed→shipped→delivered, cancelled) | `inventoryService`, `orderStateMachine` | TODO |
| 1.8 | Admin: products, categories, inventory, orders, customers, summaries, audit trail | `routes/admin/*`, `AuditLog` | TODO |

## B. Technical expectations (Section 2)
| # | Requirement | Where | Status |
|---|---|---|---|
| 2.1 | Separation of UI / business logic / persistence | routes → controllers → services → models | TODO |
| 2.2 | Server-side RBAC | `middleware/auth.js` (`requireRole`) | TODO |
| 2.3 | Schema with relationships, validation, indexes, repeatable seed, ER diagram | `models/`, `scripts/seed.js`, `docs/ER_DIAGRAM.md` | TODO |
| 2.4 | Consistent APIs, validation, predictable errors | `zod` validators, `middleware/error.js` | TODO |
| 2.5 | Protection from stale stock, duplicates, invalid transitions | atomic conditional updates, unique idempotency index, state machine | TODO |
| 2.6 | Search/filter/pagination, accessible forms, loading/empty/success/error states | frontend | TODO |
| 2.7 | Dashboard/report + audit trail | `reportService`, `AuditLog` | TODO |
| 2.8 | Unit + integration/API tests incl. negative/conflict cases | `backend/tests` | TODO |
| 2.9 | Reproducible local setup, no paid services | README | TODO |

## C. Acceptance tests (Section 3)
| # | Test | Automated test file | Status |
|---|---|---|---|
| AT1 | Find product → cart → place order end-to-end | `tests/acceptance.test.js` | TODO |
| AT2 | Stock re-checked at checkout, never negative (incl. concurrent) | `tests/acceptance.test.js` | TODO |
| AT3 | Repeated checkout requests ⇒ one order | `tests/acceptance.test.js` | TODO |
| AT4 | Failed payment + cancellation handled | `tests/acceptance.test.js` | TODO |
| AT5 | Admin protected; reports reconcile with orders | `tests/acceptance.test.js` | TODO |

## D. Submission package (Section 4)
Repo ✔ in progress · README · ER diagram · OpenAPI docs · tests + evidence · demo URL or local steps · walkthrough video plan · technical report.
