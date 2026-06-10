-- Marketing attribution (docs/80 §8.3) — L-PLAT acquisition snapshot on the
-- tenant dispatch row, written once at signup from the first-party attribution
-- cookies. The tenants table is intentionally NOT RLS-enabled (the dispatch row
-- read before tenant context is set), so this is a pure additive ALTER:
-- no policy SQL, no backfill (every column is nullable).

ALTER TABLE "tenants"
    ADD COLUMN "acquisition_channel" VARCHAR(50),
    ADD COLUMN "acquisition_source" VARCHAR(255),
    ADD COLUMN "acquisition_campaign" VARCHAR(255),
    ADD COLUMN "acquisition_first_touch" JSONB,
    ADD COLUMN "acquisition_last_touch" JSONB,
    ADD COLUMN "acquired_at" TIMESTAMPTZ;
