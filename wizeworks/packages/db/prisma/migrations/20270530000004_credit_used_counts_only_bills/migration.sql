-- Credit used counts only bills (sparx persona issue 084).
--
-- `sync_b2b_credit_used` sums what a trade account owes into
-- `companies.credit_used`, and checkout refuses an order on terms when that sum
-- leaves too little credit. It counted every billing document marked unpaid,
-- partial or overdue. A quote is marked `unpaid` from the moment it exists,
-- because the status is about payment and knows nothing about workflows. So a
-- quote nobody had accepted used up the buyer's credit.
--
-- Measured 2026-10-02 on the dev database: Wasatch Front's $4,075.60 draft quote
-- took its credit used from $678.00 to $4,753.60, and two more accounts were
-- overstated ($864.00 and $302.40). A large enough quote would have stopped the
-- customer ordering at all.
--
-- The app already answers "is this owed?" in one place, `OWED_DOCUMENT_WHERE`
-- in @wizeworks/crm (issue 857): an unpaid, partial or overdue document that is
-- NOT on a price-offer workflow and NOT on a draft or void stage. This function
-- was the one copy of that question 857 did not reach. It now asks the same
-- three things, and `credit-used-sql.test.ts` fails if the lists drift.
--
-- Then every account is recomputed. Loops tenants and sets app.tenant_id per
-- tenant: billing_documents and companies are FORCE RLS, and the owner role in
-- production is not a superuser.

CREATE OR REPLACE FUNCTION sync_b2b_credit_used(p_account_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE companies a
  SET credit_used = (
    SELECT COALESCE(SUM(d.balance), 0)
    FROM billing_documents d
    JOIN document_workflows w ON w.id = d.workflow_id
    JOIN document_stages s ON s.id = d.stage_id
    WHERE d.company_id = p_account_id
      AND d.deleted_at IS NULL
      AND d.status IN ('unpaid', 'partial', 'overdue')
      AND w.slug NOT IN ('b2b-quotes', 'customer-estimates')
      AND s.stage_type NOT IN ('draft', 'void')
  ),
  updated_at = now()
  WHERE a.id = p_account_id;
END;
$$;

DO $$
DECLARE
    t       RECORD;
    c       RECORD;
    synced  INTEGER := 0;
BEGIN
    FOR t IN SELECT id FROM tenants LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);
        FOR c IN
            SELECT id FROM companies
            WHERE tenant_id = t.id
              AND (credit_used <> 0
                   OR EXISTS (SELECT 1 FROM billing_documents d WHERE d.company_id = companies.id))
        LOOP
            PERFORM sync_b2b_credit_used(c.id);
            synced := synced + 1;
        END LOOP;
    END LOOP;
    RAISE NOTICE 'trade accounts recomputed: %', synced;
END $$;
