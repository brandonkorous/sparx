---
title: The customer spine
node: data
type: rule
status: active
sources:
  - wizeworks/packages/db/prisma/schema/20-crm-customers.prisma
  - wizeworks/packages/db/prisma/schema/48-customer-auth.prisma
---

There is **one** customer spine — the CRM `Customer` (`customers`) table. **One table, three types** (`prospect | retail | b2b`); promotion is a column update, not a row migration. Commerce and B2B **FK into this row** — orders, carts, subscriptions, reviews, quotes, deals, activities, tasks, appointments all hang off `Customer`.

- **`CustomerUser`** (`48-customer-auth`) is the Layer-2 shopper login (Better Auth), one per `(tenant, email)`. `Customer.authUserId` points to it — a plain UUID, **not** an enforced FK. A shopper across a tenant's sites = one `CustomerUser` with a per-`propertyId` `Customer` membership each (null `propertyId` = tenant-level CRM contact).
- **`User`** (Layer-1 staff) shares **zero rows** with customers; staff appear on `Customer` only as `assignedRepId` (sales rep).
- Denormalized fast-reads (`totalSpent`, `orderCount`, `first/lastOrderAt`) are written **only** by the order-event consumer, never inline. `mergedIntoCustomerId` is the dedup trail.

**Why:** parallel customer tables per module would fracture identity and dedup.

**How to apply:** need customer data from any module? **FK into `customers`** — never a new customer table. Never write the denormalized columns inline (publish/consume the order event).

Related: [[prisma-schema]], [[better-auth]], [[modules]]
