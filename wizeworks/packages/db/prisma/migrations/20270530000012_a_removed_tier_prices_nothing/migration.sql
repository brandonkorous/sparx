-- A removed price tier prices nothing (sparx persona issue 086, finding 35).
--
-- Removing a tier sets b2b_pricing_tiers.deleted_at and leaves every account
-- pointing at it. The remove dialog promises "Accounts on this tier go back to
-- your normal prices", but resolve_b2b_price() never looked at deleted_at, so a
-- removed tier's discount and its product prices went on applying: Wasatch
-- Front, on Fleet at 12% off, was still charged $2,816.00 for a $3,200.00 part
-- after Fleet was removed, measured on the local database on 2026-10-03.
--
-- The function is reproduced verbatim from pg_get_functiondef (identical to
-- 20270218000000_crm_company_rename_functions) with ONE change: a tier that is
-- removed is treated as no tier, before step 3. Account-level prices and the
-- account's own flat discount are untouched. Every reader that names a tier now
-- applies the same rule (companyService.tierInEffect).

CREATE OR REPLACE FUNCTION public.resolve_b2b_price(p_variant_id uuid, p_account_id uuid)
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

  -- A removed tier prices nothing. Removing one only marks it removed and the
  -- account keeps pointing at it, so without this its discount and its product
  -- prices went on applying (sparx persona issue 086).
  IF v_tier_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM b2b_pricing_tiers t WHERE t.id = v_tier_id AND t.deleted_at IS NULL
  ) THEN
    v_tier_id := NULL;
  END IF;

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
