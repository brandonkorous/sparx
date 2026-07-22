-- Per-SITE CRM segments (docs/131 §5).
--
-- Rated P2 (internal-only), but the doc calls it a LIVE INCONSISTENCY and that
-- is the right framing: `customers` is already property-scoped and a segment
-- FEEDS the property-scoped `broadcasts`, so an unscoped `segments` table sat
-- between two scoped endpoints. A "high-value customers" audience built from one
-- business's customers could silently feed the other business's marketing send —
-- which is a customer-visible leak wearing an internal-model label.
--
-- Nullable: a genuinely cross-business audience is real (an owner emailing every
-- VIP they have), and the segment's site — when set — bounds which customers its
-- rules evaluate over. SegmentMember gets NO column: a membership is the
-- intersection of a segment and a customer, both already site-carrying, so its
-- site is theirs (docs/131 §2 pattern 3).
--
-- No backfill / no FORCE-RLS loop — NULL = tenant-wide, matching today.

ALTER TABLE "segments" ADD COLUMN "property_id" UUID;

-- Cascade: a segment is an audience defined for one business.
ALTER TABLE "segments"
    ADD CONSTRAINT "segments_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;

-- Re-cut slug uniqueness to (tenant, property, slug). On this table the old
-- uniqueness is a bare unique INDEX (verified against the live schema), so
-- DROP INDEX is correct — the channels migration hit the CONSTRAINT variant and
-- needed DROP CONSTRAINT; the distinction is per-table, checked not assumed.
-- NULLS NOT DISTINCT so the tenant-wide tier still can't duplicate a slug.
DROP INDEX "segments_tenant_id_slug_key";
CREATE UNIQUE INDEX "segments_tenant_id_property_id_slug_key"
    ON "segments"("tenant_id", "property_id", "slug") NULLS NOT DISTINCT;

CREATE INDEX "segments_tenant_property_archived_idx"
    ON "segments"("tenant_id", "property_id", "archived_at");
