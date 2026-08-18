-- Per-SITE AI persona + tool policy (docs/131 §3.5).
--
-- `ai_prompt_templates` was unique on (tenant_id, key), so a tenant could hold
-- exactly ONE row with category='persona' — and that row is the live-chat AI's
-- system prompt, the voice the business answers customers in. A tenant running
-- both a machine shop and a donut shop therefore had one voice for both, and one
-- of the two storefronts answered as the other business. Not a subtle defect:
-- it is visible in the first chat message on the second site.
--
-- `ai_tool_policies` had the same shape with a sharper edge. A policy row is a
-- SAFETY decision ("do not let the assistant do this here"), and being
-- tenant-wide meant a decision taken while thinking about one business silently
-- applied to another nobody had in mind. Disabling a tool for the donut chat
-- disabled it for the parts chat too.
--
-- Both columns are NULLABLE, and that is a real distinction rather than
-- hedging: a prompt about the CRAFT (draft an SEO title, summarize a thread)
-- belongs to the tenant and copying it per site would be duplication with no
-- meaning, while a PERSONA belongs to the business. Resolution is
-- most-specific-wins — the site's own row beats the tenant-wide one.
--
-- These tables are FORCE RLS but need NO per-tenant backfill loop: the new
-- columns default to NULL, which is exactly the correct reading of every
-- existing row (it was tenant-wide, and it stays tenant-wide).

ALTER TABLE "ai_prompt_templates" ADD COLUMN "property_id" UUID;
ALTER TABLE "ai_tool_policies"    ADD COLUMN "property_id" UUID;

-- Cascade, not SetNull. SetNull would PROMOTE a deleted site's rows to
-- tenant-wide: the closed business's persona would start answering for every
-- remaining site, and its tool bans would spread to businesses that never chose
-- them. Deleting a site must narrow what its rows reach, never widen it — the
-- same rule migration 20261211000000 applied to automations and API keys.
ALTER TABLE "ai_prompt_templates" ADD CONSTRAINT "ai_prompt_templates_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;
ALTER TABLE "ai_tool_policies" ADD CONSTRAINT "ai_tool_policies_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────
-- Widened unique keys — NULLS NOT DISTINCT is load-bearing.
--
-- Postgres treats NULLs as DISTINCT in a unique index by default, so a plain
-- UNIQUE (tenant_id, property_id, key) would permit unlimited rows sharing
-- (tenant, NULL, 'persona'). That silently destroys the property this
-- constraint exists for: installs are ensure-by-key (upsert), so a duplicate
-- tenant-wide row makes the install non-idempotent and makes "the tenant's
-- persona" ambiguous — the exact class of bug that produced the nightly
-- reconcile double-insert noted in docs/131 §8.
--
-- NULLS NOT DISTINCT (Postgres 15+; we are on 18) makes NULL compare equal to
-- NULL here, so at most one tenant-wide row per key survives, alongside at most
-- one row per site. Prisma cannot express this modifier — the schema declares
-- the plain compound unique so the client exposes the key for upsert, and THIS
-- is the real constraint.
-- ─────────────────────────────────────────────────────────────────────────

DROP INDEX "ai_prompt_templates_tenant_key_unique";
CREATE UNIQUE INDEX "ai_prompt_templates_tenant_key_unique"
    ON "ai_prompt_templates"("tenant_id", "property_id", "key") NULLS NOT DISTINCT;

DROP INDEX "ai_tool_policies_tenant_tool_unique";
CREATE UNIQUE INDEX "ai_tool_policies_tenant_tool_unique"
    ON "ai_tool_policies"("tenant_id", "property_id", "tool_name") NULLS NOT DISTINCT;

-- Persona/category lookups are now scoped by site on the hot live-chat path.
CREATE INDEX "ai_prompt_templates_tenant_property_category_idx"
    ON "ai_prompt_templates"("tenant_id", "property_id", "category");
