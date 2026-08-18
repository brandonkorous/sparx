-- CRM engagement spine (docs/144 §5) — what was SAID, not just what the platform
-- DID.
--
-- Today a contact's timeline can say an order shipped and a campaign was opened.
-- It cannot say the rep emailed them on Tuesday and they replied on Wednesday
-- asking for a discount — which is the actual relationship, and which currently
-- lives in one person's inbox where nobody else can see it.
--
-- Four capabilities, one spine: send from the record, receive onto the record,
-- template what you send, and log what you say out loud.
--
-- crm_mailbox_connections is scheduling_calendar_connections with the nouns
-- changed, deliberately. Scheduling already solved connect-a-google-account —
-- encrypt-at-rest tokens, BYO OAuth clients, push channels with an expiry, a
-- status/last_error pair. A second pattern for the same problem would mean two
-- token-refresh paths to keep correct and two places to look when one breaks.
--
-- RLS is hand-edited (Prisma generates no ENABLE/FORCE/policies). Every table
-- here is new and empty, so the FORCE-RLS per-tenant backfill footgun
-- (packages/db CLAUDE.md §RLS) does not apply and no backfill loop is needed.
-- Nothing is seeded: a mailbox is connected by a person, and a business's
-- templates are theirs to write.

-- ─────────────────────────────────────────────────────────────────────────
-- crm_mailbox_connections — a mailbox the platform can send and receive through
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE "crm_mailbox_connections" (
    "id"                      UUID         NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"               UUID         NOT NULL,
    "property_id"             UUID,
    "provider"                VARCHAR(20)  NOT NULL,
    "connection_kind"         VARCHAR(20)  NOT NULL DEFAULT 'oauth',
    "credential_source"       VARCHAR(20)  NOT NULL DEFAULT 'platform',
    "scope"                   VARCHAR(20)  NOT NULL DEFAULT 'personal',
    "user_id"                 UUID,
    "email_address"           VARCHAR(320) NOT NULL,
    "display_name"            VARCHAR(255),
    -- Ciphertext bundles (AES-256-GCM), never plaintext — the same at-rest
    -- pattern scheduling's calendar tokens and Search Console's OAuth tokens
    -- use. Secret Manager cannot hold runtime-minted, runtime-refreshed tokens,
    -- which is why this is the platform pattern rather than an exception.
    "access_token_enc"        TEXT,
    "refresh_token_enc"       TEXT,
    "token_expires_at"        TIMESTAMPTZ,
    "app_password_enc"        TEXT,
    "oauth_client_id"         VARCHAR(512),
    "oauth_client_secret_enc" TEXT,
    "imap_host"               VARCHAR(255),
    "imap_port"               INTEGER,
    "smtp_host"               VARCHAR(255),
    "smtp_port"               INTEGER,
    "imap_user"               VARCHAR(320),
    "sync_cursor"             TEXT,
    "channel_id"              VARCHAR(255),
    "channel_expires_at"      TIMESTAMPTZ,
    "status"                  VARCHAR(20)  NOT NULL DEFAULT 'active',
    "last_synced_at"          TIMESTAMPTZ,
    "last_error"              TEXT,
    "created_at"              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updated_at"              TIMESTAMPTZ  NOT NULL,
    CONSTRAINT "crm_mailbox_connections_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "crm_mailbox_connections_tenant_id_fkey" FOREIGN KEY ("tenant_id")
        REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "crm_mailbox_connections_property_id_fkey" FOREIGN KEY ("property_id")
        REFERENCES "properties" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "crm_mailbox_connections_scope_check" CHECK ("scope" IN ('personal', 'shared')),
    -- A PERSONAL mailbox without an owner is nobody's mailbox: the privacy gate
    -- on inbound sync is defined by whose it is, so an unowned personal
    -- connection would have no gate to apply.
    CONSTRAINT "crm_mailbox_connections_personal_has_owner" CHECK (
        "scope" <> 'personal' OR "user_id" IS NOT NULL
    )
);

-- One connection per address per tenant. Connecting the same mailbox twice
-- would double every inbound message.
CREATE UNIQUE INDEX "crm_mailbox_connections_address_unique"
    ON "crm_mailbox_connections" ("tenant_id", "email_address");
CREATE INDEX "crm_mailbox_connections_user_idx"
    ON "crm_mailbox_connections" ("tenant_id", "user_id");
CREATE INDEX "crm_mailbox_connections_status_idx"
    ON "crm_mailbox_connections" ("tenant_id", "status");
-- The sweep that renews push channels before they lapse. Partial, because only
-- connections that HAVE a channel are ever swept.
CREATE INDEX "crm_mailbox_connections_channel_expiry_idx"
    ON "crm_mailbox_connections" ("channel_expires_at")
    WHERE "channel_id" IS NOT NULL;

ALTER TABLE "crm_mailbox_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm_mailbox_connections" FORCE  ROW LEVEL SECURITY;
CREATE POLICY crm_mailbox_connections_tenant_isolation ON "crm_mailbox_connections"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- ─────────────────────────────────────────────────────────────────────────
-- crm_engagement_threads — a conversation
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE "crm_engagement_threads" (
    "tenant_id"          UUID        NOT NULL,
    "id"                 UUID        NOT NULL DEFAULT gen_random_uuid(),
    "property_id"        UUID,
    "subject"            VARCHAR(998),
    "provider_thread_id" VARCHAR(255),
    "customer_id"        UUID,
    "deal_id"            UUID,
    "ticket_id"          UUID,
    "status"             VARCHAR(20) NOT NULL DEFAULT 'open',
    "last_message_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "message_count"      INTEGER     NOT NULL DEFAULT 0,
    "created_at"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"         TIMESTAMPTZ NOT NULL,
    CONSTRAINT "crm_engagement_threads_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "crm_engagement_threads_tenant_id_fkey" FOREIGN KEY ("tenant_id")
        REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "crm_engagement_threads_property_id_fkey" FOREIGN KEY ("property_id")
        REFERENCES "properties" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    -- A conversation outlives the deal it was about. SET NULL, not CASCADE:
    -- deleting a deal must not silently delete the emails that discussed it.
    CONSTRAINT "crm_engagement_threads_customer_id_fkey" FOREIGN KEY ("customer_id")
        REFERENCES "customers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "crm_engagement_threads_deal_id_fkey" FOREIGN KEY ("deal_id")
        REFERENCES "deals" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- The timeline reads: newest first, per record.
CREATE INDEX "crm_engagement_threads_customer_idx"
    ON "crm_engagement_threads" ("tenant_id", "customer_id", "last_message_at" DESC);
CREATE INDEX "crm_engagement_threads_deal_idx"
    ON "crm_engagement_threads" ("tenant_id", "deal_id", "last_message_at" DESC);
CREATE INDEX "crm_engagement_threads_ticket_idx"
    ON "crm_engagement_threads" ("tenant_id", "ticket_id", "last_message_at" DESC);
-- The second threading signal, after In-Reply-To.
CREATE INDEX "crm_engagement_threads_provider_thread_idx"
    ON "crm_engagement_threads" ("tenant_id", "provider_thread_id");

ALTER TABLE "crm_engagement_threads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm_engagement_threads" FORCE  ROW LEVEL SECURITY;
CREATE POLICY crm_engagement_threads_tenant_isolation ON "crm_engagement_threads"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- ─────────────────────────────────────────────────────────────────────────
-- crm_engagement_messages — one thing that was said
-- ─────────────────────────────────────────────────────────────────────────
--
-- Emails, logged calls and notes in ONE table, because the timeline reads them
-- together and a note that cannot be replied to is still a thing that was said.

CREATE TABLE "crm_engagement_messages" (
    "id"                    UUID        NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"             UUID        NOT NULL,
    "thread_id"             UUID        NOT NULL,
    "kind"                  VARCHAR(20) NOT NULL DEFAULT 'email',
    "direction"             VARCHAR(3)  NOT NULL,
    "from_address"          VARCHAR(320),
    "to_addresses"          TEXT[]      NOT NULL DEFAULT ARRAY[]::TEXT[],
    "cc_addresses"          TEXT[]      NOT NULL DEFAULT ARRAY[]::TEXT[],
    "body_html"             TEXT,
    "body_text"             TEXT,
    "rfc_message_id"        VARCHAR(998),
    "in_reply_to"           VARCHAR(998),
    "references"            TEXT,
    "sent_at"               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "sent_by_user_id"       UUID,
    "mailbox_connection_id" UUID,
    "first_opened_at"       TIMESTAMPTZ,
    "open_count"            INTEGER     NOT NULL DEFAULT 0,
    "click_count"           INTEGER     NOT NULL DEFAULT 0,
    "duration_sec"          INTEGER,
    "outcome"               VARCHAR(20),
    "created_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "crm_engagement_messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "crm_engagement_messages_tenant_id_fkey" FOREIGN KEY ("tenant_id")
        REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "crm_engagement_messages_thread_id_fkey" FOREIGN KEY ("thread_id")
        REFERENCES "crm_engagement_threads" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    -- Disconnecting a mailbox must not delete the mail sent through it.
    CONSTRAINT "crm_engagement_messages_mailbox_fkey" FOREIGN KEY ("mailbox_connection_id")
        REFERENCES "crm_mailbox_connections" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "crm_engagement_messages_direction_check" CHECK ("direction" IN ('in', 'out'))
);

CREATE INDEX "crm_engagement_messages_thread_idx"
    ON "crm_engagement_messages" ("tenant_id", "thread_id", "sent_at");
-- Inbound de-duplication AND the join back from an open/click in email_events.
-- NULLS NOT DISTINCT would be wrong here: a note has no Message-ID, and every
-- note would then collide with every other note.
CREATE UNIQUE INDEX "crm_engagement_messages_rfc_unique"
    ON "crm_engagement_messages" ("tenant_id", "rfc_message_id")
    WHERE "rfc_message_id" IS NOT NULL;
CREATE INDEX "crm_engagement_messages_kind_idx"
    ON "crm_engagement_messages" ("tenant_id", "kind", "sent_at" DESC);

ALTER TABLE "crm_engagement_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm_engagement_messages" FORCE  ROW LEVEL SECURITY;
CREATE POLICY crm_engagement_messages_tenant_isolation ON "crm_engagement_messages"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- ─────────────────────────────────────────────────────────────────────────
-- crm_sales_templates / crm_sales_snippets — what a rep sends over and over
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE "crm_sales_templates" (
    "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"     UUID         NOT NULL,
    "property_id"   UUID,
    "name"          VARCHAR(255) NOT NULL,
    "folder"        VARCHAR(120),
    "subject"       VARCHAR(998) NOT NULL,
    "body_html"     TEXT         NOT NULL,
    "owner_user_id" UUID,
    "is_shared"     BOOLEAN      NOT NULL DEFAULT FALSE,
    "send_count"    INTEGER      NOT NULL DEFAULT 0,
    "open_count"    INTEGER      NOT NULL DEFAULT 0,
    "reply_count"   INTEGER      NOT NULL DEFAULT 0,
    "archived_at"   TIMESTAMPTZ,
    "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updated_at"    TIMESTAMPTZ  NOT NULL,
    CONSTRAINT "crm_sales_templates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "crm_sales_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id")
        REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "crm_sales_templates_property_id_fkey" FOREIGN KEY ("property_id")
        REFERENCES "properties" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "crm_sales_templates_name_unique"
    ON "crm_sales_templates" ("tenant_id", "name");
CREATE INDEX "crm_sales_templates_folder_idx"
    ON "crm_sales_templates" ("tenant_id", "folder", "archived_at");
CREATE INDEX "crm_sales_templates_owner_idx"
    ON "crm_sales_templates" ("tenant_id", "owner_user_id");

ALTER TABLE "crm_sales_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm_sales_templates" FORCE  ROW LEVEL SECURITY;
CREATE POLICY crm_sales_templates_tenant_isolation ON "crm_sales_templates"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE "crm_sales_snippets" (
    "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"     UUID         NOT NULL,
    "shortcut"      VARCHAR(63)  NOT NULL,
    "name"          VARCHAR(255) NOT NULL,
    "body"          TEXT         NOT NULL,
    "owner_user_id" UUID,
    "is_shared"     BOOLEAN      NOT NULL DEFAULT TRUE,
    "use_count"     INTEGER      NOT NULL DEFAULT 0,
    "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updated_at"    TIMESTAMPTZ  NOT NULL,
    CONSTRAINT "crm_sales_snippets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "crm_sales_snippets_tenant_id_fkey" FOREIGN KEY ("tenant_id")
        REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "crm_sales_snippets_shortcut_unique"
    ON "crm_sales_snippets" ("tenant_id", "shortcut");

ALTER TABLE "crm_sales_snippets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm_sales_snippets" FORCE  ROW LEVEL SECURITY;
CREATE POLICY crm_sales_snippets_tenant_isolation ON "crm_sales_snippets"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());
