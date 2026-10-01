-- A teammate from another business keeps their name.
--
-- Staff identity is global: one person, one `users` row, and a membership in
-- every business they work for. But `users.tenant_id` is the business they
-- signed up under, and the only tenant policy on `users` is
-- `tenant_id = current_tenant_id()`. So when a business invites somebody who
-- already has a workspace of their own, every join from that business's rows
-- to that person comes back empty.
--
-- Measured 2026-09-30: 4 of 40 memberships on this machine are like that. Devi
-- Raman named Nadia Osei on her $200 spending limit; the row stored Nadia's id,
-- and the list printed "Anyone who can edit buying", because
-- `requiredApprover` resolved to null under this policy. 39 foreign keys point
-- at `users` (who asked, who decided, who it is assigned to), and every one of
-- them loses the name the same way. A required relation does worse: the Team
-- screen 500'd on it until `routes/v1/team.ts` moved to the owner connection to
-- get round this exact policy.
--
-- The rule added here is the one the roster already lives by: a business can
-- read the user row of anyone who is a member of it. SELECT only, and only
-- through a membership in THIS tenant, so somebody with no tie to the business
-- stays invisible. Nothing on `users` is a secret (passwords and second-factor
-- secrets live in their own tables), and the name, email and last sign-in it
-- shows are what the Team screen already shows that same business.
--
-- Proved in a rolled-back transaction as `sparx_app` with Juniper Row's
-- tenant set: Nadia's row went from 0 visible to 1, the limit's join read
-- "Nadia Osei", and users with no membership in the tenant stayed at 0.
--
-- Permissive, so it ORs with `users_tenant_isolation` and
-- `users_operator_read`; neither is changed.
CREATE POLICY "users_member_read" ON "users"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM "members" m
      WHERE m."user_id" = "users"."id"
        AND m."organization_id" = current_tenant_id()
    )
  );
