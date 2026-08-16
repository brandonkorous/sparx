-- A theme becomes a THING a business owns, instead of a column on one site.
--
-- Before this, a tenant's look lived in two JSON columns on `builder_sites`: the
-- active `silica_draft_theme`, and a `silica_draft_saved_themes` array beside it.
-- That shape cannot express either of the two facts a theme actually has — it is
-- reusable across a tenant's sites, and it has a publish lifecycle of its own. A
-- business with a shop and a blog wants one look on both, and changing it in one
-- place is the entire point.
--
-- The other two tiers already have homes and are NOT rows here: platform presets
-- ship in code, and marketplace listings live in `marketplace_themes` with their
-- publisher and price. Using either COPIES it into a row here, so a preset or a
-- listing changing under a live site can never repaint it, and an author can
-- always edit what they picked. `origin` keeps the provenance.

CREATE TABLE "builder_themes" (
    "id"                   UUID        NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"            UUID        NOT NULL,

    "name"                 VARCHAR(160) NOT NULL,

    -- custom | preset | marketplace. Provenance, never ownership: every row here
    -- belongs to the tenant and is editable.
    "origin"               VARCHAR(20)  NOT NULL DEFAULT 'custom',
    "source_key"           VARCHAR(120),
    -- Deliberately NOT a foreign key: a listing can be retracted, and that must
    -- not delete a look somebody's live site is wearing.
    "marketplace_theme_id" UUID,
    "marketplace_version"  VARCHAR(20),

    -- The silica `Theme` verbatim, so what previews on the canvas is what renders.
    "draft_tokens"         JSONB        NOT NULL,
    "published_tokens"     JSONB,

    "published_at"         TIMESTAMPTZ,
    "created_at"           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "updated_at"           TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT "builder_themes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "builder_themes_tenant_fk"
        FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
    CONSTRAINT "builder_themes_origin_check"
        CHECK ("origin" IN ('custom', 'preset', 'marketplace'))
);

-- The list read is "this tenant's looks, by name" — the theme picker's only query.
CREATE INDEX "builder_themes_tenant_name_idx" ON "builder_themes" ("tenant_id", "name");

ALTER TABLE "builder_themes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "builder_themes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "builder_themes"
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- WHICH look each site wears, draft and published.
--
-- The pair matches `builder_pages.frame_id` / `published_frame_id`, and for the
-- same reason: what a site looks like is the most visible thing about it, so the
-- pointer at it must obey the publish lifecycle. Without the published half,
-- "try a different look" would repaint the live site the moment it was clicked.
--
-- No foreign key, also matching `frame_id`: a dangling id falls back to the
-- brand-derived theme and is reported, rather than silently restoring a look the
-- author moved away from.
ALTER TABLE "builder_sites" ADD COLUMN "theme_id" UUID;
ALTER TABLE "builder_sites" ADD COLUMN "published_theme_id" UUID;

-- ── Backfill ────────────────────────────────────────────────────────────────
--
-- LOOPS TENANTS AND SETS `app.tenant_id` PER TENANT. Both tables are FORCE RLS
-- and `sparx_owner` is a NON-SUPERUSER in production, so a single un-scoped pass
-- reads zero rows there — while passing locally, where the migration runs as a
-- superuser. That divergence is the failure this loop exists to prevent.
DO $$
DECLARE
    t          RECORD;
    site       RECORD;
    saved      JSONB;
    new_id     UUID;
BEGIN
    FOR t IN SELECT id FROM tenants LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);

        -- The look each site is actually wearing becomes its first theme.
        FOR site IN
            SELECT id, silica_draft_theme, silica_published_theme, silica_draft_saved_themes
            FROM builder_sites
            WHERE tenant_id = t.id AND silica_draft_theme IS NOT NULL
        LOOP
            INSERT INTO builder_themes (
                tenant_id, name, origin, draft_tokens, published_tokens, published_at
            )
            VALUES (
                t.id,
                COALESCE(NULLIF(site.silica_draft_theme->>'name', ''), 'Your look'),
                'custom',
                site.silica_draft_theme,
                site.silica_published_theme,
                CASE WHEN site.silica_published_theme IS NOT NULL THEN now() ELSE NULL END
            )
            RETURNING id INTO new_id;

            UPDATE builder_sites
               SET theme_id = new_id,
                   -- Only points at it if a published copy actually exists. A site
                   -- that never published must keep rendering brand-derived.
                   published_theme_id = CASE
                       WHEN site.silica_published_theme IS NOT NULL THEN new_id ELSE NULL
                   END
             WHERE id = site.id;

            -- The saved-theme library becomes rows too. Skipping the entry that
            -- matches the active look, which is the same theme under both keys —
            -- importing both would give every tenant a duplicate on day one.
            IF jsonb_typeof(site.silica_draft_saved_themes) = 'array' THEN
                FOR saved IN SELECT * FROM jsonb_array_elements(site.silica_draft_saved_themes)
                LOOP
                    CONTINUE WHEN COALESCE(saved->>'name', '')
                                  = COALESCE(site.silica_draft_theme->>'name', '');
                    INSERT INTO builder_themes (tenant_id, name, origin, draft_tokens)
                    VALUES (
                        t.id,
                        COALESCE(NULLIF(saved->>'name', ''), 'Saved look'),
                        'custom',
                        saved
                    );
                END LOOP;
            END IF;
        END LOOP;
    END LOOP;

    PERFORM set_config('app.tenant_id', '', true);
END $$;
