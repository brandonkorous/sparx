-- notifications: per-user in-app notification inbox (docs/124 Phase 3).
--
-- The awareness layer's only new table. Jobs and Activity are read-only
-- projections over ledgers that already exist; a notification is different
-- because it holds state nothing else does — whether a specific person has
-- read it.
--
-- FORCE RLS is required (sparx_owner is NOT a superuser in prod). Every query
-- must set the tenant GUC before touching this table or the isolation policy
-- blocks it. This migration creates an EMPTY table and backfills nothing, so
-- the per-tenant set_config loop that FORCE-RLS backfills require does not
-- apply here.

CREATE TABLE "notifications" (
  "id"          uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "tenant_id"   uuid         NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id"     uuid         NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "kind"        varchar(100) NOT NULL,
  "title"       varchar(255) NOT NULL,
  "body"        text,
  "module"      varchar(30),
  "severity"    varchar(20)  NOT NULL DEFAULT 'info',
  "entity_type" varchar(100),
  "entity_id"   uuid,
  "read_at"     timestamptz,
  "created_at"  timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "notifications"
  USING ("tenant_id" = current_tenant_id());

-- The inbox list and the unread badge both filter on (tenant, user, read_at).
CREATE INDEX "notifications_tenant_user_read_idx"
  ON "notifications" ("tenant_id", "user_id", "read_at");

CREATE INDEX "notifications_tenant_created_idx"
  ON "notifications" ("tenant_id", "created_at" DESC);
