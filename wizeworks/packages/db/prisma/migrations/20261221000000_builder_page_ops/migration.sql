-- The append-only op log (docs/126 §2, Phase 2). Every semantic edit silicaui 0.30's
-- `<Builder onChange(site, ops, meta)>` emits, in causal order, keyed by a per-property
-- monotonic sequence (the engine's document-wide `baseSeq`, NOT a per-page one).
--
-- Additive: written in the same transaction as the `silica_draft_tree` snapshot, which
-- stays authoritative. No backfill (there is no history before this table existed), so
-- none of the FORCE-RLS backfill footgun.

CREATE TABLE "builder_page_ops" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "seq" BIGINT NOT NULL,
    "batch_id" VARCHAR(64) NOT NULL,
    "actor_id" UUID,
    "owner_kind" VARCHAR(16) NOT NULL,
    "owner_id" VARCHAR(255),
    "op_kind" VARCHAR(32) NOT NULL,
    "op" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "builder_page_ops_pkey" PRIMARY KEY ("id")
);

-- The ordering key and the concurrency guard in one: a racing duplicate seq collides
-- here and the loser retries, keeping the log a total order. Named explicitly — the
-- generated name would exceed Postgres's 63-char identifier limit and truncate.
CREATE UNIQUE INDEX "builder_page_ops_property_seq_key"
    ON "builder_page_ops" ("tenant_id", "property_id", "seq");
-- Idempotent retry: a re-sent flush finds its batch already recorded.
CREATE INDEX "builder_page_ops_tenant_id_property_id_batch_id_idx"
    ON "builder_page_ops" ("tenant_id", "property_id", "batch_id");
-- "The history of this page/symbol", in order.
CREATE INDEX "builder_page_ops_tenant_id_property_id_owner_kind_owner_id__idx"
    ON "builder_page_ops" ("tenant_id", "property_id", "owner_kind", "owner_id", "seq");

ALTER TABLE "builder_page_ops"
    ADD CONSTRAINT "builder_page_ops_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "builder_page_ops"
    ADD CONSTRAINT "builder_page_ops_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tenant isolation. FORCE so a callsite that forgets withTenant() reads nothing rather
-- than leaking another tenant's edit history.
ALTER TABLE "builder_page_ops" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "builder_page_ops" FORCE ROW LEVEL SECURITY;
CREATE POLICY builder_page_ops_tenant_isolation ON "builder_page_ops"
  USING ("tenant_id" = current_tenant_id())
  WITH CHECK ("tenant_id" = current_tenant_id());
