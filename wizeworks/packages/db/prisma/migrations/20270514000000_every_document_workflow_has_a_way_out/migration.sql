-- Every document workflow needs a stage that ENDS a document that should not
-- have been raised.
--
-- WHAT A BUSINESS OWNER SAW (issue 755). A wholesale order, one click on "Make
-- an invoice", and INV-000011 exists. The lines are wrong, so she goes to get
-- rid of it:
--
--   * The More menu offers "Print or save as PDF" and "Copy payment link".
--   * The stage menu offers "Invoice" and "Receipt", and nothing else.
--   * The order now reads: "Order O-000018 has already been invoiced as
--     INV-000011. Open that invoice to chase it, or void it before raising
--     another."
--
-- She cannot void it. The default Invoice workflow -- `isDefault: true`, seeded
-- into every tenant on invoicing activation -- had two stages, Invoice and
-- Paid, and no `void` one. The console's delete is gated on a `draft` stage,
-- which that workflow has not got either. So the invoice was PERMANENT from the
-- moment it was raised, and the order behind it could never be invoiced again.
--
-- The templates are fixed in `crm-schemas/src/builtins/invoicing.ts` and
-- `crm/src/presets/invoicing.ts`, and `check:workflow-exit` fails the build on
-- a new one without an exit. But `bootstrapDefaultWorkflows` skips a workflow
-- whose slug already exists, so respelling the template reaches NEW tenants
-- only. MEASURED 2026-09-20: 205 live workflows, 52 with a void stage, 153
-- without. Every one of those businesses keeps the dead end.
-- [[feedback_data_is_a_deploy_stage]]
--
-- WHAT THIS ADDS, AND WHAT IT LEAVES ALONE.
--
--   * A workflow that already has a `void` stage is skipped. A tenant who named
--     theirs "Written off" or "Declined" keeps it; there is no second one.
--   * The new stage sorts LAST and locks editing, exactly as the templates do.
--   * `customer_label` is 'Canceled' -- the word this console uses for an order
--     stopped before it completed, in American spelling, which is the house
--     rule for text WE write.
--   * No existing document moves. A stage is a door; nothing walks through it
--     here.
--
-- Re-running matches nothing the second time.
--
-- Loops tenants and sets app.tenant_id per tenant: document_stages is FORCE RLS
-- and sparx_owner is a non-superuser in production, so an un-scoped pass would
-- insert zero rows there while passing locally as superuser.
DO $$
DECLARE
    t     RECORD;
    w     RECORD;
    n     INTEGER;
    added INTEGER := 0;
BEGIN
    FOR t IN SELECT id FROM tenants LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);

        FOR w IN
            SELECT wf.id,
                   COALESCE(MAX(s.sort_order), -1) + 1 AS next_sort
            FROM "document_workflows" wf
            JOIN "document_stages" s ON s."workflow_id" = wf.id
            WHERE wf."tenant_id" = t.id
              AND wf."archived_at" IS NULL
            GROUP BY wf.id
            HAVING bool_or(s."stage_type" = 'void') = false
        LOOP
            INSERT INTO "document_stages" (
                "id", "tenant_id", "workflow_id", "name", "customer_label",
                "stage_type", "snapshot_on_enter", "number_on_enter",
                "number_prefix", "locks_editing", "color", "sort_order",
                "created_at", "updated_at"
            )
            VALUES (
                gen_random_uuid(), t.id, w.id, 'Canceled', 'Canceled',
                'void', false, false,
                NULL, true, '#EF4444', w.next_sort,
                now(), now()
            );
            GET DIAGNOSTICS n = ROW_COUNT;
            added := added + n;
        END LOOP;
    END LOOP;

    RAISE NOTICE 'issue 755: % workflow(s) given a way out', added;
END $$;
