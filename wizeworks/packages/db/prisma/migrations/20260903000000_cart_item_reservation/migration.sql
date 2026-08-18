-- Sell-path seam (docs/100 §2.4, P2): a cart line carries the id of the soft
-- inventory hold it created. Set when the inventory module is active; null when
-- off (untracked = always available). NOT a foreign key — it points across the
-- module boundary into inventory_reservations and the reservation reaper/expiry
-- may retire the row independently of the cart line (a stale id reads as "no
-- active hold" on re-check). App-tier only; tenant_id stays the RLS boundary, so
-- NO policy change. No backfill — existing cart lines stay null.

-- AlterTable
ALTER TABLE "commerce_cart_items" ADD COLUMN "inventory_reservation_id" UUID;
