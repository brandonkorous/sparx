-- Live Chat module (docs/56, docs/69 Track A).
--
-- Three tenant-scoped tables — conversations, messages, quick_replies — each
-- ENABLE + FORCE ROW LEVEL SECURITY with the standard tenant_isolation policy
-- (current_tenant_id(), defined in 20260527000100_rls). chat_messages
-- denormalizes tenant_id so the policy filters without joining conversations.

-- ─────────────────────────────────────────────────────────────────────────
-- chat_conversations
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE "chat_conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID,
    "assigned_to" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'open',
    "source" VARCHAR(20) NOT NULL DEFAULT 'storefront',
    "subject" VARCHAR(255),
    "visitor_name" VARCHAR(255),
    "visitor_email" VARCHAR(255),
    "visitor_token" VARCHAR(64),
    "unread_staff" INTEGER NOT NULL DEFAULT 0,
    "last_message_at" TIMESTAMPTZ,
    "resolved_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "chat_conversations" ALTER COLUMN "updated_at" DROP DEFAULT;

CREATE INDEX "chat_conversations_tenant_status_idx"
    ON "chat_conversations" ("tenant_id", "status", "last_message_at" DESC);
CREATE INDEX "chat_conversations_tenant_assigned_idx"
    ON "chat_conversations" ("tenant_id", "assigned_to");
CREATE INDEX "chat_conversations_customer_idx"
    ON "chat_conversations" ("customer_id");

ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_assigned_to_fkey"
    FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "chat_conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_conversations" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "chat_conversations"
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- ─────────────────────────────────────────────────────────────────────────
-- chat_messages
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sender_type" VARCHAR(10) NOT NULL,
    "sender_id" UUID,
    "body" TEXT NOT NULL,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "ai_confidence" DOUBLE PRECISION,
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "chat_messages_conversation_idx"
    ON "chat_messages" ("conversation_id", "created_at");
CREATE INDEX "chat_messages_tenant_idx" ON "chat_messages" ("tenant_id");

ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_messages" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "chat_messages"
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- ─────────────────────────────────────────────────────────────────────────
-- chat_quick_replies
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE "chat_quick_replies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "body" TEXT NOT NULL,
    "shortcut" VARCHAR(50),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_quick_replies_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "chat_quick_replies" ALTER COLUMN "updated_at" DROP DEFAULT;

CREATE INDEX "chat_quick_replies_tenant_idx" ON "chat_quick_replies" ("tenant_id");

ALTER TABLE "chat_quick_replies" ADD CONSTRAINT "chat_quick_replies_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_quick_replies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_quick_replies" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "chat_quick_replies"
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());
