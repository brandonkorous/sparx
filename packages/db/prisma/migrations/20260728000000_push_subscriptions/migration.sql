-- Web Push subscriptions (docs/69 A-6).
--
-- One row per (staff user, browser endpoint). push-worker reads these to deliver
-- `push.send` notifications; a 410 Gone on send → delete the row. (tenant,
-- endpoint) is unique so re-subscribing the same browser updates the owner/keys.
--
-- RLS: tenant-scoped → ENABLE + FORCE + tenant_isolation on current_tenant_id().

CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_agent" VARCHAR(400),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "push_subscriptions_tenant_id_endpoint_key" ON "push_subscriptions"("tenant_id", "endpoint");
CREATE INDEX "push_subscriptions_tenant_id_user_id_idx" ON "push_subscriptions"("tenant_id", "user_id");

-- ─── Foreign keys ─────────────────────────────────────────────────────────────

ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Row-level security (hand-edited; Prisma does not generate RLS) ────────────

ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "push_subscriptions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "push_subscriptions"
    USING ("tenant_id" = current_tenant_id())
    WITH CHECK ("tenant_id" = current_tenant_id());
