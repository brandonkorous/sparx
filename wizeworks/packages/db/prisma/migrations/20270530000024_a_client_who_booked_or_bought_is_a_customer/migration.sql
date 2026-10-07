-- A person with a booking or an order is a customer (persona issue 113).
--
-- Measured on Halo & Hem: Priyanka Deshmukh had a $180 color appointment on
-- Friday and her record read "Lead". Only an order ever moved anyone off that
-- stage, so in a business that sells time every client stayed a lead, and every
-- group, filter and report that asks for customers left them out. 53 people
-- across 9 businesses in dev.
--
-- The RULE lives in code: `recognizeBookedCustomers` in @wizeworks/scheduling,
-- called in the same write that puts a person on a booking or into a class
-- seat. This applies the same rule once to the people booked before it existed:
--   - a booking made for them, in any state but `waitlisted`, the way the code
--     promotes at the moment of booking and never demotes after;
--   - a class seat that is still a seat, or was attended or missed. A cancelled
--     seat is left out: the row cannot say whether it was ever more than a
--     waiting-list place.
-- Forward only, as in code: `customer` and `evangelist` are never touched, and
-- `lead_status` is cleared with the move.
--
-- And the people the ORDER rule never reached. `recomputeCustomerCommerce`
-- promotes a buyer on their next order (issue 280), and chose no backfill, so
-- anyone whose orders all came before it is still a lead: Priyanka herself has
-- two paid orders, $67.00, and read "Lead" above them. 38 people across 8
-- businesses in dev. The same rule as that code: any order but a cancelled one
-- (`UNCOUNTED_ORDER_STATUS`). 65 people in all, since some had both.
--
-- Loops tenants and sets app.tenant_id per tenant: customers, bookings and
-- booking_attendees and orders are FORCE RLS, and the owner role in production is not a
-- superuser, so an unscoped UPDATE would see no rows.

DO $$
DECLARE
    t      RECORD;
    n      INTEGER;
    moved  INTEGER := 0;
BEGIN
    FOR t IN SELECT id FROM tenants LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);

        UPDATE customers AS c
        SET lifecycle_stage = 'customer',
            lead_status = NULL
        WHERE c.tenant_id = t.id
          AND c.deleted_at IS NULL
          AND c.lifecycle_stage NOT IN ('customer', 'evangelist')
          AND (
              EXISTS (
                  SELECT 1 FROM orders AS o
                  WHERE o.tenant_id = t.id
                    AND o.customer_id = c.id
                    AND o.status <> 'cancelled'
              )
              OR EXISTS (
                  SELECT 1 FROM bookings AS b
                  WHERE b.tenant_id = t.id
                    AND b.customer_id = c.id
                    AND b.deleted_at IS NULL
                    AND b.status <> 'waitlisted'
              )
              OR EXISTS (
                  SELECT 1 FROM booking_attendees AS a
                  JOIN bookings AS b ON b.id = a.booking_id
                  WHERE a.tenant_id = t.id
                    AND a.customer_id = c.id
                    AND b.deleted_at IS NULL
                    AND a.status NOT IN ('waitlisted', 'cancelled')
              )
          );
        GET DIAGNOSTICS n = ROW_COUNT;
        moved := moved + n;
    END LOOP;

    RAISE NOTICE 'a client with a booking or an order is a customer: % people moved off lead', moved;
END $$;
