-- Media auto-groups (docs/49). A soft `source` label on each asset so the picker can
-- show automatic Brand / Product / Marketing / Content groups derived from WHERE the
-- asset was uploaded — no manual filing for a non-technical owner. Known values today:
-- 'brand' | 'product' | 'marketing' | 'content'; NULL = a plain library upload
-- ("Uploaded"). Free-form VarChar (not an enum) so the set grows without a migration;
-- it is a grouping hint only, never a permission boundary, so no RLS change and no
-- backfill (existing assets read as "Uploaded" until re-uploaded in a known context).

ALTER TABLE "media_assets" ADD COLUMN "source" VARCHAR(32);
