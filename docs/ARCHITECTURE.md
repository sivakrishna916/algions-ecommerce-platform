# Architecture & Decision Record

Modular monolith: `frontend/` (React SPA) → REST/JSON → `backend/` (Express) → MongoDB.

Backend layering: `routes` (HTTP wiring + validation) → `controllers` (thin) → `services` (business rules) → `models` (Mongoose).

## ADRs
1. **No multi-document transactions.** They need a replica set, which a plain local `mongod` does not provide. Correctness comes from *single-document atomic conditional updates* (`$inc` guarded by `stock >= qty`) plus compensating rollback. Works on standalone, Docker and Atlas free tier.
2. **Idempotent checkout.** Client sends `Idempotency-Key`. A *unique* index on `(user, idempotencyKey)` makes the database the arbiter, so two simultaneous retries cannot both create an order.
3. **Money as integer paise.** Avoids floating point errors.
4. **Stock is reserved when the order is placed** and restored on cancellation (guarded so it is restored exactly once).
5. **Order state machine** in one place; every transition uses `findOneAndUpdate({_id, status: from})` so concurrent admins cannot both win.
6. **Soft delete for products** to keep order history intact (orders also snapshot name/price/address).
7. **JWT (HS256), 7-day expiry, Bearer header.** Trade-off: stored in `localStorage` (simple, XSS-exposed) instead of httpOnly cookie (needs CSRF handling). Documented as a limitation.
8. **`bcryptjs`** (pure JS bcrypt implementation) to avoid native build failures on Windows.
