# Database Design (MongoDB / Mongoose)

## Entity-relationship diagram

```mermaid
erDiagram
    USER ||--o{ ORDER : places
    USER ||--o| CART : owns
    USER ||--o{ AUDIT_LOG : performs
    USER ||--o{ PAYMENT : makes
    USER ||--o{ ADDRESS : "embeds (address book)"
    CATEGORY ||--o{ PRODUCT : groups
    PRODUCT ||--o{ VARIANT : "embeds (price + stock)"
    CART ||--o{ CART_ITEM : "embeds"
    CART_ITEM }o--|| PRODUCT : "refers to (product + sku)"
    ORDER ||--o{ ORDER_ITEM : "embeds (snapshot)"
    ORDER_ITEM }o--|| PRODUCT : "refers to (history only)"
    ORDER ||--o{ PAYMENT : "paid by (one row per attempt)"
    ORDER ||--o{ STATUS_HISTORY : "embeds"

    USER { ObjectId _id string name string email UK string passwordHash string role bool isActive }
    ADDRESS { ObjectId _id string fullName string phone string line1 string city string state string postalCode bool isDefault }
    CATEGORY { ObjectId _id string name UK string slug UK bool isActive }
    PRODUCT { ObjectId _id string name string slug UK ObjectId category int minPrice int soldCount bool isActive }
    VARIANT { string sku UK_global string label int price_paise int mrp_paise int stock }
    CART { ObjectId _id ObjectId user UK string couponCode date checkoutLockedAt }
    CART_ITEM { ObjectId product string sku int quantity }
    ORDER { ObjectId _id string orderNumber UK ObjectId user string idempotencyKey string status string paymentStatus object shippingAddress object pricing bool stockRestored }
    ORDER_ITEM { ObjectId product string sku string name int unitPrice int quantity int lineTotal }
    PAYMENT { ObjectId _id ObjectId order ObjectId user int amount string method string instrument string status }
    AUDIT_LOG { ObjectId _id ObjectId actor string action string entityType string entityId string summary object meta }
```

`UK` = unique index. Money fields are integers in paise.

## Embed vs reference: the reasoning

| Data | Choice | Why |
|---|---|---|
| Addresses in User | Embedded | Always read with the user, small and bounded. An order copies the chosen address, so later edits never rewrite history. |
| Variants in Product | Embedded | Price and stock must be updated atomically together with the product document, which is what makes the conditional stock update safe. |
| Cart items | Embedded in Cart | One cart per user, read and written as a unit. |
| Order items, address, pricing | Embedded snapshot | An order must stay correct after a product is renamed, repriced or removed. |
| Product in Order/Cart | Reference (ObjectId + sku) | Needed to restore stock on cancellation and to rebuild carts. |
| Payments | Separate collection | One row per attempt (failed, succeeded, refunded); audited and summed independently of orders. |
| Audit logs | Separate, append-only | Grows without bound; never edited; no write endpoint exists. |

## Indexes and what each one is for

| Collection | Index | Purpose |
|---|---|---|
| users | `email` unique | Login lookup, prevents duplicate accounts |
| users | `role` | Customer counts and admin queries |
| categories | `name` unique, `slug` unique | Duplicate prevention, slug filtering |
| products | `slug` unique | Product page URLs |
| products | `variants.sku` unique (multikey) | SKU is globally unique |
| products | `category`; `isActive+category+minPrice`; `isActive+soldCount` | Category filter, price filter/sort, popularity sort |
| products | text index on name, brand, tags | Available for text search (current search uses an escaped, case-insensitive regex) |
| carts | `user` unique | Exactly one cart per user |
| orders | `orderNumber` unique | Human-readable unique order id |
| orders | `(user, idempotencyKey)` unique | **Database-level duplicate-order guard** |
| orders | `(user, createdAt)`, `(status, createdAt)`, `createdAt` | Order history, admin filters, reports |
| payments | `order`, `status` | Reconciliation and order detail |
| auditlogs | `createdAt`, `action`, `(entityType, entityId)` | Log browsing and per-order trail |

## Validation rules (enforced twice: zod at the API edge, Mongoose at the model)

- Stock is an integer with `min: 0`; prices are integers `>= 1` paise; `mrp >= price` (API).
- A product needs at least one variant and variant SKUs must be unique inside the product.
- Cart quantity is an integer between 1 and 10.
- Order `status` and `paymentStatus` are enums; an order must have at least one item.
- Passwords: 8 to 72 characters with a letter and a number; stored only as a bcrypt hash (`select: false`).

## Seeding and initialisation

```bash
cd backend
cp .env.example .env          # then edit JWT_SECRET
npm run seed                  # idempotent: upserts categories, products, users; creates demo orders only if none exist
npm run seed -- --reset       # drops the database first, then seeds from scratch
```

Indexes are created automatically by Mongoose when the models are initialised (the seed script and the test setup both wait for them explicitly).
