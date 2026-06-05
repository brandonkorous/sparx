-- Per-site brand override (docs/49 §3, Phase 4) — the deliberate amendment to
-- doc-34's "brand overridable by none". A single additive, NULLABLE column on
-- `properties`: null = inherit the tenant brand (the default / source of truth);
-- a JSON partial overrides only the identity fields a site sets (businessName,
-- theme colours, logo). Presentation-only, NOT a full brand fork.
--
-- DDL only — no backfill (null is the correct default for every existing site),
-- so no per-tenant set_config loop is needed. RLS on `properties` is unchanged
-- (the column adds no security surface; tenant_id stays the only boundary).

ALTER TABLE "properties" ADD COLUMN "brand_override" JSONB;
