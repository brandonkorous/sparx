-- Order invoices know their order (sparx persona issue 084).
--
-- An invoice raised for an order on payment terms (at checkout, from an approved
-- held order, or from an accepted quote) recorded its order only as
-- `metadata.orderId`. The order page lists invoices by the real `order_id`
-- link, so it read "You have not asked for the money on this order yet" over an
-- order that had an invoice, and offered "Make an invoice" again: an order on
-- terms could be billed twice. Measured 2026-10-02 on the dev database: 4 of 4
-- order invoices had no link. `createOrderArDocument` now writes it; this links
-- the ones already written.
--
-- Only where the order still exists, so a deleted order's invoice keeps its
-- null (the FK is ON DELETE SET NULL for the same reason). Loops tenants and
-- sets app.tenant_id per tenant: billing_documents and orders are FORCE RLS,
-- and the owner role in production is not a superuser.

DO $$
DECLARE
    t       RECORD;
    n       INTEGER;
    linked  INTEGER := 0;
BEGIN
    FOR t IN SELECT id FROM tenants LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);

        UPDATE billing_documents d
        SET order_id = o.id
        FROM orders o
        WHERE d.tenant_id = t.id
          AND o.tenant_id = t.id
          AND d.order_id IS NULL
          AND d.metadata->>'source' = 'b2b_order'
          AND o.id::text = d.metadata->>'orderId';
        GET DIAGNOSTICS n = ROW_COUNT;
        linked := linked + n;
    END LOOP;
    RAISE NOTICE 'order invoices linked to their order: %', linked;
END $$;
