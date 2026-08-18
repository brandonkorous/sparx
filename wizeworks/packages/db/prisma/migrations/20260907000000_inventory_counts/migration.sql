-- Inventory corrections (docs/100 P4): Counts + count lines. A counting session
-- reconciles recorded stock against a physical count; on post each line writes a
-- `recount` movement through the ledger (absolute setOnHand). Variance value over
-- a per-count threshold gates the post behind an admin approval. Both tenant-scoped,
-- FORCE RLS with the canonical `tenant_id = current_tenant_id()` policy. CHECK
-- constraints pin the type + status vocabularies. No backfill — new tables.

-- ── Counts ──────────────────────────────────────────────────────────────────────
CREATE TABLE inventory_counts (
  id                       uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id                uuid         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  number                   varchar(20)  NOT NULL,
  warehouse_id             uuid         NOT NULL REFERENCES inventory_warehouses(id) ON DELETE CASCADE,
  type                     varchar(12)  NOT NULL,
  status                   varchar(12)  NOT NULL DEFAULT 'counting',
  note                     text,
  approval_threshold_cents int          NOT NULL DEFAULT 5000,
  requires_approval        boolean      NOT NULL DEFAULT false,
  variance_value_cents     int          NOT NULL DEFAULT 0,
  started_at               timestamptz  NOT NULL DEFAULT now(),
  counted_at               timestamptz,
  approved_at              timestamptz,
  approved_by              varchar(127),
  posted_at                timestamptz,
  created_at               timestamptz  NOT NULL DEFAULT now(),
  updated_at               timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT inventory_counts_tenant_number_unique UNIQUE (tenant_id, number),
  CONSTRAINT inventory_counts_type_check CHECK (type IN ('cycle', 'full')),
  CONSTRAINT inventory_counts_status_check
    CHECK (status IN ('counting', 'review', 'approved', 'posted', 'cancelled'))
);

CREATE INDEX ON inventory_counts (tenant_id, status);
CREATE INDEX ON inventory_counts (tenant_id, warehouse_id);

ALTER TABLE inventory_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_counts FORCE  ROW LEVEL SECURITY;
CREATE POLICY inventory_counts_tenant_isolation ON inventory_counts
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- ── Count lines ─────────────────────────────────────────────────────────────────
CREATE TABLE inventory_count_lines (
  id                uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id         uuid         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  count_id          uuid         NOT NULL REFERENCES inventory_counts(id) ON DELETE CASCADE,
  variant_id        uuid         NOT NULL REFERENCES commerce_product_variants(id) ON DELETE CASCADE,
  expected_quantity int          NOT NULL,
  counted_quantity  int,
  applied_delta     int,
  movement_id       uuid,
  note              text,
  created_at        timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT inventory_count_lines_count_variant_unique UNIQUE (count_id, variant_id)
);

CREATE INDEX ON inventory_count_lines (tenant_id, count_id);
CREATE INDEX ON inventory_count_lines (tenant_id, variant_id);

ALTER TABLE inventory_count_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_count_lines FORCE  ROW LEVEL SECURITY;
CREATE POLICY inventory_count_lines_tenant_isolation ON inventory_count_lines
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());
