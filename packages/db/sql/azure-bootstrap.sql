-- Azure bootstrap — Postgres roles and grants for the sparx database on
-- Azure Database for PostgreSQL Flexible Server.
--
-- The Azure sibling of cloud-sql-bootstrap.sql, with one important difference.
-- On Cloud SQL the `sparx_app` and `wize_operator` roles were created out-of-band
-- by `gcloud sql users create`, so that script only had to wire up GRANTs. Azure
-- has no equivalent provisioning step — Terraform creates the ADMIN login and
-- nothing else — so this script must CREATE the roles as well.
--
-- It is also the only automated path to those roles at all:
--   * packages/db/docker/init/01-roles.sql is a DOCKER IMAGE ENTRYPOINT
--     convention (/docker-entrypoint-initdb.d). A managed server never runs it.
--   * The server is VNet-private, so it cannot be reached from a laptop either.
-- Hence: run as an in-cluster Job. See .github/workflows/deploy-azure.yml.
--
-- Run as the admin login (`sparx_owner`) BEFORE migrations. Fully idempotent —
-- every statement is guarded or REVOKE-then-GRANT — so the deploy workflow runs
-- it on every deploy without special-casing the first one.
--
-- Requires a psql variable for the application password, so no credential is
-- ever written into this file:
--     psql "$AUTH_DATABASE_URL" -v app_password="$SPARX_APP_PASSWORD" \
--          -v ON_ERROR_STOP=1 -f azure-bootstrap.sql

\if :{?app_password}
\else
    \echo 'FATAL: -v app_password=... is required'
    \quit 1
\endif

-- ---------------------------------------------------------------------------
-- Roles
--
-- NOBYPASSRLS is the point of `sparx_app`. Tenant-scoped tables use FORCE ROW
-- LEVEL SECURITY (docs/16 §4, decision F3) so that even the table owner cannot
-- read across tenants; the application connects as this role precisely so the
-- database is the backstop when application-tier filtering has a bug.
--
-- The password is ALTERed on every run, not just at creation. That makes
-- rotation a matter of changing the secret and redeploying, rather than a
-- manual psql session against a private server.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sparx_app') THEN
        CREATE ROLE sparx_app LOGIN NOBYPASSRLS;
    END IF;
END
$$;

ALTER ROLE sparx_app WITH LOGIN NOBYPASSRLS PASSWORD :'app_password';

-- The WizeWorks operator role (docs/apps/admin/build-plan.md §2 D3/D6). Used
-- only by the admin console's Better Auth instance and its wize_admin helpers,
-- never by tenant app code. NOBYPASSRLS for the same reason as above: even if it
-- were ever granted a tenant table, it could not read across tenants.
--
-- The `wize_admin` schema and its grants come from the
-- 20261007000000_wize_admin_operator_schema migration; this only guarantees the
-- role exists first, since that migration references it.
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'wize_operator') THEN
        CREATE ROLE wize_operator LOGIN NOBYPASSRLS;
    END IF;
END
$$;

ALTER ROLE wize_operator WITH LOGIN NOBYPASSRLS PASSWORD :'app_password';

-- ---------------------------------------------------------------------------
-- Grants — identical in intent to cloud-sql-bootstrap.sql.
-- ---------------------------------------------------------------------------

-- Azure, like Cloud SQL, lets PUBLIC create objects in `public` by default.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

GRANT CONNECT ON DATABASE sparx TO sparx_app;
GRANT USAGE ON SCHEMA public TO sparx_app;
GRANT CONNECT ON DATABASE sparx TO wize_operator;
GRANT USAGE ON SCHEMA public TO wize_operator;

-- Default privileges apply only to objects created LATER by the role named in
-- FOR ROLE. Migrations run as the admin login, so the defaults must be set on
-- objects IT creates — those are the tables and sequences the app will use.
--
-- NOTE: on Azure the admin login is `sparx_owner` because Terraform names it
-- that (administrator_login), which keeps this identical to the Cloud SQL
-- script. If that ever changes, this FOR ROLE must change with it or the app
-- silently loses access to every table created after the change.
ALTER DEFAULT PRIVILEGES FOR ROLE sparx_owner IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sparx_app;
ALTER DEFAULT PRIVILEGES FOR ROLE sparx_owner IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO sparx_app;
ALTER DEFAULT PRIVILEGES FOR ROLE sparx_owner IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO sparx_app;

-- Belt-and-braces for anything that already exists — e.g. a re-run after a
-- partially-failed first attempt. No-op on a fresh database.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sparx_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sparx_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO sparx_app;
