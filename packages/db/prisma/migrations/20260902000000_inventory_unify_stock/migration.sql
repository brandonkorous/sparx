-- Unify the standalone sync stock model into the master inventory model (docs/100 P1c).
--
-- Before: two disconnected stock models — the master `inventory_levels` /
-- `inventory_warehouses` (operational stock, the movement ledger) and the
-- sync-module `stock_levels` / `stock_locations` (fed by InventorySource). The
-- /inventory overview + valuation + reports read the EMPTY sync tables, so they
-- showed zeros (docs/99 D1).
--
-- After: ONE stock model. StockLocation -> Warehouse, StockLevel -> InventoryLevel,
-- and InventorySourceLink repoints from stock_locations to inventory_warehouses.
-- Feeds reconcile into inventory_levels through applyMovement() going forward.
--
-- Data-preserving: any existing sync rows are lifted into the master (preserving
-- ids so source links stay valid), with one opening `sync` movement per lifted
-- level so the `onHand == Σ(movements)` invariant holds. The lift runs per-tenant
-- with `app.tenant_id` set, because inventory_warehouses/levels/movements are
-- FORCE RLS and the migration role is a non-superuser in prod (sees 0 rows
-- otherwise — the packages/db CLAUDE.md FORCE-RLS footgun). In a fresh / pre-feed
-- database the sync tables are empty and the loop is a no-op.

DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN SELECT id FROM tenants LOOP
    PERFORM set_config('app.tenant_id', t.id::text, true);

    -- 1. Lift stock_locations into inventory_warehouses. Preserve the id so
    --    inventory_source_links.location_id stays valid after the FK repoint.
    --    Synthesize a unique warehouse code from the id (warehouses require one);
    --    map the location type onto the warehouse vocabulary.
    INSERT INTO inventory_warehouses
      (id, tenant_id, name, code, type, country, is_active, created_at, updated_at)
    SELECT
      sl.id,
      sl.tenant_id,
      sl.name,
      'LOC-' || upper(substr(replace(sl.id::text, '-', ''), 1, 8)),
      CASE sl.type
        WHEN '3pl'     THEN '3pl'
        WHEN 'virtual' THEN 'virtual'
        WHEN 'transit' THEN 'virtual'
        ELSE 'owned'
      END,
      sl.country_code,
      sl.active,
      sl.created_at,
      sl.updated_at
    FROM stock_locations sl
    WHERE sl.tenant_id = t.id
      AND NOT EXISTS (SELECT 1 FROM inventory_warehouses w WHERE w.id = sl.id);

    -- 2. Lift stock_levels into inventory_levels (only where the (variant,
    --    warehouse) level doesn't already exist on the master side), then write
    --    one opening `sync` movement per lifted non-zero level so the level is
    --    reconcilable to Σ(delta).
    WITH lifted AS (
      INSERT INTO inventory_levels
        (variant_id, warehouse_id, tenant_id, on_hand, allocated, as_of, updated_at)
      SELECT
        s.variant_id, s.location_id, s.tenant_id, s.on_hand, s.allocated, now(), now()
      FROM stock_levels s
      WHERE s.tenant_id = t.id
        AND NOT EXISTS (
          SELECT 1 FROM inventory_levels il
          WHERE il.variant_id = s.variant_id AND il.warehouse_id = s.location_id
        )
      RETURNING variant_id, warehouse_id, tenant_id, on_hand
    )
    INSERT INTO inventory_movements
      (tenant_id, variant_id, warehouse_id, delta, balance_after, reason,
       actor_type, source, note, created_at)
    SELECT
      l.tenant_id, l.variant_id, l.warehouse_id, l.on_hand, l.on_hand, 'sync',
      'integration', 'stock-model-unification',
      'Opening balance migrated from stock_levels (docs/100 P1c)', now()
    FROM lifted l
    WHERE l.on_hand <> 0;
  END LOOP;
END $$;

-- 3. Repoint InventorySourceLink from stock_locations to inventory_warehouses.
ALTER TABLE "inventory_source_links" RENAME COLUMN "location_id" TO "warehouse_id";
ALTER TABLE "inventory_source_links"
  DROP CONSTRAINT IF EXISTS "inventory_source_links_location_id_fkey";
ALTER TABLE "inventory_source_links"
  ADD CONSTRAINT "inventory_source_links_warehouse_id_fkey"
  FOREIGN KEY ("warehouse_id") REFERENCES "inventory_warehouses"("id") ON DELETE CASCADE;

-- 4. Retire the standalone sync stock tables (RLS policies + indexes drop with
--    them). stock_levels first — it references stock_locations.
DROP TABLE IF EXISTS "stock_levels";
DROP TABLE IF EXISTS "stock_locations";
