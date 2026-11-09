# Demo Script (3 to 5 minutes) and Video Plan

The assessment requires a 3 to 5 minute walkthrough video. This script targets about 4:30. The video itself has not been recorded; you need to record it.

## Table of contents

| Section | What it covers |
|---|---|
| Before you record | Environment checklist so the take works first time |
| Timed script | What to show and say, minute by minute |
| If something goes wrong | Quick recoveries |
| After recording | Link and permission checks |

## Before you record

1. Fresh data: `cd backend && npm run seed -- --reset`, then `npm run dev`; in another terminal `cd frontend && npm run dev`.
2. Open three browser tabs: the store (`localhost:5173`), Swagger UI (`localhost:5000/api/docs`), and a terminal in `backend/`.
3. Use one browser window; log out of everything. Increase browser zoom to 110 to 125 percent so text is readable on video.
4. Close notifications; hide bookmarks; do not show `.env` contents or any real personal data.
5. Rehearse once. Record with any screen recorder (OBS Studio is free), 1080p, microphone check, upload as unlisted and test the link while logged out.

## Timed script

| Time | Show | Say (in your own words) |
|---|---|---|
| 0:00 to 0:25 | README top and the folder structure in the editor | "This is an e-commerce platform in MERN. React storefront and admin console, Express API in routes, controllers, services and models, MongoDB. The focus is correct stock, payments and order handling." |
| 0:25 to 1:25 | Storefront: search "yoga", filter by category and sort by price, open a product, pick a variant, add to cart, apply `WELCOME10` | "Catalogue has search, filters, sorting and pagination. The cart lives on the server and prices are always recalculated there: subtotal, discount, 18 percent GST, shipping, total." |
| 1:25 to 2:15 | Register a new customer, add an address, pay with `4000 0000 0000 0002` (declined) | "A failed payment leaves the order placed but unpaid, stock held, and I can retry." Click retry with `4242...`, show confirmation and the status timeline |
| 2:15 to 2:50 | Swagger UI: call `POST /orders/checkout` twice with the same `Idempotency-Key` (use a valid token via Authorize and a cart with an item) | "Same key twice returns the same order with `replayed: true`. A unique database index guarantees no duplicate orders even for simultaneous requests." |
| 2:50 to 3:40 | Terminal: `npx jest --runInBand tests/orders.test.js` (or show saved output) and point at the concurrency lines | "Eight buyers race for three units: exactly three orders, stock never negative. Tests run on a real MongoDB." |
| 3:40 to 4:25 | Log in as admin: dashboard, open a PAID order and mark packed, try adjusting stock below zero (refused), open Reports and point at "Everything reconciles" | "Admin routes are protected on the server, not just hidden. Status changes follow a state machine, stock changes are atomic, and the reconciliation report cross-checks orders against payments." |
| 4:25 to 4:50 | Audit log page, then back to README "Known limitations" | "Every material action is audited. Limitations are listed honestly: simulated payments, unpaid orders hold stock until cancelled, and so on." |

## If something goes wrong

- Port in use: stop old servers (`Get-Process node` on Windows, `lsof -i :5000` on macOS or Linux).
- Cannot log in: re-run `npm run seed -- --reset`.
- Declined card did not decline: the number must be exactly `4000 0000 0000 0002`.
- Idempotency demo in Swagger: first log in via `POST /auth/login`, copy the token into "Authorize", add an item through `POST /cart/items`, and reuse an 8+ character key.
- Over time (more than 5 minutes): cut the filter demo and shorten the admin part.

## After recording

Upload as unlisted or public, open the link in a private window to confirm it plays without logging in, and paste it into the submission form. A broken or permission-blocked link may be treated as missing evidence.
