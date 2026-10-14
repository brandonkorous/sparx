-- A returned core's deposit taken off an invoice is a credit, not a payment
-- (sparx persona issue 185).
--
-- `receiveCores` recorded it as kind 'payment', method 'other', reference 'Core
-- returned', so a fleet's statement printed "Payment, ref Core returned" for money
-- the fleet never sent, and the invoicing report counted it as collected. It now
-- writes kind 'credit', reference 'Returned core'. The rows the old code wrote are
-- moved to the new shape here, and the order payment each one mirrored onto its
-- order (processor_ref = the invoice payment's id) gets the note the order screen
-- draws. Only rows in exactly the old code's shape are touched: a payment somebody
-- typed by hand keeps its kind.
--
-- Loops tenants and sets app.tenant_id per tenant: both tables are FORCE RLS, and
-- the owner role in production is not a superuser.

DO $$
DECLARE
    t       RECORD;
    n       INTEGER;
    moved   INTEGER := 0;
BEGIN
    FOR t IN SELECT id FROM tenants LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);

        UPDATE order_payments op
        SET metadata = op.metadata || jsonb_build_object(
                'billingPaymentKind', 'credit',
                'note', 'Credit for returned core')
        FROM billing_document_payments p
        WHERE op.tenant_id = t.id
          AND p.tenant_id = t.id
          AND op.processor_ref = p.id::text
          AND p.kind = 'payment'
          AND p.method = 'other'
          AND p.reference = 'Core returned';

        UPDATE billing_document_payments
        SET kind = 'credit', reference = 'Returned core'
        WHERE tenant_id = t.id
          AND kind = 'payment'
          AND method = 'other'
          AND reference = 'Core returned';
        GET DIAGNOSTICS n = ROW_COUNT;
        moved := moved + n;
    END LOOP;

    RAISE NOTICE 'moved % returned-core payments to credits', moved;
END
$$;
