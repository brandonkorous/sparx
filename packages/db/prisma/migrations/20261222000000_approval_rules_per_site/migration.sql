-- Per-SITE B2B purchase approval rules (docs/131 §4).
--
-- Rated P1 in the doc but flagged there as "arguably P0", and that reading is
-- the right one: this is the only P1 item that decides whether an order can be
-- PLACED AT ALL. A "$500 needs manager sign-off" threshold set while thinking
-- about a machine shop applied equally to a donut wholesaler — either blocking
-- routine orders on a business that never wanted the control, or (with a high
-- threshold set for the wholesaler) waving through machine-shop orders that
-- should have been reviewed.
--
-- Nullable, not required. A genuinely tenant-wide control is a real intent — an
-- owner wanting "anything over $10k gets my eyes" across everything they run
-- should express that once, not once per site. Matching is now two independent
-- axes: a rule fires when its ACCOUNT axis covers the buyer (specific, or null =
-- any) AND its SITE axis covers the order's site (specific, or null = any).
--
-- No backfill and no FORCE-RLS loop: the column defaults to NULL, which is
-- exactly the correct reading of every existing row. Each was authored when the
-- tenant had one business, and it still applies to that business — plus, now,
-- to any others, which is what its author would have said if asked.

ALTER TABLE "purchase_approval_rules" ADD COLUMN "property_id" UUID;

-- Cascade, matching automations and API keys (migration 20261211000000). A
-- spending control written for one business goes with it. SetNull would PROMOTE
-- a closed business's threshold to tenant-wide — silently gating checkout on
-- every remaining site with a rule none of them chose. Deleting a site must
-- narrow what a rule reaches, never widen it.
ALTER TABLE "purchase_approval_rules" ADD CONSTRAINT "purchase_approval_rules_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;

-- The checkout gate now filters on both axes, so the index leads with the site.
CREATE INDEX "purchase_approval_rules_tenant_property_account_idx"
    ON "purchase_approval_rules"("tenant_id", "property_id", "account_id", "is_active");
