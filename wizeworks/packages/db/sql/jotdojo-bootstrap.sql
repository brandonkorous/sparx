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
-- NOBYPASSRLS is load-bearing and is NOT the default you would get by not
-- thinking about it. jotDOJO's 0000_init.sql sets FORCE ROW LEVEL SECURITY
-- precisely so the owner is subject to its own policies — its comment says local
-- development would otherwise "silently bypass every policy". FORCE closes the
-- owner exemption; BYPASSRLS would reopen it from the other side, and the two
-- together would leave every policy reading as enforced while nothing was.
--
-- THE ATTRIBUTES APPEAR ON THE CREATE AND NOT ON THE UNCONDITIONAL ALTER, WHICH
-- LOOKS LIKE AN OVERSIGHT AND IS NOT.
--
-- Postgres checks the privilege for SUPERUSER and BYPASSRLS whenever the
-- attribute is MENTIONED, not when its value actually changes. So restating a
-- value the role already has is still refused:
--
--     ERROR:  permission denied to alter role
--     DETAIL:  Only roles with the SUPERUSER attribute may change the
--              SUPERUSER attribute.
--
-- `sparx_owner` is azure_pg_admin — neither a superuser nor BYPASSRLS — so it can
-- never satisfy either check. On CREATE the clauses are accepted because they
-- merely restate the defaults for a new role.
--
-- So the enforcement below is GUARDED: it names an attribute only when the
-- catalog says it is actually wrong. In the normal case nothing is mentioned and
-- nothing can be refused; in the case that genuinely matters — someone has handed
-- this role SUPERUSER or BYPASSRLS out of band — it still tries, and still fails
-- loudly if it cannot, which is the correct outcome for a real problem.
--
-- Dropping the clauses entirely would have been the smaller change and the wrong
-- one: it would have made the script silent about the single condition that
-- would turn jotDOJO's whole space boundary off.
--
-- The password IS re-applied unconditionally, which makes rotation a matter of
-- tainting the Terraform resource and redeploying rather than a hand-run psql
-- session against a server no laptop can reach.
-- ---------------------------------------------------------------------------
-- CREATEROLE, because jotDOJO's migrations create roles and run as this one.
-- `0001_app_role.sql` mints `jotdojo_app`; without CREATEROLE that migration dies
-- on `permission denied to create role`, having already been told it is the
-- owner. Owning a database and being allowed to create a role are separate
-- privileges in Postgres, and only the first is implied by ALTER DATABASE.
--
-- CREATEROLE is NOT a way back to superuser. Since PostgreSQL 16 a CREATEROLE
-- role may only grant membership in roles it created, and may not confer
-- SUPERUSER, REPLICATION or BYPASSRLS unless it holds them itself — which this
-- role deliberately does not. It can administer jotDOJO's own roles and nothing
-- outside them.
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'jotdojo_owner') THEN
        CREATE ROLE jotdojo_owner LOGIN CREATEROLE NOSUPERUSER NOBYPASSRLS;
    END IF;
END
$$;

ALTER ROLE jotdojo_owner WITH LOGIN CREATEROLE PASSWORD :'owner_password';

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'jotdojo_owner' AND rolsuper) THEN
        RAISE WARNING 'jotdojo_owner held SUPERUSER; revoking';
        ALTER ROLE jotdojo_owner NOSUPERUSER;
    END IF;

    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'jotdojo_owner' AND rolbypassrls) THEN
        RAISE WARNING 'jotdojo_owner held BYPASSRLS; revoking';
        ALTER ROLE jotdojo_owner NOBYPASSRLS;
    END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Ownership.
--
-- Granting the role to the admin FIRST is not ceremony. Reassigning a database
-- requires the executing role to be able to SET ROLE to the new owner, and
-- `sparx_owner` on Flexible Server is azure_pg_admin rather than a true
-- superuser — so without this, ALTER DATABASE fails with
-- `must be able to SET ROLE "jotdojo_owner"`, which reads like a bug in this
-- script rather than a missing grant.
--
-- `WITH SET TRUE` IS THE PART THAT IS EASY TO GET WRONG. PostgreSQL 16 split what
-- used to be one thing into three — ADMIN, INHERIT and SET — and a plain
-- `GRANT role TO user` now conveys INHERIT but NOT SET. Membership therefore
-- shows up in `pg_auth_members` while ALTER DATABASE still refuses, so a guard
-- that checks for membership reports satisfied and the next statement fails
-- anyway. This is exactly what happened on the first local run.
--
-- So the guard asks for the CAPABILITY rather than the row: `pg_has_role(...,
-- 'SET')` is the same question ALTER DATABASE asks. Guarded because re-granting
-- on every release is noise, and this file runs every release.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT pg_has_role(CURRENT_USER, 'jotdojo_owner', 'SET') THEN
        EXECUTE format('GRANT jotdojo_owner TO %I WITH SET TRUE', CURRENT_USER);
    END IF;
END
$$;

-- CONNECT is granted BEFORE ownership moves, while `sparx_owner` still owns the
-- database and can still grant on it. After the ALTER below it cannot, and this
-- line would fail on the second run — the kind of ordering bug that passes once
-- and then fails forever.
GRANT CONNECT ON DATABASE jotdojo TO jotdojo_owner;

-- The schema, not just the database. Owning a database confers the right to drop
-- and rename it and says nothing about creating tables inside `public`, which is
-- what a migration actually does.
--
-- BUT THE ALTER IS CONDITIONAL, because on PostgreSQL 15+ `public` ships owned by
-- `pg_database_owner` — a role that RESOLVES to whoever owns the database rather
-- than naming anyone. In that case the ALTER DATABASE below hands `public` over
-- as a consequence, and issuing ALTER SCHEMA here would fail outright:
-- `sparx_owner` is not its owner and never was. Unconditional, this file works
-- on a server where `public` happens to be owned outright and fails on one where
-- it is not, for reasons nothing in the error mentions.
DO $$
DECLARE
    schema_owner text;
BEGIN
    SELECT pg_get_userbyid(nspowner) INTO schema_owner
    FROM pg_namespace WHERE nspname = 'public';

    IF schema_owner = 'pg_database_owner' THEN
        RAISE NOTICE 'public follows the database owner (pg_database_owner); nothing to alter';
    ELSIF schema_owner <> 'jotdojo_owner' THEN
        ALTER SCHEMA public OWNER TO jotdojo_owner;
    END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Extensions — the third thing jotDOJO cannot do for itself, and the same shape
-- as the first two.
--
-- Its 0000_init.sql opens with `CREATE EXTENSION IF NOT EXISTS vector`, and on
-- Azure that is refused for anyone but the server admin:
--
--     ERROR:  Because vector isn't a trusted extension, only members of
--             "azure_pg_admin" are allowed to use CREATE EXTENSION vector
--     (SQLSTATE 42501)
--
-- The alternative — granting `jotdojo_owner` membership in `azure_pg_admin` —
-- would hand another product's role administrative rights over the whole server
-- to save three lines here. That is the opposite of why this file exists.
--
-- Creating them here is enough because every one of jotDOJO's is written
-- `IF NOT EXISTS`: found already present, its migration is a no-op and that
-- repository needs no change. An extension is owned by whoever created it, which
-- is fine — using a type or a function needs USAGE, not ownership, and USAGE on
-- these is public.
--
-- The list is jotDOJO's, read from its migrations rather than guessed, and it is
-- a SUBSET of the server-level allow-list in terraform/envs/azure/main.tf
-- (`azure.extensions` = PGCRYPTO, BTREE_GIST, VECTOR, PG_TRGM, CITEXT). That
-- allow-list is a SERVER setting shared with sparx and piggles: an extension
-- absent from it cannot be created here by anyone, admin or not, and adding one
-- is a Terraform change plus a server restart — not something this file can fix
-- at deploy time. If jotDOJO adds an extension, it goes there first.
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;

-- LAST, because it gives ownership away. Everything above needs `sparx_owner` to
-- still hold it.
ALTER DATABASE jotdojo OWNER TO jotdojo_owner;

-- ---------------------------------------------------------------------------
-- jotdojo_worker — the one OTHER role sparx has to mint, for the same reason as
-- the owner: jotDOJO cannot mint it for itself.
--
-- jotDOJO's 0000_init.sql creates it `BYPASSRLS NOLOGIN` — the single role
-- allowed to cross spaces. But Postgres will not let a role create a BYPASSRLS
-- role unless it HOLDS BYPASSRLS:
--
--     ERROR:  permission denied to create role
--     DETAIL:  Only roles with the BYPASSRLS attribute may create roles with
--              the BYPASSRLS attribute.
--
-- and `jotdojo_owner` deliberately does not hold it. That is not an oversight to
-- work around by granting it: jotDOJO's own 0000_init.sql sets FORCE ROW LEVEL
-- SECURITY precisely so the owner is subject to its policies, and BYPASSRLS on
-- the owner would undo that from the other side. The constraint and the design
-- are both right; they simply cannot both be satisfied by one role.
--
-- So it is minted here, by the server admin, which holds BYPASSRLS. jotDOJO's
-- `IF NOT EXISTS` guard then finds it already present and its migration is a
-- no-op — no change needed in that repository.
--
-- THIS IS THE SAME BOUNDARY AS THE OWNER, NOT AN EXCEPTION TO IT. A role is a
-- CLUSTER-level object in Postgres, not a database-level one, and this cluster
-- is sparx's. What stays jotDOJO's is everything INSIDE its database — which is
-- why `jotdojo_app` is deliberately still absent from this file: `jotdojo_owner`
-- can create it unaided, and 0001_app_role.sql carries its grants and its REVOKE
-- of CREATE on public. Duplicating that here would give two repositories a say
-- over one role, and the copy that loses is always the one nobody updated.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'jotdojo_worker') THEN
        CREATE ROLE jotdojo_worker BYPASSRLS NOLOGIN;
    END IF;
END
$$;

-- Handed to jotdojo_owner so jotDOJO can GRANT it onward to whatever runs its
-- background work, without needing the server admin again.
DO $$
BEGIN
    IF NOT pg_has_role('jotdojo_owner', 'jotdojo_worker', 'MEMBER') THEN
        GRANT jotdojo_worker TO jotdojo_owner WITH ADMIN OPTION;
    END IF;
END
$$;
