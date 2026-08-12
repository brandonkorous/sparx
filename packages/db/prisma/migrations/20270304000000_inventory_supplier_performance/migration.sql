-- docs/146 Phase 8 — supplier performance and procurement discipline.
--
-- Ten tables and two widened CHECKs. Everything here is about the OTHER side of
-- a purchase order: the counterparty whose behaviour the platform has been
-- recording all along without ever adding it up, and the controls a business
-- puts around spending money with them.
--
-- One rule governs every measured column below, and it is the rule Phase 7 had
-- to learn twice:
--
--   A FIGURE NOBODY COULD MEASURE IS NULL, AND ITS SAMPLE COUNT SITS BESIDE IT.
--
-- A scorecard is where that rule matters most. "0% on time" that actually means
-- "they never quoted a date" is a defensible-looking number that ends a
-- relationship, and no test can catch it because the arithmetic is fine.

-- ══════════════════════════════════════════════════════════════════════════
-- 1. Supplier scorecard (8.1)
-- ══════════════════════════════════════════════════════════════════════════
--
-- One recomputed row per supplier over a rolling window. Stored rather than
-- derived on read because the league table SORTS on these columns, and five
-- aggregate queries per supplier is the difference between a screen that opens
-- and one that times out.
--
-- The lead-time columns are COPIED from inventory_supplier_lead_times, never
-- re-measured. Two independent measurements of one thing is how a scorecard
-- starts disagreeing with the screen it links to.

CREATE TABLE "inventory_supplier_scorecards" (
  "id"                      UUID          NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"               UUID          NOT NULL,
  "supplier_id"             UUID          NOT NULL,

  "window_days"             INTEGER       NOT NULL DEFAULT 365,
  "measured_at"             TIMESTAMPTZ   NOT NULL DEFAULT now(),

  -- Volume. Context for every rate below: 92% on time means one thing across
  -- sixty deliveries and nothing at all across two.
  "orders_placed"           INTEGER       NOT NULL DEFAULT 0,
  "deliveries"              INTEGER       NOT NULL DEFAULT 0,
  "spend_cents"             INTEGER       NOT NULL DEFAULT 0,
  "received_units"          INTEGER       NOT NULL DEFAULT 0,

  -- On time. NULL when nobody ever set a date to be late for.
  "on_time_rate"            DECIMAL(5,4),
  "on_time_sample"          INTEGER       NOT NULL DEFAULT 0,
  "late_deliveries"         INTEGER       NOT NULL DEFAULT 0,
  -- Mean days late across the LATE deliveries only — folding in the early ones
  -- reports a chronically-late supplier as punctual.
  "avg_days_late"           DECIMAL(8,2),

  -- Fill rate, over lines on FINISHED orders only. A line on an open order is
  -- not short, it is in transit; counting it scores every supplier zero the day
  -- their order is raised.
  "fill_rate"               DECIMAL(5,4),
  "fill_rate_sample"        INTEGER       NOT NULL DEFAULT 0,
  "short_lines"             INTEGER       NOT NULL DEFAULT 0,

  -- Lead time, copied from the Phase 7.3 measurement.
  "lead_time_mean_days"     DECIMAL(8,2),
  "lead_time_promised_days" INTEGER,
  "lead_time_variance_days" DECIMAL(8,2),
  "lead_time_sample"        INTEGER       NOT NULL DEFAULT 0,

  -- Price variance, same-currency comparisons only. A variance computed across
  -- two currencies at an unrecorded rate is a fabricated number.
  "price_variance_pct"      DECIMAL(7,4),
  "price_variance_cents"    INTEGER,
  "price_variance_sample"   INTEGER       NOT NULL DEFAULT 0,

  -- Damage on arrival, read from the ledger's `damage` movements against a
  -- receipt. NULL only when nothing was received: a clean delivery genuinely
  -- recorded zero damage, and zero is the right answer there.
  "damage_rate"             DECIMAL(5,4),
  "damaged_units"           INTEGER       NOT NULL DEFAULT 0,

  -- 0-100, and deliberately nullable. `scored_components` travels with it: a
  -- 100 standing on one component is not the claim a 100 on four is, and a
  -- supplier nobody can measure scores NULL rather than zero.
  "score"                   SMALLINT,
  "grade"                   VARCHAR(1),
  "scored_components"       INTEGER       NOT NULL DEFAULT 0,

  CONSTRAINT "inventory_supplier_scorecards_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_supplier_scorecards_tenant_supplier_unique"
    UNIQUE ("tenant_id", "supplier_id"),
  CONSTRAINT "inventory_supplier_scorecards_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_supplier_scorecards_supplier_fk"
    FOREIGN KEY ("supplier_id") REFERENCES "inventory_suppliers" ("id") ON DELETE CASCADE,

  CONSTRAINT "inventory_supplier_scorecards_score_range_check"
    CHECK ("score" IS NULL OR ("score" >= 0 AND "score" <= 100)),
  CONSTRAINT "inventory_supplier_scorecards_grade_check"
    CHECK ("grade" IS NULL OR "grade" IN ('A','B','C','D')),
  -- The score and its grade are one fact expressed twice; neither may exist
  -- without the other, or a screen shows a letter with no number behind it.
  CONSTRAINT "inventory_supplier_scorecards_score_grade_pair_check"
    CHECK (("score" IS NULL) = ("grade" IS NULL))
);

CREATE INDEX "inventory_supplier_scorecards_tenant_score_idx"
  ON "inventory_supplier_scorecards" ("tenant_id", "score");

ALTER TABLE "inventory_supplier_scorecards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_supplier_scorecards" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_supplier_scorecards"
  USING ("tenant_id" = current_tenant_id());

-- ══════════════════════════════════════════════════════════════════════════
-- 2. Quantity price breaks (8.4)
-- ══════════════════════════════════════════════════════════════════════════
--
-- A break is a FLOOR, not a range: the price is the one on the largest
-- min_quantity the order clears. Ranges would let an author leave a gap between
-- 49 and 50 that resolves to nothing at all.

CREATE TABLE "inventory_supplier_price_breaks" (
  "id"                  UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"           UUID         NOT NULL,
  "supplier_variant_id" UUID         NOT NULL,

  -- Base units and base-unit price, like every other quantity in this module.
  "min_quantity"        INTEGER      NOT NULL,
  "unit_cost_cents"     INTEGER      NOT NULL,

  "created_at"          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"          TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_supplier_price_breaks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_supplier_price_breaks_link_qty_unique"
    UNIQUE ("supplier_variant_id", "min_quantity"),
  CONSTRAINT "inventory_supplier_price_breaks_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_supplier_price_breaks_link_fk"
    FOREIGN KEY ("supplier_variant_id") REFERENCES "inventory_supplier_variants" ("id") ON DELETE CASCADE,

  -- A break at quantity 1 is not a break, it is the base price, and storing it
  -- in both places creates two answers to one question.
  CONSTRAINT "inventory_supplier_price_breaks_min_qty_check"
    CHECK ("min_quantity" >= 2),
  CONSTRAINT "inventory_supplier_price_breaks_cost_check"
    CHECK ("unit_cost_cents" >= 0)
);

CREATE INDEX "inventory_supplier_price_breaks_tenant_link_idx"
  ON "inventory_supplier_price_breaks" ("tenant_id", "supplier_variant_id");

ALTER TABLE "inventory_supplier_price_breaks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_supplier_price_breaks" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_supplier_price_breaks"
  USING ("tenant_id" = current_tenant_id());

-- ══════════════════════════════════════════════════════════════════════════
-- 3. Purchase-order approval (8.5)
-- ══════════════════════════════════════════════════════════════════════════
--
-- The mirror of purchase_approval_rules (docs/10 §12), gating the opposite
-- direction: that one holds a customer's order until staff agree to sell, this
-- one holds staff's order until someone senior agrees to spend.
--
-- Precedence is STATED here, unlike in the B2B rule. That one is a boolean gate
-- where every matching rule says the same thing, so query order is harmless.
-- These rules carry an approver, so two matching rules can disagree about who
-- signs: the winner is the highest min_amount_cents the order clears, then
-- sort_order, then the oldest. A £20k order routes to the £10k approver.

CREATE TABLE "inventory_po_approval_rules" (
  "id"                        UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"                 UUID         NOT NULL,

  "name"                      VARCHAR(80)  NOT NULL,

  -- NULL on either axis = "any". A supplier-specific rule is how a business
  -- puts extra eyes on a counterparty it does not yet trust.
  "supplier_id"               UUID,
  "warehouse_id"              UUID,

  "min_amount_cents"          INTEGER      NOT NULL DEFAULT 0,

  "required_approver_user_id" UUID,
  "required_role"             VARCHAR(16),

  "sort_order"                INTEGER      NOT NULL DEFAULT 0,
  "is_active"                 BOOLEAN      NOT NULL DEFAULT true,

  "created_at"                TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"                TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_po_approval_rules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_po_approval_rules_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE,
  -- Cascade, like the B2B rule: deleting a supplier must NARROW what a spending
  -- control reaches, never promote a supplier-specific threshold to every one.
  CONSTRAINT "inventory_po_approval_rules_supplier_fk"
    FOREIGN KEY ("supplier_id") REFERENCES "inventory_suppliers" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_po_approval_rules_warehouse_fk"
    FOREIGN KEY ("warehouse_id") REFERENCES "inventory_warehouses" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_po_approval_rules_approver_fk"
    FOREIGN KEY ("required_approver_user_id") REFERENCES "users" ("id") ON DELETE SET NULL,

  CONSTRAINT "inventory_po_approval_rules_amount_check"
    CHECK ("min_amount_cents" >= 0),
  CONSTRAINT "inventory_po_approval_rules_role_check"
    CHECK ("required_role" IS NULL OR "required_role" IN ('owner','admin','member'))
);

CREATE INDEX "inventory_po_approval_rules_tenant_active_amount_idx"
  ON "inventory_po_approval_rules" ("tenant_id", "is_active", "min_amount_cents");

ALTER TABLE "inventory_po_approval_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_po_approval_rules" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_po_approval_rules"
  USING ("tenant_id" = current_tenant_id());

-- One request for sign-off and its outcome. Append-only in practice: an amended
-- and resubmitted order gets a NEW row rather than reopening the old one, so the
-- trail reads as the sequence of decisions it was — which is the entire point of
-- an approval record and the thing an auditor asks for.

CREATE TABLE "inventory_po_approvals" (
  "id"                        UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"                 UUID         NOT NULL,
  "purchase_order_id"         UUID         NOT NULL,
  "rule_id"                   UUID,

  "status"                    VARCHAR(12)  NOT NULL DEFAULT 'pending',

  -- The total AT REQUEST TIME. Editing the order after approval must not
  -- retroactively change what was signed for — that is the hole this closes.
  "amount_cents"              INTEGER      NOT NULL,
  "currency"                  VARCHAR(3)   NOT NULL DEFAULT 'USD',

  "requested_by_user_id"      UUID,
  "requested_at"              TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "required_approver_user_id" UUID,
  "decided_by_user_id"        UUID,
  "decided_at"                TIMESTAMPTZ,
  "note"                      TEXT,

  CONSTRAINT "inventory_po_approvals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_po_approvals_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_po_approvals_po_fk"
    FOREIGN KEY ("purchase_order_id") REFERENCES "inventory_purchase_orders" ("id") ON DELETE CASCADE,
  -- SET NULL, not CASCADE: deleting the rule must not erase the history of the
  -- orders it held.
  CONSTRAINT "inventory_po_approvals_rule_fk"
    FOREIGN KEY ("rule_id") REFERENCES "inventory_po_approval_rules" ("id") ON DELETE SET NULL,
  CONSTRAINT "inventory_po_approvals_requester_fk"
    FOREIGN KEY ("requested_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL,
  CONSTRAINT "inventory_po_approvals_required_approver_fk"
    FOREIGN KEY ("required_approver_user_id") REFERENCES "users" ("id") ON DELETE SET NULL,
  CONSTRAINT "inventory_po_approvals_decider_fk"
    FOREIGN KEY ("decided_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL,

  CONSTRAINT "inventory_po_approvals_status_check"
    CHECK ("status" IN ('pending','approved','rejected','cancelled')),
  -- A decided row records WHO and WHEN, or it is not a decision. A pending one
  -- records neither, or somebody has half-signed it.
  CONSTRAINT "inventory_po_approvals_decision_pair_check"
    CHECK (
      ("status" = 'pending'  AND "decided_at" IS NULL) OR
      ("status" <> 'pending' AND "decided_at" IS NOT NULL)
    )
);

CREATE INDEX "inventory_po_approvals_tenant_status_idx"
  ON "inventory_po_approvals" ("tenant_id", "status", "requested_at");
CREATE INDEX "inventory_po_approvals_tenant_po_idx"
  ON "inventory_po_approvals" ("tenant_id", "purchase_order_id");

ALTER TABLE "inventory_po_approvals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_po_approvals" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_po_approvals"
  USING ("tenant_id" = current_tenant_id());

-- A held order needs a status of its own. Without one, an order awaiting
-- sign-off is either a draft (and disappears from the buyer's "sent" list) or
-- submitted (and can be received against, which defeats the control entirely).

ALTER TABLE "inventory_purchase_orders"
  DROP CONSTRAINT "inventory_purchase_orders_status_check";
ALTER TABLE "inventory_purchase_orders"
  ADD CONSTRAINT "inventory_purchase_orders_status_check" CHECK (
    "status" IN ('draft','pending_approval','submitted','partial','received','closed','cancelled')
  );

-- ══════════════════════════════════════════════════════════════════════════
-- 4. Advance ship notice (8.6)
-- ══════════════════════════════════════════════════════════════════════════
--
-- What the supplier says they put on the lorry. Its value is not the paperwork:
-- it is that receiving stops being transcription, and that a DISCREPANCY becomes
-- visible at all. Without an ASN, a short shipment is indistinguishable from a
-- short order, and nobody notices they were billed for the difference.
--
-- Discrepancies are NOT stored — they are the difference between these lines and
-- the receipt lines, both already recorded. A third copy is a number that goes
-- stale.

CREATE TABLE "inventory_advance_ship_notices" (
  "id"                  UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"           UUID         NOT NULL,
  "number"              VARCHAR(20)  NOT NULL,

  "purchase_order_id"   UUID         NOT NULL,
  -- Denormalized from the order so the supplier's inbound pipeline is one index
  -- hit. Written once at creation; the order owns it.
  "supplier_id"         UUID         NOT NULL,

  "status"              VARCHAR(12)  NOT NULL DEFAULT 'expected',

  "reference"           VARCHAR(120),
  "carrier"             VARCHAR(80),
  "tracking_number"     VARCHAR(120),
  "package_count"       INTEGER,

  "shipped_at"          TIMESTAMPTZ,
  "expected_arrival_at" TIMESTAMPTZ,
  "received_at"         TIMESTAMPTZ,

  "goods_receipt_id"    UUID,

  -- A notice keyed in by a buyer off an emailed PDF and one posted by the
  -- supplier's own system deserve different confidence, and only this column can
  -- tell them apart.
  "source"              VARCHAR(8)   NOT NULL DEFAULT 'manual',

  "notes"               TEXT,

  "created_at"          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"          TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_advance_ship_notices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_asns_tenant_number_unique" UNIQUE ("tenant_id", "number"),
  CONSTRAINT "inventory_asns_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_asns_po_fk"
    FOREIGN KEY ("purchase_order_id") REFERENCES "inventory_purchase_orders" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_asns_supplier_fk"
    FOREIGN KEY ("supplier_id") REFERENCES "inventory_suppliers" ("id") ON DELETE CASCADE,
  -- SET NULL: a receipt can be reversed, and the notice is still a true record
  -- of what was said to ship.
  CONSTRAINT "inventory_asns_receipt_fk"
    FOREIGN KEY ("goods_receipt_id") REFERENCES "inventory_goods_receipts" ("id") ON DELETE SET NULL,

  CONSTRAINT "inventory_asns_status_check"
    CHECK ("status" IN ('expected','received','cancelled')),
  CONSTRAINT "inventory_asns_source_check"
    CHECK ("source" IN ('manual','file','api')),
  CONSTRAINT "inventory_asns_package_count_check"
    CHECK ("package_count" IS NULL OR "package_count" > 0)
);

CREATE INDEX "inventory_asns_tenant_status_eta_idx"
  ON "inventory_advance_ship_notices" ("tenant_id", "status", "expected_arrival_at");
CREATE INDEX "inventory_asns_tenant_po_idx"
  ON "inventory_advance_ship_notices" ("tenant_id", "purchase_order_id");
CREATE INDEX "inventory_asns_tenant_supplier_idx"
  ON "inventory_advance_ship_notices" ("tenant_id", "supplier_id");

ALTER TABLE "inventory_advance_ship_notices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_advance_ship_notices" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_advance_ship_notices"
  USING ("tenant_id" = current_tenant_id());

CREATE TABLE "inventory_advance_ship_notice_lines" (
  "id"                     UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"              UUID         NOT NULL,
  "advance_ship_notice_id" UUID         NOT NULL,
  "purchase_order_line_id" UUID         NOT NULL,
  "variant_id"             UUID         NOT NULL,

  -- Base units, always; the pair below records what the supplier stated it in.
  "quantity_shipped"       INTEGER      NOT NULL,
  "uom_code"               VARCHAR(12),
  "units_per_uom"          INTEGER      NOT NULL DEFAULT 1,

  "lot_number"             VARCHAR(63),

  "created_at"             TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_advance_ship_notice_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_asn_lines_asn_po_line_unique"
    UNIQUE ("advance_ship_notice_id", "purchase_order_line_id"),
  CONSTRAINT "inventory_asn_lines_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_asn_lines_asn_fk"
    FOREIGN KEY ("advance_ship_notice_id") REFERENCES "inventory_advance_ship_notices" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_asn_lines_po_line_fk"
    FOREIGN KEY ("purchase_order_line_id") REFERENCES "inventory_purchase_order_lines" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_asn_lines_variant_fk"
    FOREIGN KEY ("variant_id") REFERENCES "commerce_product_variants" ("id") ON DELETE CASCADE,

  CONSTRAINT "inventory_asn_lines_quantity_check"
    CHECK ("quantity_shipped" > 0),
  CONSTRAINT "inventory_asn_lines_units_per_uom_check"
    CHECK ("units_per_uom" >= 1)
);

CREATE INDEX "inventory_asn_lines_tenant_variant_idx"
  ON "inventory_advance_ship_notice_lines" ("tenant_id", "variant_id");

ALTER TABLE "inventory_advance_ship_notice_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_advance_ship_notice_lines" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_advance_ship_notice_lines"
  USING ("tenant_id" = current_tenant_id());

-- ══════════════════════════════════════════════════════════════════════════
-- 5. Return to supplier (8.7)
-- ══════════════════════════════════════════════════════════════════════════
--
-- Stock going back the way it came, with money expected in return. The reason it
-- needs a record rather than an adjustment is the MONEY: an operator who writes
-- off six broken pumps has told the ledger the truth about the shelf and nothing
-- at all about the £900 the supplier owes. That credit is then remembered by one
-- person, in their head, until they leave.

CREATE TABLE "inventory_supplier_returns" (
  "id"                    UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"             UUID         NOT NULL,
  "number"                VARCHAR(20)  NOT NULL,

  "supplier_id"           UUID         NOT NULL,
  "warehouse_id"          UUID         NOT NULL,
  -- Optional: stock returned two years later has usually lost its paperwork, and
  -- refusing the return over that is how it stops being recorded at all.
  "purchase_order_id"     UUID,

  "status"                VARCHAR(12)  NOT NULL DEFAULT 'draft',
  "reason"                VARCHAR(16)  NOT NULL,

  "credit_expected_cents" INTEGER      NOT NULL DEFAULT 0,
  -- NULL until somebody records a credit note. Zero would mean "they refused",
  -- which is a completely different conversation from "we are still waiting".
  "credit_received_cents" INTEGER,
  "currency"              VARCHAR(3)   NOT NULL DEFAULT 'USD',

  "rma_number"            VARCHAR(64),
  "carrier"               VARCHAR(80),
  "tracking_number"       VARCHAR(120),

  "sent_at"               TIMESTAMPTZ,
  "resolved_at"           TIMESTAMPTZ,

  "notes"                 TEXT,

  "created_at"            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"            TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_supplier_returns_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_supplier_returns_tenant_number_unique"
    UNIQUE ("tenant_id", "number"),
  CONSTRAINT "inventory_supplier_returns_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_supplier_returns_supplier_fk"
    FOREIGN KEY ("supplier_id") REFERENCES "inventory_suppliers" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_supplier_returns_warehouse_fk"
    FOREIGN KEY ("warehouse_id") REFERENCES "inventory_warehouses" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_supplier_returns_po_fk"
    FOREIGN KEY ("purchase_order_id") REFERENCES "inventory_purchase_orders" ("id") ON DELETE SET NULL,

  CONSTRAINT "inventory_supplier_returns_status_check"
    CHECK ("status" IN ('draft','sent','credited','closed','cancelled')),
  CONSTRAINT "inventory_supplier_returns_reason_check"
    CHECK ("reason" IN ('damaged','wrong_item','overstock','quality','recall','expired','other')),
  -- Stock cannot have left without a date on which it left, and a return that
  -- has not left cannot carry one.
  CONSTRAINT "inventory_supplier_returns_sent_pair_check"
    CHECK (
      ("status" IN ('draft','cancelled') AND "sent_at" IS NULL) OR
      ("status" IN ('sent','credited','closed') AND "sent_at" IS NOT NULL)
    )
);

CREATE INDEX "inventory_supplier_returns_tenant_status_idx"
  ON "inventory_supplier_returns" ("tenant_id", "status");
CREATE INDEX "inventory_supplier_returns_tenant_supplier_idx"
  ON "inventory_supplier_returns" ("tenant_id", "supplier_id");

ALTER TABLE "inventory_supplier_returns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_supplier_returns" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_supplier_returns"
  USING ("tenant_id" = current_tenant_id());

CREATE TABLE "inventory_supplier_return_lines" (
  "id"                 UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"          UUID         NOT NULL,
  "supplier_return_id" UUID         NOT NULL,
  "variant_id"         UUID         NOT NULL,

  "quantity"           INTEGER      NOT NULL,
  -- What we PAID per base unit — the basis for the credit expectation, not a
  -- selling price.
  "unit_cost_cents"    INTEGER      NOT NULL,
  "uom_code"           VARCHAR(12),
  "units_per_uom"      INTEGER      NOT NULL DEFAULT 1,

  "lot_number"         VARCHAR(63),
  "note"               VARCHAR(255),

  -- Soft pointer to the ledger row written when the return was sent. No FK: the
  -- ledger is append-only and is never deleted under a return line.
  "movement_id"        UUID,

  "created_at"         TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_supplier_return_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_supplier_return_lines_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_supplier_return_lines_return_fk"
    FOREIGN KEY ("supplier_return_id") REFERENCES "inventory_supplier_returns" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_supplier_return_lines_variant_fk"
    FOREIGN KEY ("variant_id") REFERENCES "commerce_product_variants" ("id") ON DELETE CASCADE,

  CONSTRAINT "inventory_supplier_return_lines_quantity_check"
    CHECK ("quantity" > 0),
  CONSTRAINT "inventory_supplier_return_lines_cost_check"
    CHECK ("unit_cost_cents" >= 0),
  CONSTRAINT "inventory_supplier_return_lines_units_per_uom_check"
    CHECK ("units_per_uom" >= 1)
);

CREATE INDEX "inventory_supplier_return_lines_tenant_return_idx"
  ON "inventory_supplier_return_lines" ("tenant_id", "supplier_return_id");
CREATE INDEX "inventory_supplier_return_lines_tenant_variant_idx"
  ON "inventory_supplier_return_lines" ("tenant_id", "variant_id");

ALTER TABLE "inventory_supplier_return_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_supplier_return_lines" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_supplier_return_lines"
  USING ("tenant_id" = current_tenant_id());

-- Stock leaving for the supplier is its own ledger reason. `inventory_movements`
-- has no reason CHECK, but `inventory_bin_movements` does, and a reason absent
-- from it fails with a bare 23514 that nothing upstream predicts — the same trap
-- Phases 4, 5 and 6 each hit once.

ALTER TABLE "inventory_bin_movements"
  DROP CONSTRAINT "inventory_bin_movements_reason_check";
ALTER TABLE "inventory_bin_movements"
  ADD CONSTRAINT "inventory_bin_movements_reason_check" CHECK (
    "reason" IN ('sale','return','cancel','recount','loss','damage','transfer_in',
      'transfer_out','receive','manual','sync','put_away','bin_move','pick','pick_short',
      'assembly_in','assembly_out','return_to_supplier')
  );

-- ══════════════════════════════════════════════════════════════════════════
-- 6. The supplier's bill, and the three-way match (8.8)
-- ══════════════════════════════════════════════════════════════════════════
--
-- Ordered (PO line) vs received (receipt lines) vs billed (here). The variance
-- is surfaced BEFORE the bill is approved, because after payment it is no longer
-- a discrepancy, it is a refund request.
--
-- This is not bookkeeping and never becomes one: no ledger, no double entry, no
-- chart of accounts (docs/148 §1, a permanent product position). Note also that
-- doc's locked decision #2 — stock is NOT an expense. A bill for goods never
-- becomes an expense-ledger row; the value went into inventory on receipt and
-- becomes cost when the goods sell. Writing it into both counts every part twice.

CREATE TABLE "inventory_supplier_bills" (
  "id"                            UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"                     UUID         NOT NULL,

  -- THEIR invoice number, not ours: this document is authored by the supplier,
  -- and the number is how a query to their accounts department is phrased.
  "number"                        VARCHAR(40)  NOT NULL,
  "supplier_id"                   UUID         NOT NULL,
  -- Optional: consolidated monthly statements covering several orders exist, and
  -- the per-line link is what the match actually runs on.
  "purchase_order_id"             UUID,

  "status"                        VARCHAR(20)  NOT NULL DEFAULT 'draft',

  "currency"                      VARCHAR(3)   NOT NULL DEFAULT 'USD',
  -- NULL on a same-currency bill, where storing 1 dresses a non-conversion as one.
  "fx_rate"                       DECIMAL(18,8),

  "billed_at"                     TIMESTAMPTZ  NOT NULL,
  "due_at"                        TIMESTAMPTZ,

  "subtotal_cents"                INTEGER      NOT NULL DEFAULT 0,
  "tax_cents"                     INTEGER      NOT NULL DEFAULT 0,
  "shipping_cents"                INTEGER      NOT NULL DEFAULT 0,
  "total_cents"                   INTEGER      NOT NULL DEFAULT 0,

  -- NULL until paid. Not 0 — an unpaid bill and one settled by a zero credit
  -- note are different facts, and only one of them should stop being chased.
  "paid_cents"                    INTEGER,
  "paid_at"                       TIMESTAMPTZ,

  -- An override that leaves no trace is indistinguishable from a match.
  "variance_accepted_by_user_id"  UUID,
  "variance_accepted_at"          TIMESTAMPTZ,

  "notes"                         TEXT,

  "created_at"                    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"                    TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_supplier_bills_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_supplier_bills_tenant_supplier_number_unique"
    UNIQUE ("tenant_id", "supplier_id", "number"),
  CONSTRAINT "inventory_supplier_bills_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_supplier_bills_supplier_fk"
    FOREIGN KEY ("supplier_id") REFERENCES "inventory_suppliers" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_supplier_bills_po_fk"
    FOREIGN KEY ("purchase_order_id") REFERENCES "inventory_purchase_orders" ("id") ON DELETE SET NULL,
  CONSTRAINT "inventory_supplier_bills_variance_accepter_fk"
    FOREIGN KEY ("variance_accepted_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL,

  CONSTRAINT "inventory_supplier_bills_status_check"
    CHECK ("status" IN ('draft','awaiting_approval','approved','disputed','paid','cancelled')),
  CONSTRAINT "inventory_supplier_bills_paid_pair_check"
    CHECK (("paid_cents" IS NULL) = ("paid_at" IS NULL)),
  CONSTRAINT "inventory_supplier_bills_variance_pair_check"
    CHECK (("variance_accepted_by_user_id" IS NULL) = ("variance_accepted_at" IS NULL))
);

CREATE INDEX "inventory_supplier_bills_tenant_status_due_idx"
  ON "inventory_supplier_bills" ("tenant_id", "status", "due_at");
CREATE INDEX "inventory_supplier_bills_tenant_supplier_idx"
  ON "inventory_supplier_bills" ("tenant_id", "supplier_id");

ALTER TABLE "inventory_supplier_bills" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_supplier_bills" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_supplier_bills"
  USING ("tenant_id" = current_tenant_id());

CREATE TABLE "inventory_supplier_bill_lines" (
  "id"                     UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"              UUID         NOT NULL,
  "supplier_bill_id"       UUID         NOT NULL,

  -- NULL on a line that matches nothing: freight, a pallet deposit, or a part
  -- they billed that was never ordered — precisely the case the match exists to
  -- show.
  "purchase_order_line_id" UUID,
  "variant_id"             UUID,

  "description"            VARCHAR(255),

  "quantity"               INTEGER      NOT NULL,
  "unit_cost_cents"        INTEGER      NOT NULL,
  -- Stored rather than multiplied out: a supplier's rounding is their own, and a
  -- recomputed total that disagrees with the paper by a penny reads as a bug.
  "amount_cents"           INTEGER      NOT NULL,
  "uom_code"               VARCHAR(12),
  "units_per_uom"          INTEGER      NOT NULL DEFAULT 1,

  "created_at"             TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_supplier_bill_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_supplier_bill_lines_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_supplier_bill_lines_bill_fk"
    FOREIGN KEY ("supplier_bill_id") REFERENCES "inventory_supplier_bills" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_supplier_bill_lines_po_line_fk"
    FOREIGN KEY ("purchase_order_line_id") REFERENCES "inventory_purchase_order_lines" ("id") ON DELETE SET NULL,
  CONSTRAINT "inventory_supplier_bill_lines_variant_fk"
    FOREIGN KEY ("variant_id") REFERENCES "commerce_product_variants" ("id") ON DELETE SET NULL,

  CONSTRAINT "inventory_supplier_bill_lines_quantity_check"
    CHECK ("quantity" > 0),
  CONSTRAINT "inventory_supplier_bill_lines_units_per_uom_check"
    CHECK ("units_per_uom" >= 1)
);

CREATE INDEX "inventory_supplier_bill_lines_tenant_bill_idx"
  ON "inventory_supplier_bill_lines" ("tenant_id", "supplier_bill_id");
CREATE INDEX "inventory_supplier_bill_lines_tenant_po_line_idx"
  ON "inventory_supplier_bill_lines" ("tenant_id", "purchase_order_line_id");

ALTER TABLE "inventory_supplier_bill_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_supplier_bill_lines" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_supplier_bill_lines"
  USING ("tenant_id" = current_tenant_id());
