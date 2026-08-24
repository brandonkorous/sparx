-- Issue 026 — a cake that needs five days' notice and a $30 deposit was not a
-- thing a product could be.
--
-- Three separate promises a shop that MAKES the thing has to be able to make,
-- none of which had anywhere to live:
--
--   1. "order this ahead"   → order_ahead_days
--   2. "pay some of it now" → deposit_type + deposit_amount_cents/deposit_percent
--   3. "24 a day"           → daily_limit
--
-- The nearest existing homes were all wrong. `inventory_levels.lead_time_days`
-- is how long a SUPPLIER takes to restock her, not how long a customer waits.
-- `booking_policies.deposit_*` belongs to a slot on a calendar, and a cake is a
-- thing being bought. `preorder_windows.max_quantity` caps ONE window once, not
-- 24 again tomorrow.
--
-- Every column is nullable (or defaults to 'none'), so every existing product
-- keeps behaving exactly as it does today: taken off a shelf, paid in full, as
-- many as there are.

ALTER TABLE commerce_products
    ADD COLUMN order_ahead_days     INTEGER,
    ADD COLUMN deposit_type         VARCHAR(10) NOT NULL DEFAULT 'none',
    ADD COLUMN deposit_amount_cents INTEGER,
    ADD COLUMN deposit_percent      INTEGER,
    ADD COLUMN daily_limit          INTEGER;

-- The rules are enforced here as well as in the service, because these three
-- columns decide what a customer is charged and when they are told they can
-- collect. A percent of 0, or a deposit larger than a whole order, is not a
-- validation nicety — it is money.
ALTER TABLE commerce_products
    ADD CONSTRAINT commerce_products_deposit_type_check
        CHECK (deposit_type IN ('none', 'amount', 'percent')),
    ADD CONSTRAINT commerce_products_deposit_shape_check
        CHECK (
            (deposit_type = 'none')
            OR (deposit_type = 'amount'  AND deposit_amount_cents IS NOT NULL AND deposit_amount_cents > 0)
            OR (deposit_type = 'percent' AND deposit_percent      IS NOT NULL AND deposit_percent BETWEEN 1 AND 100)
        ),
    ADD CONSTRAINT commerce_products_order_ahead_days_check
        CHECK (order_ahead_days IS NULL OR (order_ahead_days >= 1 AND order_ahead_days <= 365)),
    ADD CONSTRAINT commerce_products_daily_limit_check
        CHECK (daily_limit IS NULL OR daily_limit >= 1);

-- The daily-limit guard counts today's sold quantity for one product. The
-- existing order_items(product_id) index finds the lines; this one lets the
-- planner cut the orders side down to a single day before it does.
CREATE INDEX IF NOT EXISTS orders_tenant_placed_day_idx
    ON orders (tenant_id, placed_at)
    WHERE status <> 'cancelled';

-- The day the order can actually be handed over. Frozen at placement: a shop
-- that lengthens a cake's notice next month must not silently move a date a
-- customer was already promised.
ALTER TABLE orders
    ADD COLUMN ready_on DATE;
