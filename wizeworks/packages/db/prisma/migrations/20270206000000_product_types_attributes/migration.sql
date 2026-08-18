-- Product Types & typed attributes (docs/143) — the commerce mirror of CMS
-- content types. A ProductType declares an `attribute_schema` (a
-- @sparx/field-schema FieldSchema); a product carries `product_type_key` (the
-- typed link) + an `attributes` JSONB bag validated against that schema. The
-- fixed commerce spine is untouched — only the descriptive attribute layer is
-- typed.
--
-- Built-in types live under the sentinel Sparx Platform tenant
-- (00000000-0000-0000-0000-000000000000, inserted by
-- 20260528100000_unified_content_model) and the RLS policy exposes them
-- read-visible to every tenant, exactly like content_types. The TS source of
-- truth is packages/commerce-schemas/src/product-types/builtins/*; this
-- migration establishes the rows on a cold-start DB (idempotent ON CONFLICT so
-- re-running is safe).
--
-- RLS is hand-edited (Prisma does not generate ENABLE/FORCE/policies). The two
-- new commerce_products columns need no backfill: their defaults cover every
-- existing row, so the FORCE-RLS per-tenant backfill footgun (packages/db
-- CLAUDE.md §RLS) does not apply.

-- ─────────────────────────────────────────────────────────────────────────
-- commerce_product_types
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE "commerce_product_types" (
    "id"               UUID         NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"        UUID         NOT NULL,
    "property_id"      UUID,
    "key"              VARCHAR(63)  NOT NULL,
    "name"             VARCHAR(127) NOT NULL,
    "plural_name"      VARCHAR(127),
    "description"      TEXT,
    "attribute_schema" JSONB        NOT NULL,
    "icon"             VARCHAR(63),
    "is_built_in"      BOOLEAN      NOT NULL DEFAULT FALSE,
    "created_at"       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updated_at"       TIMESTAMPTZ  NOT NULL,
    CONSTRAINT "commerce_product_types_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "commerce_product_types_tenant_id_fkey" FOREIGN KEY ("tenant_id")
        REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "commerce_product_types_property_id_fkey" FOREIGN KEY ("property_id")
        REFERENCES "properties" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "product_types_tenant_key_unique"
    ON "commerce_product_types" ("tenant_id", "key");
CREATE INDEX "commerce_product_types_tenant_id_idx"
    ON "commerce_product_types" ("tenant_id");
CREATE INDEX "commerce_product_types_tenant_id_property_id_idx"
    ON "commerce_product_types" ("tenant_id", "property_id");

-- ─────────────────────────────────────────────────────────────────────────
-- commerce_products — typed attribute layer
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE "commerce_products"
    ADD COLUMN "product_type_key" VARCHAR(63),
    ADD COLUMN "attributes"       JSONB NOT NULL DEFAULT '{}';

CREATE INDEX "commerce_products_tenant_id_product_type_key_idx"
    ON "commerce_products" ("tenant_id", "product_type_key");

-- ─────────────────────────────────────────────────────────────────────────
-- builder_pages — per-type product page targeting (docs/143 §4.4, Option B)
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE "builder_pages"
    ADD COLUMN "record_subtype" VARCHAR(63);

-- At most one page per (tenant, property, record_type, record_subtype) when a
-- subtype is set — a tenant can't have two "Apparel product pages", which would
-- make most-specific-wins resolution ambiguous. The default page
-- (record_subtype IS NULL) keeps its own is_default partial unique from the
-- builder migration. Prisma can't express the WHERE predicate, so it's hand-added.
CREATE UNIQUE INDEX "builder_pages_property_record_subtype_unique"
    ON "builder_pages" ("tenant_id", "property_id", "record_type", "record_subtype")
    WHERE "record_subtype" IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security — commerce_product_types
-- ─────────────────────────────────────────────────────────────────────────
-- Same FORCE + tenant_isolation pattern as content_types: an extra OR clause
-- exposes platform-owned built-in rows to every tenant read; writes are pinned
-- to the caller's tenant via WITH CHECK, so a fork lands under the caller's
-- tenant_id. commerce_products already carries RLS (20260603000000) — the two
-- new columns ride the existing policy.

ALTER TABLE "commerce_product_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commerce_product_types" FORCE  ROW LEVEL SECURITY;
CREATE POLICY commerce_product_types_tenant_isolation ON "commerce_product_types"
    AS PERMISSIVE FOR ALL
    USING (
        tenant_id = current_tenant_id()
        OR tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
    )
    WITH CHECK (tenant_id = current_tenant_id());

-- ─────────────────────────────────────────────────────────────────────────
-- Seed built-in product types under the platform tenant
-- ─────────────────────────────────────────────────────────────────────────
-- RLS on commerce_product_types allows writes only where
-- tenant_id = current_tenant_id(); set the GUC to the platform tenant for the
-- duration of the seed. Schemas here are byte-for-byte the TS builtins in
-- packages/commerce-schemas/src/product-types/builtins/* (the source of truth);
-- keep the two in lockstep when either changes.

SET LOCAL app.tenant_id = '00000000-0000-0000-0000-000000000000';

-- apparel
INSERT INTO "commerce_product_types" (
    "id", "tenant_id", "property_id", "key", "name", "plural_name",
    "description", "attribute_schema", "icon", "is_built_in", "updated_at"
) VALUES (
    gen_random_uuid(), '00000000-0000-0000-0000-000000000000', NULL,
    'apparel', 'Apparel', 'Apparel',
    'Clothing and worn goods — fabric, fit, care, and material composition.',
    $json${
      "fields": [
        { "key": "fabric", "type": "long_text", "label": "Fabric & construction", "max": 2000,
          "helpText": "What it's made of and how it's built. This is product-specific — write it per product." },
        { "key": "fit", "type": "long_text", "label": "Fit", "max": 1000,
          "helpText": "How it's cut and how it wears (relaxed, true-to-size, compressive)." },
        { "key": "care", "type": "long_text", "label": "Care", "max": 1000,
          "helpText": "Washing and care instructions." },
        { "key": "materials", "type": "repeater", "label": "Materials", "itemLabel": "Material", "max": 12,
          "fields": [
            { "key": "name", "type": "text", "label": "Material", "required": true, "max": 60 },
            { "key": "percent", "type": "text", "label": "Percentage", "max": 12, "helpText": "e.g. \"82%\"" }
          ]
        },
        { "key": "origin", "type": "text", "label": "Made in", "max": 80 }
      ]
    }$json$::jsonb,
    'shirt', TRUE, NOW()
)
ON CONFLICT ("tenant_id", "key") DO UPDATE SET
    "name" = EXCLUDED."name", "plural_name" = EXCLUDED."plural_name",
    "description" = EXCLUDED."description", "attribute_schema" = EXCLUDED."attribute_schema",
    "icon" = EXCLUDED."icon", "is_built_in" = EXCLUDED."is_built_in", "updated_at" = NOW();

-- cosmetics
INSERT INTO "commerce_product_types" (
    "id", "tenant_id", "property_id", "key", "name", "plural_name",
    "description", "attribute_schema", "icon", "is_built_in", "updated_at"
) VALUES (
    gen_random_uuid(), '00000000-0000-0000-0000-000000000000', NULL,
    'cosmetics', 'Beauty & Personal Care', 'Beauty & Personal Care',
    'Skincare, cosmetics, and personal care — ingredients, usage, and skin type.',
    $json${
      "fields": [
        { "key": "keyIngredients", "type": "long_text", "label": "Key ingredients", "max": 2000,
          "helpText": "The hero ingredients and what they do." },
        { "key": "howToUse", "type": "long_text", "label": "How to use", "max": 2000 },
        { "key": "skinType", "type": "enum", "label": "Skin type", "multiple": true,
          "options": [
            { "value": "all", "label": "All skin types" },
            { "value": "dry", "label": "Dry" },
            { "value": "oily", "label": "Oily" },
            { "value": "combination", "label": "Combination" },
            { "value": "sensitive", "label": "Sensitive" },
            { "value": "normal", "label": "Normal" }
          ]
        },
        { "key": "volume", "type": "text", "label": "Size", "max": 40, "helpText": "e.g. \"50 ml / 1.7 fl oz\"" },
        { "key": "fullIngredients", "type": "long_text", "label": "Full ingredients (INCI)", "max": 5000,
          "helpText": "The complete INCI list." }
      ]
    }$json$::jsonb,
    'sparkles', TRUE, NOW()
)
ON CONFLICT ("tenant_id", "key") DO UPDATE SET
    "name" = EXCLUDED."name", "plural_name" = EXCLUDED."plural_name",
    "description" = EXCLUDED."description", "attribute_schema" = EXCLUDED."attribute_schema",
    "icon" = EXCLUDED."icon", "is_built_in" = EXCLUDED."is_built_in", "updated_at" = NOW();

-- food_beverage
INSERT INTO "commerce_product_types" (
    "id", "tenant_id", "property_id", "key", "name", "plural_name",
    "description", "attribute_schema", "icon", "is_built_in", "updated_at"
) VALUES (
    gen_random_uuid(), '00000000-0000-0000-0000-000000000000', NULL,
    'food_beverage', 'Food & Beverage', 'Food & Beverage',
    'Edible and drinkable goods — ingredients, allergens, storage, and nutrition.',
    $json${
      "fields": [
        { "key": "ingredients", "type": "long_text", "label": "Ingredients", "max": 3000 },
        { "key": "allergens", "type": "enum", "label": "Allergens", "multiple": true,
          "options": [
            { "value": "milk", "label": "Milk" },
            { "value": "eggs", "label": "Eggs" },
            { "value": "fish", "label": "Fish" },
            { "value": "shellfish", "label": "Shellfish" },
            { "value": "tree_nuts", "label": "Tree nuts" },
            { "value": "peanuts", "label": "Peanuts" },
            { "value": "wheat", "label": "Wheat" },
            { "value": "soybeans", "label": "Soybeans" },
            { "value": "sesame", "label": "Sesame" },
            { "value": "gluten", "label": "Gluten" }
          ]
        },
        { "key": "netWeight", "type": "text", "label": "Net weight", "max": 40 },
        { "key": "storage", "type": "long_text", "label": "Storage", "max": 1000 },
        { "key": "nutrition", "type": "repeater", "label": "Nutrition", "itemLabel": "Row", "max": 40,
          "fields": [
            { "key": "label", "type": "text", "label": "Nutrient", "required": true, "max": 60 },
            { "key": "value", "type": "text", "label": "Amount", "required": true, "max": 40 }
          ]
        }
      ]
    }$json$::jsonb,
    'utensils-crossed', TRUE, NOW()
)
ON CONFLICT ("tenant_id", "key") DO UPDATE SET
    "name" = EXCLUDED."name", "plural_name" = EXCLUDED."plural_name",
    "description" = EXCLUDED."description", "attribute_schema" = EXCLUDED."attribute_schema",
    "icon" = EXCLUDED."icon", "is_built_in" = EXCLUDED."is_built_in", "updated_at" = NOW();

-- home_goods
INSERT INTO "commerce_product_types" (
    "id", "tenant_id", "property_id", "key", "name", "plural_name",
    "description", "attribute_schema", "icon", "is_built_in", "updated_at"
) VALUES (
    gen_random_uuid(), '00000000-0000-0000-0000-000000000000', NULL,
    'home_goods', 'Home & Objects', 'Home & Objects',
    'Furniture, homeware, and objects — materials, dimensions, and care.',
    $json${
      "fields": [
        { "key": "materials", "type": "long_text", "label": "Materials", "max": 2000 },
        { "key": "dimensions", "type": "text", "label": "Dimensions", "max": 120,
          "helpText": "e.g. \"W 40 × D 40 × H 75 cm\"" },
        { "key": "care", "type": "long_text", "label": "Care", "max": 1000 },
        { "key": "origin", "type": "text", "label": "Made in", "max": 80 }
      ]
    }$json$::jsonb,
    'lamp', TRUE, NOW()
)
ON CONFLICT ("tenant_id", "key") DO UPDATE SET
    "name" = EXCLUDED."name", "plural_name" = EXCLUDED."plural_name",
    "description" = EXCLUDED."description", "attribute_schema" = EXCLUDED."attribute_schema",
    "icon" = EXCLUDED."icon", "is_built_in" = EXCLUDED."is_built_in", "updated_at" = NOW();

-- electronics
INSERT INTO "commerce_product_types" (
    "id", "tenant_id", "property_id", "key", "name", "plural_name",
    "description", "attribute_schema", "icon", "is_built_in", "updated_at"
) VALUES (
    gen_random_uuid(), '00000000-0000-0000-0000-000000000000', NULL,
    'electronics', 'Electronics', 'Electronics',
    'Devices and gear — specifications, connectivity, box contents, and warranty.',
    $json${
      "fields": [
        { "key": "specs", "type": "repeater", "label": "Specifications", "itemLabel": "Spec", "max": 40,
          "fields": [
            { "key": "label", "type": "text", "label": "Spec", "required": true, "max": 60 },
            { "key": "value", "type": "text", "label": "Value", "required": true, "max": 120 }
          ]
        },
        { "key": "connectivity", "type": "long_text", "label": "Connectivity", "max": 1000 },
        { "key": "inTheBox", "type": "long_text", "label": "In the box", "max": 1000 },
        { "key": "warranty", "type": "long_text", "label": "Warranty", "max": 1000 }
      ]
    }$json$::jsonb,
    'cpu', TRUE, NOW()
)
ON CONFLICT ("tenant_id", "key") DO UPDATE SET
    "name" = EXCLUDED."name", "plural_name" = EXCLUDED."plural_name",
    "description" = EXCLUDED."description", "attribute_schema" = EXCLUDED."attribute_schema",
    "icon" = EXCLUDED."icon", "is_built_in" = EXCLUDED."is_built_in", "updated_at" = NOW();

-- general (the flexible fallback)
INSERT INTO "commerce_product_types" (
    "id", "tenant_id", "property_id", "key", "name", "plural_name",
    "description", "attribute_schema", "icon", "is_built_in", "updated_at"
) VALUES (
    gen_random_uuid(), '00000000-0000-0000-0000-000000000000', NULL,
    'general', 'General', 'General',
    'A flexible fallback — a free list of labeled detail sections for any product.',
    $json${
      "fields": [
        { "key": "details", "type": "repeater", "label": "Details", "itemLabel": "Detail", "max": 20,
          "fields": [
            { "key": "label", "type": "text", "label": "Label", "required": true, "max": 60 },
            { "key": "body", "type": "long_text", "label": "Body", "required": true, "max": 1000 }
          ]
        }
      ]
    }$json$::jsonb,
    'tag', TRUE, NOW()
)
ON CONFLICT ("tenant_id", "key") DO UPDATE SET
    "name" = EXCLUDED."name", "plural_name" = EXCLUDED."plural_name",
    "description" = EXCLUDED."description", "attribute_schema" = EXCLUDED."attribute_schema",
    "icon" = EXCLUDED."icon", "is_built_in" = EXCLUDED."is_built_in", "updated_at" = NOW();

-- auto_part (Gillett / diesel vertical — no current template uses it)
INSERT INTO "commerce_product_types" (
    "id", "tenant_id", "property_id", "key", "name", "plural_name",
    "description", "attribute_schema", "icon", "is_built_in", "updated_at"
) VALUES (
    gen_random_uuid(), '00000000-0000-0000-0000-000000000000', NULL,
    'auto_part', 'Auto Part', 'Auto Parts',
    'Vehicle parts — fitment, specifications, and warranty.',
    $json${
      "fields": [
        { "key": "fitment", "type": "long_text", "label": "Fitment", "max": 2000,
          "helpText": "Which vehicles / engines this part fits." },
        { "key": "specs", "type": "repeater", "label": "Specifications", "itemLabel": "Spec", "max": 40,
          "fields": [
            { "key": "label", "type": "text", "label": "Spec", "required": true, "max": 60 },
            { "key": "value", "type": "text", "label": "Value", "required": true, "max": 120 }
          ]
        },
        { "key": "warranty", "type": "long_text", "label": "Warranty", "max": 1000 }
      ]
    }$json$::jsonb,
    'wrench', TRUE, NOW()
)
ON CONFLICT ("tenant_id", "key") DO UPDATE SET
    "name" = EXCLUDED."name", "plural_name" = EXCLUDED."plural_name",
    "description" = EXCLUDED."description", "attribute_schema" = EXCLUDED."attribute_schema",
    "icon" = EXCLUDED."icon", "is_built_in" = EXCLUDED."is_built_in", "updated_at" = NOW();
