-- A company's price tier is the tier it points at (sparx persona issue 086,
-- finding 35).
--
-- companies has two tier columns. pricing_tier_id is the real one: it prices
-- every order. pricing_tier is free text from before b2b_pricing_tiers existed,
-- and nothing prices from it. Several screens and the B2B summary read the text,
-- so Gillett's accounts, all on a real tier with the text empty, showed no tier;
-- and a company with text but no tier read as being on a tier while it paid list
-- price. Every reader now reads the linked tier and nothing writes the text.
--
-- This carries the text that is already there into the link: a company with text
-- and no tier is put on THAT business's live tier of the same name (ignoring case
-- and surrounding spaces; the oldest if two share it). Text that names no tier of
-- the business is left alone: inventing a tier would invent a discount. The
-- column itself stays until a later release drops it.
--
-- Loops tenants and sets app.tenant_id per tenant: companies and
-- b2b_pricing_tiers are both FORCE RLS, and the owner role in production is not
-- a superuser, so an unscoped UPDATE would see no rows there.

DO $$
DECLARE
    t      RECORD;
    n      INTEGER;
    linked INTEGER := 0;
BEGIN
    FOR t IN SELECT id FROM tenants LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);

        UPDATE companies AS c
        SET pricing_tier_id = (
            SELECT tier.id
            FROM b2b_pricing_tiers AS tier
            WHERE tier.tenant_id = t.id
              AND tier.deleted_at IS NULL
              AND lower(btrim(tier.name)) = lower(btrim(c.pricing_tier))
            ORDER BY tier.created_at, tier.id
            LIMIT 1
        )
        WHERE c.tenant_id = t.id
          AND c.pricing_tier_id IS NULL
          AND btrim(coalesce(c.pricing_tier, '')) <> ''
          AND EXISTS (
              SELECT 1
              FROM b2b_pricing_tiers AS tier
              WHERE tier.tenant_id = t.id
                AND tier.deleted_at IS NULL
                AND lower(btrim(tier.name)) = lower(btrim(c.pricing_tier))
          );
        GET DIAGNOSTICS n = ROW_COUNT;
        linked := linked + n;
    END LOOP;
    RAISE NOTICE 'companies put on the price tier their old tier text named: %', linked;
END $$;
