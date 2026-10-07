-- Every due date is a day, stored at midday UTC.
--
-- Measured on Gillett: INV-000014, Wasatch Front's Net 30 bill for an order
-- placed at 10:11 PM Mountain on Oct 3, read "Nov 2, 2026" on the Wholesale
-- invoices list and "Nov 3, 2026" on Owed to you (sparx persona issue 099). The
-- writers that work a due date out from terms (checkout on account, signing off
-- a held order, accepting a quote, an invoice entering its payable stage) added
-- the days to the MOMENT: 05:11 UTC on Nov 3, which is the evening of Nov 2 in
-- Denver. The platform counts and prints a due date as its UTC calendar day
-- (`daysPastDue`, `formatDay`), and one list read the moment in local time.
--
-- The writers now count the business's own calendar day and store it at midday
-- UTC (`dueDayAfter`), the house rule `dayMiddayUtc` already set for a typed
-- day: midday is the same calendar day in every zone anybody uses.
--
-- REPAIR, FACTS ONLY. Each stored due date keeps the day it has been counted,
-- aged and printed as all along, its UTC calendar day, and only its time moves
-- to midday. Nothing already sent to a customer changes its date. (Migration
-- 20270530000025 did the same for the typed wholesale days stored at midnight.)
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
        SET due_at = ((due_at AT TIME ZONE 'UTC')::date + TIME '12:00') AT TIME ZONE 'UTC'
        WHERE tenant_id = t.id
          AND due_at IS NOT NULL
          AND (due_at AT TIME ZONE 'UTC')::time <> TIME '12:00';
        GET DIAGNOSTICS n = ROW_COUNT;
        moved := moved + n;
    END LOOP;

    RAISE NOTICE 'due dates moved to midday UTC of the same day: %', moved;
END $$;
