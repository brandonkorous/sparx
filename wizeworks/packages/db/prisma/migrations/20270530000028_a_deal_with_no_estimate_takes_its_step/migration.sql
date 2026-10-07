-- A deal with no estimate of its own takes its step's chance.
--
-- Measured on Gillett: Doty opened "Service plan for all 38 RAM 3500s, 2027" on
-- the "Proposal sent" step (50%) and left Likelihood blank. It was stored at 0%
-- (sparx persona issue 113). The forecast has always read a deal's 0 as "use the
-- step's chance", but the deal page, the deals list, reports and scoring read the
-- stored 0. Moving a deal copies the step's chance; creating one did not. The
-- service now does the same on create.
--
-- REPAIR, FACTS ONLY. Open deals stored at 0% on a step with a chance above 0
-- take that chance: the number the forecast was already counting them at. Deals
-- with an estimate of their own, and deals on finished steps (migration
-- 20270530000027), are not touched.
--
-- Loops tenants and sets app.tenant_id per tenant, in case either table is FORCE
-- RLS: the owner role in production is not a superuser.

DO $$
DECLARE
    t      RECORD;
    n      INTEGER;
    moved  INTEGER := 0;
BEGIN
    FOR t IN SELECT id FROM tenants LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);

        UPDATE deals d
        SET probability = s.probability
        FROM pipeline_stages s
        WHERE d.tenant_id = t.id
          AND s.id = d.stage_id
          AND s.stage_type = 'open'
          AND s.probability > 0
          AND d.probability = 0;
        GET DIAGNOSTICS n = ROW_COUNT;
        moved := moved + n;
    END LOOP;

    RAISE NOTICE 'open deals given their step''s chance: %', moved;
END $$;
