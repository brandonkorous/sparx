-- CRM object registry + custom properties (docs/144 §3) — the keystone of the
-- HubSpot-parity plan. One registry table describes both what a tenant has ADDED
-- to the built-in CRM objects and the complete shape of the objects they
-- invented; the values live in a JSONB bag on the object's own table (built-ins)
-- or in crm_records (custom objects).
--
-- The schema documents live in @sparx/field-schema — the SAME engine already
-- behind CMS content types (11-cms-content) and commerce product types
-- (20270206000000). Three domains, one field engine.
--
-- RLS is hand-edited (Prisma generates no ENABLE/FORCE/policies). No backfill
-- loop is needed anywhere here: every new column carries a default that covers
-- existing rows, so the FORCE-RLS per-tenant backfill footgun (packages/db
-- CLAUDE.md §RLS) does not apply. crm_object_defs rows for the four built-in
-- objects are seeded lazily by the CRM module-activation consumer, not here —
-- this migration must not invent rows for tenants that have never enabled CRM.

-- ─────────────────────────────────────────────────────────────────────────
-- crm_object_defs — what an object IS
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE "crm_object_defs" (
    "id"                UUID         NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"         UUID         NOT NULL,
    "key"               VARCHAR(63)  NOT NULL,
    "kind"              VARCHAR(10)  NOT NULL DEFAULT 'custom',
    "label"             VARCHAR(120) NOT NULL,
    "label_plural"      VARCHAR(120) NOT NULL,
    "icon_key"          VARCHAR(63),
    "description"       TEXT,
    "property_schema"   JSONB        NOT NULL DEFAULT '{"fields":[]}',
    "primary_field_key" VARCHAR(63),
    "archived_at"       TIMESTAMPTZ,
    "created_at"        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updated_at"        TIMESTAMPTZ  NOT NULL,
    CONSTRAINT "crm_object_defs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "crm_object_defs_tenant_id_fkey" FOREIGN KEY ("tenant_id")
        REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "crm_object_defs_kind_check" CHECK ("kind" IN ('builtin', 'custom'))
);

-- The unique key is also the FK target for crm_records (tenant_id, object_key),
-- which is what makes a record structurally unable to name an object that does
-- not exist in its own tenant.
CREATE UNIQUE INDEX "crm_object_defs_tenant_key_unique"
    ON "crm_object_defs" ("tenant_id", "key");
CREATE INDEX "crm_object_defs_tenant_kind_archived_idx"
    ON "crm_object_defs" ("tenant_id", "kind", "archived_at");

ALTER TABLE "crm_object_defs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm_object_defs" FORCE  ROW LEVEL SECURITY;
CREATE POLICY crm_object_defs_tenant_isolation ON "crm_object_defs"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- ─────────────────────────────────────────────────────────────────────────
-- crm_records — a row of a tenant-invented object
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE "crm_records" (
    "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"   UUID        NOT NULL,
    "property_id" UUID,
    "object_key"  VARCHAR(63) NOT NULL,
    "values"      JSONB       NOT NULL DEFAULT '{}',
    "owner_id"    UUID,
    "title"       VARCHAR(255),
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"  TIMESTAMPTZ NOT NULL,
    "deleted_at"  TIMESTAMPTZ,
    CONSTRAINT "crm_records_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "crm_records_tenant_id_fkey" FOREIGN KEY ("tenant_id")
        REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    -- SetNull, not Cascade: a record of work outlives the site it was done for,
    -- the same call orders, deals and bookings make (docs/131 §5).
    CONSTRAINT "crm_records_property_id_fkey" FOREIGN KEY ("property_id")
        REFERENCES "properties" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    -- Deleting an object definition deletes its records. An orphaned bag of
    -- JSON whose schema is gone is unreadable by construction, so keeping it
    -- would preserve bytes and lose data.
    CONSTRAINT "crm_records_object_fkey" FOREIGN KEY ("tenant_id", "object_key")
        REFERENCES "crm_object_defs" ("tenant_id", "key") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "crm_records_owner_id_fkey" FOREIGN KEY ("owner_id")
        REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "crm_records_tenant_object_updated_idx"
    ON "crm_records" ("tenant_id", "object_key", "updated_at" DESC);
CREATE INDEX "crm_records_tenant_property_object_idx"
    ON "crm_records" ("tenant_id", "property_id", "object_key");
CREATE INDEX "crm_records_tenant_object_title_idx"
    ON "crm_records" ("tenant_id", "object_key", "title");
CREATE INDEX "crm_records_tenant_owner_idx"
    ON "crm_records" ("tenant_id", "owner_id");

-- Containment + key-existence over the property bag. This is what property
-- filtering actually is ("industry = manufacturing", "has a renewal date");
-- jsonb_path_ops is the smaller, faster index for exactly those operators.
-- Range and sort on a numeric property fall back to a tenant-bounded scan —
-- documented in 33-crm-objects.prisma rather than discovered in production.
CREATE INDEX "crm_records_values_gin"
    ON "crm_records" USING GIN ("values" jsonb_path_ops);

ALTER TABLE "crm_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm_records" FORCE  ROW LEVEL SECURITY;
CREATE POLICY crm_records_tenant_isolation ON "crm_records"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- ─────────────────────────────────────────────────────────────────────────
-- The built-in objects gain their property bags
-- ─────────────────────────────────────────────────────────────────────────
--
-- These are DECLARED fields — typed, editable, filterable, reportable — and are
-- deliberately not the existing `metadata` column, which is an untyped internal
-- bag no UI renders and no segment can read. All three tables already carry RLS
-- (20260601000000), so the new columns ride the existing policies.

ALTER TABLE "customers"    ADD COLUMN "custom_properties" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "deals"        ADD COLUMN "custom_properties" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "b2b_accounts" ADD COLUMN "custom_properties" JSONB NOT NULL DEFAULT '{}';

CREATE INDEX "customers_custom_properties_gin"
    ON "customers" USING GIN ("custom_properties" jsonb_path_ops);
CREATE INDEX "deals_custom_properties_gin"
    ON "deals" USING GIN ("custom_properties" jsonb_path_ops);
CREATE INDEX "b2b_accounts_custom_properties_gin"
    ON "b2b_accounts" USING GIN ("custom_properties" jsonb_path_ops);
