-- Three descriptions the customer-group presets wrote into tenant accounts.
--
-- The source already reads with a colon or a full stop (crm/src/presets/crm.ts
-- and crm-schemas/src/builtins/segments.ts), but a preset runs once and has no
-- update path, so every account that applied one kept the em dash on screen. It
-- showed in the group's own Description box and, since issue 914, as the line
-- under the group in search. These are words we wrote, not words the business
-- wrote, which is why they are refreshed here rather than left.
--
--     'B2B accounts with a fleet — primary target …'
--         -> 'B2B accounts with a fleet: primary target …'
--     'Your highest-value, still-active customers — $10,000+ …'
--         -> 'Your highest-value, still-active customers: $10,000+ …'
--     '… still hold marketing consent — your warmest list …'
--         -> '… still hold marketing consent. Your warmest list …'
--
-- Each UPDATE matches the FULL old string exactly. A business that rewrote its
-- own description no longer matches, so nothing of theirs is touched. Re-running
-- matches nothing the second time. Same shape as issue 516's shipping names.
--
-- Loops tenants and sets app.tenant_id per tenant: `segments` is FORCE RLS and
-- sparx_owner is a non-superuser in production, so an un-scoped pass would
-- update zero rows there while passing locally as superuser.
DO $$
DECLARE
    t     RECORD;
    n     INTEGER;
    total INTEGER := 0;
BEGIN
    FOR t IN SELECT id FROM tenants LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);

        UPDATE "segments"
        SET "description" = 'B2B accounts with a fleet: primary target for parts cross-sell.',
            "updated_at" = now()
        WHERE "tenant_id" = t.id
          AND "description" = 'B2B accounts with a fleet ' || U&'\2014' || ' primary target for parts cross-sell.';
        GET DIAGNOSTICS n = ROW_COUNT;
        total := total + n;

        UPDATE "segments"
        SET "description" = 'Your highest-value, still-active customers: $10,000+ lifetime spend with an order in the last 60 days. Target them with early access and perks.',
            "updated_at" = now()
        WHERE "tenant_id" = t.id
          AND "description" = 'Your highest-value, still-active customers ' || U&'\2014' || ' $10,000+ lifetime spend with an order in the last 60 days. Target them with early access and perks.';
        GET DIAGNOSTICS n = ROW_COUNT;
        total := total + n;

        UPDATE "segments"
        SET "description" = 'Subscribers who opened or clicked an email in the last 30 days and still hold marketing consent. Your warmest list for the next send.',
            "updated_at" = now()
        WHERE "tenant_id" = t.id
          AND "description" = 'Subscribers who opened or clicked an email in the last 30 days and still hold marketing consent ' || U&'\2014' || ' your warmest list for the next send.';
        GET DIAGNOSTICS n = ROW_COUNT;
        total := total + n;
    END LOOP;

    RAISE NOTICE 'issue 914: % customer group description(s) refreshed', total;
END $$;
