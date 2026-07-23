-- Session attribution (docs/128): record where the WEB traffic that produced an
-- order came from, without adding any new tracking capability the platform does
-- not already have. Four additive, NULLABLE columns on `orders`.
--
-- No backfill: attribution is only derivable from the checkout request at order
-- time (it recomputes the buyer's salted daily visitor hash from the request IP +
-- UA and matches it to that day's earliest pageview). Orders placed before these
-- columns exist can never be attributed retroactively — they stay NULL, and
-- reporting states that plainly rather than showing a misleading empty chart.
--
-- No RLS change: `orders` already has ENABLE + FORCE RLS with the tenant_isolation
-- policy; additive columns inherit it. Attribution is tenant-scoped by living on
-- the order — no new RLS surface.
--
-- No visitor hash column: storing the hash would freeze an identity designed to
-- expire at UTC midnight, which is exactly the property that keeps sparx sites
-- consent-free (docs/128 §2, §4). Only the DERIVED class / host / path persist.

ALTER TABLE "orders"
  ADD COLUMN "attribution_source"        VARCHAR(20),
  ADD COLUMN "attribution_referrer_host" VARCHAR(255),
  ADD COLUMN "attribution_landing_path"  VARCHAR(2048),
  ADD COLUMN "attribution_resolved_at"   TIMESTAMPTZ;
