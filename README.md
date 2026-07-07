# 🛒 Ganesh Trades - Grocery & Wholesale Shop

A complete full-stack web application for managing a grocery and wholesale business with three distinct portals.

## 🏗️ Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite + Tailwind CSS v4 |
| Backend | Node.js + Express.js |
| Database | MongoDB + Mongoose |
| Auth | JWT (JSON Web Tokens) |
| Charts | Recharts |
| Icons | React Icons + Lucide React |

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)

### 1. Clone & Setup Backend
```bash
cd backend
npm install
```

### 2. Configure Environment
Edit `backend/.env`:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/ganesh_trades
JWT_SECRET=your_secret_key
JWT_EXPIRE=7d
FRONTEND_URL=http://localhost:5173
```

### 3. Seed Database
```bash
cd backend
npm run seed
```

### 4. Start Backend
```bash
cd backend
npm run dev
```

### 5. Setup Frontend
```bash
cd frontend
npm install
npm run dev
```

### 6. Open App
Visit `http://localhost:5173`

## 🔑 Demo Credentials

| Role | Mobile | Password |
|------|--------|----------|
| Admin | 9999999999 | admin123 |
| Manager | 8888888888 | manager123 |
| Customer | 7777777777 | pass123 |

## 📁 Project Structure

```
ganesh-trades/
├── backend/
│   ├── config/          # Database configuration
│   ├── middleware/       # Auth, error handling, uploads
│   ├── models/          # MongoDB schemas
│   ├── routes/          # API endpoints
│   ├── seeders/         # Database seeder
│   ├── uploads/         # Product images
│   ├── utils/           # PDF generator, audit logger
│   ├── server.js        # Express app entry
│   └── .env             # Environment variables
├── frontend/
│   ├── src/
│   │   ├── context/     # Auth & Cart context
│   │   ├── layouts/     # Customer & Admin layouts
│   │   ├── pages/
│   │   │   ├── auth/    # Login, Register
│   │   │   ├── customer/# Home, Products, Cart, Orders, Profile
│   │   │   ├── admin/   # Dashboard, Orders, Products, etc.
│   │   │   └── manager/ # Management portal
│   │   ├── services/    # API service layer
│   │   ├── App.jsx      # Routes
│   │   └── main.jsx     # Entry point
│   └── index.html
└── README.md
```

## 🔌 API Endpoints

### Auth
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Current user
- `PUT /api/auth/profile` - Update profile
- `PUT /api/auth/password` - Change password

### Products
- `GET /api/products` - List products
- `GET /api/products/:id` - Product detail
- `GET /api/products/categories` - Categories
- `GET /api/products/low-stock` - Low stock alerts
- `POST /api/products` - Create (Admin)
- `PUT /api/products/:id` - Update (Admin)
- `PUT /api/products/:id/stock` - Update stock (Admin)
- `DELETE /api/products/:id` - Remove (Admin)

### Orders
- `POST /api/orders` - Place order
- `GET /api/orders` - List orders
- `GET /api/orders/:id` - Order detail
- `PUT /api/orders/:id/status` - Update status (Admin)
- `PUT /api/orders/:id/cancel` - Cancel order
- `GET /api/orders/:id/invoice` - Download PDF invoice

### Payments
- `POST /api/payments` - Record payment (Admin)
- `GET /api/payments` - List payments
- `GET /api/payments/pending` - Pending payments

### Reviews
- `POST /api/reviews` - Add review
- `GET /api/reviews/product/:id` - Product reviews
- `GET /api/reviews` - All reviews (Admin)
- `DELETE /api/reviews/:id` - Delete (Admin)

### Dashboard & Reports
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/dashboard/chart-data` - Chart data
- `GET /api/reports/sales` - Sales report
- `GET /api/reports/export/orders` - Export orders (Excel)
- `GET /api/reports/export/products` - Export products (Excel)

### Notifications
- `GET /api/notifications` - Get notifications
- `PUT /api/notifications/:id/read` - Mark read
- `PUT /api/notifications/read-all` - Mark all read

### Audit
- `GET /api/audit` - Audit logs (Manager)

## 🚢 Deployment

### Deploy Backend to Render
1. Push code to GitHub
2. Create new Web Service on Render
3. Set build command: `npm install`
4. Set start command: `node server.js`
5. Add environment variables from `.env`
6. Use MongoDB Atlas for database

### Deploy Frontend to Vercel
1. Push code to GitHub
2. Import project on Vercel
3. Set root directory: `frontend`
4. Build command: `npm run build`
5. Output directory: `dist`
6. Add env variable: `VITE_API_URL=https://your-render-url.onrender.com/api`

### MongoDB Atlas Setup
1. Create free cluster at mongodb.com
2. Create database user
3. Add IP whitelist (0.0.0.0/0 for Render)
4. Get connection string
5. Update `MONGODB_URI` in environment variables

## 📋 Features

### Customer Portal
- ✅ Registration & Login (JWT)
- ✅ Browse products by category
- ✅ Search products
- ✅ Add to cart
- ✅ Place orders
- ✅ Order history & tracking
- ✅ Download PDF invoices
- ✅ Profile management
- ✅ WhatsApp support button

### Admin Portal
- ✅ Dashboard with live statistics
- ✅ Revenue & order charts
- ✅ Customer management
- ✅ Product CRUD
- ✅ Inventory management
- ✅ Stock alerts
- ✅ Order management & status updates
- ✅ Payment tracking
- ✅ Daily/Weekly/Monthly reports
- ✅ Excel exports

### Management Portal
- ✅ Centralized analytics
- ✅ Sales analytics with charts
- ✅ Review management
- ✅ Audit logs
- ✅ Data export (Excel)

## 📄 License
MIT License - Built with ❤️ by Ganesh Trades
