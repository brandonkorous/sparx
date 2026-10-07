-- A finished step has a fixed chance: Won is 100%, every other finished step 0%.
--
-- Measured on Gillett: Doty built a "Fleet accounts" pipeline. "Add a step" makes
-- an open step at 0%, and he turned the last two into Won and Lost. Won stayed at
-- 0%. Moving a deal copies the step's chance onto the deal, so every deal won
-- there would read "0% likely" on the deal, in reports and in scoring (sparx
-- persona issue 110). The service now applies `fixedStageChance` wherever a step
-- is written.
--
-- REPAIR, FACTS ONLY. Finished steps take their fixed chance, and deals sitting on
-- a Won step take 100%. Open steps and open deals keep the chance the business
-- set. Nothing else on a deal changes.
--
-- Loops tenants and sets app.tenant_id per tenant, in case either table is FORCE
-- RLS: the owner role in production is not a superuser, so an unscoped UPDATE
-- would see no rows.

DO $$
DECLARE
    t      RECORD;
    n      INTEGER;
    steps  INTEGER := 0;
    deals_ INTEGER := 0;
BEGIN
    FOR t IN SELECT id FROM tenants LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);

        UPDATE pipeline_stages
        SET probability = CASE WHEN stage_type = 'won' THEN 100 ELSE 0 END
        WHERE tenant_id = t.id
          AND stage_type <> 'open'
          AND probability <> CASE WHEN stage_type = 'won' THEN 100 ELSE 0 END;
        GET DIAGNOSTICS n = ROW_COUNT;
        steps := steps + n;

        UPDATE deals d
        SET probability = 100
        FROM pipeline_stages s
        WHERE d.tenant_id = t.id
          AND s.id = d.stage_id
          AND s.stage_type = 'won'
          AND d.probability <> 100;
        GET DIAGNOSTICS n = ROW_COUNT;
        deals_ := deals_ + n;
    END LOOP;

    RAISE NOTICE 'finished steps given their fixed chance: %, won deals set to 100%%: %', steps, deals_;
END $$;
