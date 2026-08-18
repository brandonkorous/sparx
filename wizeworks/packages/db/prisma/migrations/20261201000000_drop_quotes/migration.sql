-- Contract step: drop the retired `quotes`/`quote_items`/`deal_quotes` tables.
--
-- Migration 20261014000000 migrated every legacy quote into `billing_documents`
-- (the one document engine) on the system `b2b-quotes` workflow, backfilled
-- `deal_quotes` into `deal_billing_documents`, and mirrored quote→order
-- conversions onto the new `orders.converted_from_document_id` FK. Every
-- consumer (services, MCP tools, dashboard) cut over to `BillingDocument` in
-- the same release cycle; nothing reads or writes these tables anymore. This
-- drops them together with their RLS policies, indexes, and foreign keys (all
-- removed with the tables) after one full release soak, matching the
-- `b2b_invoices` expand/contract precedent (20260807000000 → 20260929000000).
--
-- DROP TABLE is owner-level DDL, so the per-tenant `set_config('app.tenant_id',
-- …)` loop that FORCE-RLS *row* backfills require does NOT apply here.
DROP TABLE IF EXISTS quote_items;
DROP TABLE IF EXISTS deal_quotes;
DROP TABLE IF EXISTS quotes;
