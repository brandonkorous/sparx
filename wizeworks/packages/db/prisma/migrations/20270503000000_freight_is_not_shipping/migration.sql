-- Freight is not shipping.
--
-- FREIGHT is inbound: what it costs to get goods from a supplier to you. It is
-- part of what the stock cost, so it belongs in the value of what you hold.
-- SHIPPING is outbound: what it costs to get goods from you to a customer. It
-- is a selling expense and never touches stock value.
--
-- Both directions were called "shipping", in the same database:
--
--   commerce_carts.shipping_total_cents              outbound  (correct)
--   commerce_checkout_sessions.shipping_total_cents  outbound  (correct)
--   inventory_purchase_orders.shipping_cents         INBOUND   (wrong word)
--   inventory_supplier_bills.shipping_cents          INBOUND   (wrong word)
--
-- The wrong word is why the inbound one behaved like the outbound one: a line
-- on a total that never reached what an item cost. A dressmaker typed $25 of
-- carriage into "Shipping cost" on a purchase order, paid $745, and the 38
-- metres that arrived were valued at $684 (persona issue 496).
--
-- A pure rename. The values are preserved and nothing is re-costed here:
-- retroactively moving freight into the cost basis of orders that have already
-- been received would rewrite history in somebody's books. Orders raised from
-- here on pick it up through the freight charge the application now keeps in
-- step with this column.

ALTER TABLE "inventory_purchase_orders" RENAME COLUMN "shipping_cents" TO "freight_cents";
ALTER TABLE "inventory_supplier_bills" RENAME COLUMN "shipping_cents" TO "freight_cents";

-- How freight REACHES the cost of what arrived.
--
-- The landed-cost machinery already spreads a PurchaseOrderCharge across the
-- deliveries on an order, tracking `allocated_cents` so four part-shipments
-- share one charge without double-spending it, and `kind` already begins with
-- 'freight'. So the order's freight becomes one of those charges rather than a
-- second, parallel mechanism.
--
-- This flag is what lets the application find the charge it OWNS and keep it in
-- step with `inventory_purchase_orders.freight_cents`, without mistaking it for
-- a freight charge somebody typed in themselves. At most one per order.
ALTER TABLE "inventory_purchase_order_charges"
  ADD COLUMN "is_order_freight" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "inventory_po_charges_one_order_freight"
  ON "inventory_purchase_order_charges" ("purchase_order_id")
  WHERE "is_order_freight";
