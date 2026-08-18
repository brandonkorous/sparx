-- Quote-line markup snapshot (docs/48 Product Markup, Phase 3).
--
-- A quote line can be priced "by markup" at document time — a markup rule (or
-- an ad-hoc markup) applied against a per-line cost basis. `cost_cents` records
-- the cost the price was derived from; `applied_markup` snapshots the full
-- computation so the quoted price stays reproducible after catalog costs drift
-- (docs/48 §5). Both are nullable: a line priced manually / from the catalog
-- carries neither.
--
-- `quote_items` already has RLS (ENABLE + FORCE + tenant_isolation, applied in
-- 20260601000500_crm_quotes). Adding columns needs no policy change.

ALTER TABLE "quote_items" ADD COLUMN "cost_cents" INTEGER;
ALTER TABLE "quote_items" ADD COLUMN "applied_markup" JSONB;
