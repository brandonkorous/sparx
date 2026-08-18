-- Per-site email sends (docs/49 Phase 7a). A broadcast / queued send / engagement
-- event optionally carries property_id = the web PROPERTY (site) it is sent on
-- behalf of, so the render uses that site's brand (Property.brandOverride merged
-- over the tenant brand) and analytics break down per site. NULL = the tenant's
-- primary brand (the default, and what every pre-rollout row stays).
--
-- Purely additive: NULLABLE columns, no backfill, no NOT NULL — so no RLS loop.
-- SetNull FKs: a send/event outlives its site. property_id is NOT a security
-- boundary; tenant_id + the unchanged tenant_isolation policies are.

ALTER TABLE "email_broadcasts"      ADD COLUMN "property_id" UUID;
ALTER TABLE "email_scheduled_sends" ADD COLUMN "property_id" UUID;
ALTER TABLE "email_events"          ADD COLUMN "property_id" UUID;

ALTER TABLE "email_broadcasts"
    ADD CONSTRAINT "email_broadcasts_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "email_scheduled_sends"
    ADD CONSTRAINT "email_scheduled_sends_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "email_events"
    ADD CONSTRAINT "email_events_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
