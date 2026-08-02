# packages/db — database, migrations, RLS

Scoped guidance for `@sparx/db`. Loads when working in this package. See root [CLAUDE.md](../../CLAUDE.md) for cross-cutting rules.

## Migrations go through the pipeline, not your laptop

The managed Postgres has public access **disabled** and lives in the VNet — nothing outside the cluster can reach it. Workflow:

1. Author migrations locally against docker Postgres: `pnpm db:up` + `prisma migrate dev --create-only`, then hand-edit the SQL (RLS is not generated) and **rename the directory** per the rule below.
2. Push to `main`. The **data** stage of [release.yml](../../.github/workflows/release.yml) runs a roles Job, then a K8s Job running `prisma migrate deploy` as the owner role, then the platform seed and the marketplace ingest — all before the containers roll, so new code never meets an old schema or missing rows.

Full flow in [README.md](./README.md#applying-a-migration).

## Migration names must be MONOTONIC — this is the one that bites

**Prisma orders migrations lexicographically by directory name.** Not by mtime, not by git history. The name IS the order, and it is the primary key recorded in `_prisma_migrations` on every database that has applied it.

The timestamp prefixes in this repo are **hand-authored and run about six months ahead of the real clock**: `20270131000000_silica_class_vocabulary` was committed on 2026-07-31. Internally consistent, and fine — until someone runs plain `prisma migrate dev`, which stamps the REAL clock. Today that produces `20260802…`, which sorts **before all 241 applied migrations**. Prisma then sees a never-applied migration sitting earlier in the order than migrations that have run, and:

- `migrate deploy` **refuses** — mid-release, after the roles Job has already gone.
- `migrate dev` locally offers to **reset the database** instead.

**The drift cannot be renamed away.** Renaming the 241 existing directories makes Prisma treat every one as brand-new and re-run it against a schema that already has it. The drift is permanent; the only sound response is to keep going forward:

> A new migration's directory name must sort **after** the newest one that already exists. Take the current maximum and pick a bigger number.

Format is `<14 digits>_<lower_snake_case>`. [scripts/check-migration-order.mjs](../../scripts/check-migration-order.mjs) enforces all of this in CI, and also refuses the **deletion** of a migration directory — every database that applied it still records the name, so removing it fails `migrate deploy` on the mismatch. Reverse a migration with a new migration.

## Two seeds, and only one of them is shippable

`prisma/seed.ts` and `prisma/seed-platform.ts` are different deliverables. Reach
for the right one — they were a single entrypoint until 2026-08-02, and the
coupling is what kept the platform's own catalog out of production entirely.

| entrypoint                                          | what it writes                                                                                                                      | where it runs                                                  |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `pnpm db:seed` → `prisma/seed.ts`                   | a **demo tenant** (`e2e-staff@sparx.test`) — parts catalog, orders, bookings, a partner payout — then calls the platform data below | laptops + CI only. **Never** production: it invents a business |
| `pnpm db:seed:platform` → `prisma/seed-platform.ts` | platform data ONLY: sparx-core marketplace catalog, global `platform_components`, starter legal pages                               | stage 2 (data) of every release, as an in-cluster Job          |

Both call `seedPlatformData()` in [prisma/platform-seed.ts](./prisma/platform-seed.ts); the ONLY difference is `tolerateFailures`. Local dev tolerates (a catalog hiccup must not block a developer's demo data); the release does not, so a failure stops it **before** the containers roll. Swallowing errors is precisely how "the seed ran green" and "the catalog is empty" were both true.

Anything added to `platform-seed.ts` must be **idempotent** (upsert or find-or-create on a stable natural key) and **tenant-safe** (creates no tenants, invents no business data) — it runs on every release, unattended.

Bundle-backed marketplace listings (`marketplace-catalog/**`, docs/85) are NOT seeded; they are published by the marketplace ingest, which runs in the same `data` stage from the api-rest image. Re-publishing without a release is [ops.yml](../../.github/workflows/ops.yml) `marketplace-ingest`.

## RLS is hand-edited, not Prisma-generated

Multi-tenancy is enforced at the DB level via PostgreSQL **Row Level Security**. Every tenant-scoped table has `tenant_id`; RLS policies are the backstop against application bugs. Application-tier filtering is **not** sufficient on its own.

Prisma does not generate RLS or `current_tenant_id()` — hand-edit the migration SQL:

- Tenant-scoped tables: `ENABLE` + `FORCE` RLS + a `tenant_isolation` policy.
- Auth tables (`users`, `sessions`, `accounts`): `ENABLE`-only, **not** `FORCE`.
- **Backfilling a FORCE-RLS table inside a migration** must loop tenants and `set_config('app.tenant_id', …)` per tenant — `sparx_owner` is a **non-superuser** in prod and sees 0 rows otherwise. This passes locally (superuser) but fails in prod with a `23502` not-null violation. (See memory `feedback_sparx_db_rls_pattern`.)

## Tenant vs. Site/Property naming

`Tenant.name` = the tenant's **legal/org name** — billing/ownership only, **never** rendered to a customer or sent in a customer email. `Property.name` = the **customer-facing site name** that storefront chrome/title/OG and email wordmark/footer/`{{site.name}}` read (a tenant HAS sites; the primary site's name is seeded from the tenant name at provisioning, but render/send paths read the site, never the tenant — docs/49). `tenant_brands.business_name` is **deprecated as a name source** (kept only for brand/document rendering like invoices). The active→primary site name resolves via `resolveActivePropertyName` (api-rest `lib/property.ts`).

## Global tables (platform-scoped, no tenant_id)

Most tables are per-tenant and use the standard FORCE RLS + `tenant_isolation` pattern (`current_tenant_id()`). A small number of tables are **global** — shared across all tenants:

| Table                 | Purpose                    | RLS approach                                                                                                      |
| --------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `platform_components` | Platform component catalog | SELECT published → `sparx_app`; ALL → `sparx_owner`; API layer gates non-published reads + writes to `owner` role |

For a global table: ENABLE + FORCE RLS, two policies — one for the app role (restrictive, e.g. `status = 'published'`), one for the owner/migration role (unrestricted). The platform-admin JWT tier (docs/16 §2.4, deferred) will extend this pattern when it ships.
