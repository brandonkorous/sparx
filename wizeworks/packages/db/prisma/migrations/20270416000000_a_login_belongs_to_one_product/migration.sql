-- A login belongs to one product.
--
-- Both brands mount the same Better Auth instance against this table, and
-- `email` was globally unique — so a person who signed up on one product could
-- sign in to the other with the same address and the same password. Not two
-- accounts: literally one row, authenticating on every deployment.
--
-- `users.platform_brand` splits the pool. The same address may now hold one
-- login per brand, and the two share nothing: separate passwords, separate
-- sessions, neither visible to the other.
--
-- ── WHY THE COLUMN IS COPIED RATHER THAN JOINED ─────────────────────────────
--
-- Every user already reaches a brand through `users.tenant_id -> tenants
-- .platform_brand`, so the column is redundant in the normalised sense. It is
-- here because the question is asked at SIGN-IN, before any tenant is known —
-- that is the entire reason the leak existed. A filter that needs a join to a
-- tenant cannot run at the moment it has to run.
--
-- ── WHY NO PER-TENANT BACKFILL LOOP ─────────────────────────────────────────
--
-- Writing to a FORCE-RLS table from a migration needs the tenant GUC set per
-- row, or `sparx_owner` (a non-superuser in prod) sees nothing and the backfill
-- silently touches zero rows. `users` is NOT such a table:
-- 20260527162200_auth_tables_no_force_rls dropped FORCE from users/sessions/
-- accounts precisely so auth could read them before a tenant context exists. So
-- the owner sees every row here and a plain UPDATE is correct.
--
-- `users.tenant_id` is NOT NULL behind a real FK, so the join below cannot leave
-- a row unmatched — every account resolves to exactly one tenant, and therefore
-- to exactly one brand.

ALTER TABLE "users" ADD COLUMN "platform_brand" VARCHAR(20) NOT NULL DEFAULT 'sparx';

UPDATE "users" u
   SET "platform_brand" = t."platform_brand"
  FROM "tenants" t
 WHERE u."tenant_id" = t."id"
   AND u."platform_brand" IS DISTINCT FROM t."platform_brand";

-- The old constraint is what made cross-brand sign-in possible; it goes, and the
-- compound takes over. Order matters: the unique index must exist before anything
-- can insert a second brand's row for an address that already has one.
--
-- The name matches the schema's `map:` so Prisma sees no drift. It is the
-- DATABASE constraint name only — the generated client addresses this index as
-- `platformBrand_email`, its field names joined, exactly as `members` is
-- addressed by `organizationId_userId` while its constraint is mapped to
-- `members_org_user_unique`.
DROP INDEX IF EXISTS "users_email_key";

CREATE UNIQUE INDEX "users_brand_email_unique" ON "users" ("platform_brand", "email");
