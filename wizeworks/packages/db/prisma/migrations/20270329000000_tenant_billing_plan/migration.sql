-- Which billing PLAN a tenant is on: the shape of its bill, and which Stripe
-- account that bill is raised in (@wizeworks/billing/plans).
--
-- WizeWorks bills two products out of two separate Stripe accounts on incompatible
-- models. Before this column, `@wizeworks/billing` read one STRIPE_SECRET_KEY and
-- generated one subscription item per active module, so a Piggles business that
-- entered a card would have been charged on sparx's account, with up to fifteen
-- module line items on a plan whose whole promise is one flat price.
--
-- `tenants` is the non-RLS dispatch row, so this is a pure additive ALTER — no
-- policy SQL, no FORCE-RLS backfill concern.

ALTER TABLE "tenants"
  ADD COLUMN "billing_plan" VARCHAR(30) NOT NULL DEFAULT 'modules';

-- Seed the column for rows that predate it. Brand is the only signal available for
-- accounts already in the pool, and it is the right one exactly once: at the moment
-- the column is introduced, every existing tenant is on its brand's default plan
-- because no other plan could yet have been chosen. From here the column stands on
-- its own — new tenants are stamped at provisioning from the brand registry, and
-- nothing in the billing engine reads `platform_brand` again.
UPDATE "tenants" SET "billing_plan" = 'piggles' WHERE "platform_brand" = 'piggles';

-- Reconciliation matches (customer, plan) rather than customer alone, because a
-- Stripe customer id is only unique inside its own account.
CREATE INDEX IF NOT EXISTS "tenants_billing_plan_idx" ON "tenants" ("billing_plan");
