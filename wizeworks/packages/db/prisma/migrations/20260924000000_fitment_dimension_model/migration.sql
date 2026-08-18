-- Fitment: collapse the rigid Make→Model→Engine + single-range model into a
-- fully generalized DIMENSION-driven model.
--
-- Before: a FitmentDomain had `labels` (l1/l2/l3) + a single `range_unit`, and
-- the tree lived in three hardcoded tables (categories → items → variants).
-- That baked a 3-level cap into the schema and forced "year" into one
-- product-side range — a computer ("2026 MacBook Pro M2") or a vehicle with a
-- trim level couldn't be expressed.
--
-- After: a domain declares an ordered `dimensions` JSON (each a `level` or a
-- `range`); a single self-referential `commerce_fitment_nodes` table holds the
-- values at ANY depth; product applicability is `node_id` (deepest level it
-- targets, null = the whole domain) + `commerce_product_fitment_ranges` (one
-- numeric window per range dimension, so a domain can carry unlimited ranges).
--
-- This migration PRESERVES existing data: every category/item/variant becomes a
-- node (keeping its id), each domain's labels become `dimensions`, and each
-- product fitment's category/item/variant + range_min/max become a node_id + a
-- range row. The source tables are FORCE-RLS, so the prod migration role
-- (sparx_owner, a NON-superuser) sees ZERO rows without a tenant context — all
-- data movement loops tenants + set_config (packages/db/CLAUDE.md).

-- ─── 1. New columns + tables ─────────────────────────────────────────
-- New tables get RLS only in step 5, so the per-tenant data copy (step 2) can
-- INSERT freely as the migration role.

ALTER TABLE "commerce_fitment_domains"
  ADD COLUMN "dimensions" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "commerce_product_fitments"
  ADD COLUMN "node_id" UUID;

CREATE TABLE "commerce_fitment_nodes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "domain_id" UUID NOT NULL,
    "parent_id" UUID,
    "dimension_key" VARCHAR(40) NOT NULL,
    "name" VARCHAR(127) NOT NULL,
    "slug" VARCHAR(127) NOT NULL,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "icon_media_id" UUID,
    "path" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
    "path_names" VARCHAR(127)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(127)[],
    "depth" INTEGER NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "commerce_fitment_nodes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "commerce_product_fitment_ranges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "fitment_id" UUID NOT NULL,
    "dimension_key" VARCHAR(40) NOT NULL,
    "min" DECIMAL(12,4),
    "max" DECIMAL(12,4),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "commerce_product_fitment_ranges_pkey" PRIMARY KEY ("id")
);

-- ─── 2. Migrate data (per-tenant, FORCE-RLS safe) ────────────────────

-- Stable dimension key from a human label ("Rim diameter" → "rim_diameter").
-- Session-local (pg_temp); auto-dropped at the end of the migration session.
CREATE FUNCTION pg_temp.fitment_dimkey(label text) RETURNS text AS $fn$
  SELECT COALESCE(
    NULLIF(
      regexp_replace(
        regexp_replace(lower(COALESCE(label, '')), '[^a-z0-9]+', '_', 'g'),
        '^_+|_+$', '', 'g'
      ),
    ''),
  'level');
$fn$ LANGUAGE sql IMMUTABLE;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM tenants LOOP
    PERFORM set_config('app.tenant_id', r.id::text, true);

    -- 2a. domains: labels + range_unit → ordered dimensions JSON
    UPDATE "commerce_fitment_domains" d
      SET "dimensions" = COALESCE((
        SELECT jsonb_agg(elem ORDER BY ord)
        FROM (
          SELECT 1 AS ord,
                 jsonb_build_object('key', pg_temp.fitment_dimkey(d."labels"->>'l1'),
                                    'label', d."labels"->>'l1', 'kind', 'level') AS elem
            WHERE d."labels" ? 'l1'
          UNION ALL
          SELECT 2,
                 jsonb_build_object('key', pg_temp.fitment_dimkey(d."labels"->>'l2'),
                                    'label', d."labels"->>'l2', 'kind', 'level')
            WHERE d."labels" ? 'l2'
          UNION ALL
          SELECT 3,
                 jsonb_build_object('key', pg_temp.fitment_dimkey(d."labels"->>'l3'),
                                    'label', d."labels"->>'l3', 'kind', 'level')
            WHERE d."labels" ? 'l3'
          UNION ALL
          SELECT 4,
                 jsonb_strip_nulls(jsonb_build_object(
                   'key', COALESCE(CASE WHEN d."labels" ? 'range'
                                        THEN pg_temp.fitment_dimkey(d."labels"->>'range') END,
                                   d."range_unit"),
                   'label', COALESCE(d."labels"->>'range', 'Range'),
                   'kind', 'range',
                   'unit', d."range_unit"))
            WHERE d."range_unit" IS NOT NULL
        ) parts
      ), '[]'::jsonb)
      WHERE d."tenant_id" = r.id;

    -- 2b. categories → top-level nodes (depth 0)
    INSERT INTO "commerce_fitment_nodes"
      ("id","tenant_id","domain_id","parent_id","dimension_key","name","slug",
       "attributes","icon_media_id","path","path_names","depth","position",
       "created_at","updated_at","deleted_at")
    SELECT c."id", c."tenant_id", c."domain_id", NULL,
           pg_temp.fitment_dimkey(d."labels"->>'l1'),
           c."name", c."slug", c."attributes", c."icon_media_id",
           ARRAY[c."id"], ARRAY[c."name"]::varchar(127)[], 0, c."position",
           c."created_at", c."updated_at", c."deleted_at"
    FROM "commerce_fitment_categories" c
    JOIN "commerce_fitment_domains" d ON d."id" = c."domain_id"
    WHERE c."tenant_id" = r.id;

    -- 2c. items → depth-1 nodes (parent = category)
    INSERT INTO "commerce_fitment_nodes"
      ("id","tenant_id","domain_id","parent_id","dimension_key","name","slug",
       "attributes","path","path_names","depth","position",
       "created_at","updated_at","deleted_at")
    SELECT i."id", i."tenant_id", c."domain_id", i."category_id",
           pg_temp.fitment_dimkey(d."labels"->>'l2'),
           i."name", i."slug", i."attributes",
           ARRAY[c."id", i."id"], ARRAY[c."name", i."name"]::varchar(127)[], 1, i."position",
           i."created_at", i."updated_at", i."deleted_at"
    FROM "commerce_fitment_items" i
    JOIN "commerce_fitment_categories" c ON c."id" = i."category_id"
    JOIN "commerce_fitment_domains" d ON d."id" = c."domain_id"
    WHERE i."tenant_id" = r.id;

    -- 2d. variants → depth-2 nodes (parent = item)
    INSERT INTO "commerce_fitment_nodes"
      ("id","tenant_id","domain_id","parent_id","dimension_key","name","slug",
       "attributes","path","path_names","depth","position",
       "created_at","updated_at","deleted_at")
    SELECT v."id", v."tenant_id", c."domain_id", v."item_id",
           pg_temp.fitment_dimkey(d."labels"->>'l3'),
           v."name", v."slug", v."attributes",
           ARRAY[c."id", i."id", v."id"], ARRAY[c."name", i."name", v."name"]::varchar(127)[], 2, v."position",
           v."created_at", v."updated_at", v."deleted_at"
    FROM "commerce_fitment_variants" v
    JOIN "commerce_fitment_items" i ON i."id" = v."item_id"
    JOIN "commerce_fitment_categories" c ON c."id" = i."category_id"
    JOIN "commerce_fitment_domains" d ON d."id" = c."domain_id"
    WHERE v."tenant_id" = r.id;

    -- 2e. product fitments: node_id = deepest of variant / item / category
    UPDATE "commerce_product_fitments" pf
      SET "node_id" = COALESCE(pf."variant_id", pf."item_id", pf."category_id")
      WHERE pf."tenant_id" = r.id;

    -- 2f. range_min/range_max → a range row keyed by the domain's range dimension
    INSERT INTO "commerce_product_fitment_ranges"
      ("tenant_id","fitment_id","dimension_key","min","max","created_at","updated_at")
    SELECT pf."tenant_id", pf."id",
           COALESCE(CASE WHEN d."labels" ? 'range'
                         THEN pg_temp.fitment_dimkey(d."labels"->>'range') END,
                    d."range_unit", 'range'),
           pf."range_min", pf."range_max", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM "commerce_product_fitments" pf
    JOIN "commerce_fitment_domains" d ON d."id" = pf."domain_id"
    WHERE pf."tenant_id" = r.id
      AND (pf."range_min" IS NOT NULL OR pf."range_max" IS NOT NULL);

  END LOOP;
  PERFORM set_config('app.tenant_id', '', true);
END $$;

-- ─── 3. Foreign keys + indexes on the new structure ──────────────────

ALTER TABLE "commerce_fitment_nodes"
  ADD CONSTRAINT "commerce_fitment_nodes_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "commerce_fitment_nodes_domain_id_fkey"
    FOREIGN KEY ("domain_id") REFERENCES "commerce_fitment_domains"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "commerce_fitment_nodes_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "commerce_fitment_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "fitment_nodes_domain_parent_slug_unique"
  ON "commerce_fitment_nodes"("domain_id", "parent_id", "slug");
CREATE INDEX "commerce_fitment_nodes_tenant_id_idx" ON "commerce_fitment_nodes"("tenant_id");
CREATE INDEX "commerce_fitment_nodes_domain_id_idx" ON "commerce_fitment_nodes"("domain_id");
CREATE INDEX "commerce_fitment_nodes_domain_id_parent_id_position_idx"
  ON "commerce_fitment_nodes"("domain_id", "parent_id", "position");
CREATE INDEX "commerce_fitment_nodes_path_idx" ON "commerce_fitment_nodes" USING GIN ("path");

ALTER TABLE "commerce_product_fitment_ranges"
  ADD CONSTRAINT "commerce_product_fitment_ranges_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "commerce_product_fitment_ranges_fitment_id_fkey"
    FOREIGN KEY ("fitment_id") REFERENCES "commerce_product_fitments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "commerce_product_fitment_ranges_tenant_id_fitment_id_idx"
  ON "commerce_product_fitment_ranges"("tenant_id", "fitment_id");
CREATE INDEX "commerce_product_fitment_ranges_fitment_id_dimension_key_idx"
  ON "commerce_product_fitment_ranges"("fitment_id", "dimension_key");
CREATE INDEX "commerce_product_fitment_ranges_tenant_id_dimension_key_min_max_idx"
  ON "commerce_product_fitment_ranges"("tenant_id", "dimension_key", "min", "max");

ALTER TABLE "commerce_product_fitments"
  ADD CONSTRAINT "commerce_product_fitments_node_id_fkey"
    FOREIGN KEY ("node_id") REFERENCES "commerce_fitment_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "commerce_product_fitments_tenant_id_domain_id_idx"
  ON "commerce_product_fitments"("tenant_id", "domain_id");
CREATE INDEX "commerce_product_fitments_tenant_id_node_id_idx"
  ON "commerce_product_fitments"("tenant_id", "node_id");

-- ─── 4. Drop the old structure (data now lives in nodes + ranges) ────
-- Dropping the columns drops their FK constraints + indexes automatically.
ALTER TABLE "commerce_product_fitments"
  DROP COLUMN "category_id",
  DROP COLUMN "item_id",
  DROP COLUMN "variant_id",
  DROP COLUMN "range_min",
  DROP COLUMN "range_max";

DROP TABLE "commerce_fitment_variants";
DROP TABLE "commerce_fitment_items";
DROP TABLE "commerce_fitment_categories";

ALTER TABLE "commerce_fitment_domains"
  DROP COLUMN "labels",
  DROP COLUMN "range_unit";

-- ─── 5. RLS on the new tables (FORCE + strict tenant_isolation) ───────
ALTER TABLE "commerce_fitment_nodes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commerce_fitment_nodes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "commerce_fitment_nodes"
    USING ("tenant_id" = current_tenant_id())
    WITH CHECK ("tenant_id" = current_tenant_id());

ALTER TABLE "commerce_product_fitment_ranges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commerce_product_fitment_ranges" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "commerce_product_fitment_ranges"
    USING ("tenant_id" = current_tenant_id())
    WITH CHECK ("tenant_id" = current_tenant_id());
