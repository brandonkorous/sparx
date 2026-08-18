-- docs/146 Phase 4 — Picking and packing.
--
-- Five tables and one widened CHECK. Nothing here changes a stock number, and
-- that is the design rather than an omission:
--
--   By the time a pick list exists, checkout has already taken the units off
--   `inventory_levels.on_hand`. The goods are gone from the ledger and still
--   physically on the shelf. A confirmed pick therefore writes no warehouse
--   movement — it would be a second decrement for one sale. What the pick knows
--   that checkout could not is WHICH SHELF, so it writes a bin-level correction
--   when the picker took from somewhere other than where the sale's richest-first
--   guess assumed. The location total never moves; only the seating under it.
--
-- The one place stock does move is a SHORT pick, and it moves UP: units that were
-- not found were never picked, so the sale that removed them has not happened.
-- They go back on-hand and straight into `allocated` for the order that still
-- wants them, and the shelf is routed to a count. That write goes through
-- `applyMovement` like everything else; no SQL here does it.
--
-- No backfill: nothing has ever been picked.

-- ─────────────────────────────────────────────────────────────────────────────
-- Pick lists
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "inventory_pick_lists" (
  "id"               UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"        UUID         NOT NULL,

  "number"           VARCHAR(20)  NOT NULL,
  "warehouse_id"     UUID         NOT NULL,

  -- single: one order, one list. batch: several orders, one per tote.
  -- wave: several orders merged by shelf, sorted at the pack bench.
  "kind"             VARCHAR(10)  NOT NULL DEFAULT 'single',
  "status"           VARCHAR(12)  NOT NULL DEFAULT 'draft',

  "assigned_to"      VARCHAR(127),

  -- Snapshot of the warehouse's allocation strategy at generation. The setting
  -- can change tomorrow; this walk was built under today's, and a report that
  -- attributes it to the new rule is lying quietly.
  "strategy"         VARCHAR(20)  NOT NULL DEFAULT 'fifo',

  "note"             TEXT,

  "assigned_at"      TIMESTAMPTZ,
  -- The first CONFIRMED line, not the assignment. A list assigned at 08:00 and
  -- started at 11:00 took twenty minutes to pick, not three hours.
  "started_at"       TIMESTAMPTZ,
  "picked_at"        TIMESTAMPTZ,

  "cancelled_at"     TIMESTAMPTZ,
  "cancelled_reason" VARCHAR(500),

  "created_by"       VARCHAR(127),
  "created_at"       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"       TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_pick_lists_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_pick_lists_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_pick_lists_warehouse_fk"
    FOREIGN KEY ("warehouse_id") REFERENCES "inventory_warehouses" ("id") ON DELETE CASCADE,

  CONSTRAINT "inventory_pick_lists_kind_check" CHECK (
    "kind" IN ('single','batch','wave')
  ),
  CONSTRAINT "inventory_pick_lists_status_check" CHECK (
    "status" IN ('draft','assigned','picking','picked','cancelled')
  ),
  CONSTRAINT "inventory_pick_lists_strategy_check" CHECK (
    "strategy" IN ('fifo','fefo','nearest_bin','single_bin')
  )
);

CREATE UNIQUE INDEX "inventory_pick_lists_tenant_number_unique"
  ON "inventory_pick_lists" ("tenant_id", "number");
CREATE INDEX "inventory_pick_lists_tenant_status_idx"
  ON "inventory_pick_lists" ("tenant_id", "status", "created_at" DESC);
CREATE INDEX "inventory_pick_lists_tenant_warehouse_idx"
  ON "inventory_pick_lists" ("tenant_id", "warehouse_id", "status");
-- "What is on my list" — the first query a picker's screen makes.
CREATE INDEX "inventory_pick_lists_tenant_assignee_idx"
  ON "inventory_pick_lists" ("tenant_id", "assigned_to", "status");

ALTER TABLE "inventory_pick_lists" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_pick_lists" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_pick_lists"
  USING ("tenant_id" = current_tenant_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- Which orders a list covers
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "inventory_pick_list_orders" (
  "pick_list_id" UUID        NOT NULL,
  "order_id"     UUID        NOT NULL,
  "tenant_id"    UUID        NOT NULL,

  -- Tote 1, tote 2. What the trolley and the screen agree to call it.
  "position"     INTEGER     NOT NULL DEFAULT 0,

  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_pick_list_orders_pkey" PRIMARY KEY ("pick_list_id", "order_id"),
  CONSTRAINT "inventory_pick_list_orders_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_pick_list_orders_list_fk"
    FOREIGN KEY ("pick_list_id") REFERENCES "inventory_pick_lists" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_pick_list_orders_order_fk"
    FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE CASCADE
);

CREATE INDEX "inventory_pick_list_orders_tenant_order_idx"
  ON "inventory_pick_list_orders" ("tenant_id", "order_id");

ALTER TABLE "inventory_pick_list_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_pick_list_orders" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_pick_list_orders"
  USING ("tenant_id" = current_tenant_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- The instructions
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "inventory_pick_list_lines" (
  "id"               UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"        UUID         NOT NULL,
  "pick_list_id"     UUID         NOT NULL,

  -- A line always points at ONE order item, even on a wave. Merging by variant
  -- would shorten the walk marginally and make it impossible to say which
  -- customer the missing unit belonged to — which every accuracy number needs.
  "order_id"         UUID         NOT NULL,
  "order_item_id"    UUID         NOT NULL,
  "variant_id"       UUID         NOT NULL,

  "bin_id"           UUID,
  "lot_id"           UUID,

  "quantity"         INTEGER      NOT NULL,
  "picked_quantity"  INTEGER      NOT NULL DEFAULT 0,
  "short_quantity"   INTEGER      NOT NULL DEFAULT 0,

  "short_reason"     VARCHAR(20),
  "short_note"       TEXT,
  -- Soft pointer: the count outlives the pick list and must not cascade with it.
  "short_count_id"   UUID,

  "pick_sequence"    INTEGER      NOT NULL DEFAULT 0,
  "status"           VARCHAR(10)  NOT NULL DEFAULT 'pending',

  -- Scanned vs tapped. The two are not equally trustworthy and the accuracy
  -- report separates them rather than flattering the number.
  "verified_by_scan" BOOLEAN      NOT NULL DEFAULT false,

  "picked_at"        TIMESTAMPTZ,
  "picked_by"        VARCHAR(127),

  "created_at"       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"       TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_pick_list_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_pick_list_lines_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_pick_list_lines_list_fk"
    FOREIGN KEY ("pick_list_id") REFERENCES "inventory_pick_lists" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_pick_list_lines_order_fk"
    FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_pick_list_lines_order_item_fk"
    FOREIGN KEY ("order_item_id") REFERENCES "order_items" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_pick_list_lines_variant_fk"
    FOREIGN KEY ("variant_id") REFERENCES "commerce_product_variants" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_pick_list_lines_bin_fk"
    FOREIGN KEY ("bin_id") REFERENCES "inventory_bins" ("id") ON DELETE SET NULL,
  CONSTRAINT "inventory_pick_list_lines_lot_fk"
    FOREIGN KEY ("lot_id") REFERENCES "inventory_lot_batches" ("id") ON DELETE SET NULL,

  CONSTRAINT "inventory_pick_list_lines_status_check" CHECK (
    "status" IN ('pending','picked','short','skipped')
  ),
  CONSTRAINT "inventory_pick_list_lines_short_reason_check" CHECK (
    "short_reason" IS NULL OR "short_reason" IN
      ('not_found','damaged','wrong_item','insufficient','inaccessible','other')
  ),
  -- Picked and short are both subsets of what was asked for, and together they
  -- cannot exceed it. Without this a "short" line can report more units missing
  -- than were ever on the instruction, and the accuracy report goes negative.
  CONSTRAINT "inventory_pick_list_lines_quantity_check" CHECK (
    "quantity" > 0
    AND "picked_quantity" >= 0
    AND "short_quantity" >= 0
    AND "picked_quantity" + "short_quantity" <= "quantity"
  )
);

-- The walk, in order. The single hottest read in the phase: every screen refresh
-- on a handheld asks for the next pending line on this list.
CREATE INDEX "inventory_pick_list_lines_tenant_list_seq_idx"
  ON "inventory_pick_list_lines" ("tenant_id", "pick_list_id", "pick_sequence");
-- "Is this order item already allocated to an open walk" — the guard that stops
-- two lists sending two people to fetch the same unit.
CREATE INDEX "inventory_pick_list_lines_tenant_order_item_idx"
  ON "inventory_pick_list_lines" ("tenant_id", "order_item_id");
CREATE INDEX "inventory_pick_list_lines_tenant_variant_status_idx"
  ON "inventory_pick_list_lines" ("tenant_id", "variant_id", "status");
-- Throughput by picker (docs/146 Phase 4.7).
CREATE INDEX "inventory_pick_list_lines_tenant_picker_idx"
  ON "inventory_pick_list_lines" ("tenant_id", "picked_by", "picked_at" DESC);

ALTER TABLE "inventory_pick_list_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_pick_list_lines" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_pick_list_lines"
  USING ("tenant_id" = current_tenant_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- The box
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "inventory_shipment_packages" (
  "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"      UUID         NOT NULL,

  "number"         VARCHAR(20)  NOT NULL,
  "order_id"       UUID         NOT NULL,
  -- Null for a box packed straight from an order with no walk — a one-person
  -- shop that never generates a pick list still gets pack verification, which is
  -- the half of this phase that helps them.
  "pick_list_id"   UUID,

  "status"         VARCHAR(10)  NOT NULL DEFAULT 'open',

  -- Millimetres and grams, integers. A rate quote rounds anyway, and a float
  -- weight reading 0.30000000000000004 in a support ticket costs more trust than
  -- the precision was ever worth.
  "weight_grams"   INTEGER,
  "length_mm"      INTEGER,
  "width_mm"       INTEGER,
  "height_mm"      INTEGER,
  -- No CHECK: carriers keep inventing packaging types and a constraint here
  -- would block a legitimate quote.
  "packaging_type" VARCHAR(32),

  -- Soft pointer: a fulfillment can be cancelled and re-made without destroying
  -- the packing record of what was physically in the box.
  "fulfillment_id" UUID,

  "note"           TEXT,

  "packed_at"      TIMESTAMPTZ,
  "packed_by"      VARCHAR(127),

  "created_at"     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"     TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_shipment_packages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_shipment_packages_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_shipment_packages_order_fk"
    FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_shipment_packages_list_fk"
    FOREIGN KEY ("pick_list_id") REFERENCES "inventory_pick_lists" ("id") ON DELETE SET NULL,

  CONSTRAINT "inventory_shipment_packages_status_check" CHECK (
    "status" IN ('open','packed','cancelled')
  ),
  CONSTRAINT "inventory_shipment_packages_dimensions_check" CHECK (
    ("weight_grams" IS NULL OR "weight_grams" >= 0)
    AND ("length_mm"  IS NULL OR "length_mm"  >= 0)
    AND ("width_mm"   IS NULL OR "width_mm"   >= 0)
    AND ("height_mm"  IS NULL OR "height_mm"  >= 0)
  )
);

CREATE UNIQUE INDEX "inventory_shipment_packages_tenant_number_unique"
  ON "inventory_shipment_packages" ("tenant_id", "number");
CREATE INDEX "inventory_shipment_packages_tenant_order_idx"
  ON "inventory_shipment_packages" ("tenant_id", "order_id", "created_at");
CREATE INDEX "inventory_shipment_packages_tenant_status_idx"
  ON "inventory_shipment_packages" ("tenant_id", "status");
CREATE INDEX "inventory_shipment_packages_tenant_list_idx"
  ON "inventory_shipment_packages" ("tenant_id", "pick_list_id");

ALTER TABLE "inventory_shipment_packages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_shipment_packages" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_shipment_packages"
  USING ("tenant_id" = current_tenant_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- What went in it
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "inventory_shipment_package_lines" (
  "id"               UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"        UUID         NOT NULL,
  "package_id"       UUID         NOT NULL,

  "order_item_id"    UUID         NOT NULL,
  "variant_id"       UUID,

  "quantity"         INTEGER      NOT NULL DEFAULT 0,
  -- How many of those were confirmed by a scan rather than typed. What makes
  -- "verified" mean something on a packing slip.
  "scanned_quantity" INTEGER      NOT NULL DEFAULT 0,

  "created_at"       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"       TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_shipment_package_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_shipment_package_lines_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_shipment_package_lines_package_fk"
    FOREIGN KEY ("package_id") REFERENCES "inventory_shipment_packages" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_shipment_package_lines_order_item_fk"
    FOREIGN KEY ("order_item_id") REFERENCES "order_items" ("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_shipment_package_lines_variant_fk"
    FOREIGN KEY ("variant_id") REFERENCES "commerce_product_variants" ("id") ON DELETE SET NULL,

  CONSTRAINT "inventory_shipment_package_lines_quantity_check" CHECK (
    "quantity" >= 0
    AND "scanned_quantity" >= 0
    AND "scanned_quantity" <= "quantity"
  )
);

-- One row per (box, order line). A second row for the same pair is not a second
-- fact, it is a double count of what is in the box.
CREATE UNIQUE INDEX "inventory_shipment_package_lines_package_item_unique"
  ON "inventory_shipment_package_lines" ("package_id", "order_item_id");
CREATE INDEX "inventory_shipment_package_lines_tenant_package_idx"
  ON "inventory_shipment_package_lines" ("tenant_id", "package_id");
CREATE INDEX "inventory_shipment_package_lines_tenant_order_item_idx"
  ON "inventory_shipment_package_lines" ("tenant_id", "order_item_id");

ALTER TABLE "inventory_shipment_package_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_shipment_package_lines" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_shipment_package_lines"
  USING ("tenant_id" = current_tenant_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- Packing is a scan context
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Phase 3 reserved 'pick' but not 'pack', because at the time there was nothing
-- to pack into. There is now, and a pack-bench scan has to be recorded on the
-- same terms as every other trigger pull — same idempotency, same replay, same
-- "I scanned it and nothing happened" evidence trail.

ALTER TABLE "inventory_scan_events"
  DROP CONSTRAINT "inventory_scan_events_context_check";
ALTER TABLE "inventory_scan_events"
  ADD CONSTRAINT "inventory_scan_events_context_check" CHECK (
    "context_type" IN ('count','receipt','transfer','put_away','pick','pack','lookup')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- And picking is a bin-movement reason
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Two new reasons, both of which exist ONLY at the bin level, which is the whole
-- point of the phase:
--
--   pick        the correction written when a picker took stock off a different
--               shelf than the sale assumed. Moves nothing in or out of the
--               building, so there is deliberately no warehouse-ledger twin —
--               same shape as `put_away` and `bin_move` before it.
--   pick_short  the seating of a short pick's restore. This one DOES have a
--               warehouse twin (the units really did come back on hand), and the
--               bin row is its mirror.
--
-- Found by the integration suite on its first run rather than by a warehouse:
-- Phase 2 pinned the vocabulary, and a reason absent from it fails at INSERT with
-- a 23514 that nothing upstream would have predicted.

ALTER TABLE "inventory_bin_movements"
  DROP CONSTRAINT "inventory_bin_movements_reason_check";
ALTER TABLE "inventory_bin_movements"
  ADD CONSTRAINT "inventory_bin_movements_reason_check"
    CHECK ("reason" IN (
      'sale', 'return', 'cancel', 'recount', 'loss', 'damage',
      'transfer_in', 'transfer_out', 'receive', 'manual', 'sync',
      'put_away', 'bin_move', 'pick', 'pick_short'
    ));
