-- A sign-off task opened before tasks could name their order finds it now.
--
-- Measured on Gillett: three "Order ... is waiting for your sign-off: approve
-- or reject it under Approvals" tasks were still open after O-000012 and
-- O-000014 were signed off and O-000013 was turned down. Approvals said
-- "Nothing waiting" and the task list said three things were. They were opened
-- before 20270530000014 gave `tasks` an `order_id`, and that migration chose no
-- backfill: "older open tasks keep no link and are closed by hand". Nothing told
-- the owner which ones were safe to close, so they stayed.
--
-- BACKFILL, LINKS ONLY, the way 20270530000022 did it for accounts, deals and
-- documents. The system automation "Wholesale order waiting: sign it off"
-- records each task it opens in its run: the run's trigger event names the
-- order, and the step's output names the task. That is a fact, so SQL copies it.
-- Whether the order has moved on is a RULE, and it lives in code: the daily seed
-- reconcile (also run on every release) calls `closeTasksWhoseReasonIsGone`,
-- which now closes the linked tasks whose order has left `pending_approval`.
--
-- One more fact repaired on the same rows. Before persona issue 085 the engine
-- carried no customer name, so the title rendered "Order O-000012 from  is
-- waiting". The task's own customer has the name; it goes into the gap, built
-- the way the engine builds `customer.fullName` (first and last, whichever are
-- set). A customer with neither keeps the title as it is.
--
-- Loops tenants and sets app.tenant_id per tenant: tasks, automation_runs,
-- automation_run_steps, orders and customers are FORCE RLS, and the owner role
-- in production is not a superuser, so an unscoped UPDATE would see no rows.

DO $$
DECLARE
    t       RECORD;
    n       INTEGER;
    linked  INTEGER := 0;
    named   INTEGER := 0;
BEGIN
    FOR t IN SELECT id FROM tenants LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);

        UPDATE tasks AS task
        SET order_id = (run.trigger_event -> 'data' ->> 'orderId')::uuid,
            closes_when_order_leaves = 'pending_approval'
        FROM automation_runs AS run
        JOIN automations AS rule ON rule.id = run.automation_id
        JOIN automation_run_steps AS step ON step.run_id = run.id
        WHERE run.tenant_id = t.id
          AND rule.system_key = 'b2b.order-held-sign-off-task'
          AND step.action_type = 'crm.create_task'
          AND task.tenant_id = t.id
          AND task.id::text = step.output ->> 'taskId'
          AND task.order_id IS NULL
          AND EXISTS (
              SELECT 1 FROM orders AS o
              WHERE o.tenant_id = t.id
                AND o.id::text = run.trigger_event -> 'data' ->> 'orderId'
          );
        GET DIAGNOSTICS n = ROW_COUNT;
        linked := linked + n;

        UPDATE tasks AS task
        SET title = replace(
                task.title,
                ' from  is waiting',
                ' from ' || concat_ws(' ', nullif(btrim(c.first_name), ''), nullif(btrim(c.last_name), '')) || ' is waiting'
            )
        FROM customers AS c
        JOIN automation_runs AS run ON true
        JOIN automations AS rule ON rule.id = run.automation_id
        JOIN automation_run_steps AS step ON step.run_id = run.id
        WHERE run.tenant_id = t.id
          AND rule.system_key = 'b2b.order-held-sign-off-task'
          AND step.action_type = 'crm.create_task'
          AND task.tenant_id = t.id
          AND task.id::text = step.output ->> 'taskId'
          AND c.tenant_id = t.id
          AND c.id = task.customer_id
          AND task.title LIKE '% from  is waiting%'
          AND concat_ws(' ', nullif(btrim(c.first_name), ''), nullif(btrim(c.last_name), '')) <> '';
        GET DIAGNOSTICS n = ROW_COUNT;
        named := named + n;
    END LOOP;
    RAISE NOTICE 'sign-off tasks linked to their order: %', linked;
    RAISE NOTICE 'sign-off task titles given back their customer name: %', named;
END $$;
