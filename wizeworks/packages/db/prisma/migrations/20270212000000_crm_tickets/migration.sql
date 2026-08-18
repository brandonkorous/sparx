-- CRM service requests — tickets, SLA policies, and pipelines that are no
-- longer implicitly about sales (docs/144 §7).
--
-- The intake already existed and had nowhere to go: live chat, site forms and
-- inbound email all arrive today, and a business working from them is working
-- from three inboxes and a memory.
--
-- THREE MOVES, IN THIS ORDER:
--
--   1. `pipelines` learns WHAT it moves (`object_key`). A pipeline was
--      implicitly a sales pipeline, which is why the board and the funnel
--      report both hardcoded deals. One column is what lets a support queue
--      reuse both unchanged instead of growing a second board that drifts.
--   2. The three new tables — the ticket, the promise, and the promise's
--      per-priority targets.
--   3. The two `ticket_id` columns that shipped in phases 3 and 3.5 pointing at
--      a table that did not exist yet finally get their foreign keys.
--
-- RLS is hand-edited (Prisma generates no ENABLE/FORCE/policies). The three new
-- tables are empty, so the FORCE-RLS per-tenant backfill footgun (packages/db
-- CLAUDE.md §RLS) does not apply. The `pipelines` backfill below writes a
-- CONSTANT via a plain UPDATE with no tenant predicate, which the owner role
-- can run under FORCE RLS only because migrations run as the table owner with
-- policies applied — so it is written as a DEFAULT on the new column instead,
-- and touches no existing row at all.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Pipelines become generic (docs/144 §7.2)
-- ─────────────────────────────────────────────────────────────────────────

-- DEFAULT 'deal' rather than an UPDATE: every existing pipeline IS a sales
-- pipeline, and a column default backfills them without reading a row (and so
-- without meeting the FORCE-RLS visibility problem at all).
ALTER TABLE "pipelines"
    ADD COLUMN "object_key" VARCHAR(63) NOT NULL DEFAULT 'deal';

-- No CHECK on the VALUES. `object_key` names a row in crm_object_defs, and the
-- whole point of the registry is that a tenant invents object keys we do not
-- know at build time — a value list here would be a constraint that has to be
-- migrated every time a tenant creates an object. Shape only.
ALTER TABLE "pipelines"
    ADD CONSTRAINT "pipelines_object_key_shape"
    CHECK ("object_key" ~ '^[a-z][a-z0-9_]*$');

-- Slug uniqueness widens to include the object: one site may legitimately run a
-- `default` pipeline for deals AND a `default` pipeline for tickets. Bare unique
-- INDEX on this table (see 20270101000000), so DROP INDEX rather than a
-- constraint drop. NULLS NOT DISTINCT keeps the tenant-wide tier (property_id
-- IS NULL) from duplicating a slug — without it Postgres treats every NULL as
-- different and the tier stops being unique at all.
DROP INDEX "pipelines_tenant_id_property_id_slug_key";
CREATE UNIQUE INDEX "pipelines_tenant_id_property_id_object_key_slug_key"
    ON "pipelines"("tenant_id", "property_id", "object_key", "slug") NULLS NOT DISTINCT;

CREATE INDEX "pipelines_tenant_object_archived_idx"
    ON "pipelines"("tenant_id", "object_key", "archived_at");

-- `pipeline_stages.stage_type` gains 'resolved' and 'closed' (the ticket
-- vocabulary). It is an unconstrained VARCHAR(20) — verified: no CHECK was ever
-- written on it — so this is a documentation change at the database and a
-- validation change in @sparx/crm-schemas. Left unconstrained deliberately, for
-- the same reason as object_key above: a tenant-invented object brings its own
-- terminal vocabulary with it.
COMMENT ON COLUMN "pipeline_stages"."stage_type" IS
    'open | won | lost | resolved | closed — see packages/crm-schemas StageType';

-- ─────────────────────────────────────────────────────────────────────────
-- 2a. crm_ticket_sla_policies — what a business promised, and when it is open
-- ─────────────────────────────────────────────────────────────────────────
--
-- SELF-CONTAINED CALENDAR, deliberately NOT the scheduling module's
-- scheduling_availability_windows. Those hang off a scheduling_resource, so
-- reusing them would make "we answer support within four hours" depend on the
-- Scheduling module being switched on and a bookable resource existing. Modules
-- are independent and never default on, and a CRM-only tenant has neither. They
-- are also different facts: when the support desk is staffed is not when bay 2
-- can be booked.

CREATE TABLE "crm_ticket_sla_policies" (
    "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"       UUID         NOT NULL,
    "property_id"     UUID,
    "name"            VARCHAR(120) NOT NULL,
    "description"     TEXT,
    "is_default"      BOOLEAN      NOT NULL DEFAULT FALSE,
    -- IANA zone. Business hours are local by definition, and a promise stated in
    -- UTC would drift by an hour twice a year.
    "timezone"        VARCHAR(64)  NOT NULL DEFAULT 'UTC',
    -- [{ day: 0-6, startMinute, endMinute }, …]. JSON rather than a child table
    -- because it is always read, written and edited as ONE set — nothing queries
    -- a single Tuesday. An EMPTY array means 24/7, which is the honest reading
    -- of "the business declared no hours" for a promise about response time.
    "business_hours"  JSONB        NOT NULL DEFAULT '[]',
    -- Whole local days the desk is shut, regardless of the weekly pattern.
    "holidays"        DATE[]       NOT NULL DEFAULT '{}',
    -- How far into the clock counts as "about to miss this". Per policy: a
    -- one-hour promise and a five-day promise want warning at different points.
    "warn_at_percent" INTEGER      NOT NULL DEFAULT 80,
    "archived_at"     TIMESTAMPTZ,
    "created_at"      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updated_at"      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT "crm_ticket_sla_policies_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "crm_ticket_sla_policies_tenant_fkey"
        FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
    CONSTRAINT "crm_ticket_sla_policies_property_fkey"
        FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE,
    -- 0 and 100 are both nonsense: warn immediately, or warn exactly as it
    -- breaches (which is not a warning).
    CONSTRAINT "crm_ticket_sla_policies_warn_sane"
        CHECK ("warn_at_percent" > 0 AND "warn_at_percent" < 100),
    CONSTRAINT "crm_ticket_sla_policies_hours_is_array"
        CHECK (jsonb_typeof("business_hours") = 'array')
);

CREATE UNIQUE INDEX "crm_ticket_sla_policies_name_key"
    ON "crm_ticket_sla_policies" ("tenant_id", "property_id", "name") NULLS NOT DISTINCT;

-- ONE default per site. A partial unique index rather than a CHECK, because
-- "at most one row where is_default" is a statement about the set, not the row.
-- Without it, two defaults means new tickets silently get whichever the planner
-- returned first — an inconsistency nobody would ever see reported.
CREATE UNIQUE INDEX "crm_ticket_sla_policies_one_default_per_site"
    ON "crm_ticket_sla_policies" ("tenant_id", "property_id") NULLS NOT DISTINCT
    WHERE "is_default" AND "archived_at" IS NULL;

CREATE INDEX "crm_ticket_sla_policies_archived_idx"
    ON "crm_ticket_sla_policies" ("tenant_id", "archived_at");

ALTER TABLE "crm_ticket_sla_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm_ticket_sla_policies" FORCE  ROW LEVEL SECURITY;
CREATE POLICY crm_ticket_sla_policies_tenant_isolation ON "crm_ticket_sla_policies"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- ─────────────────────────────────────────────────────────────────────────
-- 2b. crm_ticket_sla_targets — one priority's two promises
-- ─────────────────────────────────────────────────────────────────────────
--
-- A row per priority rather than eight columns on the policy: "we make no
-- promise about low-priority requests" is then the ABSENCE of a row, instead of
-- two nulls that only mean that when read as a pair.

CREATE TABLE "crm_ticket_sla_targets" (
    "id"                     UUID        NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"              UUID        NOT NULL,
    "policy_id"              UUID        NOT NULL,
    "priority"               VARCHAR(20) NOT NULL,
    -- BUSINESS minutes, not wall-clock. 60 on a desk open 9–5 means an email
    -- arriving at 4:45pm is due at 9:45 the next morning — which is what the
    -- business actually promised, and what a wall-clock reading gets wrong in
    -- the customer's favour right up until it gets it wrong in ours.
    "first_response_minutes" INTEGER,
    "resolution_minutes"     INTEGER,
    "created_at"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "crm_ticket_sla_targets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "crm_ticket_sla_targets_tenant_fkey"
        FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
    CONSTRAINT "crm_ticket_sla_targets_policy_fkey"
        FOREIGN KEY ("policy_id") REFERENCES "crm_ticket_sla_policies"("id") ON DELETE CASCADE,
    CONSTRAINT "crm_ticket_sla_targets_priority_valid"
        CHECK ("priority" IN ('low', 'medium', 'high', 'urgent')),
    -- A zero-minute promise is unmeetable and a negative one is a bug; NULL is
    -- the way to say "no promise on this one".
    CONSTRAINT "crm_ticket_sla_targets_first_response_sane"
        CHECK ("first_response_minutes" IS NULL OR "first_response_minutes" > 0),
    CONSTRAINT "crm_ticket_sla_targets_resolution_sane"
        CHECK ("resolution_minutes" IS NULL OR "resolution_minutes" > 0)
);

CREATE UNIQUE INDEX "crm_ticket_sla_targets_policy_priority_key"
    ON "crm_ticket_sla_targets" ("policy_id", "priority");
CREATE INDEX "crm_ticket_sla_targets_policy_idx"
    ON "crm_ticket_sla_targets" ("tenant_id", "policy_id");

ALTER TABLE "crm_ticket_sla_targets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm_ticket_sla_targets" FORCE  ROW LEVEL SECURITY;
CREATE POLICY crm_ticket_sla_targets_tenant_isolation ON "crm_ticket_sla_targets"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- ─────────────────────────────────────────────────────────────────────────
-- 2c. crm_tickets — somebody asked us for something
-- ─────────────────────────────────────────────────────────────────────────
--
-- NO STATUS COLUMN, AND THAT IS THE DESIGN. A ticket's state is the pipeline
-- stage it sits on, exactly like a deal — because "New → Waiting on us →
-- Waiting on them → Resolved" is a process a business owns, not a vocabulary
-- the platform hands them.

CREATE TABLE "crm_tickets" (
    "id"                         UUID         NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"                  UUID         NOT NULL,
    "property_id"                UUID,
    -- Human-readable, per tenant, monotonic. People say "ticket 1042" out loud
    -- and write it in emails; a uuid is unusable for that. Gap-prone, which is
    -- fine for an identifier a person reads.
    "number"                     INTEGER      NOT NULL,
    "pipeline_id"                UUID         NOT NULL,
    "stage_id"                   UUID         NOT NULL,
    "customer_id"                UUID,
    "b2b_account_id"             UUID,
    "assigned_to_user_id"        UUID,
    "subject"                    VARCHAR(255) NOT NULL,
    "description"                TEXT,
    "priority"                   VARCHAR(20)  NOT NULL DEFAULT 'medium',
    "source"                     VARCHAR(20)  NOT NULL DEFAULT 'manual',
    -- The id of the thing that raised it. NOT a foreign key: the row it points
    -- at lives in a module that may be switched off, and the ticket outlives it
    -- either way. Its real job is idempotency — see the unique index below.
    "source_record_id"           VARCHAR(64),
    "tags"                       VARCHAR(63)[] NOT NULL DEFAULT '{}',
    "custom_properties"          JSONB        NOT NULL DEFAULT '{}',

    -- The clock. Resolved ONCE, at creation, from the policy that applied then:
    -- a policy edited in March must not silently move what was promised in
    -- February.
    "sla_policy_id"              UUID,
    -- Absolute instants, already converted through the policy's business hours,
    -- so everything downstream compares two timestamps instead of each
    -- re-deriving a calendar. NULL where the policy sets no target for this
    -- priority — a legitimate answer, not missing data.
    --
    -- The `warn_at` pair is the policy's warn_at_percent mark, computed on the
    -- SAME clock at the same moment. Stored rather than derived because 80% of
    -- a business-hours budget is NOT 80% of the wall-clock interval it spans —
    -- a sweep deriving it would be quietly wrong on every overnight ticket.
    "first_response_due_at"      TIMESTAMPTZ,
    "first_response_warn_at"     TIMESTAMPTZ,
    "first_responded_at"         TIMESTAMPTZ,
    "resolution_due_at"          TIMESTAMPTZ,
    "resolution_warn_at"         TIMESTAMPTZ,
    -- Two timestamps, not one: a resolved ticket the customer reopens is
    -- normal, and closing is the separate, later filing action.
    "resolved_at"                TIMESTAMPTZ,
    "closed_at"                  TIMESTAMPTZ,
    -- "We have already said this." The sweep runs every few minutes and has to
    -- be idempotent; without these it would re-announce the same breach forever.
    "first_response_warned_at"   TIMESTAMPTZ,
    "first_response_breached_at" TIMESTAMPTZ,
    "resolution_warned_at"       TIMESTAMPTZ,
    "resolution_breached_at"     TIMESTAMPTZ,

    "created_at"                 TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updated_at"                 TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "deleted_at"                 TIMESTAMPTZ,

    CONSTRAINT "crm_tickets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "crm_tickets_tenant_fkey"
        FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
    -- SetNull, like orders and chat: a ticket is a record of something a real
    -- person asked for and survives the site closing.
    CONSTRAINT "crm_tickets_property_fkey"
        FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL,
    CONSTRAINT "crm_tickets_pipeline_fkey"
        FOREIGN KEY ("pipeline_id") REFERENCES "pipelines"("id") ON DELETE CASCADE,
    CONSTRAINT "crm_tickets_stage_fkey"
        FOREIGN KEY ("stage_id") REFERENCES "pipeline_stages"("id"),
    CONSTRAINT "crm_tickets_customer_fkey"
        FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL,
    CONSTRAINT "crm_tickets_b2b_account_fkey"
        FOREIGN KEY ("b2b_account_id") REFERENCES "b2b_accounts"("id") ON DELETE SET NULL,
    CONSTRAINT "crm_tickets_assigned_to_fkey"
        FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL,
    -- SetNull, not Cascade: deleting a policy must not delete the requests that
    -- were made under it. The due dates already on the row stay true.
    CONSTRAINT "crm_tickets_sla_policy_fkey"
        FOREIGN KEY ("sla_policy_id") REFERENCES "crm_ticket_sla_policies"("id") ON DELETE SET NULL,
    CONSTRAINT "crm_tickets_priority_valid"
        CHECK ("priority" IN ('low', 'medium', 'high', 'urgent')),
    CONSTRAINT "crm_tickets_source_valid"
        CHECK ("source" IN ('chat', 'email', 'form', 'phone', 'manual', 'api')),
    CONSTRAINT "crm_tickets_number_positive" CHECK ("number" > 0)
);

CREATE UNIQUE INDEX "crm_tickets_tenant_number_key"
    ON "crm_tickets" ("tenant_id", "number");

-- IDEMPOTENT INTAKE. A routing rule that fires twice on one chat conversation
-- must update nothing rather than open a second ticket for the same
-- conversation — and automations retry, so "fires twice" is the normal case and
-- not the exception. Partial, because a ticket someone typed by hand has no
-- source record and any number of those may exist.
CREATE UNIQUE INDEX "crm_tickets_source_record_key"
    ON "crm_tickets" ("tenant_id", "source", "source_record_id")
    WHERE "source_record_id" IS NOT NULL;

CREATE INDEX "crm_tickets_stage_idx"     ON "crm_tickets" ("tenant_id", "stage_id", "created_at" DESC);
CREATE INDEX "crm_tickets_property_idx"  ON "crm_tickets" ("tenant_id", "property_id", "stage_id");
CREATE INDEX "crm_tickets_pipeline_idx"  ON "crm_tickets" ("tenant_id", "pipeline_id", "stage_id");
CREATE INDEX "crm_tickets_assignee_idx"  ON "crm_tickets" ("tenant_id", "assigned_to_user_id", "stage_id");
CREATE INDEX "crm_tickets_customer_idx"  ON "crm_tickets" ("tenant_id", "customer_id");
CREATE INDEX "crm_tickets_account_idx"   ON "crm_tickets" ("tenant_id", "b2b_account_id");
CREATE INDEX "crm_tickets_priority_idx"  ON "crm_tickets" ("tenant_id", "priority", "stage_id");
-- The sweep's own indexes: it asks for tickets that are still owed something.
CREATE INDEX "crm_tickets_first_due_idx" ON "crm_tickets" ("tenant_id", "first_response_due_at");
CREATE INDEX "crm_tickets_res_due_idx"   ON "crm_tickets" ("tenant_id", "resolution_due_at");
CREATE INDEX "crm_tickets_updated_idx"   ON "crm_tickets" ("tenant_id", "updated_at" DESC);

ALTER TABLE "crm_tickets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm_tickets" FORCE  ROW LEVEL SECURITY;
CREATE POLICY crm_tickets_tenant_isolation ON "crm_tickets"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- ─────────────────────────────────────────────────────────────────────────
-- 3. The two dangling ticket_id columns finally get their foreign keys
-- ─────────────────────────────────────────────────────────────────────────
--
-- crm_engagement_threads.ticket_id (phase 3) and crm_calls.ticket_id (phase 3.5)
-- both shipped as bare UUIDs pointing at a table that did not exist yet. Every
-- one is NULL today, so the constraints validate against nothing and cannot
-- fail. SET NULL rather than CASCADE: deleting a ticket must not delete the
-- conversation that raised it — the words a customer said outlive our filing.

ALTER TABLE "crm_engagement_threads"
    ADD CONSTRAINT "crm_engagement_threads_ticket_fkey"
    FOREIGN KEY ("ticket_id") REFERENCES "crm_tickets"("id") ON DELETE SET NULL;

ALTER TABLE "crm_calls"
    ADD CONSTRAINT "crm_calls_ticket_fkey"
    FOREIGN KEY ("ticket_id") REFERENCES "crm_tickets"("id") ON DELETE SET NULL;

CREATE INDEX "crm_calls_ticket_idx"
    ON "crm_calls" ("tenant_id", "ticket_id", "started_at" DESC);
