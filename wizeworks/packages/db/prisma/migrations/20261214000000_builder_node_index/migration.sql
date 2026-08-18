-- builder_node_index (docs/126 §5.4) — a DERIVED index of the nodes inside every
-- silica tree a property owns: page bodies, the site chrome (layout), and symbol
-- masters.
--
-- The trees are JSONB blobs, so nothing about their CONTENTS is queryable. This
-- makes three questions answerable without loading and walking every tree:
--   · what breaks if I change or delete this saved component (symbol)?
--   · what shows this product / entry, if I delete it?
--   · which pages contain a node type this renderer cannot draw?
--
-- It is a CACHE, never a source of truth: every row is derivable by re-walking the
-- owning tree, and each write rebuilds one owner wholesale (delete-then-insert), so
-- it cannot drift into a half-updated state.

CREATE TABLE "builder_node_index" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "owner_kind" VARCHAR(16) NOT NULL,
    "owner_id" VARCHAR(255) NOT NULL,
    -- Nullable: a silica node id is OPTIONAL (template/block nodes carry none), and
    -- those nodes still hold bindings worth indexing.
    "node_id" VARCHAR(255),
    "kind" VARCHAR(16) NOT NULL,
    "type" VARCHAR(120) NOT NULL,
    "symbol_id" VARCHAR(255),
    "binding_entity" VARCHAR(20),
    "binding_id" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "builder_node_index_pkey" PRIMARY KEY ("id")
);

-- The rebuild key — a write deletes this owner's rows, then re-inserts them.
CREATE INDEX "builder_node_index_tenant_id_owner_kind_owner_id_idx"
    ON "builder_node_index"("tenant_id", "owner_kind", "owner_id");

-- "Where is this symbol used?"
CREATE INDEX "builder_node_index_tenant_id_symbol_id_idx"
    ON "builder_node_index"("tenant_id", "symbol_id");

-- "What shows this record?"
CREATE INDEX "builder_node_index_tenant_id_binding_entity_binding_id_idx"
    ON "builder_node_index"("tenant_id", "binding_entity", "binding_id");

-- "Which pages contain type X?" — the unknown-type census.
CREATE INDEX "builder_node_index_tenant_id_property_id_type_idx"
    ON "builder_node_index"("tenant_id", "property_id", "type");

ALTER TABLE "builder_node_index"
    ADD CONSTRAINT "builder_node_index_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "builder_node_index"
    ADD CONSTRAINT "builder_node_index_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tenant-scoped table → RLS is the backstop against an application-tier bug.
-- Hand-written: Prisma does not generate policies.
ALTER TABLE "builder_node_index" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "builder_node_index" FORCE ROW LEVEL SECURITY;

-- Named + shaped to match the sibling builder_* tables: a table-prefixed policy
-- name, and WITH CHECK stated explicitly rather than relying on Postgres falling
-- back to USING for INSERT. Same expression, but stating it means a later edit to
-- one clause cannot silently change insert behaviour.
CREATE POLICY builder_node_index_tenant_isolation ON "builder_node_index"
  USING ("tenant_id" = current_tenant_id())
  WITH CHECK ("tenant_id" = current_tenant_id());

-- No backfill. The index is derived and rebuilt on the next write to each tree, so
-- an empty table is a correct cold-start rather than missing data — and backfilling
-- would mean walking every tree in every tenant inside the migration, against a
-- FORCE-RLS table where `sparx_owner` is a non-superuser in prod.
