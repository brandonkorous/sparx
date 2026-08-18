-- Marketplace provenance: which platform brand a blueprint listing came from.
--
-- WizeWorks runs more than one product on this platform, and the blueprint
-- catalog is deliberately SHARED: ~169 of the bundles are branded as invented
-- businesses, which is what makes them reusable by both. Forking them per brand
-- would stop every future improvement at the brand boundary.
--
-- What is NOT shared is a showcase — a bundle whose demo business is the
-- product's own name, which is the product demonstrating itself. Those are
-- restricted by the `brands` field in the bundle manifest (read from the image at
-- request time and handed to the query as a slug list, so no column was needed
-- for the FIRST-PARTY case).
--
-- This column is for the case that is coming: TENANT UPLOADS. When a merchant
-- publishes a template, the listing has a provenance — the brand of the account
-- that uploaded it — and provenance is not the same question as visibility:
--
--   · origin_brand  WHERE IT CAME FROM. Immutable, because a tenant never changes
--                   brands (piggles/CLAUDE.md). NULL = first-party, published by
--                   WizeWorks for every brand.
--   · brands        WHO MAY SEE IT. Mutable — a seller may later list into both
--                   marketplaces, at which point visibility grows and origin does
--                   not move.
--
-- The rule that ties them is a DEFAULT and never an equality: a tenant upload
-- defaults to visible only on its own brand (a merchant's template appearing on
-- the other product's marketplace unasked is a surprise, not a feature), while
-- first-party defaults to everywhere.
--
-- Set SERVER-SIDE from the authenticated publisher, never from the uploaded
-- manifest — a manifest is attacker-controlled, and a self-asserted origin would
-- let an uploader place a listing on another brand's marketplace by typing its
-- name.
--
-- Directory name sorts after 20270325000000_tenant_usage_rollup, per the
-- monotonic-name rule in packages/db/CLAUDE.md.

ALTER TABLE "marketplace_blueprints"
  ADD COLUMN "origin_brand" VARCHAR(20);

CREATE INDEX "marketplace_blueprints_origin_brand_idx"
  ON "marketplace_blueprints" ("origin_brand");

-- NULLABLE with no default, and no backfill. Every row that exists today is
-- first-party, and NULL is precisely how this column says so — writing 'sparx'
-- across them would claim they were made by one brand and are therefore that
-- brand's, which is the opposite of true and would hide the shared library from
-- the other product the moment the filter goes live.
--
-- No RLS change: `marketplace_blueprints` is a GLOBAL table with its own posture
-- (published rows readable by the app role, writes owner-only) rather than
-- tenant isolation, and provenance does not alter who may read a published row.
