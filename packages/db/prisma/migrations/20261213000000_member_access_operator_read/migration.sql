-- Let the auth path read member ACCESS GRANTS, not just the membership row.
--
-- `members` carries TWO policies (migration 20261002000000):
--
--   members_tenant_isolation  organization_id = current_tenant_id()
--   members_operator_read     current_tenant_id() IS NULL
--
-- The second is the auth-layer escape hatch, and it exists because resolving
-- "what may this user reach?" necessarily happens BEFORE any tenant context is
-- established — that is what the request is trying to work out.
--
-- `member_module_access` and `member_property_access` were both created with only
-- the isolation half. That is invisible for module access, which is read inside
-- already-tenant-scoped request handlers. It is NOT invisible for SITE access
-- (docs/131 §3.3), which api-core reads while building the auth context, with no
-- GUC set: the membership row comes back through members_operator_read, its grant
-- rows do not, and the member resolves to "restricted to ZERO sites".
--
-- The failure mode is the dangerous kind of safe. It fails CLOSED, so nothing
-- leaks — a restricted teammate is simply locked out of every site, on every
-- request, with a 403 that looks like a deliberate policy decision rather than a
-- missing row. An integration test caught it; a human would have reported it as
-- "site access is broken" and it would have been bisected the hard way.
--
-- Both tables get the companion policy. Module access is fixed here too even
-- though nothing reads it on the auth path yet — the day it is enforced (it
-- currently is not; see docs/131) it will read exactly where site access does,
-- and rediscovering this then is a worse use of an afternoon.
--
-- This does not widen tenant isolation. A GUC-less connection is `sparx_owner`
-- on the auth path only; every tenant-scoped request sets the GUC, and with it
-- set the isolation policy is the one that applies. The grants also carry
-- nothing the membership row does not already imply.

CREATE POLICY "member_property_access_operator_read" ON "member_property_access"
  USING (current_tenant_id() IS NULL);

CREATE POLICY "member_module_access_operator_read" ON "member_module_access"
  USING (current_tenant_id() IS NULL);
