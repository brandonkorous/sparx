---
title: The migration pipeline (+ FORCE-RLS footgun)
node: data
type: pattern
status: active
sources:
  - packages/db/CLAUDE.md
  - .github/workflows/db-migrate.yml
---

Cloud SQL is **private-IP only** — you cannot migrate from a laptop. Author locally against docker Postgres (`pnpm db:up` + `prisma migrate dev`), push to `main`; the **DB Migrate workflow** applies it: WIF auth (no SA key) → build `db-migrate` image → GKE creds via Connect Gateway → a **K8s Job in `sparx-prod`** runs `prisma migrate deploy` through the Cloud SQL Auth Proxy sidecar. RLS / `current_tenant_id()` are **hand-edited SQL**, never Prisma-generated. Re-seed via `-f run_seed=true`; clear a failed migration via `-f resolve_migration=<dir>`.

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
