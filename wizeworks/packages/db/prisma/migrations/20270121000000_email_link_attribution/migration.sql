-- Email link-click attribution (docs/impl transactional-email Slice 10) — make the
-- clicks on a tenant's sent emails MEASURABLE in the tenant's own analytics.
--
-- At send, every on-site link in an email is tagged with UTM params (utm_medium=email,
-- utm_campaign=<the email's name>). This migration is the STORAGE half:
--
--   1. site_analytics_events.campaign — when the storefront beacon reports a hit whose
--      utm_medium=email, the ingest classifies source='email' (the VARCHAR(20) `source`
--      column already fits the new value, no type change) and records which email drove
--      it here. Null for every non-email hit.
--   2. orders.attribution_campaign — resolveOrderAttribution already copies the buyer's
--      first-touch pageview's source onto the order; this lets it carry the campaign too,
--      so "Revenue by traffic source" can drill Email → per-campaign.
--   3. builder_emails.tracking_campaign — an author's optional campaign-name override
--      (null = use the email's name), for grouping several sends under one campaign.
--
-- All three are additive, nullable columns on tables that already have FORCE RLS +
-- their tenant_isolation policy — a new nullable column inherits the policy, needs no
-- backfill, and can't trip the FORCE-RLS backfill footgun. Attribution simply begins
-- populating from the next email send / storefront hit / order.

ALTER TABLE "site_analytics_events" ADD COLUMN "campaign" VARCHAR(64);

ALTER TABLE "orders" ADD COLUMN "attribution_campaign" VARCHAR(64);

ALTER TABLE "builder_emails" ADD COLUMN "tracking_campaign" VARCHAR(64);
