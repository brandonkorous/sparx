-- A RETURN CANNOT OUTLIVE ITS SALE.
--
-- `commerce_return_requests.order_id` was the only relation on that table with
-- no foreign key. Every sibling had one: tenant, items, inspections, labels.
-- So when an order went away, its returns stayed, pointing at a uuid that
-- resolves to nothing.
--
-- Measured 2026-09-16, before this ran:
--
--     83 return requests on the platform
--     35 of them (42.2%) point at an order that does not exist, across 4 tenants
--     every one of those 35 has a line item, and every one of THOSE line items
--     points at an order item that is gone too
--     one shop's returns list was 20 dead rows in 28
--
-- A return with no sale is not a partial record. There is no customer on it, no
-- items, no money, and nothing an owner can do with it. The console already
-- knows this: it renders the customer as "The sale is gone" and the stage as
-- "Nothing to do" (persona issue 225). That was the symptom getting a label.
-- This is the cause.
--
-- Two steps, in this order, because the constraint cannot be added over rows
-- that already violate it:
--   1. delete the dangling returns (their lines, inspections and labels follow
--      on the cascades that DO exist)
--   2. add the two missing foreign keys, cascading, so it cannot recur
--
-- THE DELETE LOOPS TENANTS AND SETS THE TENANT CONTEXT. These tables force row
-- level security and the migration role is not a superuser in production, so a
-- plain DELETE here matches ZERO rows in production while passing locally, and
-- reports success either way. Migration 20270418 learned this the hard way.

DO $$
DECLARE
  t           RECORD;
  removed     INTEGER;
  total       INTEGER := 0;
  tenants_hit INTEGER := 0;
BEGIN
  FOR t IN SELECT id FROM tenants LOOP
    PERFORM set_config('app.tenant_id', t.id::text, true);

    DELETE FROM commerce_return_requests r
     WHERE r.tenant_id = t.id
       AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.id = r.order_id);

    GET DIAGNOSTICS removed = ROW_COUNT;
    IF removed > 0 THEN
      total := total + removed;
      tenants_hit := tenants_hit + 1;
      RAISE NOTICE 'tenant %: removed % return(s) with no sale behind them', t.id, removed;
    END IF;
  END LOOP;

  RAISE NOTICE 'returns with no sale removed: % across % tenant(s)', total, tenants_hit;
END $$;

-- A line whose order item is gone but whose return survived would block the
-- second constraint on its own. None exist today (all 35 belonged to the
-- returns deleted above), but the constraint is what makes that permanent, and
-- a migration must not assume the measurement it was written against.
DO $$
DECLARE
  t       RECORD;
  removed INTEGER;
  total   INTEGER := 0;
BEGIN
  FOR t IN SELECT id FROM tenants LOOP
    PERFORM set_config('app.tenant_id', t.id::text, true);

    DELETE FROM commerce_return_line_items li
     WHERE li.tenant_id = t.id
       AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.id = li.order_item_id);

    GET DIAGNOSTICS removed = ROW_COUNT;
    total := total + removed;
  END LOOP;

  RAISE NOTICE 'return lines with no order item removed: %', total;
END $$;

ALTER TABLE "commerce_return_requests"
  ADD CONSTRAINT "commerce_return_requests_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id")
  ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "commerce_return_line_items"
  ADD CONSTRAINT "commerce_return_line_items_order_item_id_fkey"
  FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id")
  ON UPDATE CASCADE ON DELETE CASCADE;
