# 🛒 Ganesh Trades - Grocery & Wholesale Shop

A complete full-stack web application for managing a grocery and wholesale business with three distinct portals — **Customer**, **Admin** and **Manager** — plus a standalone OTP microservice.

## 🏗️ Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite + Tailwind CSS v4 + Vitest |
| Backend | Node.js + Express.js + Jest + Supertest |
| Database | MongoDB + Mongoose (GridFS for images) |
| Auth | JWT (JSON Web Tokens) + OTP (SMS) |
| Payments | UPI / Card / Net-Banking gateway (simulated gateway, Razorpay-ready) |
| Charts & Maps | Recharts, React-Leaflet |
| Icons | React Icons + Lucide React |
| Reports | PDFKit (invoices), ExcelJS (exports) |
| SMS | Fast2SMS / Twilio (OTP microservice) |

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)

### 1. Install everything (root)
```bash
npm run install-all
```

### 2. Configure Environment
Copy/edit `backend/.env`:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/ganesh_trades
JWT_SECRET=your_secret_key
JWT_EXPIRE=7d
FRONTEND_URL=http://localhost:5173

# SMS (OTP) — optional; falls back to console mock when unset
FAST2SMS_API_KEY=your_key
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1xxxx

# Optional payment gateway
RAZORPAY_KEY_ID=your_key
RAZORPAY_KEY_SECRET=your_secret
```

OTP microservice (`otp-server/`):
```
PORT=5001
MONGODB_URI=mongodb://localhost:27017/ganesh_trades_otp
OTP_SERVICE_API_KEY=your_shared_api_key
```

### 3. Seed Database
```bash
cd backend
npm run seed
```

### 4. Start everything (root)
```bash
npm run dev
```
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000`
- OTP service: `http://localhost:5001`

## 📁 Project Structure

```
ganesh-trades/
├── backend/               # Express API (port 5000)
│   ├── config/            # DB + cron job configuration
│   ├── controllers/       # Route controllers
│   ├── middleware/        # Auth (JWT), error handling, uploads
│   ├── models/            # 17 Mongoose schemas
│   ├── routes/            # API endpoints
│   ├── seeders/           # Database seeder + settings migration
│   ├── scripts/           # Maintenance scripts
│   ├── tests/             # Jest regression suites
│   ├── utils/             # SMS, PDF generator, audit logger, security
│   ├── uploads/           # Local product image storage
│   └── server.js          # Express app entry
├── frontend/              # React SPA (port 5173)
│   └── src/
│       ├── components/    # Common + admin components
│       ├── context/       # Auth, Cart, Theme context
│       ├── layouts/       # Customer & Admin layouts
│       ├── pages/         # auth / customer / admin / manager
│       ├── services/      # Axios API service layer
│       ├── utils/         # media URLs, time slots
│       ├── App.jsx        # Routes
│       └── main.jsx       # Entry point
├── otp-server/            # Standalone OTP microservice (port 5001)
├── render.yaml            # Render blueprint (backend + otp-server)
├── vercel.json            # Vercel SPA + rewrite config
├── DEPLOYMENT.md          # Deployment & CI/CD guide
└── README.md
```

## 🔌 API Endpoints

### Auth & Users
- `POST /api/auth/send-otp`, `POST /api/auth/verify-otp` - OTP verification
- `POST /api/auth/register`, `POST /api/auth/login` - Auth
- `GET /api/auth/me`, `PUT /api/auth/profile`, `PUT /api/auth/password`
- `POST /api/auth/forgot-password`, `POST /api/auth/reset-password` - OTP-based password reset
- `POST /api/auth/validate-password`
- `GET /api/users`, `GET /api/users/stats/summary`, `GET/PUT/DELETE /api/users/:id`

### Products
- `GET /api/products`, `GET /api/products/categories`, `GET /api/products/featured`
- `GET /api/products/low-stock`, `GET/PUT/DELETE /api/products/:id`
- `PUT /api/products/:id/stock`, `POST /api/products/bulk-images`
- `POST /api/products/:id/images`, `PUT .../images/primary`, `DELETE .../images`

### Orders
- `POST /api/orders`, `GET /api/orders`, `GET /api/orders/:id`
- `PUT /api/orders/:id/status`, `PUT /api/orders/:id/cancel`, `PUT /api/orders/:id/reschedule`
- `GET /api/orders/time-slots`, `GET /api/orders/scheduled/upcoming`
- `GET /api/orders/:id/invoice` - PDF invoice

### Payments & Khata
- `POST /api/payments`, `GET /api/payments`, `GET /api/payments/pending`
- `POST /api/payments/settlement` - Khata settlement
- `POST /api/payments/create-order`, `POST /api/payments/verify` - online gateway

### Reviews
- `POST /api/reviews`, `GET /api/reviews`, `GET /api/reviews/product/:id`
- `PUT /api/reviews/:id`, `PUT /api/reviews/:id/moderate`, `PUT /api/reviews/:id/helpful`, `DELETE /api/reviews/:id`

### Notifications
- `GET /api/notifications`, `PUT .../:id/read`, `PUT /api/notifications/read-all`
- `POST /api/notifications`, `DELETE /api/notifications/clear-read`, `DELETE /api/notifications/:id`

### Dashboard, Reports & Audit
- `GET /api/dashboard/stats`, `GET /api/dashboard/chart-data`, `GET /api/dashboard/auto-reorder`
- `GET /api/reports/sales`, `GET /api/reports/profit-loss`
- `GET /api/reports/export/orders`, `GET /api/reports/export/products` (Excel)
- `GET /api/audit` - audit logs

### Suppliers, Expenses & Deliveries
- `POST /api/suppliers`, `GET /api/suppliers`
- `POST /api/suppliers/po`, `GET /api/suppliers/po`, `PUT /api/suppliers/po/:id/receive`
- `POST /api/suppliers/payment`
- `POST /api/expenses`, `GET /api/expenses`, `DELETE /api/expenses/:id`
- `POST /api/deliveries`, `GET /api/deliveries`, `GET /api/deliveries/today-priority`
- `PUT /api/deliveries/:id/status`

### Backups, Settings & Media
- `GET /api/backups`, `POST /api/backups/trigger`, `POST /api/backups/restore/:file`, `GET /api/backups/download/:file`
- `GET /api/settings`, `PUT /api/settings`, `POST /api/settings/check-serviceability`, `GET /api/settings/coverage-stats`
- `GET /api/media/:fileId` - GridFS image streaming
- `GET /api/health` - health check

## 📋 Features

### Customer Portal
- ✅ Registration & Login with OTP, JWT auth, forgot-password via SMS OTP
- ✅ Browse products by 15 categories, live debounced search
- ✅ Product detail with reviews, helpful votes, admin responses, Load-More pagination
- ✅ Cart with stock clamping and local persistence
- ✅ Checkout — instant or scheduled (date + time-slot) delivery
- ✅ Serviceability check (geolocation + delivery radius)
- ✅ Online (UPI/card/net-banking), Cash on Delivery, and Khata (credit) payments
- ✅ Payment-resume flow for abandoned gateway attempts
- ✅ Order history, tracking, reschedule and PDF invoice download
- ✅ Review edit/delete, notification bell with live polling, profile management

### Admin Portal
- ✅ Dashboard with stats, revenue/order charts and auto-reorder alerts
- ✅ Orders — filters, pagination, status flow, reschedule, delivery assignment, payment recording
- ✅ Delivery management — priority queue + filterable, paginated full history
- ✅ Product CRUD, inventory/stock, bulk image upload, low-stock alerts
- ✅ Customers — search, type filters, summary cards, toggle active, pagination
- ✅ Credit (Khata) — balances, settlements, credit-limit management
- ✅ Suppliers & POs — create/receive POs, supplier payments
- ✅ Expenses, payments ledger, daily/weekly/monthly reports, Excel exports, Profit & Loss
- ✅ Review moderation, notification center, delivery-coverage map & settings
- ✅ Database backups (trigger/restore/download, cron-scheduled), audit logs
- ✅ 404 page, global error boundary, responsive layout

### Manager Portal
- ✅ Centralized analytics dashboard
- ✅ Sales analytics with charts
- ✅ Review management & audit logs (Read)
- ✅ Data export (Excel)
- ✅ Management link surfaced in the shared admin sidebar

## 🚢 Deployment

The production topology splits **frontend (Vercel)** from **backend + OTP service (Render)**. Follow [`DEPLOYMENT.md`](DEPLOYMENT.md) for the full steps, CI, CORS, and rollback details.

1. **Frontend (Vercel):** repo root; `vercel.json` builds `frontend` and rewrites all routes to the SPA. Set `VITE_API_URL=https://your-backend.onrender.com/api`.
2. **Backend (Render):** root directory `backend`; `node server.js`. Set `MONGODB_URI`, `JWT_SECRET`, `FRONTEND_URL` and optional SMS/gateway keys.
3. **OTP service (Render):** root directory `otp-server`; set `MONGODB_URI`, `OTP_SERVICE_API_KEY` (must match backend's `OTP_SERVICE_API_KEY`).

### MongoDB Atlas Setup
1. Create free cluster at mongodb.com
2. Create database user
3. Add IP whitelist (`0.0.0.0/0` for cloud deployment)
4. Get connection string and set `MONGODB_URI` in Render environment variables.

## 🧪 Testing

```bash
# Backend (Jest + Supertest + MongoMemoryServer)
cd backend && npm test

# Frontend (Vitest + Testing Library)
cd frontend && npm test

# Lint & build
cd frontend && npm run lint && npm run build
```

CI on GitHub Actions (`main` branch / PRs) runs backend tests, frontend lint/tests and the production build automatically.

## 📄 License
MIT License - Built with ❤️ by Ganesh Trades