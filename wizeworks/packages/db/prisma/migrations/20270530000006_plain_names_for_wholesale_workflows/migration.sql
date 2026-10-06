-- Plain names for the two wholesale workflows (sparx persona issue 085).
--
-- The quote editor read "Document type: B2B Quotes" to a shop owner whose
-- console calls the same thing Wholesale everywhere else, and the receivables
-- workflow was named "Net-terms AR", which is accounting shorthand. The
-- built-in names are now "Wholesale quotes" and "Invoices on account"; this
-- renames the rows already seeded.
--
-- Only rows still carrying the OLD built-in name: a shop that renamed its own
-- workflow keeps its name. Every service finds these workflows by slug, never
-- by name (crm workflow-system-slug test), so the rename moves nothing else.
-- Loops tenants and sets app.tenant_id per tenant: document_workflows is FORCE
-- RLS, and the owner role in production is not a superuser.

DO $$
DECLARE
    t        RECORD;
    n        INTEGER;
    renamed  INTEGER := 0;
BEGIN
    FOR t IN SELECT id FROM tenants LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);

        UPDATE document_workflows
        SET name = 'Wholesale quotes'
        WHERE tenant_id = t.id AND slug = 'b2b-quotes' AND name = 'B2B Quotes';
        GET DIAGNOSTICS n = ROW_COUNT;
        renamed := renamed + n;

        UPDATE document_workflows
        SET name = 'Invoices on account'
        WHERE tenant_id = t.id AND slug = 'net-terms-ar' AND name = 'Net-terms AR';
        GET DIAGNOSTICS n = ROW_COUNT;
        renamed := renamed + n;
    END LOOP;
    RAISE NOTICE 'wholesale workflows given plain names: %', renamed;
END $$;
