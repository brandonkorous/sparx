---
title: RLS multi-tenancy
node: architecture
type: rule
status: active
sources:
  - packages/db/src/tenant-context.ts
  - packages/db/prisma/migrations/20260527000100_rls/migration.sql
  - packages/db/CLAUDE.md
---

Multi-tenancy is enforced at the **database** via Postgres Row Level Security — the backstop against application bugs. App-tier `where: { tenantId }` is **not** sufficient.

- `current_tenant_id()` = `NULLIF(current_setting('app.tenant_id', true), '')::UUID` — unset GUC → NULL → **zero rows** (fail-closed).
- Tenant tables get `ENABLE` + **`FORCE` RLS** + a `tenant_isolation` policy (`USING (tenant_id = current_tenant_id())`). FORCE applies to the table owner too.
- **Runtime:** wrap every tenant handler in `withTenant({ tenantId, userId }, fn)` (`packages/db/src/tenant-context.ts`) — it opens a `$transaction`, runs `SET LOCAL app.tenant_id = '<uuid>'`, and pins the query to that connection. Tenant id is request-scoped via `AsyncLocalStorage` (`tenant-store.ts`).
- `withSystem()` clears the GUC for genuine globals (e.g. marketplace catalog) — **not** a tenant-isolation bypass.
- **Global (no-RLS) tables:** `tenants` (dispatch table, read before context exists) and `verifications`. Auth `sessions`/`accounts` key on `user_id = current_user_id()`, not tenant. Customer-auth stamps tenant via `@default(dbgenerated("current_tenant_id()"))` (Better Auth is tenant-oblivious).
- The UUID string-interpolation in `withTenant` (Postgres forbids placeholders in `SET LOCAL`) is the **only** sanctioned raw-SQL interpolation, guarded by `assertUuid`.

**Why:** one missed app-tier filter would leak across tenants; RLS makes the DB itself refuse.

**How to apply:** never touch tenant data outside `withTenant`. Schema-authoring + the backfill footgun live in [[migration-pipeline]].

Related: [[better-auth]], [[migration-pipeline]], [[customer-spine]]
