-- CRM calling (docs/144 §5.6) — click-to-call, and the record of what happened.
--
-- A phone call is the highest-signal thing that happens in most sales
-- relationships and the one least likely to be written down, because logging it
-- means opening a screen after the conversation is already over. Click-to-call
-- closes that loop from the other end: the platform placed the call, so it
-- already knows who, when and how long, and the only thing left for a person to
-- add is what was said.
--
-- TWO TABLES, AND THE SPLIT IS THE DESIGN:
--
--   crm_calls             — the PLACEMENT and its lifecycle. A call that was
--                           placed is not yet a call that happened; it can ring
--                           out, hit voicemail, or fail at the carrier, and
--                           those states arrive minutes later over a webhook.
--   crm_voice_connections — the tenant's OWN vendor credentials. sparx never
--                           fronts its own account for a tenant's outbound
--                           calls: their account, their number, their bill.
--
-- The timeline entry (crm_engagement_messages) is written only once a call
-- reaches a terminal state, so the record never shows a conversation that has
-- not started.
--
-- RLS is hand-edited (Prisma generates no ENABLE/FORCE/policies). Both tables
-- are new and empty, so the FORCE-RLS per-tenant backfill footgun
-- (packages/db CLAUDE.md §RLS) does not apply.

-- ─────────────────────────────────────────────────────────────────────────
-- crm_voice_connections — a tenant's own phone system
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE "crm_voice_connections" (
    "id"                UUID         NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"         UUID         NOT NULL,
    "property_id"       UUID,
    "provider"          VARCHAR(20)  NOT NULL DEFAULT 'twilio',
    "account_sid"       VARCHAR(255) NOT NULL,
    -- Ciphertext bundle (AES-256-GCM), never plaintext — the same at-rest
    -- pattern every other runtime credential on the platform uses.
    "auth_token_enc"    TEXT         NOT NULL,
    "from_number"       VARCHAR(20)  NOT NULL,
    -- OFF BY DEFAULT, and deliberately. Call recording is jurisdictionally
    -- loaded — one-party and two-party consent states, plus the EU's own rules
    -- — and a platform that quietly opted a business into recording would be
    -- handing them a legal problem they never agreed to.
    "recording_enabled" BOOLEAN      NOT NULL DEFAULT FALSE,
    "status"            VARCHAR(20)  NOT NULL DEFAULT 'active',
    "last_error"        TEXT,
    "created_at"        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updated_at"        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT "crm_voice_connections_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "crm_voice_connections_tenant_fkey"
        FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
);

-- One phone system per site. A tenant running two businesses under one login
-- needs two numbers; a tenant running one needs exactly one row. NULLS NOT
-- DISTINCT so the tenant-wide row (property_id IS NULL) is also unique — without
-- it, Postgres treats every NULL as different and a tenant accumulates
-- duplicates that silently disagree about which number rings.
CREATE UNIQUE INDEX "crm_voice_connections_per_site"
    ON "crm_voice_connections" ("tenant_id", "property_id") NULLS NOT DISTINCT;

ALTER TABLE "crm_voice_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm_voice_connections" FORCE  ROW LEVEL SECURITY;
CREATE POLICY crm_voice_connections_tenant_isolation ON "crm_voice_connections"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- ─────────────────────────────────────────────────────────────────────────
-- crm_calls — one placement and its lifecycle
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE "crm_calls" (
    "id"                    UUID        NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"             UUID        NOT NULL,
    "property_id"           UUID,
    "customer_id"           UUID,
    "deal_id"               UUID,
    "ticket_id"             UUID,
    "direction"             VARCHAR(3)  NOT NULL,
    -- E.164 both ways, stored as DIALLED rather than as a link to the contact's
    -- current number: the record of a call has to survive them changing it.
    "from_number"           VARCHAR(20) NOT NULL,
    "to_number"             VARCHAR(20) NOT NULL,
    "started_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Null until the call ends. A null duration on an old row means the status
    -- webhook never arrived — a real thing that happens, and better left
    -- visibly unknown than filled in with a guess.
    "duration_sec"          INTEGER,
    "ended_at"              TIMESTAMPTZ,
    -- The LIFECYCLE, distinct from the outcome: a call can complete and still
    -- have reached nobody.
    "status"                VARCHAR(20) NOT NULL DEFAULT 'placing',
    "outcome"               VARCHAR(20),
    "notes"                 TEXT,
    "recording_url"         TEXT,
    "provider_call_id"      VARCHAR(255),
    "provider"              VARCHAR(20),
    "user_id"               UUID,
    "engagement_message_id" UUID,
    "created_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "crm_calls_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "crm_calls_tenant_fkey"
        FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
    CONSTRAINT "crm_calls_direction_valid" CHECK ("direction" IN ('in', 'out')),
    CONSTRAINT "crm_calls_status_valid"
        CHECK ("status" IN ('placing', 'ringing', 'completed', 'failed')),
    CONSTRAINT "crm_calls_outcome_valid" CHECK (
        "outcome" IS NULL
        OR "outcome" IN ('connected', 'no_answer', 'voicemail', 'busy', 'wrong_number')
    ),
    -- A duration is a length of time, and a negative one is a bug arriving from
    -- a vendor's payload rather than a fact about the call.
    CONSTRAINT "crm_calls_duration_sane" CHECK ("duration_sec" IS NULL OR "duration_sec" >= 0)
);

-- The vendor's call id, unique per tenant, so a RE-DELIVERED webhook updates
-- the row it belongs to instead of creating a second call that never happened.
-- Providers retry aggressively and duplicate delivery is normal, not an error.
CREATE UNIQUE INDEX "crm_calls_provider_id_unique"
    ON "crm_calls" ("tenant_id", "provider_call_id")
    WHERE "provider_call_id" IS NOT NULL;

CREATE INDEX "crm_calls_customer_idx" ON "crm_calls" ("tenant_id", "customer_id", "started_at" DESC);
CREATE INDEX "crm_calls_deal_idx"     ON "crm_calls" ("tenant_id", "deal_id", "started_at" DESC);
CREATE INDEX "crm_calls_user_idx"     ON "crm_calls" ("tenant_id", "user_id", "started_at" DESC);

ALTER TABLE "crm_calls" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm_calls" FORCE  ROW LEVEL SECURITY;
CREATE POLICY crm_calls_tenant_isolation ON "crm_calls"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());
