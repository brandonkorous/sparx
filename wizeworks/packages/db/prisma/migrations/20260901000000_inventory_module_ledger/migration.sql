-- Inventory module extraction — table rename + movement-ledger hardening (docs/100 P1b).
--
-- Pre-launch, no user data to preserve, but we still ALTER ... RENAME (never
-- DROP/CREATE) so the change is reversible and RLS policies survive intact.
--
-- 1. Rename the six inventory tables `commerce_* → inventory_*` (+ their PKs,
--    FKs, indexes, and RLS policies) to match the new module ownership.
-- 2. Rename model `InventoryAdjustment → InventoryMovement` (commerce_inventory_adjustments
--    → inventory_movements) — it records every kind of stock movement, not just adjustments.
-- 3. Harden the ledger: actor attribution (actor_type/actor_id/source), an
--    idempotency_key (+ unique index), and a running balance_after.
-- 4. Add moving-average cost basis (avg_cost_cents) to inventory_levels.

-- ── Tables ──────────────────────────────────────────────────────────────────
ALTER TABLE "commerce_warehouses" RENAME TO "inventory_warehouses";
ALTER TABLE "commerce_inventory_levels" RENAME TO "inventory_levels";
ALTER TABLE "commerce_inventory_adjustments" RENAME TO "inventory_movements";
ALTER TABLE "commerce_inventory_reservations" RENAME TO "inventory_reservations";
ALTER TABLE "commerce_lot_batches" RENAME TO "inventory_lot_batches";
ALTER TABLE "commerce_serial_units" RENAME TO "inventory_serial_units";

-- ── Primary keys ────────────────────────────────────────────────────────────
ALTER TABLE "inventory_warehouses" RENAME CONSTRAINT "commerce_warehouses_pkey" TO "inventory_warehouses_pkey";
ALTER TABLE "inventory_levels" RENAME CONSTRAINT "commerce_inventory_levels_pkey" TO "inventory_levels_pkey";
ALTER TABLE "inventory_movements" RENAME CONSTRAINT "commerce_inventory_adjustments_pkey" TO "inventory_movements_pkey";
ALTER TABLE "inventory_reservations" RENAME CONSTRAINT "commerce_inventory_reservations_pkey" TO "inventory_reservations_pkey";
ALTER TABLE "inventory_lot_batches" RENAME CONSTRAINT "commerce_lot_batches_pkey" TO "inventory_lot_batches_pkey";
ALTER TABLE "inventory_serial_units" RENAME CONSTRAINT "commerce_serial_units_pkey" TO "inventory_serial_units_pkey";

-- ── Foreign keys ────────────────────────────────────────────────────────────
ALTER TABLE "inventory_warehouses" RENAME CONSTRAINT "commerce_warehouses_tenant_id_fkey" TO "inventory_warehouses_tenant_id_fkey";

ALTER TABLE "inventory_levels" RENAME CONSTRAINT "commerce_inventory_levels_tenant_id_fkey" TO "inventory_levels_tenant_id_fkey";
ALTER TABLE "inventory_levels" RENAME CONSTRAINT "commerce_inventory_levels_variant_id_fkey" TO "inventory_levels_variant_id_fkey";
ALTER TABLE "inventory_levels" RENAME CONSTRAINT "commerce_inventory_levels_warehouse_id_fkey" TO "inventory_levels_warehouse_id_fkey";

ALTER TABLE "inventory_movements" RENAME CONSTRAINT "commerce_inventory_adjustments_tenant_id_fkey" TO "inventory_movements_tenant_id_fkey";
ALTER TABLE "inventory_movements" RENAME CONSTRAINT "commerce_inventory_adjustments_variant_id_fkey" TO "inventory_movements_variant_id_fkey";
ALTER TABLE "inventory_movements" RENAME CONSTRAINT "commerce_inventory_adjustments_warehouse_id_fkey" TO "inventory_movements_warehouse_id_fkey";

ALTER TABLE "inventory_reservations" RENAME CONSTRAINT "commerce_inventory_reservations_tenant_id_fkey" TO "inventory_reservations_tenant_id_fkey";
ALTER TABLE "inventory_reservations" RENAME CONSTRAINT "commerce_inventory_reservations_variant_id_fkey" TO "inventory_reservations_variant_id_fkey";
ALTER TABLE "inventory_reservations" RENAME CONSTRAINT "commerce_inventory_reservations_warehouse_id_fkey" TO "inventory_reservations_warehouse_id_fkey";

ALTER TABLE "inventory_lot_batches" RENAME CONSTRAINT "commerce_lot_batches_tenant_id_fkey" TO "inventory_lot_batches_tenant_id_fkey";
ALTER TABLE "inventory_lot_batches" RENAME CONSTRAINT "commerce_lot_batches_variant_id_fkey" TO "inventory_lot_batches_variant_id_fkey";
ALTER TABLE "inventory_lot_batches" RENAME CONSTRAINT "commerce_lot_batches_warehouse_id_fkey" TO "inventory_lot_batches_warehouse_id_fkey";

ALTER TABLE "inventory_serial_units" RENAME CONSTRAINT "commerce_serial_units_tenant_id_fkey" TO "inventory_serial_units_tenant_id_fkey";
ALTER TABLE "inventory_serial_units" RENAME CONSTRAINT "commerce_serial_units_variant_id_fkey" TO "inventory_serial_units_variant_id_fkey";
ALTER TABLE "inventory_serial_units" RENAME CONSTRAINT "commerce_serial_units_warehouse_id_fkey" TO "inventory_serial_units_warehouse_id_fkey";
ALTER TABLE "inventory_serial_units" RENAME CONSTRAINT "commerce_serial_units_lot_batch_id_fkey" TO "inventory_serial_units_lot_batch_id_fkey";

-- ── Indexes ─────────────────────────────────────────────────────────────────
ALTER INDEX "commerce_warehouses_tenant_id_is_active_idx" RENAME TO "inventory_warehouses_tenant_id_is_active_idx";
ALTER INDEX "warehouses_tenant_code_unique" RENAME TO "inventory_warehouses_tenant_code_unique";

ALTER INDEX "commerce_inventory_levels_tenant_id_warehouse_id_idx" RENAME TO "inventory_levels_tenant_id_warehouse_id_idx";
ALTER INDEX "commerce_inventory_levels_tenant_id_on_hand_idx" RENAME TO "inventory_levels_tenant_id_on_hand_idx";

ALTER INDEX "commerce_inventory_adjustments_tenant_id_variant_id_created_idx" RENAME TO "inventory_movements_tenant_id_variant_id_created_at_idx";
ALTER INDEX "commerce_inventory_adjustments_tenant_id_warehouse_id_creat_idx" RENAME TO "inventory_movements_tenant_id_warehouse_id_created_at_idx";
ALTER INDEX "commerce_inventory_adjustments_tenant_id_reference_type_ref_idx" RENAME TO "inventory_movements_tenant_id_reference_type_reference_id_idx";

ALTER INDEX "commerce_inventory_reservations_tenant_id_variant_id_status_idx" RENAME TO "inventory_reservations_tenant_id_variant_id_status_idx";
ALTER INDEX "commerce_inventory_reservations_tenant_id_holder_type_holde_idx" RENAME TO "inventory_reservations_tenant_id_holder_type_holder_id_idx";
ALTER INDEX "commerce_inventory_reservations_status_expires_at_idx" RENAME TO "inventory_reservations_status_expires_at_idx";

ALTER INDEX "commerce_lot_batches_tenant_id_expires_at_idx" RENAME TO "inventory_lot_batches_tenant_id_expires_at_idx";
ALTER INDEX "commerce_lot_batches_tenant_id_recall_status_idx" RENAME TO "inventory_lot_batches_tenant_id_recall_status_idx";
ALTER INDEX "lot_batches_variant_lot_unique" RENAME TO "inventory_lot_batches_variant_lot_unique";

ALTER INDEX "commerce_serial_units_tenant_id_status_idx" RENAME TO "inventory_serial_units_tenant_id_status_idx";
ALTER INDEX "commerce_serial_units_tenant_id_lot_batch_id_idx" RENAME TO "inventory_serial_units_tenant_id_lot_batch_id_idx";
ALTER INDEX "commerce_serial_units_sold_on_order_item_id_idx" RENAME TO "inventory_serial_units_sold_on_order_item_id_idx";
ALTER INDEX "serial_units_variant_serial_unique" RENAME TO "inventory_serial_units_variant_serial_unique";

-- ── RLS policies (hand-managed; renamed for naming consistency) ──────────────
-- ENABLE + FORCE survive a table rename, so only the policy names change.
ALTER POLICY "commerce_warehouses_tenant_isolation" ON "inventory_warehouses" RENAME TO "inventory_warehouses_tenant_isolation";
ALTER POLICY "commerce_inventory_levels_tenant_isolation" ON "inventory_levels" RENAME TO "inventory_levels_tenant_isolation";
ALTER POLICY "commerce_inventory_adjustments_tenant_isolation" ON "inventory_movements" RENAME TO "inventory_movements_tenant_isolation";
ALTER POLICY "commerce_inventory_reservations_tenant_isolation" ON "inventory_reservations" RENAME TO "inventory_reservations_tenant_isolation";
ALTER POLICY "commerce_lot_batches_tenant_isolation" ON "inventory_lot_batches" RENAME TO "inventory_lot_batches_tenant_isolation";
ALTER POLICY "commerce_serial_units_tenant_isolation" ON "inventory_serial_units" RENAME TO "inventory_serial_units_tenant_isolation";

-- ── inventory_levels: moving-average cost basis ─────────────────────────────
ALTER TABLE "inventory_levels" ADD COLUMN "avg_cost_cents" INTEGER;

-- ── inventory_movements: ledger hardening ───────────────────────────────────
-- actor_user_id (uuid) → actor_id (varchar) so an integration/agent identifier
-- fits alongside a user uuid.
ALTER TABLE "inventory_movements" RENAME COLUMN "actor_user_id" TO "actor_id";
ALTER TABLE "inventory_movements" ALTER COLUMN "actor_id" TYPE VARCHAR(127) USING "actor_id"::text;
ALTER TABLE "inventory_movements" ADD COLUMN "actor_type" VARCHAR(20) NOT NULL DEFAULT 'system';
ALTER TABLE "inventory_movements" ADD COLUMN "source" VARCHAR(63);
ALTER TABLE "inventory_movements" ADD COLUMN "idempotency_key" VARCHAR(127);
ALTER TABLE "inventory_movements" ADD COLUMN "balance_after" INTEGER;

-- Idempotency guard. Postgres treats NULLs as distinct, so non-guarded
-- movements (null key) never collide; guarded writers apply exactly once.
CREATE UNIQUE INDEX "inventory_movements_tenant_idempotency_unique" ON "inventory_movements"("tenant_id", "idempotency_key");
