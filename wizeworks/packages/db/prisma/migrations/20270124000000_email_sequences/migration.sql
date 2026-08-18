-- Email sequences (docs/81 §9, docs/implementation/transactional-email §19) — the
-- reusable multi-touch email journey. Two tenant-scoped tables:
--   email_sequences              — the journey document (ordered JSON steps)
--   email_sequence_enrollments   — one person's in-flight progress through it
-- Both get ENABLE + FORCE RLS + tenant_isolation (the enrollment carries its own
-- tenant_id — a join can't satisfy FORCE RLS). DDL is Prisma-exact; RLS + the
-- cross-tenant drain-discovery function are hand-added.

-- ─── Tables ──────────────────────────────────────────────────────────────────

-- CreateTable
CREATE TABLE "email_sequences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "property_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "reentry_policy" VARCHAR(20) NOT NULL DEFAULT 'once',
    "exit_on_purchase" BOOLEAN NOT NULL DEFAULT false,
    "steps" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "email_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_sequence_enrollments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sequence_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "property_id" UUID,
    "customer_id" UUID,
    "recipient_email" VARCHAR(320) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "current_step" INTEGER NOT NULL DEFAULT 0,
    "next_run_at" TIMESTAMPTZ NOT NULL,
    "last_step_at" TIMESTAMPTZ,
    "enrolled_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,
    "exited_at" TIMESTAMPTZ,
    "exit_reason" VARCHAR(64),
    "source_automation_id" UUID,
    "source_refs" JSONB,
    "active_dedupe" VARCHAR(320),

    CONSTRAINT "email_sequence_enrollments_pkey" PRIMARY KEY ("id")
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

-- CreateIndex
CREATE INDEX "email_sequences_tenant_id_status_idx" ON "email_sequences"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "email_sequences_tenant_id_property_id_idx" ON "email_sequences"("tenant_id", "property_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_sequence_enrollments_active_unique" ON "email_sequence_enrollments"("sequence_id", "active_dedupe");

-- CreateIndex
CREATE INDEX "email_sequence_enrollments_tenant_id_status_idx" ON "email_sequence_enrollments"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "email_sequence_enrollments_status_next_run_at_idx" ON "email_sequence_enrollments"("status", "next_run_at");

-- CreateIndex
CREATE INDEX "email_sequence_enrollments_sequence_id_status_idx" ON "email_sequence_enrollments"("sequence_id", "status");

-- CreateIndex
CREATE INDEX "email_sequence_enrollments_tenant_id_customer_id_idx" ON "email_sequence_enrollments"("tenant_id", "customer_id");

-- ─── Foreign keys ────────────────────────────────────────────────────────────
-- tenant_id / property_id FKs are hand-added (no Prisma relation on the leaf
-- table, so the Tenant/Property models don't grow a back-relation).

-- AddForeignKey
ALTER TABLE "email_sequences" ADD CONSTRAINT "email_sequences_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_sequences" ADD CONSTRAINT "email_sequences_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_sequence_enrollments" ADD CONSTRAINT "email_sequence_enrollments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_sequence_enrollments" ADD CONSTRAINT "email_sequence_enrollments_sequence_id_fkey" FOREIGN KEY ("sequence_id") REFERENCES "email_sequences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_sequence_enrollments" ADD CONSTRAINT "email_sequence_enrollments_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Row-level security (hand-edited; Prisma does not generate RLS) ────────────
-- Tenant-scoped → ENABLE + FORCE + tenant_isolation on current_tenant_id().

ALTER TABLE "email_sequences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_sequences" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "email_sequences"
    USING ("tenant_id" = current_tenant_id())
    WITH CHECK ("tenant_id" = current_tenant_id());

ALTER TABLE "email_sequence_enrollments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_sequence_enrollments" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "email_sequence_enrollments"
    USING ("tenant_id" = current_tenant_id())
    WITH CHECK ("tenant_id" = current_tenant_id());

-- ─── Cross-tenant drain discovery (SECURITY DEFINER) ──────────────────────────
-- The automation-worker's sequence-drain tick runs as `sparx_app` (FORCE
-- RLS-bound). To find due enrollments across ALL tenants without granting the app
-- role RLS bypass, expose a SECURITY DEFINER function — the same pattern as
-- find_due_automation_runs (20260731000000). Owned by sparx_owner; only the column
-- subset in the RETURNS clause crosses the boundary. The worker then drives each
-- enrollment under withTenant, so every subsequent read/write is RLS-scoped.
--
-- An enrollment is "due" when it is active, its next_run_at has passed, AND its
-- sequence is still active (a paused/archived sequence stops draining without
-- touching its enrollments).

CREATE OR REPLACE FUNCTION find_due_sequence_enrollments(p_limit int DEFAULT 100)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  sequence_id uuid,
  property_id uuid,
  customer_id uuid,
  recipient_email varchar(320),
  current_step int,
  source_refs jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT e.id, e.tenant_id, e.sequence_id, e.property_id, e.customer_id,
         e.recipient_email, e.current_step, e.source_refs
  FROM email_sequence_enrollments e
  JOIN email_sequences s ON s.id = e.sequence_id AND s.status = 'active'
  WHERE e.status = 'active'
    AND e.next_run_at <= NOW()
  ORDER BY e.next_run_at ASC
  LIMIT p_limit;
$$;

REVOKE EXECUTE ON FUNCTION find_due_sequence_enrollments(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_due_sequence_enrollments(int) TO sparx_app;

COMMENT ON FUNCTION find_due_sequence_enrollments IS
  'Returns up to p_limit active email_sequence_enrollments whose next_run_at <= NOW() and whose sequence is active. SECURITY DEFINER (sparx_owner) so the worker drain tick can scan across tenants without sparx_app holding RLS bypass; the worker drives each enrollment under withTenant.';
