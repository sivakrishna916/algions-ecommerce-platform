# Algions Store — E-Commerce Platform

A full-stack e-commerce platform developed as part of the **ALGIONS AI LABS PRIVATE LIMITED Full-Stack Web Development Internship Assessment**.

**Developed by:** Sivakrishna Reddy
**Registration Number:** 12305362
**Repository:** https://github.com/sivakrishna916/algions-ecommerce-platform

Algions Store is a MERN-based e-commerce application featuring a customer storefront and a separate admin console. The project focuses on reliable shopping workflows, inventory management, payment simulation, order processing, and backend security.

## 1. Features

### Customer Features
- User registration, login, and authentication.
- Product browsing with search, filters, sorting, and pagination.
- Product variants and SKU-based inventory.
- Server-persisted shopping cart.
- Address management.
- Coupon application and automatic GST and shipping calculations.
- Checkout with simulated card and UPI payments.
- Payment success, failure, and retry handling.
- Order history, order tracking, and cancellation.
- Refund handling for eligible cancelled orders.

### Admin Features
- Admin dashboard with sales charts and statistics.
- Product creation, editing, and management.
- Category management.
- Inventory adjustments.
- Order management and fulfilment status updates.
- Customer management.
- Sales and reconciliation reports.
- Audit logs for important administrative activities.
- Server-side role-based access control (RBAC).

## 2. Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS, React Router |
| API Communication | Axios |
| Charts | Recharts |
| Backend | Node.js 22, Express.js |
| Database | MongoDB, Mongoose |
| Authentication | JWT, bcryptjs |
| Validation | Zod |
| Testing | Jest, Supertest, Vitest |
| API Documentation | Swagger / OpenAPI |

**Architecture:** Modular Monolith

The backend follows a modular structure separating routes, controllers, services, models, middleware, and validation logic.

## 3. Project Structure

```text
algions-ecommerce-platform/
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── validators/
│   │   └── scripts/
│   │
│   ├── tests/
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── context/
│   │   └── services/
│   │
│   └── package.json
│
├── docs/
│   ├── ER_DIAGRAM.md
│   ├── TECHNICAL_REPORT.md
│   └── TEST_EVIDENCE.md
│
├── .gitignore
├── README.md
└── start-project.ps1
```

## 4. Prerequisites

Make sure the following are installed:

- Node.js 22
- npm
- MongoDB Community Server or MongoDB Atlas
- Git

## 5. Installation and Setup

### Step 1: Clone the Repository

```bash
git clone https://github.com/sivakrishna916/algions-ecommerce-platform.git
cd algions-ecommerce-platform
```

### Step 2: Configure the Backend

Open a terminal in the project root:

```powershell
cd backend
Copy-Item .env.example .env
```

Open `backend/.env` and configure the required environment variables.

At minimum, configure:
- `MONGO_URI`
- `JWT_SECRET`
- `CLIENT_ORIGIN`

Use a strong, private JWT secret. Do not commit your `.env` file.

### Step 3: Install Backend Dependencies

```bash
npm install
```

### Step 4: Seed the Database

```bash
npm run seed
```


```bash
cd frontend
npm run build
```

### Step 5: Start the Backend

```bash
npm run dev
```

The backend API runs at:

`http://localhost:5055`

Swagger API documentation:

`http://localhost:5055/api/docs`

### Step 6: Configure and Start the Frontend

Open a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

The frontend runs at:

`http://localhost:5173`

### Alternative: Start Both Applications

From the project root, run:

```powershell
.\start-project.ps1
```

This starts the backend and frontend together using the project's startup script.

## 6. Environment Variables

The complete environment variable list is available in `backend/.env.example`.

| Variable | Purpose |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret used for signing authentication tokens |
| `CLIENT_ORIGIN` | Allowed frontend origin for CORS |
| `TAX_RATE_PERCENT` | Configurable tax percentage |
| `SHIPPING_FLAT_PAISE` | Flat shipping charge in paise |
| `FREE_SHIPPING_THRESHOLD_PAISE` | Order value threshold for free shipping |

Keep credentials and secrets private.

## 7. Demo Credentials

The following credentials are intended for local demonstration with seeded data.

| Role | Email | Password |
|---|---|---|
| Admin | `admin@demo.test` | `Admin@12345` |
| Customer | `customer@demo.test` | `Customer@12345` |

### Simulated Payment Testing

**Card payments**

| Card Number | Expected Result |
|---|---|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 0002` | Payment declined |
| `4000 0000 0000 9995` | Insufficient funds |

Use a valid future expiry date and valid CVV format.

**UPI payments**

- A UPI ID ending in `@fail` simulates a failed payment.
- Other valid UPI IDs simulate successful payments.

These are simulated payment scenarios. No real money is charged.

### Demo Coupons

| Coupon | Description |
|---|---|
| `WELCOME10` | Percentage-based discount |
| `FLAT100` | Flat discount |

## 8. Important Technical Design Decisions

### 1. Inventory Safety
Stock reservation uses an atomic MongoDB update with a stock availability condition. This prevents concurrent purchases from reducing stock below zero.

### 2. Checkout Idempotency
Checkout uses an `Idempotency-Key` header, a unique user-and-key database index, and a cart lock to reduce duplicate order creation.

### 3. Order Lifecycle
Orders follow controlled status transitions:

```text
PLACED → PAID → PACKED → SHIPPED → DELIVERED
   |
   └── CANCELLED
```

Invalid status transitions are rejected.

### 4. Server-Side Validation
Prices, stock availability, and user permissions are validated on the backend rather than trusted from client-side values.

### 5. Role-Based Access Control
Administrative API routes use authentication and role-checking middleware to prevent customers from accessing administrative operations.

### 6. Audit and Reconciliation
Important operations are recorded in audit logs. Reconciliation checks compare order totals, payments, refunds, and inventory-restoration status.

## 9. Testing

### Backend Tests

```bash
cd backend
npm test
```

The backend test suite has previously passed:

- 8 test suites.
- 108 tests passed.

### Frontend Tests

```bash
cd frontend
npm test
```

Previously recorded frontend unit test results:

- 9 tests passed.
- 5 tests skipped.

Browser end-to-end test evidence is documented separately.

For detailed test results and screenshots, refer to:

`docs/TEST_EVIDENCE.md`

## 10. API Documentation

Swagger UI is available locally at:

`http://localhost:5055/api/docs`

OpenAPI JSON:

`http://localhost:5055/api/docs.json`

The API uses consistent response structures:

**Successful response**

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

**Error response**

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description"
  }
}
```

Monetary values are stored as integer paise to avoid floating-point precision issues.

## 11. Documentation

Additional project documentation is available in the `docs/` directory:

| File | Description |
|---|---|
| `ER_DIAGRAM.md` | Database entities and relationships |
| `TECHNICAL_REPORT.md` | Architecture, implementation, and design decisions |
| `TEST_EVIDENCE.md` | Test results and verification evidence |

## 12. Known Limitations

- Payments are simulated; no external payment gateway is integrated.
- Unpaid orders retain reserved stock until cancellation; automatic reservation expiry is not implemented.
- Authentication tokens are stored in browser `localStorage`.
- Rate limiting is currently focused on login.
- Product images are generated illustrations rather than real product photography.
- Email and SMS notifications are not integrated.
- The application is designed for local execution and is not currently deployed.

## 13. Project Objective

The objective of this project is to demonstrate full-stack development skills through a practical e-commerce application, with particular attention to backend architecture, secure API access, inventory consistency, checkout idempotency, payment workflows, automated testing, and administrative reporting.