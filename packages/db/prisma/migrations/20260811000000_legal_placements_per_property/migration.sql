-- Legal/footer doc placements → optionally per-site (docs/49 Phase 6c). A
-- placement with property_id = NULL is tenant-wide (shows on EVERY site — the
-- default, and what every pre-rollout row stays); a non-null property_id scopes
-- it to one site, so a multi-brand tenant can give each site its own footer legal
-- links. The public read returns (NULL ∪ the resolved site).
--
-- Purely additive: a NULLABLE column, no backfill, no NOT NULL — so no RLS loop
-- (existing rows keep the NULL = tenant-wide meaning). property_id is NOT a
-- security boundary; tenant_id + the unchanged tenant_isolation policy is.

-- ── Add nullable property_id ──────────────────────────────────────────────
ALTER TABLE "storefront_doc_placements" ADD COLUMN "property_id" UUID;

-- ── Per-site uniqueness — the same entry can be placed on different sites and
--    tenant-wide. NULLs are distinct in a unique index, so multiple null-property
--    rows still coexist exactly as before. ─────────────────────────────────────
DROP INDEX "storefront_doc_placements_tenant_id_placement_source_kind_e_key";
CREATE UNIQUE INDEX "storefront_doc_placements_prop_placement_source_entry_key"
    ON "storefront_doc_placements" ("tenant_id", "property_id", "placement", "source_kind", "entry_id");

-- ── FK to properties ──────────────────────────────────────────────────────
ALTER TABLE "storefront_doc_placements"
    ADD CONSTRAINT "storefront_doc_placements_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
