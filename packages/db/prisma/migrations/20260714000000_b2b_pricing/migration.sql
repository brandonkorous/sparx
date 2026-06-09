-- B2B / Wholesale — pricing tier tables (docs/10, docs/64 Ph1).
--
-- Three new tables (all FORCE RLS), one additive column on b2b_accounts,
-- and the `resolve_b2b_price()` SQL function that encodes the price
-- resolution order so it stays consistent across every call site.
--
-- Resolution order (highest wins):
--   1. b2b_account_product_overrides (exact variant, then collection)
--   2. b2b_tier_product_overrides   (exact variant, then collection)
--   3. B2bPricingTier blanket discount × variant.price_cents
--   4. B2BAccount.discount_percent stacked on top of step 3
--   5. variant.price_cents (list price)
--
-- FORCE RLS note: sparx_owner is a non-superuser in prod. Every query
-- against these tables must `SET app.current_tenant_id` first, or the
-- isolation policy blocks all rows. (See packages/db/CLAUDE.md.)

-- ─── b2b_pricing_tiers ────────────────────────────────────────────────────────

CREATE TABLE b2b_pricing_tiers (
  id              uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       uuid         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            varchar(127) NOT NULL,
  description     text,
  discount_type   varchar(20)  NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value  numeric(10,4) NOT NULL DEFAULT 0,
  product_scope   varchar(20)  NOT NULL DEFAULT 'all' CHECK (product_scope IN ('all', 'collections', 'products')),
  min_order_cents int          NOT NULL DEFAULT 0,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX ON b2b_pricing_tiers (tenant_id);
CREATE INDEX ON b2b_pricing_tiers (tenant_id, deleted_at);

ALTER TABLE b2b_pricing_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE b2b_pricing_tiers FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON b2b_pricing_tiers
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ─── b2b_tier_product_overrides ──────────────────────────────────────────────

CREATE TABLE b2b_tier_product_overrides (
  id                   uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id            uuid         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tier_id              uuid         NOT NULL REFERENCES b2b_pricing_tiers(id) ON DELETE CASCADE,
  -- Exactly one of variant_id or collection_id must be set (enforced in service layer).
  variant_id           uuid         REFERENCES commerce_product_variants(id) ON DELETE CASCADE,
  collection_id        uuid         REFERENCES commerce_product_collections(id) ON DELETE CASCADE,
  -- Exactly one of price_cents or discount_percentage must be set.
  price_cents          int,
  discount_percentage  numeric(5,2),
  notes                text,
  created_at           timestamptz  NOT NULL DEFAULT now(),
  updated_at           timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX ON b2b_tier_product_overrides (tenant_id, tier_id);
CREATE INDEX ON b2b_tier_product_overrides (tenant_id, variant_id);
CREATE INDEX ON b2b_tier_product_overrides (tenant_id, collection_id);

ALTER TABLE b2b_tier_product_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE b2b_tier_product_overrides FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON b2b_tier_product_overrides
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ─── b2b_account_product_overrides ───────────────────────────────────────────

CREATE TABLE b2b_account_product_overrides (
  id                   uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id            uuid         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_id           uuid         NOT NULL REFERENCES b2b_accounts(id) ON DELETE CASCADE,
  variant_id           uuid         REFERENCES commerce_product_variants(id) ON DELETE CASCADE,
  collection_id        uuid         REFERENCES commerce_product_collections(id) ON DELETE CASCADE,
  price_cents          int,
  discount_percentage  numeric(5,2),
  notes                text,
  created_at           timestamptz  NOT NULL DEFAULT now(),
  updated_at           timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX ON b2b_account_product_overrides (tenant_id, account_id);
CREATE INDEX ON b2b_account_product_overrides (tenant_id, variant_id);
CREATE INDEX ON b2b_account_product_overrides (tenant_id, collection_id);

ALTER TABLE b2b_account_product_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE b2b_account_product_overrides FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON b2b_account_product_overrides
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ─── Extend b2b_accounts ─────────────────────────────────────────────────────
-- Additive: the old free-text pricing_tier column is kept for backward compat
-- during any in-flight reads. New code uses pricing_tier_id.

ALTER TABLE b2b_accounts
  ADD COLUMN IF NOT EXISTS pricing_tier_id uuid
    REFERENCES b2b_pricing_tiers(id) ON DELETE SET NULL;

CREATE INDEX ON b2b_accounts (tenant_id, pricing_tier_id)
  WHERE pricing_tier_id IS NOT NULL;

-- ─── resolve_b2b_price() ─────────────────────────────────────────────────────
-- Returns the effective unit price in cents for a given variant + B2B account.
-- Returns NULL when the variant or account does not exist for this tenant.
--
-- Called by the B2B order placement check and the B2B API pricing endpoint.
-- Both callers set app.current_tenant_id before invoking.

CREATE OR REPLACE FUNCTION resolve_b2b_price(
  p_variant_id  uuid,
  p_account_id  uuid
) RETURNS int
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id         uuid;
  v_list_price        int;
  v_tier_id           uuid;
  v_tier_discount_type  varchar(20);
  v_tier_discount_value numeric(10,4);
  v_account_discount  numeric(5,2);
  v_override_price    int;
  v_override_pct      numeric(5,2);
  v_effective         int;
BEGIN
  -- 0. Resolve list price + account metadata.
  SELECT pv.price_cents
  INTO v_list_price
  FROM commerce_product_variants pv
  WHERE pv.id = p_variant_id;

  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT a.pricing_tier_id, a.discount_percent
  INTO v_tier_id, v_account_discount
  FROM b2b_accounts a
  WHERE a.id = p_account_id;

  IF NOT FOUND THEN RETURN NULL; END IF;

  -- 1. Account-level variant override (highest precedence).
  SELECT apo.price_cents, apo.discount_percentage
  INTO v_override_price, v_override_pct
  FROM b2b_account_product_overrides apo
  WHERE apo.account_id = p_account_id
    AND apo.variant_id = p_variant_id
  LIMIT 1;

  IF FOUND THEN
    IF v_override_price IS NOT NULL THEN RETURN v_override_price; END IF;
    IF v_override_pct   IS NOT NULL THEN
      RETURN GREATEST(0, ROUND(v_list_price * (1 - v_override_pct / 100)));
    END IF;
  END IF;

  -- 2. Account-level collection override.
  SELECT apo.price_cents, apo.discount_percentage
  INTO v_override_price, v_override_pct
  FROM b2b_account_product_overrides apo
  JOIN commerce_collection_products ccp
    ON ccp.collection_id = apo.collection_id
   AND ccp.product_id = (SELECT product_id FROM commerce_product_variants WHERE id = p_variant_id)
  WHERE apo.account_id = p_account_id
    AND apo.collection_id IS NOT NULL
  LIMIT 1;

  IF FOUND THEN
    IF v_override_price IS NOT NULL THEN RETURN v_override_price; END IF;
    IF v_override_pct   IS NOT NULL THEN
      RETURN GREATEST(0, ROUND(v_list_price * (1 - v_override_pct / 100)));
    END IF;
  END IF;

  -- 3. Tier-level variant override.
  IF v_tier_id IS NOT NULL THEN
    SELECT tpo.price_cents, tpo.discount_percentage
    INTO v_override_price, v_override_pct
    FROM b2b_tier_product_overrides tpo
    WHERE tpo.tier_id = v_tier_id
      AND tpo.variant_id = p_variant_id
    LIMIT 1;

    IF FOUND THEN
      IF v_override_price IS NOT NULL THEN RETURN v_override_price; END IF;
      IF v_override_pct   IS NOT NULL THEN
        RETURN GREATEST(0, ROUND(v_list_price * (1 - v_override_pct / 100)));
      END IF;
    END IF;

    -- 4. Tier-level collection override.
    SELECT tpo.price_cents, tpo.discount_percentage
    INTO v_override_price, v_override_pct
    FROM b2b_tier_product_overrides tpo
    JOIN commerce_collection_products ccp
      ON ccp.collection_id = tpo.collection_id
     AND ccp.product_id = (SELECT product_id FROM commerce_product_variants WHERE id = p_variant_id)
    WHERE tpo.tier_id = v_tier_id
      AND tpo.collection_id IS NOT NULL
    LIMIT 1;

    IF FOUND THEN
      IF v_override_price IS NOT NULL THEN RETURN v_override_price; END IF;
      IF v_override_pct   IS NOT NULL THEN
        RETURN GREATEST(0, ROUND(v_list_price * (1 - v_override_pct / 100)));
      END IF;
    END IF;

    -- 5. Tier blanket discount.
    SELECT t.discount_type, t.discount_value
    INTO v_tier_discount_type, v_tier_discount_value
    FROM b2b_pricing_tiers t
    WHERE t.id = v_tier_id;

    IF FOUND THEN
      v_effective := CASE v_tier_discount_type
        WHEN 'percentage' THEN GREATEST(0, ROUND(v_list_price * (1 - v_tier_discount_value / 100)))
        WHEN 'fixed'      THEN GREATEST(0, v_list_price - v_tier_discount_value::int)
        ELSE v_list_price
      END;
    ELSE
      v_effective := v_list_price;
    END IF;
  ELSE
    v_effective := v_list_price;
  END IF;

  -- 6. Stack account-level flat discount on top.
  IF v_account_discount IS NOT NULL AND v_account_discount > 0 THEN
    v_effective := GREATEST(0, ROUND(v_effective * (1 - v_account_discount / 100)));
  END IF;

  RETURN v_effective;
END;
$$;
