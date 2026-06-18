-- Inventory sync controls (docs/100 P5b — conflict resolution + oversell guards).
--
--  • inventory_source_links gains UoM conversion (a feed may report a pack UoM —
--    "case of 12" — while the catalog sells "each"; the feed quantity is multiplied
--    by units_per_external before reconcile) and stale-link tracking (last_seen_at +
--    is_stale, flagged when a full-snapshot sync no longer reports a mapped SKU).
--  • inventory_levels gains a safety_buffer: units withheld from the sellable
--    `available` so the lag between a physical change at an external source and the
--    next sync can't oversell.
--
-- Pure additive ALTERs with defaults — no backfill, no RLS change (both tables are
-- already ENABLE+FORCE RLS with their tenant_isolation policy).

ALTER TABLE inventory_source_links
  ADD COLUMN external_uom       varchar(30),
  ADD COLUMN units_per_external int         NOT NULL DEFAULT 1,
  ADD COLUMN last_seen_at       timestamptz,
  ADD COLUMN is_stale           boolean     NOT NULL DEFAULT false;

ALTER TABLE inventory_levels
  ADD COLUMN safety_buffer int NOT NULL DEFAULT 0;
