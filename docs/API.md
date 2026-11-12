# Ganesh Trades — API Reference

Base URLs:

- Local: `http://localhost:5000/api`
- Production: `https://ganeshtrades1.onrender.com/api`

All request and response bodies are JSON unless noted. File upload endpoints use
`multipart/form-data`.

## Authentication

Protected endpoints require a JWT in the `Authorization` header:

```
Authorization: Bearer <token>
```

Roles: `customer`, `staff`, `manager`, `admin`.

- `protect` — valid JWT required.
- `authorize(...)` — the authenticated user must have one of the listed roles.
- Staff users can only access deliveries assigned to them (`/api/worker/*`).
- Managers cannot create or promote `admin` accounts; only admins can.

Tokens are issued by `/api/auth/login`, `/api/auth/register`, and the Google
endpoints. Default lifetime is `7d` (`JWT_EXPIRE`).

## Rate limits

| Scope | Limit |
| --- | --- |
| Global `/api/` limiter | Per server configuration |
| `/api/auth/*` auth actions | 20 requests / 15 minutes / IP |
| OTP send / forgot password | 10 requests / 15 minutes / IP |

## Response conventions

Most endpoints return:

```json
{ "success": true, "data": { } }
```

or a domain-specific payload such as `{ "success": true, "orders": [], "page": 1 }`.
Errors return an appropriate HTTP status and:

```json
{ "success": false, "message": "Human-readable message" }
```

Internal error details are sanitized in production.

## Health

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/health` | Public | Liveness/readiness. Returns environment, database connection state, and database type (`atlas`, `local`, or `memory`). |

Example:

```json
{
  "environment": "production",
  "database": "connected",
  "dbType": "atlas"
}
```

## Auth — `/api/auth`

| Method | Path | Access | Body / notes |
| --- | --- | --- | --- |
| GET | `/google/config` | Public | Returns `{ configured, clientId }` for Google Identity Services. |
| POST | `/google` | Public | `{ credential }` or `{ idToken }`; signs in or registers a Google user. |
| POST | `/google/link` | Authenticated | Links a Google credential to the current account. |
| POST | `/send-otp` | Public | `{ mobile, purpose }`; purpose is `register`, `login`, `password_reset`, or `email_verify`. |
| POST | `/verify-otp` | Public | `{ mobile, otp, purpose }`; marks the OTP verified. |
| POST | `/register` | Public | `{ name, mobile, password, email?, customerType?, address? }`. |
| POST | `/login` | Public | `{ mobile, password }` or `{ email, password }`. |
| GET | `/me` | Authenticated | Current user profile. |
| PUT | `/profile` | Authenticated | Updates allowed profile fields. |
| PUT | `/password` | Authenticated | `{ currentPassword, newPassword }`. |
| POST | `/forgot-password` | Public | `{ mobile }`; sends a reset OTP. |
| POST | `/reset-password` | Public | `{ mobile, otp, newPassword }`. |
| POST | `/validate-password` | Public | `{ password }`; returns strength/validation feedback. |

OTP behavior:

- OTPs are hashed at rest (`salt` + hash), expire via a MongoDB TTL index, and are
  rate-limited per mobile and purpose.
- Verification attempts are capped (`OTP_MAX_VERIFY_ATTEMPTS`).
- Resend cooldown is enforced (`OTP_RESEND_COOLDOWN_SECONDS`).
- OTP delivery can be handled locally or by the optional split OTP service
  (`OTP_SERVICE_URL` / `OTP_SERVICE_API_KEY`), with Fast2SMS/Twilio adapters.

## Users — `/api/users`

All routes require `admin` or `manager`, except delete which requires `admin`.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/` | List customers/users. Supports pagination, search, role, and credit filters. |
| GET | `/stats/summary` | Customer totals, outstanding credit/debt, and counts. |
| GET | `/:id` | User detail. |
| GET | `/:id/credit-history` | Credit/debit ledger (`CreditTransaction`) and settlement history. |
| PUT | `/:id` | Update user fields (role changes restricted; managers cannot grant admin). |
| DELETE | `/:id` | Delete a user (admin only). |

Outstanding balances are the sum of `pendingAmount` (cash/UPI debt) and
`creditBalance` (Khata credit debt). The two fields are disjoint by design.

## Products — `/api/products`

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/` | Public | List/search products. Filters include category, search text, price range, featured, and pagination. |
| GET | `/featured` | Public | Featured products. |
| GET | `/categories` | Public | Category list/counts. |
| GET | `/low-stock` | Admin/Manager | Products at or below `minStock` (or stock ≤ 5). |
| GET | `/:id` | Public | Product detail. |
| POST | `/` | Admin/Manager | Create product; `multipart/form-data` with up to 10 images. |
| PUT | `/:id` | Admin/Manager | Update product; up to 10 images. |
| POST | `/:id/images` | Admin/Manager | Upload additional images. |
| PUT | `/:id/images/primary` | Admin/Manager | Set the primary image. |
| DELETE | `/:id/images` | Admin/Manager | Delete an image (body identifies the image). |
| PUT | `/:id/stock` | Admin/Manager | Adjust stock. |
| DELETE | `/:id` | Admin/Manager | Delete product. |
| POST | `/bulk-images` | Admin/Manager | Upload images for multiple products (up to 20). |

Image storage supports Cloudinary, GridFS, and local storage. `Product.status`
auto-updates between `active` and `out_of_stock` based on stock.

## Orders — `/api/orders`

All routes require authentication; status changes require `admin` or `manager`.

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| POST | `/` | Authenticated | Create an order. Body: `{ items, paymentMethod, deliveryAddress, notes?, deliveryType?, scheduledDate?, timeSlot? }`. |
| GET | `/` | Authenticated | List orders. Customers see their own; admins/managers can filter all orders. |
| GET | `/scheduled/upcoming` | Admin/Manager | Upcoming scheduled deliveries. |
| GET | `/time-slots` | Public | Available delivery time slots. |
| GET | `/:id` | Authenticated | Order detail (ownership enforced for customers). |
| PUT | `/:id/reschedule` | Authenticated | `{ scheduledDate, timeSlot }`; reschedules a scheduled order. |
| PUT | `/:id/status` | Admin/Manager | `{ orderStatus, note? }`; validates transitions and updates delivery/finance state transactionally. |
| PUT | `/:id/cancel` | Authenticated | `{ reason? }`; cancels the order, restores stock, and reverses unsettled financial state. |
| GET | `/:id/invoice` | Authenticated | Downloads the order invoice PDF. |

Order statuses: `pending`, `confirmed`, `processing`, `out_for_delivery`,
`delivered`, `cancelled`.

Payment statuses: `pending`, `partial`, `paid`, `refunded`.

Scheduled delivery fields include `deliveryType: instant | scheduled`,
`scheduledDelivery.date`, `scheduledDelivery.timeSlot`, `scheduledAt`,
`rescheduledAt`, `originalDate`, and `originalTimeSlot`.

Cancellation behavior:

- Stock is always restored for non-cancelled orders.
- Only still-owed money is reversed; already-paid amounts are not removed.
- Payment status is recomputed from actual completed payments and settlements.
- Settlement allocations are reversed for the cancelled order.

## Payments — `/api/payments`

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| POST | `/` | Admin/Manager | Record a payment. Body: `{ userId, orderId, amount, paymentMethod, notes? }`. Amount cannot exceed outstanding. |
| GET | `/` | Authenticated | Payment history. Customers see their own; admins/managers can filter by user and paginate. |
| GET | `/pending` | Admin/Manager | Orders with pending payment. |
| POST | `/settlement` | Admin/Manager | Record a Khata settlement. Body: `{ userId, amount, paymentMethod, referenceNumber?, notes? }`. Allocates FIFO to oldest orders. |
| POST | `/create-order` | Authenticated | Creates a gateway order. Body: `{ orderId, paymentMode }`. Charges only the outstanding amount. |
| POST | `/verify` | Authenticated | Verifies a gateway payment. Body: `{ gatewayOrderId, gatewayPaymentId, gatewaySignature }`. |

Financial integrity rules:

- Payment and settlement writes run in a MongoDB transaction when the deployment
  supports replica sets; otherwise the code uses the non-transactional fallback.
- Ledger updates are conditional and idempotent where applicable.
- If stored ledger values do not match computed values, the API returns `409`
  with a reconciliation message instead of silently clamping or overwriting.
- `Payment.paymentStatus = completed` rows and `Settlement` rows are the source
  of truth for recomputing `Order.paymentStatus`.

## Reviews — `/api/reviews`

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/` | Public (optional auth) | List reviews. |
| GET | `/product/:productId` | Public | Reviews for a product. |
| POST | `/` | Authenticated | `{ productId, rating (1–5), comment? }`. One review per user per product. |
| PUT | `/:id` | Authenticated | Edit own review. |
| PUT | `/:id/moderate` | Admin/Manager | `{ status }` where status is `pending`, `approved`, or `rejected`. |
| PUT | `/:id/helpful` | Authenticated | Mark a review helpful. |
| DELETE | `/:id` | Authenticated | Delete own review; admins/managers may delete any. |

Product `avgRating` and `reviewCount` are recalculated after review changes.

## Notifications — `/api/notifications`

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/` | Authenticated | Current user's notifications, including role broadcasts with per-user read state. |
| PUT | `/:id/read` | Authenticated | Mark one notification read. |
| PUT | `/read-all` | Authenticated | Mark all visible notifications read. |
| POST | `/` | Admin/Manager | Create a notification (targeted user or role broadcast). |
| DELETE | `/clear-read` | Authenticated | Delete the current user's read notifications. |
| DELETE | `/:id` | Authenticated | Delete one visible notification. |

## Dashboard — `/api/dashboard`

All routes require `admin` or `manager`.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/stats` | Totals: orders, revenue, customers, products, low stock, outstanding, scheduled counts, recent orders. |
| GET | `/chart-data` | Seven-day orders/revenue chart series. |
| GET | `/auto-reorder` | Rule-based restock suggestions (low stock or high sales velocity). |

`totalOutstanding` is `pendingAmount + creditBalance` across customers and is
reported as `totalPending` for backward compatibility.

## Reports — `/api/reports`

All routes require `admin` or `manager`.

| Method | Path | Query | Description |
| --- | --- | --- | --- |
| GET | `/sales` | `period` (`daily`, `weekly`, `monthly`, `yearly`), `startDate`, `endDate` | Sales summary. |
| GET | `/profit-loss` | `startDate`, `endDate` | Revenue, expenses, and profit/loss. |
| GET | `/export/orders` | `startDate`, `endDate` | CSV/Excel export of orders. |
| GET | `/export/products` | — | CSV/Excel export of products. |

## Audit — `/api/audit`

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/` | Admin/Manager | Paginated audit log with filters (action, entity, user, date). |

Audited actions include authentication, user/product/order/payment changes,
settlements, deliveries, staff/partner changes, supplier/PO/payment activity,
expenses, imports, image changes, and settings updates.

## Suppliers — `/api/suppliers`

All routes require `admin` or `manager`.

| Method | Path | Body | Description |
| --- | --- | --- | --- |
| POST | `/` | Supplier fields | Create supplier. |
| GET | `/` | — | List suppliers. |
| POST | `/po` | `{ supplierId, items, expectedDelivery?, notes? }` | Create a purchase order. PO numbers are generated atomically. |
| GET | `/po` | — | List purchase orders. |
| PUT | `/po/:id/receive` | — | Receive a PO; increases stock and updates supplier balance. |
| POST | `/payment` | `{ supplierId, amount, paymentMethod, referenceNumber?, notes?, purchaseOrderId? }` | Record a supplier payment. |

Supplier `balance` is the amount the shop owes the supplier.

## Expenses — `/api/expenses`

All routes require `admin` or `manager`.

| Method | Path | Body | Description |
| --- | --- | --- | --- |
| POST | `/` | `{ category, amount, date?, description, receiptUrl? }` | Create expense. |
| GET | `/` | — | List expenses. |
| PUT | `/:id` | Expense fields | Update expense. |
| DELETE | `/:id` | — | Delete expense (admin/manager). |

Categories: `electricity`, `salary`, `transport`, `maintenance`,
`miscellaneous`, `supplies`.

## Deliveries — `/api/deliveries`

All routes require `admin` or `manager`.

| Method | Path | Body | Description |
| --- | --- | --- | --- |
| POST | `/` | `{ orderId, deliveryPersonName, deliveryPersonMobile, assignedWorker?, notes? }` | Create/assign a delivery. |
| GET | `/` | — | List deliveries. |
| GET | `/today-priority` | — | Today's priority deliveries. |
| PUT | `/:id/status` | `{ status, note?, location?, failureReason?, proofUrl? }` | Update delivery status. |

Delivery statuses: `assigned`, `picked_up`, `on_the_way`, `delivered`, `failed`.

## Backups — `/api/backups`

All routes require `admin`.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/` | List backups. |
| POST | `/trigger` | Trigger a manual backup. |
| POST | `/restore/:filename` | Restore from a backup file. |
| GET | `/download/:filename` | Download a backup file. |

Restore is destructive to current data. Use only with explicit operational
approval and a verified backup.

## Settings — `/api/settings`

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/` | Public | Shop settings (name, address, location, delivery radius/fees). |
| PUT | `/` | Admin/Manager | Update settings. |
| POST | `/check-serviceability` | Public | Check whether a location is inside the delivery radius. |
| GET | `/coverage-stats` | Admin/Manager | Delivery coverage statistics. |

## Media — `/api/media`

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/:fileId` | Public | Stream a GridFS media file (images). |

## Import — `/api/import`

All routes require `admin` or `manager`. Uploads use `multipart/form-data` with
field name `file`. Supported formats are CSV and XLSX.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/template/:type` | Download a template. `type` is `products`, `customers`, or `inventory`. |
| POST | `/products/preview` | Preview product import and validation results. |
| POST | `/products/commit` | Commit a validated product import. |
| POST | `/customers/preview` | Preview customer import. |
| POST | `/customers/commit` | Commit customer import. |
| POST | `/inventory/preview` | Preview inventory update import. |
| POST | `/inventory/commit` | Commit inventory update import. |

## AI — `/api/ai`

All routes require `admin` or `manager`.

| Method | Path | Body | Description |
| --- | --- | --- | --- |
| GET | `/snapshot` | — | Live aggregated business snapshot. |
| POST | `/assistant` | `{ query }` | Ask the business assistant a question. |

See `docs/AI_FEATURES.md` for architecture, configuration, and fallback behavior.

## Staff — `/api/staff`

All routes require `admin` or `manager`.

| Method | Path | Description |
| --- | --- | --- |
| POST | `/` | Create a staff User + StaffProfile. Managers cannot create admin accounts. |
| GET | `/` | List staff. |
| GET | `/:id` | Staff detail. |
| PUT | `/:id` | Update staff profile/account. |
| GET | `/partners` | List delivery partners. |
| POST | `/partners` | Create a delivery partner. |
| PUT | `/partners/:id` | Update a delivery partner. |

Staff profile categories: `shop`, `delivery`, `hybrid`. Engagement types:
`internal`, `external`. External staff can be linked to a `DeliveryPartner`.

## Worker — `/api/worker`

All routes require authentication with role `staff`. Workers can only access
deliveries where `assignedWorker` equals their user ID, and must have an active
`StaffProfile`.

| Method | Path | Body | Description |
| --- | --- | --- | --- |
| GET | `/me` | — | Worker profile and summary. |
| GET | `/deliveries` | — | Deliveries assigned to the worker. |
| GET | `/deliveries/:id` | — | Assigned delivery detail. |
| PUT | `/deliveries/:id/status` | `{ status, note?, location?, failureReason?, proofUrl? }` | Advance the delivery. |
| POST | `/deliveries/:id/payment` | `{ amount, paymentMethod, idempotencyKey?, notes? }` | Collect cash/UPI at the door. |

Allowed status transitions:

```
assigned   -> picked_up
picked_up  -> on_the_way
on_the_way -> delivered | failed
delivered  -> (terminal)
failed     -> (terminal; admin reassigns)
```

Failure requires `failureReason` (at least 5 characters). Proof of delivery
(`proofUrl`) is accepted when marking delivered.

Door payment rules:

- Only `cash` and `upi` are allowed; credit settlements remain admin-only.
- Amount cannot exceed the order's outstanding balance.
- `idempotencyKey` prevents duplicate collection for the same delivery.
- For credit orders, the payment reduces `creditBalance`; otherwise it reduces
  `pendingAmount`.
- Ledger mismatches return `409` for reconciliation.

## Common error statuses

| Status | Meaning |
| --- | --- |
| 400 | Validation error or invalid state transition. |
| 401 | Missing/invalid token. |
| 403 | Authenticated but not authorized for the role/resource. |
| 404 | Resource not found. |
| 409 | Ledger/financial inconsistency requiring reconciliation. |
| 429 | Rate limit exceeded. |
| 500 | Unexpected server error (details sanitized). |
