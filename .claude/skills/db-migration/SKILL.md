---
name: db-migration
description: Author and ship a Prisma schema migration for Sparx end-to-end — local authoring against docker Postgres, hand-edited RLS SQL, and the Cloud SQL pipeline. Use whenever adding/altering a table, column, index, or enum in wizeworks/packages/db, or when a task needs `prisma migrate`. Encodes the private-IP pipeline and the FORCE-RLS backfill footgun that fails only in prod.
---

# Ship a Sparx DB migration

The Cloud SQL instance is **private-IP only** — you cannot `prisma migrate deploy` from a laptop. Author locally, push to `main`, let the pipeline apply it.

## 1. Author locally

```bash
pnpm db:up                      # docker Postgres
pnpm --filter @wizeworks/db exec prisma migrate dev --name <change>
```

Edit `wizeworks/packages/db/prisma/schema.prisma`, then re-run `migrate dev`. This writes `wizeworks/packages/db/prisma/migrations/<ts>_<change>/migration.sql`.

## 2. Hand-edit the SQL for RLS — Prisma does NOT generate it

For every **new tenant-scoped table** (has `tenant_id`), append to the generated `migration.sql`:

```sql
ALTER TABLE "<table>" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "<table>" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "<table>"
  USING ("tenant_id" = current_tenant_id());
```

- **Auth tables** (`users`, `sessions`, `accounts`) get `ENABLE` only — **never** `FORCE`.
- **Backfill footgun:** if the migration backfills data into a FORCE-RLS table, you MUST loop tenants and `set_config('app.tenant_id', <id>, false)` before each write. `sparx_owner` is a **non-superuser in prod** and sees 0 rows otherwise — the migration passes locally (superuser) but fails in prod with `23502`. Pattern:

```sql
DO $$
DECLARE t RECORD;
BEGIN
  FOR t IN SELECT id FROM tenants LOOP
    PERFORM set_config('app.tenant_id', t.id::text, false);
    -- backfill writes here, scoped to t.id
  END LOOP;
END $$;
```

## 3. Verify no Prisma drift

```bash
pnpm --filter @wizeworks/db exec prisma migrate status
pnpm --filter @wizeworks/db exec prisma validate
```

Partial/conditional unique indexes (e.g. `WHERE is_active`) are hand-SQL too — confirm `prisma migrate diff` shows no drift after adding them.

## 4. Gate + push (this triggers the pipeline)

```bash
pnpm format && pnpm lint && pnpm typecheck
git add -A && git commit -m "feat(db): <change>"
git push
```

The [DB Migrate workflow](../../../.github/workflows/db-migrate.yml) builds a runner image, applies a K8s Job in `sparx-prod`, and runs `prisma migrate deploy` via the Cloud SQL Auth Proxy sidecar. Re-seed with `gh workflow run db-migrate.yml -f run_seed=true`.

Never run `prisma migrate deploy` against prod directly, and never `kubectl apply` a migration Job by hand.
