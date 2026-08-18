-- P0 site scoping (docs/131 §3.1–3.3) — the three defects that produce wrong
-- behaviour or cross-business data access the moment a tenant runs two sites.
--
-- The governing principle (docs/131): the tenant is the billing and ownership
-- container; the SITE is the business a customer actually deals with. One tenant
-- can run two unrelated businesses — a machine shop and a donut shop — and today
-- an automation written for one fires on the other's orders, an API key issued
-- from one reads the other's customers, and a member cannot be given access to
-- one without the other.
--
-- Three separate fixes, one migration, so the Prisma client is regenerated once.
--
-- NULL vs NOT NULL: `property_id` is nullable on automations and api_keys because
-- "applies to the whole tenant" is a REAL state for both — a tenant-wide rule and
-- a tenant-wide integration key are things people legitimately want. It is the
-- established "null = all sites" convention (see `orders.property_id`). Elsewhere
-- in docs/131 (billing documents, chat conversations, email settings) the column
-- is NOT NULL, because "an invoice belonging to no business" is not a real state.
--
-- ON DELETE CASCADE, not SET NULL: this is the one place the two differ in a way
-- that matters. `orders.property_id` is SET NULL so finance history survives a
-- site deletion. An automation or an API key is CONFIG, not history — and
-- SET NULL would silently WIDEN it from one site to all sites, which is exactly
-- the blast-radius bug this migration exists to remove. Deleting a site must
-- narrow reach, never broaden it. The site-delete confirmation is responsible for
-- naming what it will take down (see the destructive-action rule).

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. automations — a rule authored for one business must not fire on another
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "automations"
  ADD COLUMN "property_id" UUID;

ALTER TABLE "automations"
  ADD CONSTRAINT "automations_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- The engine's dispatch query is:
--   WHERE tenant_id = ? AND status = 'active' AND trigger_type = ?
--     AND (property_id IS NULL OR property_id = ?)
-- so property_id belongs as the TRAILING column — the three leading columns
-- still select the candidate set, and this lets the index answer the site filter
-- rather than rechecking every candidate row.
CREATE INDEX "automations_tenant_status_trigger_property_idx"
  ON "automations" ("tenant_id", "status", "trigger_type", "property_id");

-- Superseded by the index above, which shares its leading three columns.
DROP INDEX IF EXISTS "automations_tenant_id_status_trigger_type_idx";

-- Denormalized onto runs so "what fired on this site" is answerable without a
-- join back to the automation — and so the run log stays truthful if the
-- automation is later re-scoped. Stamped at run creation from the automation.
ALTER TABLE "automation_runs"
  ADD COLUMN "property_id" UUID;

ALTER TABLE "automation_runs"
  ADD CONSTRAINT "automation_runs_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- SET NULL here, unlike the automation itself: a run is a HISTORICAL record of
-- something that happened. Deleting the site should not erase the evidence that
-- it ran, and a run cannot "widen" — it already completed.

CREATE INDEX "automation_runs_tenant_property_started_idx"
  ON "automation_runs" ("tenant_id", "property_id", "started_at" DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. api_keys — a key issued from one business must not read another's data
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Today `scopes` is module-level (`read:crm`) with no site dimension, and the
-- header on 05-api-keys.prisma says keys are issued from a settings page — so an
-- operator reasonably believes the key belongs to the business they created it
-- in. It does not: it reads the entire tenant.
--
-- Nullable preserves today's behaviour for existing keys (null = whole tenant).
-- The ISSUING UI should default to the current site, so the safe option is the
-- one you get by not thinking about it.

ALTER TABLE "api_keys"
  ADD COLUMN "property_id" UUID;

ALTER TABLE "api_keys"
  ADD CONSTRAINT "api_keys_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Verification still reads by `key_prefix` (already uniquely indexed) — this
-- index is for the "keys for this site" listing in settings.
CREATE INDEX "api_keys_tenant_property_idx"
  ON "api_keys" ("tenant_id", "property_id");

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. members — a teammate must be grantable one business and not the other
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Deliberately mirrors `module_access_mode` + `member_module_access` (migration
-- 20261210000000) rather than inventing a second shape: same mode flag, same
-- grant-row semantics, same reasoning. Two orthogonal narrowing axes on one
-- membership — WHICH MODULES and WHICH SITES — that compose independently.
--
-- The default is a no-op. Every existing member is `all`, which means "no
-- restriction, the role is the only gate" — today's exact behaviour. Nobody's
-- access changes when this ships.

ALTER TABLE "members"
  ADD COLUMN "property_access_mode" VARCHAR(20) NOT NULL DEFAULT 'all';

-- Closed vocabulary, and the access layer branches on it — an unrecognised value
-- would fail OPEN (no restriction applied). A check makes that unreachable
-- rather than merely unlikely. Same reasoning as members_module_access_mode_check.
ALTER TABLE "members"
  ADD CONSTRAINT "members_property_access_mode_check"
  CHECK ("property_access_mode" IN ('all', 'selected'));

CREATE TABLE "member_property_access" (
  "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
  "member_id"   UUID        NOT NULL,
  "property_id" UUID        NOT NULL,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "member_property_access_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "member_property_access_member_id_fkey"
    FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "member_property_access_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "member_property_access_member_property_unique"
  ON "member_property_access" ("member_id", "property_id");

CREATE INDEX "member_property_access_member_id_idx"
  ON "member_property_access" ("member_id");

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- ENABLE but NOT FORCE, matching `members` / `member_module_access` / `users`.
-- This is an auth-layer table: @sparx/auth connects as `sparx_owner` and must
-- resolve a user's access BEFORE any tenant context exists, so it cannot sit
-- behind a policy keyed on current_tenant_id(). `sparx_app` stays filtered as
-- defence-in-depth.
--
-- The policy reaches the tenant through `members`, since this table has no
-- tenant_id of its own — a grant belongs to a membership, and the membership is
-- what is scoped to a tenant. Duplicating tenant_id here would create a second
-- copy that can disagree with the row it hangs off. Identical to the
-- member_module_access policy.
ALTER TABLE "member_property_access" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "member_property_access"
  USING (
    EXISTS (
      SELECT 1 FROM "members" m
      WHERE m."id" = "member_property_access"."member_id"
        AND m."organization_id" = current_tenant_id()
    )
  );
