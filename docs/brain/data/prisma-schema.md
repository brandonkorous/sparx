---
title: The Prisma schema
node: data
type: reference
status: active
sources:
  - wizeworks/packages/db/prisma/schema/
  - wizeworks/packages/db/CLAUDE.md
---

A **split multi-file** Prisma schema in `wizeworks/packages/db/prisma/schema/` — **85 numbered `.prisma` files** (`01-config` … `84-bootcamps`), **not** a single `schema.prisma`. **277 models**, numbered by domain: 02 tenant, 03 auth, 05 api-keys, 07 tenant-brand, 08 property, 09 domain, 10–16 CMS, 20–32 CRM, 30–47 commerce, 34–40/66 inventory, 48 customer-auth, 49 sitebuilder, 50 email, 51 builder, 60–64 B2B, 65 dropship, 68 marketplace, 71 automation, 72–74 invoicing/billing/payments, 78 scheduling, 82 ai, 83 partners, 84 bootcamps. Seed is `seed.ts` (~132 KB).

**Why it matters:** this is a **large, shipping** schema — the root CLAUDE.md "early scaffold / empty" framing is stale ([[claude-md-drifted]]). Find a model by its domain number.

**How to apply:** add models to the right numbered domain file; author migrations via [[migration-pipeline]] — never `generate`/`db push` against the shared docker DB.

Related: [[customer-spine]], [[migration-pipeline]]
