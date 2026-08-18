-- docs/146 Phase 7 — Planning intelligence.
--
-- Six tables, six columns, no backfill and no new movement reason.
--
-- WHAT THIS IS FOR. A reorder point today is an integer somebody typed once. It
-- does not know how fast the thing sells, how long the supplier really takes, or
-- how erratic either of those is — so it is simultaneously too high on the steady
-- lines and too low on the spiky ones. That single missing number is why 37.5% of
-- operators report overstock and 33.5% report stockouts at the same time.
--
-- Everything added here is DERIVED from records the platform already keeps: the
-- movement ledger for demand, purchase orders against goods receipts for lead
-- time, the cost ledger for value. Nothing is a tuning parameter and nothing is
-- opaque — every figure traces back to the rows that produced it, which is what
-- makes an operator willing to leave it alone instead of overriding it back to
-- the number in their head.
--
-- TWO PLACES ON PURPOSE. The four planning columns on `inventory_levels` are the
-- FAST READ (sort a stock list by class or by cover without joining anything);
-- the tables below are the EXPLANATION (every input, its window, its sample size).
-- Both are written by the same nightly pass in one transaction per level, so they
-- cannot disagree. Same relationship as Phase 5's moving average and its cost
-- layers.
--
-- NOTHING HERE WRITES on_hand, and nothing here silently rewrites a human. The
-- only write that changes operational behaviour is copying a computed reorder
-- point onto `inventory_levels.reorder_point`, and that happens exclusively where
-- `inventory_reorder_policies.is_auto_managed` is true — which is false by
-- default and false for every level that already has a hand-typed point. The
-- computed figure otherwise sits beside it in `dynamic_reorder_point` so the
-- difference is visible and adopting it is a decision, not a surprise.
--
-- NO BACKFILL. Every figure here is a measurement, and a measurement nobody has
-- taken yet is NULL, not zero. The surfaces say "not measured yet" until the
-- first sweep runs, which is the honest state and is distinguishable from "we
-- measured it and it is nothing".
--
-- CHECK-CONSTRAINT NOTE (this has bitten in Phases 4, 5 and 6): nothing in this
-- migration adds a movement reason, a cost-layer source or a reservation holder,
-- so no existing CHECK needs widening. The counts this phase GENERATES use
-- `type = 'cycle'` and `scope IN ('location','zone')`, all of which the existing
-- `inventory_counts` CHECKs already admit.

-- ══════════════════════════════════════════════════════════════════════════
-- 1. Demand velocity — how fast one thing sells in one place
-- ══════════════════════════════════════════════════════════════════════════
--
-- Three windows because they disagree usefully: a 7-day rate at triple the
-- 90-day rate is an acceleration a single 30-day average would have hidden.

CREATE TABLE "inventory_demand_velocity" (
  "variant_id"         UUID           NOT NULL,
  "warehouse_id"       UUID           NOT NULL,
  "tenant_id"          UUID           NOT NULL,

  "units_7"            INTEGER        NOT NULL DEFAULT 0,
  "units_30"           INTEGER        NOT NULL DEFAULT 0,
  "units_90"           INTEGER        NOT NULL DEFAULT 0,

  "per_day_7"          DECIMAL(12,4)  NOT NULL DEFAULT 0,
  "per_day_30"         DECIMAL(12,4)  NOT NULL DEFAULT 0,
  "per_day_90"         DECIMAL(12,4)  NOT NULL DEFAULT 0,

  -- The one figure everything downstream uses, and which window produced it.
  "forecast_per_day"   DECIMAL(12,4)  NOT NULL DEFAULT 0,
  "forecast_basis"     VARCHAR(8)     NOT NULL DEFAULT 'none',

  -- Standard deviation of DAILY demand over the 90-day window (σ_d).
  "demand_std_dev"     DECIMAL(12,4)  NOT NULL DEFAULT 0,

  -- σ/mean. NULL when the mean is zero — a ratio against nothing is no number,
  -- and storing 0 would classify a dead item as perfectly predictable.
  "demand_cv"          DECIMAL(10,4),

  -- Days of the last 90 with any sale. Separates "two a day, every day" from
  -- "sixty in one afternoon", which share an average and want opposite policies.
  "days_with_demand"   INTEGER        NOT NULL DEFAULT 0,

  -- Same period last year ÷ the trailing year's average. NULL, never 1.0, when
  -- there is not a year of history: a defaulted 1.0 is indistinguishable from a
  -- measured one.
  "seasonality_index"  DECIMAL(8,4),

  -- The honesty field. Every figure above is only as good as this.
  "history_days"       INTEGER        NOT NULL DEFAULT 0,
  "first_movement_at"  TIMESTAMPTZ,
  "last_sale_at"       TIMESTAMPTZ,

  "computed_at"        TIMESTAMPTZ    NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_demand_velocity_pkey" PRIMARY KEY ("variant_id", "warehouse_id"),
  CONSTRAINT "inventory_demand_velocity_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_demand_velocity_variant_fk"
    FOREIGN KEY ("variant_id") REFERENCES "commerce_product_variants" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_demand_velocity_warehouse_fk"
    FOREIGN KEY ("warehouse_id") REFERENCES "inventory_warehouses" ("id") ON DELETE CASCADE,

  CONSTRAINT "inventory_demand_velocity_basis_check" CHECK (
    "forecast_basis" IN ('none','7d','30d','90d')
  )
);

CREATE INDEX "inventory_demand_velocity_tenant_warehouse_idx"
  ON "inventory_demand_velocity" ("tenant_id", "warehouse_id");
CREATE INDEX "inventory_demand_velocity_tenant_rate_idx"
  ON "inventory_demand_velocity" ("tenant_id", "forecast_per_day");

ALTER TABLE "inventory_demand_velocity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_demand_velocity" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_demand_velocity"
  USING ("tenant_id" = current_tenant_id());

-- ══════════════════════════════════════════════════════════════════════════
-- 2. ABC / XYZ — what deserves attention, and what can be forecast
-- ══════════════════════════════════════════════════════════════════════════
--
-- ABC is by annual usage VALUE (where the money is), cut cumulatively at 80/95.
-- XYZ is by the coefficient of variation of daily demand. Together they say what
-- to DO: an AX line earns a tight reorder point and a monthly count; a CZ line
-- earns being bought when someone asks and counted once a year.
--
-- The override is sticky and the measured class is kept alongside it, so the
-- surface can say "measured C, you set A" instead of pretending the override was
-- the finding.

CREATE TABLE "inventory_classifications" (
  "variant_id"              UUID          NOT NULL,
  "warehouse_id"            UUID          NOT NULL,
  "tenant_id"               UUID          NOT NULL,

  "abc_class"               VARCHAR(1)    NOT NULL DEFAULT 'C',
  "xyz_class"               VARCHAR(1)    NOT NULL DEFAULT 'Z',

  "annual_usage_units"       INTEGER      NOT NULL DEFAULT 0,
  "annual_usage_value_cents" BIGINT       NOT NULL DEFAULT 0,

  -- The two numbers that make the cut explainable: "you are 0.4% of spend, and
  -- everything above you adds to 93%, so you are a B".
  "value_share_pct"          DECIMAL(9,6) NOT NULL DEFAULT 0,
  "cumulative_share_pct"     DECIMAL(9,6) NOT NULL DEFAULT 0,

  "demand_cv"                DECIMAL(10,4),

  "abc_override"             VARCHAR(1),
  "xyz_override"             VARCHAR(1),
  "override_reason"          VARCHAR(255),
  "override_by"              VARCHAR(127),
  "override_at"              TIMESTAMPTZ,

  "classified_at"            TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_classifications_pkey" PRIMARY KEY ("variant_id", "warehouse_id"),
  CONSTRAINT "inventory_classifications_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_classifications_variant_fk"
    FOREIGN KEY ("variant_id") REFERENCES "commerce_product_variants" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_classifications_warehouse_fk"
    FOREIGN KEY ("warehouse_id") REFERENCES "inventory_warehouses" ("id") ON DELETE CASCADE,

  CONSTRAINT "inventory_classifications_abc_check" CHECK ("abc_class" IN ('A','B','C')),
  CONSTRAINT "inventory_classifications_xyz_check" CHECK ("xyz_class" IN ('X','Y','Z')),
  CONSTRAINT "inventory_classifications_abc_override_check" CHECK (
    "abc_override" IS NULL OR "abc_override" IN ('A','B','C')
  ),
  CONSTRAINT "inventory_classifications_xyz_override_check" CHECK (
    "xyz_override" IS NULL OR "xyz_override" IN ('X','Y','Z')
  )
);

CREATE INDEX "inventory_classifications_tenant_class_idx"
  ON "inventory_classifications" ("tenant_id", "abc_class", "xyz_class");
CREATE INDEX "inventory_classifications_tenant_value_idx"
  ON "inventory_classifications" ("tenant_id", "annual_usage_value_cents");

ALTER TABLE "inventory_classifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_classifications" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_classifications"
  USING ("tenant_id" = current_tenant_id());

-- ══════════════════════════════════════════════════════════════════════════
-- 3. Reorder policy — the arithmetic, and who owns the answer
-- ══════════════════════════════════════════════════════════════════════════
--
--   safety stock  = z(service level) × √( LT·σ_d² + d²·σ_LT² )
--   reorder point = d × LT × seasonality + safety stock
--
-- Both variability terms are carried. Most tools only carry demand variability,
-- but a supplier whose lead time swings between 3 and 21 days puts far more stock
-- at risk than one whose demand wobbles slightly, and σ_LT is the only term that
-- says so.

CREATE TABLE "inventory_reorder_policies" (
  "variant_id"               UUID         NOT NULL,
  "warehouse_id"             UUID         NOT NULL,
  "tenant_id"                UUID         NOT NULL,

  -- NULL follows the tenant default.
  "service_level"            VARCHAR(4),

  -- The two inputs a person may genuinely know better than the ledger does.
  "lead_time_days_override"  INTEGER,
  "safety_stock_override"    INTEGER,

  "safety_stock_units"       INTEGER      NOT NULL DEFAULT 0,
  "computed_reorder_point"   INTEGER      NOT NULL DEFAULT 0,
  "computed_order_quantity"  INTEGER      NOT NULL DEFAULT 0,
  "lead_time_days_used"      DECIMAL(8,2) NOT NULL DEFAULT 0,
  "lead_time_std_dev_used"   DECIMAL(8,2) NOT NULL DEFAULT 0,

  -- Where the lead time came from. "We measured your last 14 deliveries" and
  -- "your supplier says 5 days" deserve very different confidence.
  "lead_time_source"         VARCHAR(12)  NOT NULL DEFAULT 'default',

  -- The consent flag. False = the level's own reorder point is a human's and the
  -- sweep only writes `dynamic_reorder_point` beside it.
  "is_auto_managed"          BOOLEAN      NOT NULL DEFAULT false,
  "applied_at"               TIMESTAMPTZ,

  "computed_at"              TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"               TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_reorder_policies_pkey" PRIMARY KEY ("variant_id", "warehouse_id"),
  CONSTRAINT "inventory_reorder_policies_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_reorder_policies_variant_fk"
    FOREIGN KEY ("variant_id") REFERENCES "commerce_product_variants" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_reorder_policies_warehouse_fk"
    FOREIGN KEY ("warehouse_id") REFERENCES "inventory_warehouses" ("id") ON DELETE CASCADE,

  CONSTRAINT "inventory_reorder_policies_service_level_check" CHECK (
    "service_level" IS NULL OR "service_level" IN ('p50','p80','p90','p95','p99')
  ),
  CONSTRAINT "inventory_reorder_policies_lt_source_check" CHECK (
    "lead_time_source" IN ('measured','supplier','level','default')
  )
);

CREATE INDEX "inventory_reorder_policies_tenant_auto_idx"
  ON "inventory_reorder_policies" ("tenant_id", "is_auto_managed");

ALTER TABLE "inventory_reorder_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_reorder_policies" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_reorder_policies"
  USING ("tenant_id" = current_tenant_id());

-- ══════════════════════════════════════════════════════════════════════════
-- 4. Measured lead time — how long they ACTUALLY take
-- ══════════════════════════════════════════════════════════════════════════
--
-- Two grains in one table: `variant_id IS NULL` is the supplier's overall
-- figure, a set `variant_id` is that supplier for that item — often materially
-- different, because they stock the common part and drop-ship the rare one. Two
-- PARTIAL unique indexes rather than one over the nullable column: a plain
-- UNIQUE treats NULLs as distinct and would accept fifty "overall" rows for the
-- same supplier.

CREATE TABLE "inventory_supplier_lead_times" (
  "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"       UUID         NOT NULL,
  "supplier_id"     UUID         NOT NULL,
  "variant_id"      UUID,

  -- One delivery is an anecdote. The surface reports this so a two-sample mean
  -- is never presented as a measurement.
  "sample_count"    INTEGER      NOT NULL DEFAULT 0,

  "mean_days"       DECIMAL(8,2) NOT NULL DEFAULT 0,
  "std_dev_days"    DECIMAL(8,2) NOT NULL DEFAULT 0,
  "min_days"        INTEGER      NOT NULL DEFAULT 0,
  "max_days"        INTEGER      NOT NULL DEFAULT 0,

  -- The stated figure at measuring time, so promise-vs-reality is a stored fact
  -- rather than a report recomputing against a number since edited.
  "promised_days"   INTEGER,
  "on_time_rate"    DECIMAL(5,4),

  "last_receipt_at" TIMESTAMPTZ,
  "measured_at"     TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_supplier_lead_times_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_supplier_lead_times_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_supplier_lead_times_supplier_fk"
    FOREIGN KEY ("supplier_id") REFERENCES "inventory_suppliers" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_supplier_lead_times_variant_fk"
    FOREIGN KEY ("variant_id") REFERENCES "commerce_product_variants" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "inventory_supplier_lead_times_overall_unique"
  ON "inventory_supplier_lead_times" ("tenant_id", "supplier_id")
  WHERE "variant_id" IS NULL;
CREATE UNIQUE INDEX "inventory_supplier_lead_times_variant_unique"
  ON "inventory_supplier_lead_times" ("tenant_id", "supplier_id", "variant_id")
  WHERE "variant_id" IS NOT NULL;
CREATE INDEX "inventory_supplier_lead_times_tenant_supplier_idx"
  ON "inventory_supplier_lead_times" ("tenant_id", "supplier_id");

ALTER TABLE "inventory_supplier_lead_times" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_supplier_lead_times" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_supplier_lead_times"
  USING ("tenant_id" = current_tenant_id());

-- ══════════════════════════════════════════════════════════════════════════
-- 5. Cycle-count schedules — counting as a fact, not an intention
-- ══════════════════════════════════════════════════════════════════════════
--
-- Counts have existed since docs/100 and every one had to be created by hand,
-- which in practice means they stop happening in week three. ABC-driven cadence
-- covers a catalogue completely for a tenth of the effort of a full stocktake:
-- count where the money is monthly, the middle quarterly, the tail annually.
--
-- `next_run_at` is stored rather than derived from `last_run_at + interval`, so a
-- schedule paused for six weeks resumes on a sane date instead of immediately
-- firing six overdue counts.

CREATE TABLE "inventory_cycle_count_schedules" (
  "id"                UUID        NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"         UUID        NOT NULL,
  "warehouse_id"      UUID        NOT NULL,

  "name"              VARCHAR(80) NOT NULL,

  -- NULL class = every class; NULL zone = the whole location.
  "abc_class"         VARCHAR(1),
  "zone_name"         VARCHAR(60),

  "cadence"           VARCHAR(12) NOT NULL,
  "interval_days"     INTEGER     NOT NULL,

  -- A count of four hundred lines does not get done. The generator takes the
  -- most overdue slice up to this size and leaves the rest for next time.
  "max_items_per_run" INTEGER     NOT NULL DEFAULT 50,

  -- Blind by DEFAULT here, unlike a hand-made count: a scheduled count exists to
  -- measure accuracy, and showing the expected figure measures agreement instead.
  "is_blind"          BOOLEAN     NOT NULL DEFAULT true,

  "assigned_to"       VARCHAR(127),
  "is_active"         BOOLEAN     NOT NULL DEFAULT true,

  "last_run_at"       TIMESTAMPTZ,
  "last_count_id"     UUID,
  "next_run_at"       TIMESTAMPTZ NOT NULL,

  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_cycle_count_schedules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_cycle_count_schedules_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_cycle_count_schedules_warehouse_fk"
    FOREIGN KEY ("warehouse_id") REFERENCES "inventory_warehouses" ("id") ON DELETE CASCADE,

  CONSTRAINT "inventory_cycle_count_schedules_cadence_check" CHECK (
    "cadence" IN ('weekly','monthly','quarterly','annually','custom')
  ),
  CONSTRAINT "inventory_cycle_count_schedules_abc_check" CHECK (
    "abc_class" IS NULL OR "abc_class" IN ('A','B','C')
  ),
  CONSTRAINT "inventory_cycle_count_schedules_interval_check" CHECK ("interval_days" > 0),
  CONSTRAINT "inventory_cycle_count_schedules_max_items_check" CHECK ("max_items_per_run" > 0)
);

CREATE INDEX "inventory_cycle_count_schedules_tenant_warehouse_idx"
  ON "inventory_cycle_count_schedules" ("tenant_id", "warehouse_id");
CREATE INDEX "inventory_cycle_count_schedules_due_idx"
  ON "inventory_cycle_count_schedules" ("tenant_id", "is_active", "next_run_at");

ALTER TABLE "inventory_cycle_count_schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_cycle_count_schedules" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_cycle_count_schedules"
  USING ("tenant_id" = current_tenant_id());

-- ══════════════════════════════════════════════════════════════════════════
-- 6. Planning policy — the knobs, with defaults that are right for most
-- ══════════════════════════════════════════════════════════════════════════
--
-- One row per tenant, absent by default, and absent means these values — so a
-- tenant who never opens the screen still gets a working forecast. Same contract
-- as `inventory_costing_policies`.
--
-- 25% a year is the category's holding-cost figure (warehousing, insurance,
-- capital, shrink, obsolescence together), and 54% of operators report their real
-- number is above 10%. It is an estimate and the surface says so. It exists
-- because "£41,000 has not moved in a year" is interesting and "that is costing
-- you about £10,000 a year to keep" is actionable.

CREATE TABLE "inventory_planning_policies" (
  "tenant_id"                     UUID         NOT NULL,

  "service_level"                 VARCHAR(4)   NOT NULL DEFAULT 'p95',
  "holding_cost_rate_pct"         DECIMAL(5,2) NOT NULL DEFAULT 25.00,

  "abc_a_threshold_pct"           DECIMAL(5,2) NOT NULL DEFAULT 80.00,
  "abc_b_threshold_pct"           DECIMAL(5,2) NOT NULL DEFAULT 95.00,

  "xyz_x_max_cv"                  DECIMAL(6,3) NOT NULL DEFAULT 0.500,
  "xyz_y_max_cv"                  DECIMAL(6,3) NOT NULL DEFAULT 1.000,

  -- Separate numbers because they are separate problems: overstock is too much
  -- of something that sells, dead stock is any of something that does not.
  "overstock_cover_days"          INTEGER      NOT NULL DEFAULT 180,
  "dead_stock_days"               INTEGER      NOT NULL DEFAULT 180,

  -- Off by default: a number that appears without being asked for is
  -- indistinguishable from a bug.
  "auto_apply_reorder_points"     BOOLEAN      NOT NULL DEFAULT false,

  "min_seasonality_history_days"  INTEGER      NOT NULL DEFAULT 365,

  "last_sweep_at"                 TIMESTAMPTZ,

  "created_at"                    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"                    TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_planning_policies_pkey" PRIMARY KEY ("tenant_id"),
  CONSTRAINT "inventory_planning_policies_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE,

  CONSTRAINT "inventory_planning_policies_service_level_check" CHECK (
    "service_level" IN ('p50','p80','p90','p95','p99')
  ),
  CONSTRAINT "inventory_planning_policies_abc_order_check" CHECK (
    "abc_a_threshold_pct" > 0 AND "abc_a_threshold_pct" < "abc_b_threshold_pct"
      AND "abc_b_threshold_pct" <= 100
  ),
  CONSTRAINT "inventory_planning_policies_xyz_order_check" CHECK (
    "xyz_x_max_cv" > 0 AND "xyz_x_max_cv" < "xyz_y_max_cv"
  ),
  CONSTRAINT "inventory_planning_policies_holding_rate_check" CHECK (
    "holding_cost_rate_pct" >= 0 AND "holding_cost_rate_pct" <= 100
  )
);

ALTER TABLE "inventory_planning_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_planning_policies" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_planning_policies"
  USING ("tenant_id" = current_tenant_id());

-- ══════════════════════════════════════════════════════════════════════════
-- 7. The fast read on the level, and the count's link back to its schedule
-- ══════════════════════════════════════════════════════════════════════════
--
-- All five level columns are NULLABLE with no default, and that is deliberate:
-- NULL means "no sweep has looked at this yet", which is a different thing from
-- a measured zero and must read differently on screen.

ALTER TABLE "inventory_levels"
  ADD COLUMN "abc_class"             VARCHAR(1),
  ADD COLUMN "xyz_class"             VARCHAR(1),
  ADD COLUMN "forecast_daily_demand" DECIMAL(12,4),
  ADD COLUMN "dynamic_reorder_point" INTEGER,
  ADD COLUMN "planning_computed_at"  TIMESTAMPTZ;

ALTER TABLE "inventory_levels"
  ADD CONSTRAINT "inventory_levels_abc_check" CHECK (
    "abc_class" IS NULL OR "abc_class" IN ('A','B','C')
  ),
  ADD CONSTRAINT "inventory_levels_xyz_check" CHECK (
    "xyz_class" IS NULL OR "xyz_class" IN ('X','Y','Z')
  );

-- Sorting a stock list by "least cover first" is the whole point of the
-- denormalisation, so it gets the index rather than only the planning tables.
CREATE INDEX "inventory_levels_tenant_abc_idx"
  ON "inventory_levels" ("tenant_id", "abc_class");

-- SET NULL, not CASCADE: deleting the standing instruction must never delete the
-- counts it produced, which are the evidence that counting happened.
ALTER TABLE "inventory_counts"
  ADD COLUMN "schedule_id" UUID;

ALTER TABLE "inventory_counts"
  ADD CONSTRAINT "inventory_counts_schedule_fk"
    FOREIGN KEY ("schedule_id") REFERENCES "inventory_cycle_count_schedules" ("id")
    ON DELETE SET NULL;

CREATE INDEX "inventory_counts_tenant_schedule_idx"
  ON "inventory_counts" ("tenant_id", "schedule_id");
