-- Bulk-operation revert ledger (docs/69 B-3).
--
-- Captures the before-state of a bulk mutation so it can be undone within a
-- short window (30 minutes). Generic (entity_type + field + value_before/after)
-- though the first producer is bulk price adjustment on commerce variants. Rows
-- sharing operation_id are one undoable batch; expires_at is stamped at apply
-- time so revertability is a plain `expires_at > now()`.
--
-- RLS: tenant-scoped → ENABLE + FORCE + tenant_isolation on current_tenant_id().

CREATE TABLE "bulk_op_reverts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "operation_id" UUID NOT NULL,
    "operation_type" VARCHAR(40) NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "entity_type" VARCHAR(40) NOT NULL,
    "entity_id" UUID NOT NULL,
    "group_id" UUID,
    "field" VARCHAR(40) NOT NULL,
    "value_before" INTEGER NOT NULL,
    "value_after" INTEGER NOT NULL,
    "applied_by" UUID,
    "applied_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "reverted_at" TIMESTAMPTZ,
    "reverted_by" UUID,

    CONSTRAINT "bulk_op_reverts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bulk_op_reverts_tenant_id_operation_id_idx" ON "bulk_op_reverts"("tenant_id", "operation_id");
CREATE INDEX "bulk_op_reverts_tenant_id_applied_at_idx" ON "bulk_op_reverts"("tenant_id", "applied_at" DESC);

-- ─── Foreign keys ─────────────────────────────────────────────────────────────

ALTER TABLE "bulk_op_reverts" ADD CONSTRAINT "bulk_op_reverts_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Row-level security (hand-edited; Prisma does not generate RLS) ────────────

ALTER TABLE "bulk_op_reverts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bulk_op_reverts" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "bulk_op_reverts"
    USING ("tenant_id" = current_tenant_id())
    WITH CHECK ("tenant_id" = current_tenant_id());
