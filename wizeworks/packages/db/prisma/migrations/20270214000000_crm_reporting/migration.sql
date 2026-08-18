-- CRM report builder + dashboards (docs/144 §8).
--
-- Three tables, all tenant-scoped with FORCE RLS, so a malformed report
-- definition can leak nothing: whatever query the compiler emits, the policy
-- below is still the fence. That is the reason the compiler is allowed to be
-- data-driven at all — a report names an object and a property, and the worst a
-- wrong one can do is return the tenant's own rows in a shape nobody wanted.

-- ─────────────────────────────────────────────────────────────────────────────
-- Reports
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "crm_reports" (
    "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"     UUID NOT NULL,
    "property_id"   UUID,
    "name"          VARCHAR(160) NOT NULL,
    "description"   TEXT,
    "object_key"    VARCHAR(63) NOT NULL,
    "filters"       JSONB NOT NULL DEFAULT '{"logic":"AND","conditions":[]}'::jsonb,
    "group_by"      JSONB,
    "measures"      JSONB NOT NULL DEFAULT '[]'::jsonb,
    "visualization" VARCHAR(24) NOT NULL DEFAULT 'table',
    "date_range"    JSONB NOT NULL DEFAULT '{"kind":"all"}'::jsonb,
    "builtin_slug"  VARCHAR(63),
    "owner_id"      UUID,
    "shared"        BOOLEAN NOT NULL DEFAULT false,
    "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
    "archived_at"   TIMESTAMPTZ,

    CONSTRAINT "crm_reports_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "crm_reports_tenant_id_fkey"
        FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE,
    CONSTRAINT "crm_reports_property_id_fkey"
        FOREIGN KEY ("property_id") REFERENCES "properties" ("id") ON DELETE CASCADE,
    -- Shape-only. WHICH visualizations exist is a product decision that will
    -- change; that a column holds one of a known set is a database one.
    CONSTRAINT "crm_reports_visualization_check"
        CHECK ("visualization" IN ('table', 'bar', 'line', 'pie', 'funnel', 'number')),
    -- A report with no measure is not a report — it is a filter nobody counted.
    CONSTRAINT "crm_reports_measures_check"
        CHECK (jsonb_typeof("measures") = 'array' AND jsonb_array_length("measures") > 0),
    CONSTRAINT "crm_reports_filters_check"
        CHECK (jsonb_typeof("filters") = 'object')
);

CREATE INDEX "crm_reports_tenant_object_idx" ON "crm_reports" ("tenant_id", "object_key");
CREATE INDEX "crm_reports_tenant_owner_idx"  ON "crm_reports" ("tenant_id", "owner_id");
CREATE INDEX "crm_reports_tenant_archived_idx" ON "crm_reports" ("tenant_id", "archived_at");

-- One copy of each built-in per tenant/site. Partial so the column stays free
-- for the tenant's own reports, which have no slug at all.
CREATE UNIQUE INDEX "crm_reports_builtin_key"
    ON "crm_reports" ("tenant_id", "property_id", "builtin_slug") NULLS NOT DISTINCT
    WHERE "builtin_slug" IS NOT NULL;

ALTER TABLE "crm_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm_reports" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "crm_reports"
    USING ("tenant_id" = current_tenant_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- Dashboards
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "crm_dashboards" (
    "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"   UUID NOT NULL,
    "property_id" UUID,
    "name"        VARCHAR(160) NOT NULL,
    "description" TEXT,
    "is_default"  BOOLEAN NOT NULL DEFAULT false,
    "owner_id"    UUID,
    "shared"      BOOLEAN NOT NULL DEFAULT false,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
    "archived_at" TIMESTAMPTZ,

    CONSTRAINT "crm_dashboards_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "crm_dashboards_tenant_id_fkey"
        FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE,
    CONSTRAINT "crm_dashboards_property_id_fkey"
        FOREIGN KEY ("property_id") REFERENCES "properties" ("id") ON DELETE CASCADE
);

CREATE INDEX "crm_dashboards_tenant_archived_idx"
    ON "crm_dashboards" ("tenant_id", "archived_at");

-- At most one landing dashboard per site. NULLS NOT DISTINCT so the tenant-wide
-- one (property_id IS NULL) is covered by the same index rather than escaping it.
CREATE UNIQUE INDEX "crm_dashboards_one_default_per_site"
    ON "crm_dashboards" ("tenant_id", "property_id") NULLS NOT DISTINCT
    WHERE "is_default" AND "archived_at" IS NULL;

ALTER TABLE "crm_dashboards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm_dashboards" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "crm_dashboards"
    USING ("tenant_id" = current_tenant_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- Widgets
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "crm_dashboard_widgets" (
    "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"    UUID NOT NULL,
    "dashboard_id" UUID NOT NULL,
    "report_id"    UUID NOT NULL,
    "x"            INTEGER NOT NULL DEFAULT 0,
    "y"            INTEGER NOT NULL DEFAULT 0,
    "w"            INTEGER NOT NULL DEFAULT 6,
    "h"            INTEGER NOT NULL DEFAULT 4,
    "title"        VARCHAR(160),
    "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "crm_dashboard_widgets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "crm_dashboard_widgets_tenant_id_fkey"
        FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE,
    CONSTRAINT "crm_dashboard_widgets_dashboard_id_fkey"
        FOREIGN KEY ("dashboard_id") REFERENCES "crm_dashboards" ("id") ON DELETE CASCADE,
    -- Cascade: a widget whose report is gone has nothing to draw.
    CONSTRAINT "crm_dashboard_widgets_report_id_fkey"
        FOREIGN KEY ("report_id") REFERENCES "crm_reports" ("id") ON DELETE CASCADE,
    -- A 12-column grid. A widget wider than the grid, or with no height, is a
    -- layout that cannot render — cheaper to refuse than to defend against in
    -- every client.
    CONSTRAINT "crm_dashboard_widgets_grid_check"
        CHECK ("x" >= 0 AND "x" < 12 AND "w" > 0 AND "w" <= 12 AND "x" + "w" <= 12
               AND "y" >= 0 AND "h" > 0 AND "h" <= 24)
);

CREATE INDEX "crm_dashboard_widgets_tenant_dashboard_idx"
    ON "crm_dashboard_widgets" ("tenant_id", "dashboard_id");
CREATE INDEX "crm_dashboard_widgets_tenant_report_idx"
    ON "crm_dashboard_widgets" ("tenant_id", "report_id");

ALTER TABLE "crm_dashboard_widgets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm_dashboard_widgets" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "crm_dashboard_widgets"
    USING ("tenant_id" = current_tenant_id());
