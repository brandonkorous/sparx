-- Two brands, one tenant pool.
--
-- sparx and Piggles are separate PRODUCTS sharing this platform, this database
-- and this table (piggles/CLAUDE.md). Two columns carry that: which brand an
-- account signed up under, and whether the account is one of ours.
--
-- `tenants` is the non-RLS dispatch row, so this is a pure additive ALTER — no
-- policy SQL, no FORCE-RLS backfill footgun, nothing to grant.
--
-- Both columns are NOT NULL with a DEFAULT, which on PostgreSQL 11+ is a
-- catalogue-only change: no table rewrite, no lock held while every row is
-- touched. The default IS the backfill and it is the correct one — every tenant
-- that exists today signed up on sparx, because Piggles has no signup path yet.

-- ─────────────────────────────────────────────────────────────────────────────
-- Which product this account signed up under
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Recorded once at signup and never changed; a business does not migrate between
-- brands. Resolved from the request hostname where there is one, and read from
-- HERE by everything asynchronous — the `email.send` worker consuming a Pub/Sub
-- event, edge OG routes, the Stripe webhook — none of which have a hostname or a
-- tenant context to infer it from.
--
-- VARCHAR rather than an enum on purpose: adding a third brand should be a
-- product decision, not a migration.

ALTER TABLE "tenants"
  ADD COLUMN "platform_brand" VARCHAR(20) NOT NULL DEFAULT 'sparx';

-- The staff console segments tenants by brand from the day the second brand
-- exists, and every cross-brand metric groups by it.
CREATE INDEX "tenants_platform_brand_idx" ON "tenants" ("platform_brand");

-- ─────────────────────────────────────────────────────────────────────────────
-- Internal WizeWorks accounts
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Staff, demo, sales, seed, support — and the tenant that will own the Piggles
-- SEO satellite sites. Never metered, never warned, never capacity-blocked.
--
-- An EXPLICIT flag rather than something inferred from an email domain, a plan
-- value or a name pattern: inference is how a real paying customer eventually
-- gets unlimited capacity by accident, and the failure is silent. Never settable
-- from a tenant-facing surface.

ALTER TABLE "tenants"
  ADD COLUMN "is_system" BOOLEAN NOT NULL DEFAULT false;
