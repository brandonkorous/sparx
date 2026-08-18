-- docs/144 §9 + §10 — workflow depth (branching + goals), scoring, and lists
-- that aren't rules.
--
-- Three groups of change, in the order they depend on each other:
--   1. automations gain a GOAL, and runs gain the outcome that goal produces
--   2. lists gain a KIND (dynamic vs static) and an append-only membership log
--   3. records gain a SCORE, backed by a tenant-authored model and an event log
--
-- Every new table is ENABLE + FORCE RLS with a tenant_isolation policy. No
-- backfill loops a tenant here: every added column has a literal default, so
-- there is no read of existing rows to be blocked by FORCE RLS under the
-- non-superuser owner role (packages/db/CLAUDE.md).

-- ══════════════════════════════════════════════════════════════════════════
-- 1. Workflow depth — goals and how a run ends
-- ══════════════════════════════════════════════════════════════════════════

-- The outcome the rule is trying to cause, as a ConditionGroup. Null = the rule
-- declares no goal, which is every automation that exists today.
ALTER TABLE "automations" ADD COLUMN "goal" JSONB;

-- Snapshots carry it too, so restoring an old version restores its goal rather
-- than silently keeping the current one.
ALTER TABLE "automation_versions" ADD COLUMN "goal" JSONB;

-- A run that met its goal stopped for a reason worth distinguishing from having
-- simply run out of actions. `status` is an unconstrained VARCHAR, so
-- 'converted' needs no type change — but it does need to be readable, hence the
-- comment below.
ALTER TABLE "automation_runs" ADD COLUMN "goal_met_at" TIMESTAMPTZ;
ALTER TABLE "automation_runs" ADD COLUMN "exit_reason" VARCHAR(255);

COMMENT ON COLUMN "automation_runs"."status" IS
  'running | waiting | completed | failed | skipped | converted. "converted" is a terminal SUCCESS: the run stopped because the automation''s goal was met (docs/144 §9).';

-- Enrollment analytics reads (entered / active / converted / exited) group by
-- automation and status. The existing indexes lead with tenant_id and don't
-- carry automation_id, so this is the one that serves the funnel.
CREATE INDEX "automation_runs_automation_status_idx"
  ON "automation_runs" ("tenant_id", "automation_id", "status");

-- Where a step sat in the AUTHORED tree ('2', '2.then.0'). The engine resumes
-- from `action_index` into the compiled program; this is the human coordinate.
ALTER TABLE "automation_run_steps" ADD COLUMN "path" VARCHAR(255);

-- Per-step drop-off asks "of the runs that reached step N, how many reached
-- N+1" — a scan by (run, index) already covered, plus this one for the
-- cross-run aggregate by action type.
CREATE INDEX "automation_run_steps_tenant_action_idx"
  ON "automation_run_steps" ("tenant_id", "action_type", "status");

-- ══════════════════════════════════════════════════════════════════════════
-- 2. Lists that aren't rules
-- ══════════════════════════════════════════════════════════════════════════

-- 'dynamic' (rule-driven, the only kind until now) | 'static' (hand-picked).
-- Defaulted so every existing segment keeps behaving exactly as it did.
ALTER TABLE "segments" ADD COLUMN "kind" VARCHAR(10) NOT NULL DEFAULT 'dynamic';

ALTER TABLE "segments" ADD CONSTRAINT "segments_kind_check"
  CHECK ("kind" IN ('dynamic', 'static'));

COMMENT ON COLUMN "segments"."kind" IS
  'dynamic = membership recomputed from `rules`; static = membership is written by hand or by an automation and the evaluator MUST skip it (docs/144 §10).';

-- Append-only membership log. Not a nullable exited_at on segment_members: a
-- customer can enter, leave and re-enter, and one row remembers only the last.
CREATE TABLE "segment_membership_events" (
  "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"   UUID         NOT NULL,
  "segment_id"  UUID         NOT NULL,
  "customer_id" UUID         NOT NULL,
  "kind"        VARCHAR(10)  NOT NULL,
  "source"      VARCHAR(20)  NOT NULL DEFAULT 'rule',
  "actor_id"    UUID,
  "occurred_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "segment_membership_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "segment_membership_events_kind_check"
    CHECK ("kind" IN ('entered', 'exited')),
  CONSTRAINT "segment_membership_events_source_check"
    CHECK ("source" IN ('rule', 'manual', 'automation', 'import')),
  CONSTRAINT "segment_membership_events_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "segment_membership_events_segment_id_fkey"
    FOREIGN KEY ("segment_id") REFERENCES "segments"("id") ON DELETE CASCADE,
  CONSTRAINT "segment_membership_events_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE
);

CREATE INDEX "segment_membership_events_segment_idx"
  ON "segment_membership_events" ("tenant_id", "segment_id", "occurred_at" DESC);
CREATE INDEX "segment_membership_events_customer_idx"
  ON "segment_membership_events" ("tenant_id", "customer_id", "occurred_at" DESC);

ALTER TABLE "segment_membership_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "segment_membership_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "segment_membership_events"
  USING ("tenant_id" = current_tenant_id());

-- ══════════════════════════════════════════════════════════════════════════
-- 3. Scoring
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE "scoring_models" (
  "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"     UUID         NOT NULL,
  "property_id"   UUID,
  "object_key"    VARCHAR(63)  NOT NULL,
  "name"          VARCHAR(160) NOT NULL,
  "description"   TEXT,
  "rules"         JSONB        NOT NULL DEFAULT '[]',
  "decay_per_day" DECIMAL(8,2),
  "max_score"     INTEGER      NOT NULL DEFAULT 100,
  "is_active"     BOOLEAN      NOT NULL DEFAULT true,
  "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "archived_at"   TIMESTAMPTZ,

  CONSTRAINT "scoring_models_pkey" PRIMARY KEY ("id"),
  -- A ceiling of zero would make every score zero and read as "scoring is
  -- broken"; a negative one is meaningless.
  CONSTRAINT "scoring_models_max_score_check" CHECK ("max_score" > 0),
  CONSTRAINT "scoring_models_decay_check"
    CHECK ("decay_per_day" IS NULL OR "decay_per_day" >= 0),
  CONSTRAINT "scoring_models_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "scoring_models_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE
);

-- ONE active model per (site, object). Two would make "the score" mean whichever
-- model happened to run last. Partial + NULLS NOT DISTINCT so the tenant-wide
-- tier (property_id IS NULL) is covered by the same constraint — Prisma cannot
-- express either half, hence the hand-written index.
CREATE UNIQUE INDEX "scoring_models_one_active_per_object"
  ON "scoring_models" ("tenant_id", "property_id", "object_key")
  NULLS NOT DISTINCT
  WHERE "is_active" AND "archived_at" IS NULL;

CREATE INDEX "scoring_models_object_idx"
  ON "scoring_models" ("tenant_id", "object_key", "is_active");
CREATE INDEX "scoring_models_property_idx"
  ON "scoring_models" ("tenant_id", "property_id", "object_key");

ALTER TABLE "scoring_models" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scoring_models" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "scoring_models"
  USING ("tenant_id" = current_tenant_id());

-- One row per score CHANGE — the answer to "why is this 74?".
CREATE TABLE "score_events" (
  "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"   UUID         NOT NULL,
  "model_id"    UUID,
  "object_key"  VARCHAR(63)  NOT NULL,
  "record_id"   UUID         NOT NULL,
  "delta"       INTEGER      NOT NULL,
  "score"       INTEGER      NOT NULL,
  "reason"      VARCHAR(255),
  "source"      VARCHAR(20)  NOT NULL DEFAULT 'rule',
  "actor_id"    UUID,
  "occurred_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "score_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "score_events_source_check"
    CHECK ("source" IN ('rule', 'decay', 'manual', 'recompute')),
  CONSTRAINT "score_events_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  -- SetNull, not Cascade: deleting the model that produced a score must not
  -- erase the record of what the score WAS. The history outlives the rules.
  CONSTRAINT "score_events_model_id_fkey"
    FOREIGN KEY ("model_id") REFERENCES "scoring_models"("id") ON DELETE SET NULL
);

CREATE INDEX "score_events_record_idx"
  ON "score_events" ("tenant_id", "object_key", "record_id", "occurred_at" DESC);
CREATE INDEX "score_events_recent_idx"
  ON "score_events" ("tenant_id", "occurred_at" DESC);

ALTER TABLE "score_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "score_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "score_events"
  USING ("tenant_id" = current_tenant_id());

-- The scored records themselves. Zero until the tenant writes a model — a
-- default-scored CRM would rank people by a rule nobody chose.
ALTER TABLE "customers" ADD COLUMN "score" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "customers" ADD COLUMN "scored_at" TIMESTAMPTZ;

ALTER TABLE "deals" ADD COLUMN "score" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "deals" ADD COLUMN "scored_at" TIMESTAMPTZ;

-- "Show me the hottest leads" is the whole point, and it is a DESC sort. A plain
-- ascending index serves it, but the composite leading with tenant_id is what
-- keeps it a single-tenant range scan.
CREATE INDEX "customers_score_idx"
  ON "customers" ("tenant_id", "score" DESC)
  WHERE "deleted_at" IS NULL;

CREATE INDEX "deals_score_idx"
  ON "deals" ("tenant_id", "score" DESC)
  WHERE "deleted_at" IS NULL;
