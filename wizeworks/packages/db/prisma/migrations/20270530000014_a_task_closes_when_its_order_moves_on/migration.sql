-- A task can be about an order, and can close itself when the order moves on.
--
-- When a wholesale order is held for sign-off, a system automation opens a task
-- for the business: "Order O-000014 from Renee Castaneda is waiting for your
-- sign-off: approve or reject it under Approvals". The account's own approver
-- approved O-000014 on the site, the order was placed, and the task stayed open.
-- Same when the business approved or rejected it from the console or over MCP,
-- and when the order was canceled. A task telling the owner to do something
-- that is already done is false, and nothing linked the task to the order it
-- was about: `tasks` knew its customer and its deal, never its order.
--
-- `order_id` is that link. `closes_when_order_leaves` is the status the task
-- exists to move the order out of; the code that moves an order out of a status
-- closes every open task waiting on it, in the same transaction, and says who
-- did it. Null means a person closes it, as before.
--
-- No backfill. The only tasks that would carry these are the ones the held-order
-- automation opens, and they are written with both columns from now on. Older
-- open tasks keep no link and are closed by hand, as they always were.
--
-- `tasks` is already under RLS; two nullable columns change nothing about who
-- can read a row.

ALTER TABLE "tasks" ADD COLUMN "order_id" UUID;
ALTER TABLE "tasks" ADD COLUMN "closes_when_order_leaves" VARCHAR(20);

CREATE INDEX "tasks_tenant_id_order_id_idx" ON "tasks"("tenant_id", "order_id");

ALTER TABLE "tasks"
    ADD CONSTRAINT "tasks_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
