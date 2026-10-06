-- A task the platform opens closes itself when its reason is gone.
--
-- Measured on Gillett: "Set up prices and terms for Wasatch Front Utility
-- Contractors, LLC" stayed open while Wasatch had the Fleet price tier, a
-- $25,000 credit limit and Net 30. The system automation "New wholesale
-- customer: set-up task" opened it when the account was added without terms,
-- and nothing ever closed it once the business set them. `tasks` could not even
-- say which account it was about: it knew a customer, a deal and an order.
--
-- The same shape in three more system automations, closed the same way:
--   "Follow up" on a new deal         -> closes when the deal leaves an open stage
--   "Create invoice" on a won deal    -> closes when the deal leaves won
--   "<number> was approved: take it to the next step" on a billing document
--                                     -> closes when the document is taken on
--                                        (another stage, turned into an order),
--                                        voided or removed
--
-- New columns:
--   company_id                  the account the task is about (FK, SetNull)
--   closes_when_account_set_up  closes, done, once the account is set up by the
--                               rule the automation opens it on
--   closes_when_deal_leaves     the deal stage TYPE the task exists for
--   billing_document_id         the document the task is about (FK, SetNull)
--   closes_when_document_leaves the document stage the task exists for
--
-- `tasks` is already under FORCE RLS with `tenant_isolation`; new columns change
-- nothing about who can read a row.
--
-- BACKFILL, LINKS ONLY. Each task those four automations opened is recorded in
-- its run: the run's trigger event names the account / deal / document, and the
-- step's output names the task. That is a fact, so SQL can copy it. Whether the
-- reason is gone is a RULE, and the rule lives in code (`ACCOUNT_SET_UP_TO_DO`
-- and the closers in taskService), so SQL does not decide it: the daily seed
-- reconcile (also run on every release) calls `closeTasksWhoseReasonIsGone`,
-- which closes the linked tasks whose account is already set up, whose deal has
-- moved on, or whose document has, through the same code every save calls.
--
-- Loops tenants and sets app.tenant_id per tenant: tasks, automation_runs,
-- automation_run_steps, companies and billing_documents are FORCE RLS, and the
-- owner role in production is not a superuser, so an unscoped UPDATE would see
-- no rows.

ALTER TABLE "tasks" ADD COLUMN "company_id" UUID;
ALTER TABLE "tasks" ADD COLUMN "closes_when_account_set_up" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tasks" ADD COLUMN "closes_when_deal_leaves" VARCHAR(20);
ALTER TABLE "tasks" ADD COLUMN "billing_document_id" UUID;
ALTER TABLE "tasks" ADD COLUMN "closes_when_document_leaves" UUID;

CREATE INDEX "tasks_tenant_id_company_id_idx" ON "tasks"("tenant_id", "company_id");
CREATE INDEX "tasks_tenant_id_billing_document_id_idx" ON "tasks"("tenant_id", "billing_document_id");

ALTER TABLE "tasks"
    ADD CONSTRAINT "tasks_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tasks"
    ADD CONSTRAINT "tasks_billing_document_id_fkey" FOREIGN KEY ("billing_document_id") REFERENCES "billing_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DO $$
DECLARE
    t        RECORD;
    n        INTEGER;
    accounts INTEGER := 0;
    deals    INTEGER := 0;
    docs     INTEGER := 0;
BEGIN
    FOR t IN SELECT id FROM tenants LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);

        -- "Set up prices and terms for ...": the account the run was about.
        UPDATE tasks AS task
        SET company_id = (run.trigger_event -> 'data' ->> 'companyId')::uuid,
            closes_when_account_set_up = true
        FROM automation_runs AS run
        JOIN automations AS rule ON rule.id = run.automation_id
        JOIN automation_run_steps AS step ON step.run_id = run.id
        WHERE run.tenant_id = t.id
          AND rule.system_key = 'b2b.new-account-setup-task'
          AND step.action_type = 'crm.create_task'
          AND task.tenant_id = t.id
          AND task.id::text = step.output ->> 'taskId'
          AND EXISTS (
              SELECT 1 FROM companies AS c
              WHERE c.tenant_id = t.id
                AND c.id::text = run.trigger_event -> 'data' ->> 'companyId'
          );
        GET DIAGNOSTICS n = ROW_COUNT;
        accounts := accounts + n;

        -- "Follow up" and "Create invoice": the deal is on the task already.
        UPDATE tasks AS task
        SET closes_when_deal_leaves =
                CASE rule.system_key
                    WHEN 'crm.new-lead-follow-up-task' THEN 'open'
                    ELSE 'won'
                END
        FROM automation_runs AS run
        JOIN automations AS rule ON rule.id = run.automation_id
        JOIN automation_run_steps AS step ON step.run_id = run.id
        WHERE run.tenant_id = t.id
          AND rule.system_key IN ('crm.new-lead-follow-up-task', 'crm.deal-won-invoice-task')
          AND step.action_type = 'crm.create_task'
          AND task.tenant_id = t.id
          AND task.id::text = step.output ->> 'taskId'
          AND task.deal_id IS NOT NULL;
        GET DIAGNOSTICS n = ROW_COUNT;
        deals := deals + n;

        -- "... was approved: take it to the next step": the document and the
        -- stage it was approved into, as the run's event named them.
        UPDATE tasks AS task
        SET billing_document_id = (run.trigger_event -> 'data' ->> 'documentId')::uuid,
            closes_when_document_leaves = (run.trigger_event -> 'data' ->> 'toStageId')::uuid
        FROM automation_runs AS run
        JOIN automations AS rule ON rule.id = run.automation_id
        JOIN automation_run_steps AS step ON step.run_id = run.id
        WHERE run.tenant_id = t.id
          AND rule.system_key = 'invoicing.estimate-approved-task'
          AND step.action_type = 'crm.create_task'
          AND task.tenant_id = t.id
          AND task.id::text = step.output ->> 'taskId'
          AND run.trigger_event -> 'data' ->> 'toStageId' IS NOT NULL
          AND EXISTS (
              SELECT 1 FROM billing_documents AS d
              WHERE d.tenant_id = t.id
                AND d.id::text = run.trigger_event -> 'data' ->> 'documentId'
          );
        GET DIAGNOSTICS n = ROW_COUNT;
        docs := docs + n;
    END LOOP;
    RAISE NOTICE 'set-up tasks linked to their account: %', accounts;
    RAISE NOTICE 'deal tasks told which stage type they wait on: %', deals;
    RAISE NOTICE 'approved-document tasks linked to their document: %', docs;
END $$;
