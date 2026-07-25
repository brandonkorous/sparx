-- Customer classification → three orthogonal axes (docs/137).
--
-- Splits the overloaded `type` (prospect|retail|regular|vip|b2b) into:
--   • type            — RELATIONSHIP (retail|b2b|partner|vendor); only b2b keeps behaviour
--   • lifecycle_stage — where they are in the journey (HubSpot's 8 stages)
--   • lead_status     — the micro work-state, nullable

ALTER TABLE "customers" ADD COLUMN "lifecycle_stage" VARCHAR(30) NOT NULL DEFAULT 'lead';
ALTER TABLE "customers" ADD COLUMN "lead_status" VARCHAR(30);

-- The backfill reads the OLD `type` to decide all three axes AND rewrites `type`.
-- Reading and writing the same column makes a naive multi-statement backfill
-- non-idempotent: once a row's `type` flips to 'retail', a re-run can no longer
-- tell it was a prospect. That matters because `customers` is FORCE ROW LEVEL
-- SECURITY, so the writes must run inside a per-tenant loop (sparx_owner is a
-- NON-superuser in prod and an unqualified UPDATE sees 0 rows otherwise) — and in
-- a superuser context (local docker) that loop is NOT row-scoped, so it re-runs on
-- every row once per tenant. To be correct under both, snapshot the original type
-- into an immutable temp column and map from THAT in a single atomic UPDATE.
ALTER TABLE "customers" ADD COLUMN "_orig_type" VARCHAR(20);

DO $$
DECLARE t RECORD;
BEGIN
  FOR t IN SELECT id FROM tenants LOOP
    PERFORM set_config('app.tenant_id', t.id::text, false);

    -- Snapshot once; the NULL guard makes re-runs (superuser over-iteration) no-ops.
    UPDATE "customers" SET "_orig_type" = "type" WHERE "_orig_type" IS NULL;

    -- One atomic map from the frozen snapshot — every SET reads `_orig_type`, never
    -- the `type` it also rewrites, so the result is identical however many times it
    -- runs. prospect → a fresh lead being worked; every other kind is already a
    -- customer; b2b keeps its wholesale relationship, the rest become retail;
    -- regular/vip (no axis home) are preserved losslessly as tags.
    UPDATE "customers"
       SET "lifecycle_stage" = CASE WHEN "_orig_type" = 'prospect' THEN 'lead' ELSE 'customer' END,
           "lead_status"     = CASE WHEN "_orig_type" = 'prospect' THEN 'new' ELSE NULL END,
           "type"            = CASE WHEN "_orig_type" = 'b2b' THEN 'b2b' ELSE 'retail' END,
           "tags" = CASE
             WHEN "_orig_type" = 'regular' AND NOT ("tags" @> ARRAY['regular']::VARCHAR[])
               THEN ARRAY_APPEND("tags", 'regular')
             WHEN "_orig_type" = 'vip' AND NOT ("tags" @> ARRAY['vip']::VARCHAR[])
               THEN ARRAY_APPEND("tags", 'vip')
             ELSE "tags"
           END;
  END LOOP;
END $$;

ALTER TABLE "customers" DROP COLUMN "_orig_type";

-- New rows are a retail individual by default (was 'prospect').
ALTER TABLE "customers" ALTER COLUMN "type" SET DEFAULT 'retail';
