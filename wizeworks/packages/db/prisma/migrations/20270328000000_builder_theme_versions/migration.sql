-- A look gets a history of its own.
--
-- Every other document in the builder was already restorable: pages, the chrome and
-- the saved pieces all ride the site-wide snapshots in `builder_draft_versions`,
-- whose manifest names one artifact per tree. A LOOK could not, and the reason is
-- structural rather than an oversight — those snapshots are PROPERTY-scoped and a
-- look is TENANT-wide. A business with a shop and a blog wears one look on both, so
-- a history keyed by property could only say when one of the sites happened to be
-- saved, never when the look itself changed.
--
-- So this is its own table, on the tier the thing actually lives on. Append-only
-- like the rest: a restore writes the old tokens FORWARD as a new version rather
-- than rewinding, which is what makes restoring itself undoable.

CREATE TABLE "builder_theme_versions" (
    "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"  UUID        NOT NULL,
    "theme_id"   UUID        NOT NULL,

    -- The silica `Theme` as it stood. Whole rather than a diff: a look is a small
    -- bag of custom properties, and a diff would trade a few kilobytes away for the
    -- one property that makes a history worth having — that any row in it can be
    -- read on its own, without replaying the ones before it.
    "tokens"     JSONB       NOT NULL,

    -- Content address of `tokens`. Two saves that changed nothing share a hash,
    -- which is how a no-op save is skipped instead of adding an opaque row.
    "hash"       CHAR(64)    NOT NULL,

    -- save | publish | restore — what produced this version, so the history can
    -- label it for a non-technical owner.
    "source"     VARCHAR(16) NOT NULL DEFAULT 'save',

    -- Nullable, and deliberately NOT a foreign key: users live in the Better Auth
    -- instance, and a deleted user must not take the edit history with them.
    "actor_id"   UUID,

    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "builder_theme_versions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "builder_theme_versions_tenant_fk"
        FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
    -- CASCADE from the look itself: a deleted look has no history worth keeping,
    -- and the delete is already refused while any site is wearing it.
    CONSTRAINT "builder_theme_versions_theme_fk"
        FOREIGN KEY ("theme_id") REFERENCES "builder_themes"("id") ON DELETE CASCADE,
    CONSTRAINT "builder_theme_versions_source_check"
        CHECK ("source" IN ('save', 'publish', 'restore'))
);

-- The history list: one look's versions, newest first. The only query there is.
CREATE INDEX "builder_theme_versions_theme_idx"
    ON "builder_theme_versions" ("tenant_id", "theme_id", "created_at");

ALTER TABLE "builder_theme_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "builder_theme_versions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "builder_theme_versions"
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- ── Backfill ────────────────────────────────────────────────────────────────
--
-- Every look that exists gets a first version, so a history is never empty for a
-- look that plainly has a state. Without it the pane would open on "nothing saved
-- yet" for a look someone has been using for months — which reads as lost work
-- rather than as a feature that started today.
--
-- LOOPS TENANTS AND SETS `app.tenant_id` PER TENANT. Both tables are FORCE RLS and
-- `sparx_owner` is a NON-SUPERUSER in production, so a single un-scoped pass reads
-- zero rows there while passing locally, where the migration runs as a superuser.
-- That divergence is the failure this loop exists to prevent.
DO $$
DECLARE
    t     RECORD;
    look  RECORD;
BEGIN
    FOR t IN SELECT id FROM tenants LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);

        FOR look IN
            SELECT id, draft_tokens, created_at FROM builder_themes WHERE tenant_id = t.id
        LOOP
            INSERT INTO builder_theme_versions (tenant_id, theme_id, tokens, hash, source, created_at)
            VALUES (
                t.id,
                look.id,
                look.draft_tokens,
                -- ZEROS, not a digest, and that is deliberate. The service addresses
                -- a look by hashing its CANONICAL JSON (keys sorted by the app's own
                -- rule); `jsonb::text` sorts by a different one, so a digest computed
                -- here would look like an address and never match a real one. A
                -- sentinel that plainly is not an address cannot be mistaken for a
                -- match, and costs one extra version on the first save — which is a
                -- real point in the history anyway.
                repeat('0', 64),
                'save',
                look.created_at
            );
        END LOOP;
    END LOOP;

    PERFORM set_config('app.tenant_id', '', true);
END $$;
