-- Funnels module (docs/151, docs/152 B1) — three new tables, nothing altered.
--
-- The platform already had every part of a campaign: a capture surface, a
-- follow-up, a rule engine, a traffic record and an outcome. What it had no way
-- to say was that THOSE belong to one campaign, and whether that campaign
-- worked. These tables are that binding, and its measurement.
--
-- ── THE PRIVACY LINE ────────────────────────────────────────────────────────
--
-- Site analytics is cookieless by construction: a visitor is a salted
-- daily-rotating hash, used as a lookup key and never stored as a column. That
-- is what lets a tenant's site ship with no consent banner.
--
-- So identity is split at the capture line. `rollup_funnel_daily` counts people
-- and identifies nobody. `funnel_stage_events` holds one row per KNOWN person —
-- somebody who gave an address or is already a customer. There is deliberately
-- NO visitor-hash column on any table here, and adding one would be the change
-- that puts a consent banner on every tenant's site.
--
-- All three are new and empty, so there is no FORCE-RLS backfill loop: nothing
-- to rewrite, and none of the `sparx_owner`-sees-zero-rows footgun.

-- ─── funnels ────────────────────────────────────────────────────────────────

CREATE TABLE "funnels" (
    "id"                  UUID         NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"           UUID         NOT NULL,
    -- NOT NULL, unlike automations.property_id. A rule can sensibly apply to
    -- every business a tenant runs; a campaign cannot. Required here removes the
    -- "which business is this for" ambiguity from every report downstream.
    "property_id"         UUID         NOT NULL,

    "name"                VARCHAR(255) NOT NULL,
    "description"         TEXT,
    "status"              VARCHAR(20)  NOT NULL DEFAULT 'draft',
    "kind"                VARCHAR(20)  NOT NULL DEFAULT 'lead',

    -- The ordered ladder as ONE document, like automations.actions and
    -- email_sequences.steps: always read whole, always written whole, and its
    -- order is part of its meaning.
    "stages"              JSONB        NOT NULL DEFAULT '[]',
    -- A ConditionGroup, same shape and same evaluator as automations.goal.
    -- Nullable here because a DRAFT is allowed to be incomplete; the service
    -- layer requires it before a funnel may go active.
    "goal"                JSONB,
    -- NULLABLE ON PURPOSE, and it renders as "not set", never as $0.00. A funnel
    -- nobody has priced and a funnel priced at zero are different facts, and a
    -- defaulted 0 makes them identical while reporting that every lead the
    -- campaign produced was worth nothing.
    "goal_value_cents"    BIGINT,

    "automation_id"       UUID,
    "sequence_id"         UUID,
    "entry_page_id"       UUID,
    -- A node id inside a page document, not a row in a table — nothing to point
    -- a foreign key at.
    "entry_form_node_id"  VARCHAR(64),

    "origin"              VARCHAR(10)  NOT NULL DEFAULT 'user',
    "recipe_key"          VARCHAR(63),

    "created_at"          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "updated_at"          TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT "funnels_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "funnels_tenant_fk"
        FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
    -- CASCADE: deleting a site must NARROW a campaign's reach. SetNull would
    -- silently promote a site's funnel to tenant-wide, which is the bug.
    CONSTRAINT "funnels_property_fk"
        FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE,
    -- SetNull on all three: the evidence outlives the machinery. Deleting the
    -- automation that drove a campaign must not delete the record that it
    -- converted eleven people.
    CONSTRAINT "funnels_automation_fk"
        FOREIGN KEY ("automation_id") REFERENCES "automations"("id") ON DELETE SET NULL,
    CONSTRAINT "funnels_sequence_fk"
        FOREIGN KEY ("sequence_id") REFERENCES "email_sequences"("id") ON DELETE SET NULL,
    CONSTRAINT "funnels_entry_page_fk"
        FOREIGN KEY ("entry_page_id") REFERENCES "builder_pages"("id") ON DELETE SET NULL,

    -- Keep the small closed vocabularies closed. A typo in `status` would make a
    -- funnel invisible to the engine while looking perfectly fine in the console.
    CONSTRAINT "funnels_status_check"
        CHECK ("status" IN ('draft', 'active', 'paused', 'archived')),
    CONSTRAINT "funnels_kind_check"
        CHECK ("kind" IN ('lead', 'recovery', 'purchase', 'booking', 'winback', 'custom')),
    CONSTRAINT "funnels_origin_check"
        CHECK ("origin" IN ('user', 'system')),
    -- A goal value of zero is not a price, it is a defaulted number that escaped.
    -- Reject it at the wall so "not set" stays the only way to say "not priced".
    CONSTRAINT "funnels_goal_value_positive_check"
        CHECK ("goal_value_cents" IS NULL OR "goal_value_cents" > 0)
);

-- The list read is "this site's campaigns, most recently touched first".
CREATE INDEX "funnels_tenant_property_updated_idx"
    ON "funnels" ("tenant_id", "property_id", "updated_at" DESC);
-- The engine's "which active funnels might this event belong to" scan.
CREATE INDEX "funnels_tenant_status_idx"
    ON "funnels" ("tenant_id", "status");

ALTER TABLE "funnels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "funnels" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "funnels"
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- ─── funnel_stage_events ────────────────────────────────────────────────────
--
-- One append-only row per (funnel, stage, KNOWN subject, occurrence). Nobody
-- anonymous is ever written here, and there is no column that could hold them.

CREATE TABLE "funnel_stage_events" (
    "id"                  UUID         NOT NULL DEFAULT gen_random_uuid(),
    -- On the ROW, not reached through a join: FORCE RLS is evaluated per row and
    -- a policy cannot follow a foreign key to find its tenant.
    "tenant_id"           UUID         NOT NULL,
    "funnel_id"           UUID         NOT NULL,
    -- Denormalized from the funnel at write time. A funnel's property is NOT
    -- NULL and does not move, so these cannot disagree; it is here so a per-site
    -- report filters without joining a table that grows per person per stage.
    "property_id"         UUID         NOT NULL,

    -- Matches a `key` in the funnel's `stages` document, never a display name,
    -- so renaming a stage keeps its history.
    "stage_key"           VARCHAR(63)  NOT NULL,

    -- THE SUBJECT — exactly one of these, enforced below.
    "customer_id"         UUID,
    "subject_email"       VARCHAR(255),

    -- Copied in at capture and frozen. Same vocabulary as
    -- site_analytics_events.source, which is what lets a funnel report break
    -- down by source with no mapping table. Frozen rather than joined:
    -- attribution is a fact about a moment, and the pageview it came from sits
    -- in a rotating window that will not survive.
    "entry_source"        VARCHAR(20),
    "entry_landing_path"  VARCHAR(2048),
    "entry_campaign"      VARCHAR(64),

    -- Converting stage only, and null when nobody can say what it was worth.
    -- A conversion of unknown value must never be recorded as a conversion
    -- worth nothing.
    "value_cents"         BIGINT,

    -- { cartId, orderId, bookingId, submissionId }. Pointers for a detail view
    -- to follow, deliberately NOT foreign keys: the set is open, and a new kind
    -- of outcome must not require a migration. A dangling one renders as "no
    -- longer available".
    "refs"                JSONB        NOT NULL DEFAULT '{}',

    -- When it HAPPENED, which is not always when it was written: a stitched
    -- entry event is recorded at capture and occurred when the person landed.
    "occurred_at"         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "created_at"          TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT "funnel_stage_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "funnel_stage_events_tenant_fk"
        FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
    CONSTRAINT "funnel_stage_events_funnel_fk"
        FOREIGN KEY ("funnel_id") REFERENCES "funnels"("id") ON DELETE CASCADE,
    -- CASCADE, and it has to be. This table holds per-person history, so an
    -- erasure request must take these rows with it — CASCADE makes that true by
    -- construction rather than by remembering. SET NULL would be actively wrong
    -- twice over: it would keep the history after the person was erased, and it
    -- would leave a row with neither subject, which the check below forbids.
    --
    -- Rows identified by `subject_email` instead have no key to cascade from;
    -- erasing one of those is a delete by (tenant, email) in the erasure path,
    -- and that is the half a reader has to remember.
    CONSTRAINT "funnel_stage_events_customer_fk"
        FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE,

    -- EXACTLY ONE subject. Neither would be an anonymous row, which this table
    -- must never hold; both would be two identities for one person, and the
    -- reports would count them twice.
    CONSTRAINT "funnel_stage_events_one_subject_check"
        CHECK (num_nonnulls("customer_id", "subject_email") = 1)
);

-- The ladder read: this funnel, this window, grouped by stage.
CREATE INDEX "funnel_stage_events_ladder_idx"
    ON "funnel_stage_events" ("tenant_id", "funnel_id", "stage_key", "occurred_at");
-- "Everything this person did in this campaign" — the detail view, and the
-- dedupe check before writing a repeat stage for the same subject.
--
-- Deliberately NOT partial (`WHERE customer_id IS NOT NULL`), even though half
-- the rows in each are null. Prisma cannot express a predicate, so a partial
-- index exists only in SQL and the next `migrate dev` proposes dropping it as
-- drift. These two are declared on the model, so they stay expressible and the
-- schema and the database keep saying the same thing.
CREATE INDEX "funnel_stage_events_customer_idx"
    ON "funnel_stage_events" ("tenant_id", "funnel_id", "customer_id");
CREATE INDEX "funnel_stage_events_email_idx"
    ON "funnel_stage_events" ("tenant_id", "funnel_id", "subject_email");

ALTER TABLE "funnel_stage_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "funnel_stage_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "funnel_stage_events"
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- ─── rollup_funnel_daily ────────────────────────────────────────────────────
--
-- The above-the-line half: how many people reached each rung, per day, with no
-- identity of any kind. Maintained by the same nightly reconcile that owns
-- rollup_site_daily, read with the open day live-overlaid so today is fresh.

CREATE TABLE "rollup_funnel_daily" (
    "tenant_id"   UUID        NOT NULL,
    -- NON-null, unlike the commerce and dropship rollups: a funnel's property is
    -- required and cascades with it, so a row here can never outlive its site
    -- into an "unattributed" bucket. The grain is exact; no surrogate needed.
    "property_id" UUID        NOT NULL,
    "funnel_id"   UUID        NOT NULL,
    "stage_key"   VARCHAR(63) NOT NULL,
    "bucket"      DATE        NOT NULL,

    -- Distinct WITHIN the day, so it charts correctly per bucket and must not be
    -- summed for a window-unique figure — the same caveat rollup_site_daily
    -- carries on visitors.
    "entered"     INTEGER     NOT NULL DEFAULT 0,
    "converted"   INTEGER     NOT NULL DEFAULT 0,
    -- Zero is honest here in a way it is not on the funnel itself: this is a SUM
    -- over rows, and a sum of nothing is nothing.
    "value_cents" BIGINT      NOT NULL DEFAULT 0,

    "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "rollup_funnel_daily_pkey"
        PRIMARY KEY ("tenant_id", "property_id", "funnel_id", "stage_key", "bucket"),
    CONSTRAINT "rollup_funnel_daily_tenant_fk"
        FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
    CONSTRAINT "rollup_funnel_daily_property_fk"
        FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE
);

-- The chart reads one funnel across a date range; the PK's leading tenant_id and
-- property_id cannot serve that on their own.
CREATE INDEX "rollup_funnel_daily_funnel_bucket_idx"
    ON "rollup_funnel_daily" ("tenant_id", "funnel_id", "bucket");

ALTER TABLE "rollup_funnel_daily" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rollup_funnel_daily" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "rollup_funnel_daily"
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());
