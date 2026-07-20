-- Per-SITE invoice numbering + a frozen issuer identity (docs/131 §3.6,
-- docs/130 §2.7).
--
-- TWO defects, and they compound.
--
-- 1. `number_seq` was a per-TENANT sequence. A tenant running two businesses
--    therefore interleaved their books: Bob's Parts issues INV-000123, Savory
--    Donuts INV-000124, Bob's INV-000125. Each set of books appears to skip
--    numbers — which an accountant reads as missing documents — and the gaps
--    disclose to customers that two unrelated brands are one legal entity, which
--    is exactly what a tenant running separate brands is trying not to say.
--
-- 2. The SELLER was never snapshotted. `bill_to` and `ship_to` are frozen onto
--    the document specifically so a later contact edit cannot rewrite a finalized
--    invoice — but the issuer was read live at render time. So renaming a site,
--    or correcting the legal entity's address, silently rewrote the letterhead on
--    invoices ALREADY IN CUSTOMERS' HANDS. The customer's PDF and the tenant's
--    copy then disagree about who billed them, which is the one class of
--    discrepancy an audit cannot be talked out of.
--
-- This is the least reversible item in docs/131. A wrong scoping decision
-- elsewhere shows the wrong data; a wrong decision here produces documents that
-- were already wrong when a customer received them, and no later migration can
-- retract a sent invoice.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. billing_documents.property_id (REQUIRED) + issued_by
--
-- The loop + set_config is mandatory: `billing_documents` is ENABLE+FORCE RLS
-- and `sparx_owner` is a NON-SUPERUSER in production, so a bare UPDATE sees zero
-- rows and the SET NOT NULL below fails in prod after passing locally.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE "billing_documents" ADD COLUMN "property_id" UUID;
ALTER TABLE "billing_documents" ADD COLUMN "issued_by" JSONB;

-- REPAIR FIRST, then backfill.
--
-- Measured on the dev database while writing this: SIX tenants hold billing
-- documents while having NO primary site. That state is supposed to be
-- impossible — `provision-tenant.ts` creates exactly one primary for every
-- tenant — and it exists only because older TEST FIXTURES built tenants without
-- one (the same defect that made api-rest suites fail with unexplained 404s).
--
-- The first draft of this migration let SET NOT NULL fail loudly on those rows,
-- on the principle that nobody should guess who issued an invoice. Running it
-- proved that too strict to be useful: it blocks the migration on data that is
-- not ambiguous at all. A tenant with no primary site is not a tenant whose
-- issuer is UNKNOWN — it is a tenant missing a row it was always meant to have.
--
-- So restore the invariant rather than deleting financial records or inventing
-- an issuer. The repaired site is created exactly as provisioning does: slug
-- 'primary', named from the tenant, is_primary = true. That is not a guess; it
-- is the row that should have been there all along, and the documents then
-- attach to it correctly.
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN
        SELECT DISTINCT d.tenant_id AS id, tn.name
          FROM "billing_documents" d
          JOIN "tenants" tn ON tn.id = d.tenant_id
         WHERE NOT EXISTS (
               SELECT 1 FROM "properties" p
                WHERE p.tenant_id = d.tenant_id AND p.is_primary
         )
    LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);

        -- 'primary' is the slug provisioning uses. ON CONFLICT DO NOTHING covers
        -- a tenant that somehow holds a non-primary site already sitting on that
        -- slug; the is_primary partial unique index guards the other direction.
        --
        -- `updated_at` is supplied EXPLICITLY. Prisma's `@updatedAt` is an
        -- application-layer behaviour, not a DB default, so a column written by
        -- raw migration SQL gets NULL and trips its own NOT NULL constraint —
        -- which is exactly what happened on the first run of this block. Same
        -- reason migration 20261209000000 passes CURRENT_TIMESTAMP by hand.
        INSERT INTO "properties" ("tenant_id", "slug", "name", "is_primary", "created_at", "updated_at")
        VALUES (t.id, 'primary', t.name, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT DO NOTHING;
    END LOOP;

    PERFORM set_config('app.tenant_id', '', true);
END $$;

DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT id FROM "tenants" LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);

        UPDATE "billing_documents" d
           SET "property_id" = (
               SELECT p.id FROM "properties" p
                WHERE p.tenant_id = t.id AND p.is_primary
                LIMIT 1
           )
         WHERE d.tenant_id = t.id;
    END LOOP;

    PERFORM set_config('app.tenant_id', '', true);
END $$;

-- Existing documents keep issued_by NULL rather than being back-filled with
-- today's business details. That is deliberate and it is the honest choice: a
-- snapshot is a claim about what the document said WHEN IT WAS ISSUED, and
-- inventing one now from current data would fabricate exactly the evidence this
-- column exists to make trustworthy. Renderers fall back to the live entity for
-- these, as they already do.

-- Still fails loudly if anything remains unattributed after the repair above.
-- Unlike the consent rows dropped in 20261219000000, these are NEVER deleted — a
-- financial record is not destroyed by a schema migration. If this raises 23502,
-- the cause is a case the repair did not anticipate, and a human decides.
ALTER TABLE "billing_documents" ALTER COLUMN "property_id" SET NOT NULL;

-- RESTRICT — the only FK in this remediation that blocks. Cascade would let
-- deleting a site destroy its books; SetNull would leave invoices nobody issued.
-- A site with billing history simply cannot be deleted, and must be archived
-- instead. Refusing the delete is the honest answer rather than picking which
-- kind of damage to do.
ALTER TABLE "billing_documents" ADD CONSTRAINT "billing_documents_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Per-site uniqueness
--
-- Two businesses may now each hold INV-000001, and should — that is what
-- separate books look like. The constraint remains the collision backstop for
-- the count-based allocator (a lost race still fails loudly rather than silently
-- issuing a duplicate invoice number), just at the correct grain.
--
-- No NULLS NOT DISTINCT needed here, unlike the AI and redirect indexes:
-- property_id is NOT NULL, and number/number_seq are legitimately NULL on an
-- unnumbered draft — where distinct-NULL behaviour is exactly what we want, so
-- that many drafts can coexist unnumbered.
-- ─────────────────────────────────────────────────────────────────────────

DROP INDEX "billing_documents_tenant_number_unique";
DROP INDEX "billing_documents_tenant_seq_unique";

CREATE UNIQUE INDEX "billing_documents_tenant_number_unique"
    ON "billing_documents"("tenant_id", "property_id", "number");
CREATE UNIQUE INDEX "billing_documents_tenant_seq_unique"
    ON "billing_documents"("tenant_id", "property_id", "number_seq");

CREATE INDEX "billing_documents_tenant_property_status_idx"
    ON "billing_documents"("tenant_id", "property_id", "status", "due_at");

-- ─────────────────────────────────────────────────────────────────────────
-- 3. billing_document_templates.property_id (NULLABLE) + per-site default
--
-- A letterhead is brand artwork, so two unrelated businesses forced onto one is
-- the same defect as the shared sender identity in §3.4. Nullable because a
-- genuinely neutral template is real; existing rows stay NULL (available
-- everywhere), which is the correct reading of data authored when there was one
-- business.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE "billing_document_templates" ADD COLUMN "property_id" UUID;

ALTER TABLE "billing_document_templates" ADD CONSTRAINT "billing_document_templates_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;

-- "One default per tenant" becomes "one default per site" — a partial unique
-- index, so it constrains only the rows claiming to be default. NULLS NOT
-- DISTINCT so the tenant-wide tier can hold at most one default too; without it
-- two shared templates could both claim it and the winner would be row order.
DROP INDEX IF EXISTS "billing_document_templates_one_default_per_tenant";
CREATE UNIQUE INDEX "billing_document_templates_one_default_per_property"
    ON "billing_document_templates"("tenant_id", "property_id")
    NULLS NOT DISTINCT
    WHERE "is_default";

CREATE INDEX "billing_document_templates_tenant_property_idx"
    ON "billing_document_templates"("tenant_id", "property_id");
