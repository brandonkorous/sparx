-- The offer stack (docs/151 §12, docs/152 E1 + E2).
--
-- ONE table for the order bump and the post-purchase upsell, because they differ
-- in exactly one thing: when they are shown. Two tables would be two places to
-- fix a pricing bug.
--
-- The design pass §1 #4 asked for found that the two halves are very different
-- problems wearing one name:
--
--   A BUMP is shown during checkout, before anything is charged. Taking it is a
--   cart line, so tax, discounts, inventory commitment and refunds are the
--   cart's and NOTHING about payment changes.
--
--   An UPSELL is shown after the order completes and creates a SECOND ORDER
--   rather than amending the first. That is the call that keeps the money
--   correct: amending would mean re-running tax on a document the customer has a
--   receipt for, and a refund path that has to unpick which lines belonged to
--   which capture. Two orders refund independently because they always were two.
--
-- Note what is NOT here: a price. The offer is priced from the variant every
-- time. A price on the offer would be a second place a product costs something,
-- and the two would disagree the first time somebody edited the product.

CREATE TABLE "commerce_offers" (
    "id"                  UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"           UUID NOT NULL,
    "property_id"         UUID NOT NULL,
    "name"                VARCHAR(160) NOT NULL,
    "placement"           VARCHAR(20) NOT NULL,
    "variant_id"          UUID NOT NULL,
    "headline"            VARCHAR(200) NOT NULL,
    "blurb"               TEXT,
    "cta_label"           VARCHAR(60) NOT NULL DEFAULT 'Add this',
    "trigger_variant_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
    -- Off by default. An offer that went live the moment somebody saved a draft
    -- would be charging customers for a decision nobody finished making.
    "active"              BOOLEAN NOT NULL DEFAULT false,
    "priority"            INTEGER NOT NULL DEFAULT 100,
    "created_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "commerce_offers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "commerce_offers_tenant_id_fkey"
        FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
    CONSTRAINT "commerce_offers_property_id_fkey"
        FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE,
    CONSTRAINT "commerce_offers_placement_check"
        CHECK ("placement" IN ('bump', 'upsell'))
);
CREATE INDEX "commerce_offers_lookup_idx"
    ON "commerce_offers" ("tenant_id", "property_id", "placement", "active", "priority");

CREATE TABLE "commerce_offer_impressions" (
    "id"                  UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"           UUID NOT NULL,
    "offer_id"            UUID NOT NULL,
    "checkout_session_id" UUID,
    "order_id"            UUID,
    -- Null is not "no". It is "not yet, or never", and collapsing the two would
    -- be the absence-as-measurement mistake this build log keeps recording.
    "accepted_at"         TIMESTAMPTZ,
    "result_order_id"     UUID,
    "created_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "commerce_offer_impressions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "commerce_offer_impressions_tenant_id_fkey"
        FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
    CONSTRAINT "commerce_offer_impressions_offer_id_fkey"
        FOREIGN KEY ("offer_id") REFERENCES "commerce_offers"("id") ON DELETE CASCADE,
    -- Exactly one place. A row naming both, or neither, is a showing nobody can
    -- locate.
    CONSTRAINT "commerce_offer_impressions_place_check"
        CHECK (num_nonnulls("checkout_session_id", "order_id") = 1)
);
-- One impression per offer per place, so a customer reloading the payment step
-- does not inflate the denominator of their own conversion rate.
CREATE UNIQUE INDEX "commerce_offer_impressions_session_key"
    ON "commerce_offer_impressions" ("offer_id", "checkout_session_id")
    WHERE "checkout_session_id" IS NOT NULL;
CREATE UNIQUE INDEX "commerce_offer_impressions_order_key"
    ON "commerce_offer_impressions" ("offer_id", "order_id")
    WHERE "order_id" IS NOT NULL;
CREATE INDEX "commerce_offer_impressions_recent_idx"
    ON "commerce_offer_impressions" ("tenant_id", "offer_id", "created_at" DESC);

-- ─── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE "commerce_offers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commerce_offers" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "commerce_offers"
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

ALTER TABLE "commerce_offer_impressions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commerce_offer_impressions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "commerce_offer_impressions"
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());
