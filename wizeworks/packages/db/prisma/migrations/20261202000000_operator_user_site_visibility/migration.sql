-- Operator cross-tenant visibility for the admin console's Users + Sites surfaces
-- (docs/apps/admin — user & site management). The WizeWorks operator console reads
-- the fleet-wide staff-user roster and site roster through api-rest (role
-- sparx_app) under `withSystem` — i.e. with app.tenant_id unset, so
-- current_tenant_id() returns NULL.
--
-- `users`, `members`, and `properties` are all RLS-protected and their existing
-- tenant_isolation policies evaluate to FALSE when the tenant GUC is unset, so a
-- system read sees ZERO rows. This migration adds, to each, a PERMISSIVE,
-- SELECT-ONLY companion policy that exposes rows ONLY in the no-tenant
-- (operator/system) context. It mirrors the marketplace/partners_visibility
-- pattern (a second permissive policy OR-combined with tenant_isolation).
--
-- Safety: purely additive, SELECT-only, touches NO data (→ the FORCE-RLS
-- per-tenant backfill footgun does not apply). A NORMAL tenant request always has
-- current_tenant_id() set, so `current_tenant_id() IS NULL` is FALSE for it and it
-- keeps seeing ONLY its own rows via the untouched tenant_isolation policy. All
-- operator WRITES stay tenant-scoped under withTenant (tenant_isolation +
-- WITH CHECK), never through this policy.

-- users — ENABLE + FORCE, tenant_id = current_tenant_id()
CREATE POLICY users_operator_read ON "users"
    AS PERMISSIVE FOR SELECT
    USING (current_tenant_id() IS NULL);

-- members — ENABLE + NO FORCE, organization_id = current_tenant_id(). sparx_app is
-- NOT the table owner, so NO FORCE does not exempt it — it still needs this policy
-- to read memberships across orgs in the system context.
CREATE POLICY members_operator_read ON "members"
    AS PERMISSIVE FOR SELECT
    USING (current_tenant_id() IS NULL);

-- properties — ENABLE + FORCE, tenant_id = current_tenant_id()
CREATE POLICY properties_operator_read ON "properties"
    AS PERMISSIVE FOR SELECT
    USING (current_tenant_id() IS NULL);
