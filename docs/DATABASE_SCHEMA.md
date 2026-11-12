# Ganesh Trades — Database Schema

Database: MongoDB (Atlas in production, local MongoDB for development).
ODM: Mongoose 8.

## Collections overview

```
User ──< Order ──< Payment
 │        │
 │        ├──< Delivery >── StaffProfile (assignedWorker)
 │        └──< Review >── Product
 │
 ├──< Settlement ──< CreditTransaction
 ├──< StaffProfile >── DeliveryPartner
 └──< Notification

Supplier ──< PurchaseOrder ──< SupplierPayment
Expense, Settings, Otp, AuditLog, Backup, Counter
```

## Financial model

Two disjoint customer balances are maintained on `User`:

- `pendingAmount` — unpaid cash/UPI debt for non-credit orders.
- `creditBalance` — unpaid Khata credit debt for `paymentMethod: credit` orders.

Each order books exactly one of these fields, so total outstanding is
`pendingAmount + creditBalance` without double counting.

Source of truth for payment state:

- `Payment` rows with `paymentStatus: completed`.
- `Settlement` rows (Khata payments), with per-order `allocations`.

`Order.paymentStatus` is derived by `recomputeOrderPaymentStatus` from completed
payments plus settlement allocations. Settlement allocation is FIFO (oldest
outstanding order first). Cancellation restores stock and reverses only the
still-owed portion of the cancelled order.

Transaction behavior:

- When the MongoDB deployment supports transactions (replica set / Atlas),
  financial mutations run inside `withTransaction`.
- On standalone MongoDB, the code falls back to non-transactional writes.
- Ledger inconsistencies are detected and surfaced as HTTP `409` rather than
  being silently clamped.

## User

Collection: `users`

| Field | Type | Notes |
| --- | --- | --- |
| `name` | String, required, max 100 | |
| `mobile` | String, unique, sparse | Indian 10-digit format `^[6-9]\d{9}$`; required unless Google auth. |
| `email` | String, unique, sparse, lowercase | |
| `password` | String, min 8, `select: false` | bcrypt hash (cost 12); required unless Google auth. |
| `googleId` | String, unique, sparse | |
| `authProvider` | String | `local` (default) or `google`. |
| `address` | Object | `street`, `area`, `city` (default `Local`), `pincode`, `lat`, `lng`. |
| `distanceFromShop` | Number | Default 0. |
| `customerType` | String | `public` (default), `hotel`, `pg_hostel`. |
| `role` | String | `customer` (default), `admin`, `manager`, `staff`. |
| `isActive` | Boolean | Default true. |
| `avatar` | String | |
| `totalOrders` | Number | Default 0. |
| `totalSpent` | Number | Default 0. |
| `pendingAmount` | Number | Default 0; cash/UPI debt. |
| `creditLimit` | Number | Default 0. |
| `creditBalance` | Number | Default 0; Khata debt. |
| `loginAttempts` | Number | Default 0. |
| `lockUntil` | Date | Account lockout. |
| `isEmailVerified` | Boolean | Default false. |
| `emailVerificationToken` / `emailVerificationExpires` | String / Date | |
| `passwordResetToken` / `passwordResetExpires` | String / Date | |

Indexes:

- `{ role: 1, isActive: 1 }`
- `{ customerType: 1, createdAt: -1 }`
- `{ pendingAmount: -1 }`
- Unique sparse indexes on `mobile`, `email`, `googleId`.

Hooks: password is bcrypt-hashed before save when modified.

## Product

Collection: `products`

| Field | Type | Notes |
| --- | --- | --- |
| `name` | String, required, max 200 | |
| `description` | String, max 1000 | |
| `category` | String, required, enum | `rice_grains`, `dal_pulses`, `spices`, `oil_ghee`, `flour`, `sugar_jaggery`, `tea_coffee`, `snacks`, `beverages`, `dairy`, `fruits`, `vegetables`, `dry_fruits`, `cleaning`, `personal_care`, `packaged_food`, `bakery`, `frozen`, `other`. |
| `image` | String | Primary image URL (legacy/compat). |
| `images` | [String] | Image URLs. |
| `imageMetadata` | Array | `url`, `public_id`, `fileId`, `storageProvider` (`cloudinary`, `gridfs`, `local`), dimensions, mime type, size, `isPrimary`. |
| `isFeatured` | Boolean | Default false. |
| `price` | Number, required, min 0 | |
| `wholesalePrice` | Number, min 0 | |
| `unit` | String | `kg`, `g`, `l`, `ml`, `piece`, `packet`, `dozen`, `box`; default `kg`. |
| `stock` | Number, required, min 0 | |
| `minStock` | Number | Default 10. |
| `status` | String | `active`, `inactive`, `out_of_stock`; auto-managed from stock. |
| `brand` | String | |
| `sku` | String, unique, sparse | |
| `totalSold` | Number | Default 0. |
| `avgRating` | Number | Default 0. |
| `reviewCount` | Number | Default 0. |
| `expiryDate` | Date | |

Indexes:

- Text index: `{ name: "text", description: "text", category: "text" }`
- Unique sparse index on `sku`.

Hook: `status` becomes `out_of_stock` when stock is 0 and returns to `active`
when stock becomes positive.

## Order

Collection: `orders`

| Field | Type | Notes |
| --- | --- | --- |
| `orderNumber` | String, unique | Atomic `GT{YYYYMM}{00001}` counter. |
| `user` | ObjectId → User, required | |
| `items` | Array | `product` (→ Product), `name`, `price`, `quantity` (min 1), `total`. |
| `totalAmount` | Number, required, min 0 | |
| `discount` | Number | Default 0. |
| `deliveryCharge` | Number | Default 0. |
| `finalAmount` | Number, required | |
| `orderStatus` | String | `pending` (default), `confirmed`, `processing`, `out_for_delivery`, `delivered`, `cancelled`. |
| `paymentStatus` | String | `pending` (default), `partial`, `paid`, `refunded`. |
| `paymentMethod` | String | `cash` (default), `upi`, `card`, `credit`, `bank_transfer`. |
| `deliveryAddress` | Object | `street`, `area`, `city`, `pincode`, `lat`, `lng`. |
| `distanceFromShop` | Number | Default 0. |
| `deliveryType` | String | `instant` (default) or `scheduled`. |
| `scheduledDelivery` | Object | `date`, `timeSlot`, `scheduledAt`, `rescheduledAt`, `rescheduledBy`, `originalDate`, `originalTimeSlot`. |
| `estimatedDeliveryTime` | Date | |
| `deliveryDate` / `deliveredAt` | Date | |
| `notes` | String | |
| `cancelReason` | String | |
| `statusHistory` | Array | `status`, `timestamp`, `note`. |

Virtual: `isDeliveryLate` — true for scheduled, non-terminal orders past the
scheduled date.

Indexes:

- `{ user: 1, createdAt: -1 }`
- `{ orderStatus: 1, createdAt: -1 }`
- `{ paymentStatus: 1 }`
- `{ deliveryType: 1, "scheduledDelivery.date": 1, orderStatus: 1 }`
- `{ createdAt: -1 }`

Time slots: `8 AM - 10 AM`, `10 AM - 12 PM`, `12 PM - 2 PM`, `2 PM - 4 PM`,
`4 PM - 6 PM`, `6 PM - 8 PM`, `8 PM - 10 PM`.

## Payment

Collection: `payments`

| Field | Type | Notes |
| --- | --- | --- |
| `user` | ObjectId → User, required | |
| `order` | ObjectId → Order, required | |
| `amount` | Number, required, min 1 | |
| `paymentMethod` | String, required | `cash`, `upi`, `card`, `credit`, `bank_transfer`. |
| `paymentStatus` | String | `pending` (default), `completed`, `failed`, `refunded`. |
| `transactionId` | String | |
| `gatewayOrderId` / `gatewayPaymentId` / `gatewaySignature` | String | Gateway integration. |
| `paymentMode` | String | `upi`, `debit_card`, `credit_card`, `net_banking`, `cash`, `credit`, `wallet`; default `cash`. |
| `notes` | String | Worker idempotency uses `idem:<key>`. |
| `receivedBy` | ObjectId → User | |

Indexes:

- `{ order: 1, paymentStatus: 1 }`
- `{ user: 1, createdAt: -1 }`
- `{ gatewayOrderId: 1 }` (sparse)

## Settlement

Collection: `settlements`

| Field | Type | Notes |
| --- | --- | --- |
| `user` | ObjectId → User, required | Customer receiving Khata payment. |
| `amount` | Number, required, min 1 | |
| `paymentMethod` | String, required | `cash`, `upi`, `bank_transfer`, `cheque`. |
| `referenceNumber` | String | |
| `status` | String | `pending`, `completed` (default), `failed`. |
| `notes` | String | |
| `allocations` | Array | `{ order: ObjectId → Order, amount: Number }`; FIFO attribution. |
| `processedBy` | ObjectId → User | |

Allocation allows aging and cancellation reversal to identify exactly which
invoice a settlement paid.

## CreditTransaction

Collection: `credittransactions`

| Field | Type | Notes |
| --- | --- | --- |
| `user` | ObjectId → User, required | |
| `amount` | Number, required, min 1 | |
| `type` | String, required | `credit` (balance reduced) or `debit` (customer owes more). |
| `referenceOrder` | ObjectId → Order | |
| `referenceSettlement` | ObjectId → Settlement | |
| `description` | String | |
| `loggedBy` | ObjectId → User | |

## Delivery

Collection: `deliveries`

| Field | Type | Notes |
| --- | --- | --- |
| `order` | ObjectId → Order, required, unique | One delivery per order. |
| `deliveryPersonName` | String, required | Legacy free-text rider name. |
| `deliveryPersonMobile` | String, required | Indian mobile format. |
| `status` | String | `assigned` (default), `picked_up`, `on_the_way`, `delivered`, `failed`. |
| `location` | String | |
| `notes` | String | |
| `history` | Array | `status`, `timestamp`, `note`. |
| `assignedBy` | ObjectId → User, required | |
| `assignedWorker` | ObjectId → User | Staff user performing delivery. |
| `failureReason` | String, max 500 | Required for `failed`. |
| `proofUrl` | String, max 1000 | Photo/signature proof. |
| `paymentIdempotencyKey` | String, sparse | Cash collection idempotency. |

## StaffProfile

Collection: `staffprofiles`

| Field | Type | Notes |
| --- | --- | --- |
| `user` | ObjectId → User, required, unique | One profile per user. |
| `category` | String, required | `shop`, `delivery`, `hybrid`; default `delivery`. |
| `engagementType` | String, required | `internal` (default) or `external`. |
| `partnerOrg` | ObjectId → DeliveryPartner | Required for external staff. |
| `employeeId` | String, max 50 | |
| `designation` | String, max 100 | |
| `joiningDate` | Date | |
| `isActive` | Boolean | Default true; independent of `User.isActive`. |
| `createdBy` | ObjectId → User, required | |
| `updatedBy` | ObjectId → User | |
| `notes` | String, max 500 | |

Indexes:

- `{ category: 1, isActive: 1 }`
- `{ engagementType: 1, isActive: 1 }`
- `{ partnerOrg: 1 }`

## DeliveryPartner

Collection: `deliverypartners`

| Field | Type | Notes |
| --- | --- | --- |
| `name` | String, required, max 150 | |
| `contactPerson` | String, max 100 | |
| `mobile` | String | Indian mobile format. |
| `email` | String | Lowercase. |
| `address` | String, max 300 | |
| `isActive` | Boolean | Default true; controls new assignments. |
| `notes` | String, max 500 | |
| `createdBy` | ObjectId → User, required | |

Indexes: `{ isActive: 1 }`, `{ name: 1 }`.

## Supplier

Collection: `suppliers`

| Field | Type | Notes |
| --- | --- | --- |
| `name` | String, required | |
| `contactPerson` | String | |
| `mobile` | String, required | Indian mobile format. |
| `email` | String | |
| `gstNumber` | String | |
| `address` | Object | `street`, `area`, `city`, `state`, `pincode`. |
| `balance` | Number | Default 0; amount the shop owes. |
| `status` | String | `active` (default), `inactive`. |

## PurchaseOrder

Collection: `purchaseorders`

| Field | Type | Notes |
| --- | --- | --- |
| `poNumber` | String, unique | Atomic `PO{YYYYMM}{00001}` counter; seeded from the highest existing number. |
| `supplier` | ObjectId → Supplier, required | |
| `items` | Array | `product` (→ Product), `name`, `quantity` (min 1), `unitPrice` (min 0), `total`. |
| `totalAmount` | Number, required, min 0 | |
| `status` | String | `pending` (default), `approved`, `received`, `cancelled`. |
| `paymentStatus` | String | `unpaid` (default), `partial`, `paid`. |
| `expectedDelivery` | Date | |
| `receivedAt` | Date | |
| `notes` | String | |
| `createdBy` | ObjectId → User, required | |

## SupplierPayment

Collection: `supplierpayments`

| Field | Type | Notes |
| --- | --- | --- |
| `supplier` | ObjectId → Supplier, required | |
| `purchaseOrder` | ObjectId → PurchaseOrder | Optional link. |
| `amount` | Number, required, min 1 | |
| `paymentMethod` | String, required | `cash`, `bank_transfer`, `cheque`, `upi`. |
| `referenceNumber` | String | |
| `paymentDate` | Date | Default now. |
| `notes` | String | |
| `processedBy` | ObjectId → User | |

## Expense

Collection: `expenses`

| Field | Type | Notes |
| --- | --- | --- |
| `category` | String, required | `electricity`, `salary`, `transport`, `maintenance`, `miscellaneous`, `supplies`. |
| `amount` | Number, required, min 0 | |
| `date` | Date | Default now. |
| `description` | String, required | |
| `receiptUrl` | String | |
| `loggedBy` | ObjectId → User, required | |

## Review

Collection: `reviews`

| Field | Type | Notes |
| --- | --- | --- |
| `user` | ObjectId → User, required | |
| `product` | ObjectId → Product, required | |
| `rating` | Number, required, 1–5 | |
| `comment` | String, max 500 | |
| `status` | String | `pending` (default), `approved`, `rejected`. |
| `isApproved` | Boolean | Legacy compatibility field; default true. |
| `adminResponse` | String, max 500 | |
| `helpfulCount` | Number | Default 0. |

Index: unique `{ user: 1, product: 1 }`.

Hooks recalculate `Product.avgRating` and `reviewCount` after save, update, and
delete. Only approved reviews count.

## Notification

Collection: `notifications`

| Field | Type | Notes |
| --- | --- | --- |
| `title` | String, required | |
| `message` | String, required | |
| `type` | String | `order`, `payment`, `stock`, `general` (default), `system`, `promotion`, `delivery`, `new_product`, `payment_reminder`. |
| `priority` | String | `low`, `normal` (default), `high`. |
| `recipient` | ObjectId → User | Targeted notification. |
| `recipientRole` | String | `customer`, `admin`, `manager`, `all`; broadcast. |
| `isRead` | Boolean | Default false; used for targeted notifications. |
| `readBy` | [ObjectId → User] | Per-user read receipts for broadcasts. |
| `link` | String | |
| `metadata` | Mixed | |

Indexes:

- `{ recipient: 1, isRead: 1, createdAt: -1 }`
- `{ recipientRole: 1, isRead: 1 }`
- `{ recipientRole: 1, readBy: 1 }`

## Settings

Collection: `settings`

| Field | Type | Default |
| --- | --- | --- |
| `shopName` | String | `Ganesh Trades` |
| `shopAddress` | String | `HW4C+XJ Pune, Maharashtra, India` |
| `shopPlusCode` | String | `HW4C+XJ` |
| `shopLocation.lat` | Number, required | `18.557473097373734` |
| `shopLocation.lng` | Number, required | `73.92156518195121` |
| `deliveryRadiusKm` | Number, required, 1–100 | `15` |
| `deliveryFeePerKm` | Number | `0` |
| `freeDeliveryWithinKm` | Number | `5` |
| `isDeliveryRestrictionActive` | Boolean | `true` |

## Otp

Collection: `otps`

| Field | Type | Notes |
| --- | --- | --- |
| `mobile` | String, required | Indian mobile format. |
| `otp` | String, required | Hash (with `salt`). |
| `salt` | String | |
| `purpose` | String, required | `register`, `login`, `password_reset`, `email_verify`. |
| `verified` | Boolean | Default false. |
| `attempts` | Number | Default 0. |
| `expiresAt` | Date, required, TTL index | MongoDB auto-deletes expired documents. |

Index: `{ mobile: 1, purpose: 1 }`.

## AuditLog

Collection: `auditlogs`

| Field | Type | Notes |
| --- | --- | --- |
| `user` | ObjectId → User | Actor. |
| `action` | String, required, enum | Includes auth, user, product, order, payment, stock/price, review, settings, export, settlement, delivery, supplier, PO, expense, password reset, image/import, staff/partner, and worker actions. |
| `entity` | String, enum | `user`, `product`, `order`, `payment`, `review`, `notification`, `settings`, `settlement`, `delivery`, `supplier`, `purchase_order`, `supplier_payment`, `expense`, `staff_profile`, `delivery_partner`. |
| `entityId` | ObjectId | |
| `details` | Mixed | |
| `ipAddress` / `userAgent` | String | |

## Backup

Collection: `backups`

| Field | Type | Notes |
| --- | --- | --- |
| `filename` | String, required | |
| `type` | String, required | `manual`, `daily`, `weekly`, `monthly`. |
| `status` | String | `pending`, `completed`, `failed`. |
| `size` | Number | Default 0. |
| `error` | String | |

## Counter

Collection: `counters`

| Field | Type | Notes |
| --- | --- | --- |
| `_id` | String | Prefix, e.g. `GT202611` or `PO202611`. |
| `seq` | Number | Default 0. |

Used for atomic order and purchase-order number generation.

## Operational notes

- `.env` files are never committed; only `.env.example` is tracked.
- Production uses MongoDB Atlas; health checks report `dbType: atlas`.
- Tests use `mongodb-memory-server`; set `MONGOMS_REPLICA_SET=true` to exercise
  transaction paths.
- Backups are listed in the `backups` collection; restore is admin-only and
  destructive.
