# Requirement Checklist (Official Assessment to Implementation)

Source of truth: ALGIONS AI LABS Internship Project Assessment, E-Commerce Platform. Status values: DONE (implemented and exercised by a named test), PARTIAL (works with a stated gap), NOT DONE (needs your action). Test files are in `backend/tests` and `frontend/src/test`.

## Table of contents

| Section | What it covers |
|---|---|
| A. Scope | The eight functional scope items |
| B. Technical expectations | The nine technical requirements |
| C. Acceptance tests | The five mandatory acceptance tests and their proof |
| D. Submission package | What must be delivered and what is still left for you |
| E. Master-prompt extras | Items from the project brief that go beyond the assessment text |

## A. Scope (Section 1)

| # | Requirement | Implementation | Evidence | Status |
|---|---|---|---|---|
| 1.1 | Registration and login | `routes/auth.js`, `services/authService.js` | `auth.test.js`, `journey.test.jsx` | DONE |
| 1.2 | Profile and address book | `services/profileService.js`, `pages/Profile.jsx` | `auth.test.js` (address tests) | DONE |
| 1.3 | Categories, searchable catalogue, detail pages | `services/productService.js`, `pages/Catalog.jsx`, `ProductDetail.jsx` | `catalog.test.js` | DONE |
| 1.4 | Search, filters, sorting, pagination, variants | same, plus `Product.variants` | `catalog.test.js` | DONE |
| 1.5 | Persistent cart, quantity and stock validation, totals | `services/cartService.js`, `pricingService.js` | `cart.test.js`, `unit.test.js` | DONE |
| 1.6 | Checkout, simulated payment, duplicate prevention | `orderService.checkout`, `paymentService.js` | `orders.test.js` | DONE |
| 1.7 | Safe inventory and lifecycle (placed, paid, packed, shipped, delivered, cancelled) | `inventoryService.js`, `orderStateMachine.js` | `orders.test.js`, `admin.test.js` | DONE |
| 1.8 | Admin: products, categories, inventory, orders, customers, summaries, audit trail | `routes/admin.js` and `pages/admin/*` | `admin.test.js`, `admin-journey.test.jsx` | DONE |

## B. Technical expectations (Section 2)

| # | Requirement | Implementation | Evidence | Status |
|---|---|---|---|---|
| 2.1 | Separation of UI, business logic, persistence | routes, controllers, services, models; React pages/components/api | structure; README | DONE |
| 2.2 | Server-side role-based access control | `middleware/auth.js`, `routes/admin.js` | `admin.test.js` (12 endpoints x 2 negative cases, forged token, demoted admin) | DONE |
| 2.3 | Schema with relationships, validation, indexes; repeatable seed; diagram | `models/*`, `scripts/seed.js`, `docs/ER_DIAGRAM.md` | seed run twice (idempotent); model tests via API | DONE (no migration tool; indexes are created by Mongoose) |
| 2.4 | Consistent APIs, validation, predictable errors | zod, `middleware/error.js`, OpenAPI | `docs.test.js`, validation tests throughout | DONE |
| 2.5 | Protection from stale stock, duplicates, invalid transitions | atomic conditional updates, unique index, state machine | `orders.test.js`, `admin.test.js`, `payment-race.test.js` | DONE |
| 2.6 | Search/filter/pagination UX, accessible forms, loading/empty/success/error states | `components/ui.jsx`, `forms.jsx`, pages | journey tests (role-based queries) | PARTIAL: not inspected in a real browser or with an accessibility audit tool |
| 2.7 | Dashboard or report plus audit trail | `reportService.js`, `AuditLog` | `admin.test.js` | DONE |
| 2.8 | Unit and integration tests including negative and conflict cases | 108 backend + 14 frontend | `docs/TEST_EVIDENCE.md` | DONE |
| 2.9 | Reproducible local setup, no paid services | README, `.env.example`, seed | README quick start was followed to run the tests; not re-verified on a second machine | DONE (verify once on your machine) |

## C. Acceptance tests (Section 3)

| # | Acceptance test | Proof | Status |
|---|---|---|---|
| AT1 | Find a product, add to cart, place an order end-to-end | `orders.test.js` "full customer journey"; `journey.test.jsx` through the real UI | DONE |
| AT2 | Stock re-checked at checkout and never negative | stale-cart refusal; all-or-nothing rollback; 8 buyers for 3 units; 10 concurrent admin decrements | DONE |
| AT3 | Repeated checkout requests create no duplicate orders | sequential replay; 6 simultaneous identical requests; 2 keys for one cart | DONE |
| AT4 | Failed payment and cancellation handled | declined card then retry; concurrent cancels restore stock once; cancel of paid order refunds; late payment after cancel reversed | DONE |
| AT5 | Admin updates protected; reports reconcile with orders | RBAC tests; dashboard equals independent recomputation; reconciliation balanced and detects tampering | DONE |

## D. Submission package (Section 4 and 5)

| Item | Status |
|---|---|
| Source repository (frontend, backend, schema, seed) | DONE: GitHub repository created and `main` branch pushed: https://github.com/sivakrishna916/algions-ecommerce-platform |
| README with architecture, setup, env vars, credentials, DB setup, test commands, limitations | DONE |
| Architecture and schema diagram | DONE (`docs/ER_DIAGRAM.md`, Mermaid; renders on GitHub) |
| API documentation | DONE (Swagger UI `/api/docs`, `/api/docs.json`) |
| Test evidence | DONE (`docs/TEST_EVIDENCE.md`) |
| Technical report | DONE (`docs/TECHNICAL_REPORT.md`) |
| Demo credentials (dummy) | DONE (README) |
| Live demo URL | NOT DONE: nothing was deployed. Deployment steps are in the README, otherwise declare "local-only demo" in the form |
| 3 to 5 minute video | NOT DONE: script in `docs/DEMO_SCRIPT.md`; you must record it |
| Form: name, registration number, university email, AI and attribution, declarations | NOT DONE: yours to fill in, honestly |
| Reviewer access and working links | NOT DONE: verify repository access for the reviewer and check all submitted links before submission |

## E. Master-prompt extras

| Item | Status |
|---|---|
| Jest/Vitest and Supertest tests | DONE |
| Product images | DONE: locally generated SVG illustrations (not photographs) |
| Recharts dashboard | DONE |
| Free deployment | NOT DONE (instructions only) |
| Interview preparation and demo script | DONE |
| Git workflow: feature branches, conventional commits, merges | DONE locally (see `docs/SUBMISSION.md`) |
