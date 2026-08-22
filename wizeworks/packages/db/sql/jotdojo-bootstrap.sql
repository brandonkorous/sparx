-- jotDOJO bootstrap — the ONE role sparx must create on behalf of another
-- product, and the reason the boundary falls exactly here.
--
-- jotDOJO lives in its own repository, its own namespace, its own database and
-- its own pipeline. It creates its own roles: `jotdojo_worker` in 0000_init.sql,
-- `jotdojo_app` in 0001_app_role.sql. This file creates neither of those, and
-- adding them here would be taking work that is properly jotDOJO's.
--
-- What jotDOJO CANNOT create for itself is an OWNER, and that is a fact about
-- Postgres rather than a policy choice. Its migrations must already be connected
-- as something that owns the database before they can run at all. On Azure
-- Flexible Server a database is owned by the SERVER ADMIN unless something says
-- otherwise, and this server's only admin is `sparx_owner` — so without this
-- script jotDOJO's DATABASE-ADMIN-URL would have to BE the sparx server admin.
--
-- That credential opens the `sparx` and `piggles` databases exactly as readily
-- as it opens `jotdojo`, and it would sit in a Kubernetes Secret in the
-- `jotdojo` namespace where anything holding `get secrets` could read it. The
-- migrations are not the threat. The blast radius around them is.
--
-- So sparx mints one role, hands the database to it, and stops. Sparx owns the
-- SERVER; server-level roles are not something a tenant of that server can mint
-- for itself. Everything INSIDE the jotdojo database stays jotDOJO's.
--
-- WHY THIS IS A JOB AND NOT A SCRIPT ON SOMEONE'S LAPTOP: the server is
-- VNet-private, so the only thing that can reach it is already in the cluster.
-- Same constraint as azure-bootstrap.sql beside it, same answer.
--
-- Run as the admin login (`sparx_owner`) against the `jotdojo` database, BEFORE
-- jotDOJO's own migrations. Fully idempotent — every statement is guarded or
-- unconditional-and-repeatable — so the release runs it every time without
-- special-casing the first.
--
--     psql "$JOTDOJO_ADMIN_BOOTSTRAP_URL" -v owner_password="$JOTDOJO_OWNER_PASSWORD" \
--          -v ON_ERROR_STOP=1 -f jotdojo-bootstrap.sql

\if :{?owner_password}
\else
    \echo 'FATAL: -v owner_password=... is required'
    \quit 1
\endif

-- ---------------------------------------------------------------------------
-- The role.
--
-- NOSUPERUSER and NOBYPASSRLS are both load-bearing, and neither is the default
-- you would get by not thinking about it.
--
-- jotDOJO's 0000_init.sql sets FORCE ROW LEVEL SECURITY precisely so the owner
-- is subject to its own policies — its comment says local development would
-- otherwise "silently bypass every policy". FORCE closes the owner exemption;
-- BYPASSRLS would reopen it from the other side, and the two together would
-- leave every policy reading as enforced while nothing was. Say NOBYPASSRLS out
-- loud rather than inheriting it.
--
-- The password is ALTERed on every run rather than only at creation, which makes
-- rotation a matter of tainting the Terraform resource and redeploying instead
-- of a hand-run psql session against a server no laptop can reach.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'jotdojo_owner') THEN
        CREATE ROLE jotdojo_owner LOGIN NOSUPERUSER NOBYPASSRLS;
    END IF;
END
$$;

ALTER ROLE jotdojo_owner WITH LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD :'owner_password';

-- ---------------------------------------------------------------------------
-- Ownership.
--
-- Granting the role to the admin FIRST is not ceremony. Postgres requires the
-- executing role to be a member of the new owner before it will reassign a
-- database, and `sparx_owner` on Flexible Server is azure_pg_admin rather than a
-- true superuser — so without this line ALTER DATABASE fails with
-- `must be member of role "jotdojo_owner"`, which reads like a permissions bug
-- in this script rather than a missing membership.
--
-- IF NOT EXISTS on the grant, because re-granting an existing membership is an
-- error and this file runs on every release.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_auth_members m
        JOIN pg_roles granted ON granted.oid = m.roleid
        JOIN pg_roles grantee ON grantee.oid = m.member
        WHERE granted.rolname = 'jotdojo_owner'
          AND grantee.rolname = CURRENT_USER
    ) THEN
        EXECUTE format('GRANT jotdojo_owner TO %I', CURRENT_USER);
    END IF;
END
$$;

ALTER DATABASE jotdojo OWNER TO jotdojo_owner;

-- The schema too, not just the database. Owning a database confers the right to
-- drop and rename it; it says nothing about creating tables inside `public`,
-- which is what a migration actually does. Missing this produces a first
-- migration that fails on `permission denied for schema public` while the
-- ownership above looks correct.
ALTER SCHEMA public OWNER TO jotdojo_owner;

GRANT ALL ON SCHEMA public TO jotdojo_owner;
GRANT CONNECT ON DATABASE jotdojo TO jotdojo_owner;

-- ---------------------------------------------------------------------------
-- Deliberately NOT here.
--
--   jotdojo_app       created by jotDOJO's 0001_app_role.sql, which also carries
--                     its grants and its REVOKE of CREATE on public. Its
--                     password is set by jotDOJO's own migration Job from
--                     JOTDOJO-APP-PASSWORD in the vault.
--   jotdojo_worker    created by jotDOJO's 0000_init.sql, BYPASSRLS NOLOGIN.
--
-- Both live inside the jotdojo database and belong to the product that owns it.
-- Duplicating them here would give two repositories a say over one role, and the
-- copy that loses is always the one nobody remembered to update.
-- ---------------------------------------------------------------------------
