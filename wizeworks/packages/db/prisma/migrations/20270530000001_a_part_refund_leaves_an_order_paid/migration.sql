-- A part refund leaves an order paid (sparx persona issue 051).
--
-- `recomputeOrderPaymentRollup` called an order `partially_paid` whenever the
-- money left after refunds fell below its total. So an order paid in full and
-- then part refunded read as owing money: the console said "some is still owed"
-- and the list of orders to chase listed it. The rule now asks whether the money
-- that came IN covered the order. This repairs rows the old rule already wrote.
--
-- Loops tenants and sets app.tenant_id per tenant: `orders` is FORCE RLS, and
-- the owner role in production is not a superuser, so an unscoped UPDATE would
-- touch zero rows there while passing locally.
DO $$
DECLARE
    t     RECORD;
    n     INTEGER;
    fixed INTEGER := 0;
BEGIN
    FOR t IN SELECT id FROM tenants LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);

        UPDATE "orders" o
        SET "payment_status" = 'paid', "updated_at" = now()
        WHERE o."tenant_id" = t.id
          AND o."payment_status" = 'partially_paid'
          AND o."total" > 0
          AND (
              SELECT COALESCE(SUM(p."amount"), 0)
              FROM "order_payments" p
              WHERE p."order_id" = o."id" AND p."status" = 'captured'
          ) >= o."total";
        GET DIAGNOSTICS n = ROW_COUNT;
        fixed := fixed + n;
    END LOOP;
    RAISE NOTICE 'orders paid in full and part refunded, now paid: %', fixed;
END $$;
