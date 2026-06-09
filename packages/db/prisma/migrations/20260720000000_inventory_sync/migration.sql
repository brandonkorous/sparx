-- Inventory Sync: sources, locations, stock levels, and source links.
-- (docs/64 Inventory Sync Ph1)

-- ── inventory_sources ────────────────────────────────────────────────────────

CREATE TABLE "inventory_sources" (
  "id"                UUID        NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"         UUID        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name"              VARCHAR(255) NOT NULL,
  "type"              VARCHAR(30)  NOT NULL,
  "config"            JSONB       NOT NULL DEFAULT '{}',
  "status"            VARCHAR(20)  NOT NULL DEFAULT 'active',
  "last_sync_at"      TIMESTAMPTZ,
  "sync_interval_sec" INT         NOT NULL DEFAULT 0,
  "notes"             TEXT,
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deleted_at"        TIMESTAMPTZ,
  CONSTRAINT "inventory_sources_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inventory_sources_tenant_status_idx" ON "inventory_sources"("tenant_id", "status");

ALTER TABLE "inventory_sources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_sources" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_sources"
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid);

-- ── stock_locations ──────────────────────────────────────────────────────────

CREATE TABLE "stock_locations" (
  "id"           UUID        NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"    UUID        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name"         VARCHAR(255) NOT NULL,
  "type"         VARCHAR(20)  NOT NULL DEFAULT 'warehouse',
  "country_code" VARCHAR(2),
  "address"      TEXT,
  "is_default"   BOOLEAN     NOT NULL DEFAULT false,
  "active"       BOOLEAN     NOT NULL DEFAULT true,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "stock_locations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "stock_locations_tenant_active_idx" ON "stock_locations"("tenant_id", "active");

ALTER TABLE "stock_locations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_locations" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "stock_locations"
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid);

-- ── stock_levels ─────────────────────────────────────────────────────────────

CREATE TABLE "stock_levels" (
  "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"   UUID        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "variant_id"  UUID        NOT NULL REFERENCES "commerce_product_variants"("id") ON DELETE CASCADE,
  "location_id" UUID        NOT NULL REFERENCES "stock_locations"("id") ON DELETE CASCADE,
  "on_hand"     INT         NOT NULL DEFAULT 0,
  "allocated"   INT         NOT NULL DEFAULT 0,
  "available"   INT         NOT NULL DEFAULT 0,
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "stock_levels_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stock_levels_variant_location_unique" UNIQUE ("tenant_id", "variant_id", "location_id")
);

CREATE INDEX "stock_levels_tenant_location_idx" ON "stock_levels"("tenant_id", "location_id");

ALTER TABLE "stock_levels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_levels" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "stock_levels"
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid);

-- ── inventory_source_links ───────────────────────────────────────────────────

CREATE TABLE "inventory_source_links" (
  "id"                UUID        NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"         UUID        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "source_id"         UUID        NOT NULL REFERENCES "inventory_sources"("id") ON DELETE CASCADE,
  "variant_id"        UUID        NOT NULL REFERENCES "commerce_product_variants"("id") ON DELETE CASCADE,
  "location_id"       UUID        NOT NULL REFERENCES "stock_locations"("id") ON DELETE CASCADE,
  "external_sku"      VARCHAR(255) NOT NULL,
  "external_location" VARCHAR(255),
  "status"            VARCHAR(20)  NOT NULL DEFAULT 'active',
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "inventory_source_links_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_source_link_unique" UNIQUE ("tenant_id", "source_id", "external_sku", "external_location")
);

CREATE INDEX "inventory_source_links_tenant_source_idx" ON "inventory_source_links"("tenant_id", "source_id");
CREATE INDEX "inventory_source_links_tenant_variant_idx" ON "inventory_source_links"("tenant_id", "variant_id");

ALTER TABLE "inventory_source_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_source_links" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_source_links"
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid);
