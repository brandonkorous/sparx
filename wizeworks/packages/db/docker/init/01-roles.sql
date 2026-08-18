-- Provision the runtime application role used by the Prisma client at request
-- time. `sparx_owner` (the bootstrap superuser created by the Postgres image)
-- owns the schema and runs migrations; `sparx_app` is the unprivileged role
-- whose connections are subject to FORCE ROW LEVEL SECURITY.
--
-- Decision F3 (docs/16-auth-security.md §4): tenant-scoped tables use FORCE
-- RLS so even the table owner cannot bypass policies. `sparx_app` is the only
-- role used by application code; `sparx_owner` is reserved for migrations and
-- DBA-style operations.

CREATE ROLE sparx_app LOGIN PASSWORD 'devpassword' NOBYPASSRLS;

GRANT CONNECT ON DATABASE sparx TO sparx_app;
GRANT USAGE ON SCHEMA public TO sparx_app;

-- Tables created later by migrations are not yet visible here; default
-- privileges ensure every future table grants the same DML rights to sparx_app.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sparx_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO sparx_app;

-- The WizeWorks operator role (docs/apps/admin/build-plan.md §2 D3/D6). Used
-- ONLY by the admin console's Better Auth instance + its wize_admin data helpers
-- — never by tenant app code. NOBYPASSRLS like sparx_app, so even if it were
-- ever granted a public table it could not read across tenants. The `wize_admin`
-- schema + its grants are created by the 20261007000000_wize_admin_operator_schema
-- migration; this just ensures the role exists first (local dev). Prod provisions
-- the same role via Terraform (google_sql_user) before the migration runs.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'wize_operator') THEN
    CREATE ROLE wize_operator LOGIN PASSWORD 'devpassword' NOBYPASSRLS;
  END IF;
END
$$;

GRANT CONNECT ON DATABASE sparx TO wize_operator;
