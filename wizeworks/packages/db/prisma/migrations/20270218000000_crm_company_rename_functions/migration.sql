-- docs/144 §11 — the two SECURITY DEFINER functions the company rename broke.
--
-- `ALTER TABLE … RENAME` updates the catalog. It does NOT rewrite the BODY of a
-- plpgsql function, because a body is stored as text and only parsed when it
-- runs. So both of these kept saying `b2b_accounts` and started failing at
-- runtime the moment the rename landed — invisibly, because neither is called by
-- anything that runs at boot.
--
-- The one that matters is `sync_b2b_credit_used`: it is the single money
-- chokepoint every create / line / payment / void funnels through to keep a
-- company's credit utilisation in step with its open AR (docs/87 §15). Broken, it
-- takes the whole billing-document write path down — which is exactly how the
-- integration suite found it.
--
-- Reproduced verbatim from the live definitions with ONLY the table name
-- changed. Nothing about either behaviour moves here.


CREATE OR REPLACE FUNCTION sync_b2b_credit_used(p_account_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE companies a
  SET credit_used = (
    SELECT COALESCE(SUM(d.balance), 0)
    FROM billing_documents d
    WHERE d.company_id = p_account_id
      AND d.deleted_at IS NULL
      AND d.status IN ('unpaid', 'partial', 'overdue')
  ),
  updated_at = now()
  WHERE a.id = p_account_id;
END;
$$;

CREATE OR REPLACE FUNCTION resolve_b2b_price(p_variant_id uuid, p_account_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  FROM companies a
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
$function$;
