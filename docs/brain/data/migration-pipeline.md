---
title: The migration pipeline (+ FORCE-RLS footgun)
node: data
type: pattern
status: active
sources:
  - packages/db/CLAUDE.md
  - .github/workflows/release.yml
  - scripts/check-migration-order.mjs
---

The managed Postgres has public access **disabled** and lives in the VNet — you cannot migrate from a laptop. Author locally against docker Postgres (`pnpm db:up` + `prisma migrate dev --create-only`), hand-edit the SQL, push to `main`. **Stage 2 (data) of [[deploy-workflows]]** applies it: OIDC auth (no stored credential) → cluster creds → a roles Job (`sql/azure-bootstrap.sql`, idempotent, CREATEs as well as GRANTs) → a **K8s Job** running `prisma migrate deploy` as the OWNER role → the platform seed → the marketplace ingest. All of it runs **before the containers roll**, so new code never meets an old schema or missing rows.

RLS / `current_tenant_id()` are **hand-edited SQL**, never Prisma-generated.

## ⚠️ Migration names must be MONOTONIC

Prisma orders migrations **lexicographically by directory name**, and that name is the key recorded in `_prisma_migrations`. This repo's prefixes are hand-authored and run ~6 months **ahead** of the real clock (`20270131…` was committed 2026-07-31), so plain `prisma migrate dev` stamps a name that sorts **before** all 241 applied migrations — `migrate deploy` then refuses, mid-release, after the roles Job has run.

The drift **cannot be renamed away**: renaming makes Prisma treat 241 applied migrations as new. A new migration must simply sort after the newest existing one. Deleting a migration directory is equally broken — every database still records the name. [scripts/check-migration-order.mjs](../../../scripts/check-migration-order.mjs) enforces both in CI.

## ⚠️ The FORCE-RLS backfill footgun (fails only in prod)

When a migration backfills a **FORCE-RLS** table, it MUST loop tenants and set the GUC per tenant — because `sparx_owner` is a **non-superuser in prod** and FORCE RLS applies to owners, so with no GUC set it sees **0 rows**. It **passes locally** (dev runs as superuser, which bypasses RLS) but **fails in prod** with `23502` NOT-NULL on the new column.

```sql
FOR t IN SELECT id FROM "tenants" LOOP
  PERFORM set_config('app.tenant_id', t.id::text, true);
  -- backfill this tenant's rows
END LOOP;
PERFORM set_config('app.tenant_id', '', true);
```

"It passed locally" proves nothing for an RLS-table backfill. Use the `db-migration` skill; logged in [[lessons-learned]].

Related: [[rls-multi-tenancy]], [[prisma-schema]], [[infrastructure]]
