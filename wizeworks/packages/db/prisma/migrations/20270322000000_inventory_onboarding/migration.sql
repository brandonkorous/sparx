-- Onboarding — beating the spreadsheet (docs/146 Phase 11).
--
-- Three tables and five columns. The tables hold what the first hour produced;
-- the columns hold the one or two facts a business keeps that no schema
-- anticipated, on the four records they keep them about.
--
-- Nothing here is backfilled, and that is deliberate: a tenant who set their
-- inventory up before this migration did not take zero minutes over it, and
-- writing a row that says they did would be a measurement of something that was
-- never measured. They simply have no setup record until they open the wizard.

-- ─────────────────────────────────────────────────────────────────────────────
-- 11.1 — The guided setup, and the clock against it
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "inventory_setup_progress" (
  "id"           UUID        NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"    UUID        NOT NULL,
  "steps"        JSONB       NOT NULL DEFAULT '{}',
  "started_at"   TIMESTAMPTZ,
  "completed_at" TIMESTAMPTZ,
  "dismissed_at" TIMESTAMPTZ,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_setup_progress_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_setup_progress_tenant_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,

  -- Finishing before starting is not a state a clock can produce, so it is a
  -- state the table refuses. The thirty-minute figure is computed from these
  -- two, and a negative duration would be reported as a triumph.
  CONSTRAINT "inventory_setup_progress_order_check"
    CHECK ("completed_at" IS NULL OR "started_at" IS NOT NULL),
  CONSTRAINT "inventory_setup_progress_span_check"
    CHECK ("completed_at" IS NULL OR "completed_at" >= "started_at")
);

CREATE UNIQUE INDEX "inventory_setup_progress_tenant_unique"
  ON "inventory_setup_progress" ("tenant_id");

ALTER TABLE "inventory_setup_progress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_setup_progress" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "inventory_setup_progress"
  USING ("tenant_id" = current_tenant_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- 11.2 / 11.7 — What their columns meant
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "inventory_import_profiles" (
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"    UUID         NOT NULL,
  "name"         VARCHAR(120) NOT NULL,
  "kind"         VARCHAR(30)  NOT NULL DEFAULT 'stock',
  "mapping"      JSONB        NOT NULL DEFAULT '{}',
  "options"      JSONB        NOT NULL DEFAULT '{}',
  "recipe_key"   VARCHAR(60),
  "last_used_at" TIMESTAMPTZ,
  "use_count"    INTEGER      NOT NULL DEFAULT 0,
  "created_by"   UUID,
  "created_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_import_profiles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_import_profiles_tenant_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,

  -- A profile with no mapping maps nothing, and would present as a saved answer
  -- that silently does not answer. Better to refuse the row.
  CONSTRAINT "inventory_import_profiles_mapping_check"
    CHECK (jsonb_typeof("mapping") = 'object' AND "mapping" <> '{}'::jsonb),
  CONSTRAINT "inventory_import_profiles_use_count_check"
    CHECK ("use_count" >= 0),
  -- Counted as used, but with no record of when. The pair is the evidence, and
  -- half of it is worse than none.
  CONSTRAINT "inventory_import_profiles_used_check"
    CHECK (("use_count" = 0) = ("last_used_at" IS NULL))
);

CREATE UNIQUE INDEX "inventory_import_profiles_tenant_name_unique"
  ON "inventory_import_profiles" ("tenant_id", "name");
CREATE INDEX "inventory_import_profiles_kind_idx"
  ON "inventory_import_profiles" ("tenant_id", "kind");

ALTER TABLE "inventory_import_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_import_profiles" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "inventory_import_profiles"
  USING ("tenant_id" = current_tenant_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- 11.8 — The tenant's own columns
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "inventory_custom_fields" (
  "entity"       VARCHAR(20)  NOT NULL,
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"    UUID         NOT NULL,
  "key"          VARCHAR(40)  NOT NULL,
  "label"        VARCHAR(80)  NOT NULL,
  "type"         VARCHAR(20)  NOT NULL,
  "options"      VARCHAR(80)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(80)[],
  "help_text"    TEXT,
  "required"     BOOLEAN      NOT NULL DEFAULT false,
  "show_in_list" BOOLEAN      NOT NULL DEFAULT false,
  "position"     INTEGER      NOT NULL DEFAULT 0,
  "is_active"    BOOLEAN      NOT NULL DEFAULT true,
  "created_by"   UUID,
  "created_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_custom_fields_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_custom_fields_tenant_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,

  -- Pinned, unlike most vocabularies in this schema. A fifth entity is not a
  -- row somebody can write: it needs a `custom_fields` column on a fifth table
  -- and code that reads it, so accepting the row would create a definition that
  -- renders nowhere and silently swallows what people type into it.
  CONSTRAINT "inventory_custom_fields_entity_check"
    CHECK ("entity" IN ('variant', 'level', 'supplier', 'purchase_order')),
  CONSTRAINT "inventory_custom_fields_type_check"
    CHECK ("type" IN ('text', 'number', 'money', 'date', 'boolean', 'select', 'multi_select', 'url')),
  -- The key is what appears in the JSON on every record, in the CSV header and
  -- in the API. Anything a spreadsheet or a URL would mangle is refused here
  -- rather than discovered on export.
  CONSTRAINT "inventory_custom_fields_key_check"
    CHECK ("key" ~ '^[a-z][a-z0-9_]*$'),
  -- A list field with no list is a field nobody can fill in.
  CONSTRAINT "inventory_custom_fields_options_check"
    CHECK ("type" NOT IN ('select', 'multi_select') OR array_length("options", 1) >= 1)
);

CREATE UNIQUE INDEX "inventory_custom_fields_tenant_entity_key_unique"
  ON "inventory_custom_fields" ("tenant_id", "entity", "key");
CREATE INDEX "inventory_custom_fields_render_idx"
  ON "inventory_custom_fields" ("tenant_id", "entity", "is_active", "position");

ALTER TABLE "inventory_custom_fields" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_custom_fields" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "inventory_custom_fields"
  USING ("tenant_id" = current_tenant_id());

-- Where the VALUES live.
--
-- A JSON column on each record rather than a values table: the stock grid draws
-- three hundred rows with their custom columns, and an entity-attribute-value
-- join makes that query several times the size for a benefit sparx would never
-- use. Deleting a definition leaves the values here, unread — which is the
-- cheapest possible undo for a field somebody removed by mistake.
--
-- Separate from `metadata` on the two tables that have one. `metadata` is
-- sparx's scratch space (sample-data markers, import provenance); this is the
-- tenant's data, and a platform feature writing a colliding key into their
-- column would be a data-loss bug with no trace.
ALTER TABLE "commerce_product_variants"
  ADD COLUMN "custom_fields" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "inventory_levels"
  ADD COLUMN "custom_fields" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "inventory_suppliers"
  ADD COLUMN "custom_fields" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "inventory_purchase_orders"
  ADD COLUMN "custom_fields" JSONB NOT NULL DEFAULT '{}';

-- ─────────────────────────────────────────────────────────────────────────────
-- 11.3 — What a person decided about the rows that did not land
-- ─────────────────────────────────────────────────────────────────────────────

-- Beside the plan, not folded into it. "The file said this" and "we did that"
-- are two facts, and keeping them apart is the difference between an import that
-- can be explained afterwards and one that can only be believed.
ALTER TABLE "inventory_import_batches"
  ADD COLUMN "resolutions" JSONB NOT NULL DEFAULT '{}';

-- ─────────────────────────────────────────────────────────────────────────────
-- 11.4 — The opening balance is its own kind of count
-- ─────────────────────────────────────────────────────────────────────────────

-- An opening count behaves like a full count and is recorded as its own type,
-- because its movements post under the `opening` reason rather than `recount`.
-- Establishing a starting point is not the same event as finding a discrepancy:
-- without the distinction, a business's first day reads as its worst day of
-- shrinkage, and the journal credits stock corrections for goods nobody ever
-- got wrong.
ALTER TABLE "inventory_counts"
  DROP CONSTRAINT "inventory_counts_type_check";
ALTER TABLE "inventory_counts"
  ADD CONSTRAINT "inventory_counts_type_check"
  CHECK ("type" IN ('cycle', 'full', 'opening'));
