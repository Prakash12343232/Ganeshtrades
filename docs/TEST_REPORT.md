# Ganesh Trades — Test Report

Date: 2026-11-13
Branch: `main`
Commits tested: `6e221f4` (HEAD), `adc339b` (Phase 1 financial integrity)
Environment: Windows, Node.js v26.13.0, npm 12.2.2

## Result summary

| Suite | Files / suites | Tests | Result | Duration |
| --- | --- | --- | --- | --- |
| Backend (Jest + Supertest) | 33 suites | 223 | Passed | 357.7 s |
| Frontend (Vitest + Testing Library) | 27 files | 164 | Passed | 30.9 s |
| OTP service (Jest) | 1 suite | 11 | Passed | 16.0 s |
| **Total** | **61** | **398** | **All passed** | — |

Backend tests were also verified with `MONGOMS_REPLICA_SET=true` to exercise the
real MongoDB transaction path; all 33 suites / 223 tests passed.

## Backend suites

```
apiContract.test.js                 auth.test.js
bugRegression.test.js               bulkImportAndAI.test.js
catalogRegression.test.js           credit.test.js
customerDetail.test.js              deliveries.test.js
deliveryOrderSync.test.js           errorSanitization.test.js
expenseUpdate.test.js               googleAuth.test.js
imageBulkUpload.test.js             imageManagement.test.js
notifications.test.js               orders.test.js
otpClient.test.js                   otpHashing.test.js
otpSplitArchitecture.test.js        paidCancellation.test.js
passwordReset.test.js               paymentResume.test.js
phase1FinancialIntegrity.test.js    reports.test.js
roles.test.js                       rootAndHealth.test.js
security.test.js                    settlementAndCancellation.test.js
settlementThenCancellation.test.js  smsGateway.test.js
staffWorkerManagement.test.js       supplyChain.test.js
userCreditFilter.test.js
```

Coverage includes:

- Authentication, JWT roles, account lockout, Google sign-in, OTP hashing,
  OTP rate limits, split OTP service, password reset.
- Product catalog, search/filtering, images, bulk upload, inventory updates.
- Order creation, scheduled delivery, rescheduling, status transitions,
  cancellation, invoices.
- Payments, partial payments, gateway create/verify, settlements, credit/Khata,
  paid-order cancellation, settlement-then-cancellation.
- Phase 1 financial integrity: stock restoration, ledger consistency (`409`),
  FIFO settlement allocations, worker door payments, outstanding totals.
- Deliveries, delivery/order synchronization, staff and worker management,
  worker status transitions and idempotent cash collection.
- Supplier/purchase-order/receiving/payment flows, expenses, reports,
  notifications, audit, health.
- Security: input sanitization, authorization boundaries, error sanitization.

## Frontend suites

```
components/common/ErrorBoundary.test.jsx
components/common/ProductImage.test.jsx
components/common/ThemeSettings.test.jsx
context/CartContext.test.jsx
context/ThemeContext.test.jsx
pages/admin/AdminCoverage.test.jsx
pages/admin/AdminCredit.test.jsx
pages/admin/AdminCustomerDetail.test.jsx
pages/admin/AdminCustomers.test.jsx
pages/admin/AdminDeliveries.test.jsx
pages/admin/AdminExpenses.test.jsx
pages/admin/AdminInventory.test.jsx
pages/admin/AdminOrders.test.jsx
pages/admin/AdminPayments.test.jsx
pages/admin/AdminProducts.test.jsx
pages/admin/AdminSuppliers.test.jsx
pages/auth/ForgotPassword.test.jsx
pages/auth/Login.test.jsx
pages/customer/Cart.test.jsx
pages/customer/OrderDetail.test.jsx
pages/customer/ProductDetail.test.jsx
pages/customer/Products.test.jsx
pages/NotFound.test.jsx
utils/mediaUrl.test.js
utils/timeSlots.test.js
utils/useTimeSlots.test.js
App.test.jsx
```

Coverage includes routing, authentication screens, cart/context behavior, admin
dashboards for orders, payments, credit, customers, products, inventory,
deliveries, expenses, suppliers, coverage, media URL handling, time slots, and
error boundaries.

## Build and lint

- Frontend production build: passed (`vite build`, `✓ built in 5.99s`).
- Lint: no errors. Warnings only for unused imports/variables in
  `AdminProducts.jsx`, `WorkerLayout.jsx`, `WorkerDeliveries.jsx`, and
  `ProductImage.test.jsx`.

## Production readiness checks

Command:

```
npm run verify:prod
```

Result: **GREEN — all production readiness checks passed.**

Verified:

- Frontend reachable: `https://ganeshtrades.vercel.app`
- Backend reachable: `https://ganeshtrades1.onrender.com/api`
- Health endpoint reports `database: connected`, `dbType: atlas`,
  `environment: production`.
- Atlas-backed production database confirmed.
- 10 products present; no demo data detected.
- Google auth configured.
- Frontend bundle targets the production backend.
- OTP service not configured in production; single-database OTP topology is
  acceptable.

Not verified at commit level:

- The live Vercel/Render deployments are reachable, but the exact deployed Git
  commit could not be confirmed because no Vercel/Render CLI, project token, or
  `.vercel/project.json` is available in this environment.

## Reproduction commands

Backend:

```powershell
$env:MONGOMS_SYSTEM_BINARY="$env:LOCALAPPDATA\Temp\opencode\mongod\mongod.exe"
npm test --prefix backend
```

Transaction mode:

```powershell
$env:MONGOMS_SYSTEM_BINARY="$env:LOCALAPPDATA\Temp\opencode\mongod\mongod.exe"
$env:MONGOMS_REPLICA_SET="true"
npm test --prefix backend
```

Frontend:

```powershell
npm test --prefix frontend
npm run build --prefix frontend
```

OTP service:

```powershell
npm test --prefix otp-server
```

Production readiness:

```powershell
npm run verify:prod
```

## Limitations

- Tests use `mongodb-memory-server`; they do not run against the production
  Atlas cluster.
- No end-to-end browser automation suite (Playwright/Cypress) is included.
- No load, stress, or soak testing was performed.
- Real SMS/OTP delivery and real payment-gateway transactions were not exercised
  against live providers.
- Backup restore was not executed against production data.
- Vercel/Render deployed-commit verification remains outstanding without
  dashboard/API access.
- Phase 2+ features (60-day receivables aging, recipe AI) were not approved or
  implemented, so they are not covered.
