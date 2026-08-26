-- SMS: built safe, shipped dark (docs/151 §8, docs/152 D1).
--
-- Everything a text message needs in order to be sent RESPONSIBLY, with the
-- switch off. `sms_settings.enabled` defaults false and the provider credential
-- is absent by default, so a tenant who has not asked for SMS cannot be billed
-- for one — which is the whole reason this ships before anybody can use it.
--
-- The four things that are part of this slice rather than a follow-up:
--   · consent recorded separately from email marketing consent (the `sms` scope
--     in customers.gdpr_consent, which needs no DDL),
--   · a suppression table a STOP feeds,
--   · quiet hours in the RECIPIENT's timezone,
--   · a per-tenant ceiling that trips before the provider call.

CREATE TABLE "sms_suppressions" (
    "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"   UUID NOT NULL,
    "phone"       VARCHAR(20) NOT NULL,
    "scope"       VARCHAR(20) NOT NULL DEFAULT 'all',
    "reason"      VARCHAR(20) NOT NULL,
    "source"      VARCHAR(63),
    "customer_id" UUID,
    "note"        TEXT,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "sms_suppressions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sms_suppressions_tenant_id_fkey"
        FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "sms_suppressions_tenant_phone_scope_key"
    ON "sms_suppressions" ("tenant_id", "phone", "scope");
CREATE INDEX "sms_suppressions_tenant_phone_idx"
    ON "sms_suppressions" ("tenant_id", "phone");

CREATE TABLE "sms_messages" (
    "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"     UUID NOT NULL,
    "customer_id"   UUID,
    "to_phone"      VARCHAR(20) NOT NULL,
    "body"          TEXT NOT NULL,
    "status"        VARCHAR(20) NOT NULL,
    "reason"        VARCHAR(120),
    "scope"         VARCHAR(20) NOT NULL DEFAULT 'marketing',
    "provider_name" VARCHAR(40),
    "provider_id"   VARCHAR(120),
    "segments"      SMALLINT,
    "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
    "sent_at"       TIMESTAMPTZ,
    CONSTRAINT "sms_messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sms_messages_tenant_id_fkey"
        FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
);
-- The rate-limit read. It runs before EVERY send, so it is the index that has to
-- exist rather than the one that would be nice to have.
CREATE INDEX "sms_messages_tenant_created_idx"
    ON "sms_messages" ("tenant_id", "created_at" DESC);
CREATE INDEX "sms_messages_tenant_phone_created_idx"
    ON "sms_messages" ("tenant_id", "to_phone", "created_at" DESC);

CREATE TABLE "sms_settings" (
    "tenant_id"         UUID NOT NULL,
    "enabled"           BOOLEAN NOT NULL DEFAULT false,
    "daily_cap"         INTEGER NOT NULL DEFAULT 200,
    "quiet_start_hour"  INTEGER NOT NULL DEFAULT 21,
    "quiet_end_hour"    INTEGER NOT NULL DEFAULT 9,
    "fallback_timezone" TEXT NOT NULL DEFAULT 'UTC',
    "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "sms_settings_pkey" PRIMARY KEY ("tenant_id"),
    CONSTRAINT "sms_settings_tenant_id_fkey"
        FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
    -- A cap of zero would be a tenant who enabled SMS and can never send one,
    -- which reads as a broken feature rather than a policy.
    CONSTRAINT "sms_settings_daily_cap_check" CHECK ("daily_cap" > 0),
    CONSTRAINT "sms_settings_quiet_start_check"
        CHECK ("quiet_start_hour" >= 0 AND "quiet_start_hour" <= 23),
    CONSTRAINT "sms_settings_quiet_end_check"
        CHECK ("quiet_end_hour" >= 0 AND "quiet_end_hour" <= 23)
);

-- ─── RLS ────────────────────────────────────────────────────────────────────
--
-- FORCE, like every other tenant-scoped table: a suppression that leaked across
-- tenants would mean either texting somebody who said stop, or refusing to text
-- somebody who never did. Both are the failure this exists to prevent.

ALTER TABLE "sms_suppressions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sms_suppressions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "sms_suppressions"
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

ALTER TABLE "sms_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sms_messages" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "sms_messages"
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

ALTER TABLE "sms_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sms_settings" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "sms_settings"
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());
