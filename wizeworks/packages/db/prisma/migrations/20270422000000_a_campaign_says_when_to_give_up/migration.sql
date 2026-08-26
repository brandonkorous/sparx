-- A campaign says when to give up (docs/151 §6.1, docs/152 B4).
--
-- `funnel.abandoned` is the only one of the three funnel events with no request
-- behind it: nobody DID anything, and that is the whole signal. A nightly sweep
-- has to decide when standing still became giving up, and that judgment cannot
-- be a platform constant — a cart left for four hours is abandoned, a B2B quote
-- left for four hours is Tuesday afternoon.
--
-- NULL is not "never". It means "use the default for this funnel's kind"
-- (DEFAULT_STALL_HOURS in @wizeworks/funnels), because a funnel that never gives
-- up never fires the recovery follow-up, which is most of the reason a business
-- builds one.
--
-- Bounded at 8760 (a year) so a typo cannot silently park a campaign forever,
-- and > 0 so it can never be set to a window nothing can fall outside of.
ALTER TABLE "funnels"
    ADD COLUMN "stall_after_hours" INTEGER,
    ADD CONSTRAINT "funnels_stall_after_hours_check"
        CHECK ("stall_after_hours" IS NULL
               OR ("stall_after_hours" > 0 AND "stall_after_hours" <= 8760));

-- The sweep's read is "this funnel's subjects, most recent activity first",
-- which the existing (tenant_id, funnel_id, stage_key, occurred_at) index cannot
-- serve: it needs to scan a funnel's events by TIME regardless of rung.
CREATE INDEX "funnel_stage_events_tenant_funnel_occurred_idx"
    ON "funnel_stage_events" ("tenant_id", "funnel_id", "occurred_at" DESC);
