# packages/db — database, migrations, RLS

Scoped guidance for `@sparx/db`. Loads when working in this package. See root [CLAUDE.md](../../CLAUDE.md) for cross-cutting rules.

## Migrations go through the pipeline, not your laptop

The Cloud SQL instance is **private-IP only** — the Auth Proxy from a local machine cannot reach it. Workflow:

1. Author migrations locally against docker Postgres: `pnpm db:up` + `prisma migrate dev`.
2. Push to `main`. The [DB Migrate workflow](../../.github/workflows/db-migrate.yml) builds a runner image, applies a K8s Job in `sparx-prod`, and runs `prisma migrate deploy` via the Cloud SQL Auth Proxy sidecar.
3. Re-seed with `gh workflow run db-migrate.yml -f run_seed=true`.

Full flow in [README.md](./README.md#applying-a-migration).

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

| Table | Purpose | RLS approach |
|---|---|---|
| `platform_components` | Platform component catalog | SELECT published → `sparx_app`; ALL → `sparx_owner`; API layer gates non-published reads + writes to `owner` role |

For a global table: ENABLE + FORCE RLS, two policies — one for the app role (restrictive, e.g. `status = 'published'`), one for the owner/migration role (unrestricted). The platform-admin JWT tier (docs/16 §2.4, deferred) will extend this pattern when it ships.
