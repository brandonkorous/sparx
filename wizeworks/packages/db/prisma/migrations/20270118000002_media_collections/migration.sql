-- Media collections (docs/49) — manual named "boards" a tenant builds by hand
-- ("Spring campaign", "Hero shots"), on top of the automatic source groups. A
-- collection is site-scoped like an asset (property_id, NULL = shared) and holds
-- assets through a many-to-many join so one image can be in several collections.
--
-- tenant_id / property_id are plain columns (no FK) — RLS + withTenant enforce the
-- tenant boundary, property_id is a soft scope, and adding FKs to the already-huge
-- tenants/properties tables buys nothing. The join's collection/asset FKs DO exist
-- (they mirror Prisma relations) and both cascade, so deleting a collection or an
-- asset just drops the membership.

CREATE TABLE "media_collections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "property_id" UUID,
    "name" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "media_collections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "media_collections_tenant_id_property_id_name_idx"
    ON "media_collections" ("tenant_id", "property_id", "name");

CREATE TABLE "media_asset_collections" (
    "tenant_id" UUID NOT NULL,
    "collection_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "added_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "media_asset_collections_pkey" PRIMARY KEY ("collection_id", "asset_id")
);

CREATE INDEX "media_asset_collections_tenant_id_asset_id_idx"
    ON "media_asset_collections" ("tenant_id", "asset_id");

ALTER TABLE "media_asset_collections"
    ADD CONSTRAINT "media_asset_collections_collection_id_fkey"
    FOREIGN KEY ("collection_id") REFERENCES "media_collections"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "media_asset_collections"
    ADD CONSTRAINT "media_asset_collections_asset_id_fkey"
    FOREIGN KEY ("asset_id") REFERENCES "media_assets"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: standard tenant isolation on both, matching every other tenant-scoped table.
ALTER TABLE "media_collections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "media_collections" FORCE ROW LEVEL SECURITY;
CREATE POLICY media_collections_tenant_isolation ON "media_collections"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

ALTER TABLE "media_asset_collections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "media_asset_collections" FORCE ROW LEVEL SECURITY;
CREATE POLICY media_asset_collections_tenant_isolation ON "media_asset_collections"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());
