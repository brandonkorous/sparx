-- A due day typed on a wholesale invoice reads as that day again.
--
-- Measured on Gillett: invoice 4471 for O'Malley Ranch, raised by hand and due
-- Aug 27, 2026, read "Aug 27" on its own page and "Aug 26" on the Wholesale
-- invoices list (sparx persona issue 098). Raise an invoice, and the due date
-- box on a wholesale invoice, stored the picked day at MIDNIGHT UTC, which is
-- the evening before for every reader west of Greenwich. The rest of invoicing
-- stores a due day at MIDDAY UTC (`dayMiddayUtc`), the same calendar day in
-- every zone anybody uses. Both consoles now store midday.
--
-- REPAIR, FACTS ONLY. A due date on a trade bill at exactly 00:00:00 UTC was
-- written by one of those two boxes: order invoices are stamped at the moment
-- they are raised plus their terms, never at a whole UTC midnight. Each moves
-- forward twelve hours to midday of the SAME UTC day, which is the day that was
-- typed. Nothing else on the row changes; whether it is late is worked out from
-- the date by the daily check, as it always was.
--
-- Loops tenants and sets app.tenant_id per tenant: billing_documents is FORCE
-- RLS, and the owner role in production is not a superuser, so an unscoped
-- UPDATE would see no rows.

DO $$
DECLARE
    t      RECORD;
    n      INTEGER;
    moved  INTEGER := 0;
BEGIN
    FOR t IN SELECT id FROM tenants LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);

        UPDATE billing_documents
        SET due_at = due_at + INTERVAL '12 hours'
        WHERE tenant_id = t.id
          AND company_id IS NOT NULL
          AND deleted_at IS NULL
          AND due_at IS NOT NULL
          AND (due_at AT TIME ZONE 'UTC')::time = TIME '00:00:00';
        GET DIAGNOSTICS n = ROW_COUNT;
        moved := moved + n;
    END LOOP;

    RAISE NOTICE 'wholesale due days moved to midday UTC: %', moved;
END $$;
