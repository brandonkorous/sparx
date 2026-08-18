-- ─────────────────────────────────────────────────────────────────────────
-- Partners get a public URL slug (docs/114 §B.6).
--
-- The partner program has always been specified to have a per-partner public
-- profile, and `partners` had no stable, human-readable key to hang one on. The
-- only candidates were the uuid primary key (an unshareable URL, and it leaks
-- the row id into every share card) and `referral_code` (attribution, not
-- identity — a random UNAMBIGUOUS-ALPHABET string, not a name).
--
-- So: `slug`, minted from `display_name` at provisioning and IMMUTABLE after
-- that. A public URL that moves when a partner edits its display name breaks
-- every inbound link, every share card, and every referral someone pasted into
-- an email — a rename is a label change, not a new identity.
--
-- ORDER MATTERS. `ADD COLUMN … NOT NULL UNIQUE` fails outright on a table that
-- already holds rows, so this is the four-step shape: add nullable → backfill →
-- SET NOT NULL → unique index.
--
-- RLS — the footgun this migration is shaped around (packages/db/CLAUDE.md).
-- `partners` is FORCE ROW LEVEL SECURITY and `sparx_owner` is a NON-SUPERUSER
-- in production, so inside a migration the `partners_visibility` policy is live:
--
--     USING      (status = 'active' OR tenant_id = current_tenant_id())
--     WITH CHECK (tenant_id = current_tenant_id())
--
-- An unscoped `UPDATE partners SET slug = …` therefore (a) cannot SEE a pending
-- or suspended partner at all and (b) fails the WITH CHECK on every row it can
-- see, because `current_tenant_id()` is null. It would report success having
-- touched zero rows — locally it would even pass, because docker's `sparx_owner`
-- IS a superuser. Hence the per-tenant `set_config('app.tenant_id', …)` loop.
--
-- That same policy is why the slugs are computed in a TEMP table rather than in
-- one window function over `partners`: a single unscoped SELECT would only see
-- ACTIVE rows, so the de-duplication would be computed against a partial view of
-- the very column being made UNIQUE. Temp tables carry no RLS, so pass 1 gathers
-- every row (each tenant reads its own, which it can always see), the collision
-- resolution runs on the complete set, and pass 2 writes it back per tenant.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE "partners" ADD COLUMN "slug" VARCHAR(160);

-- id → the slug it will receive. Temp tables carry no RLS, which is the point.
-- Dropped explicitly at the bottom rather than with ON COMMIT DROP: that clause
-- would take the table with it the instant the CREATE committed if this file
-- ever ran outside a transaction, and every statement after it would fail on a
-- missing relation.
CREATE TEMP TABLE "tmp_partner_slugs" (
    "id"           UUID PRIMARY KEY,
    "tenant_id"    UUID NOT NULL,
    "display_name" VARCHAR(255) NOT NULL,
    "base"         VARCHAR(160),
    "slug"         VARCHAR(160)
);

-- ── Pass 1: gather every partner row, one tenant scope at a time ────────────
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT id FROM tenants LOOP
        PERFORM set_config('app.tenant_id', t.id::text, false);
        -- `tenant_id = t.id` is not redundant with the policy: under this scope
        -- the policy ALSO exposes every other tenant's active partner, and each
        -- of those is gathered under its own tenant's turn through the loop.
        INSERT INTO "tmp_partner_slugs" ("id", "tenant_id", "display_name")
        SELECT p."id", p."tenant_id", p."display_name"
          FROM "partners" p
         WHERE p."tenant_id" = t.id;
    END LOOP;
    PERFORM set_config('app.tenant_id', '', false);
END $$;

-- ── Compute the base slug ───────────────────────────────────────────────────
-- Mirrors slugify() in services/api-rest/src/lib/partners/slug.ts: lowercase,
-- every run of non-alphanumerics to a single '-', trimmed, capped at 120 chars
-- (leaving room inside VARCHAR(160) for the collision suffix below), and a
-- 'partner' fallback when nothing survives. The one divergence is deliberate:
-- the TS side keeps unicode letters (\p{Letter} over an NFKD normalisation)
-- where SQL without `unaccent` cannot, so a wholly non-Latin display name
-- backfills to the fallback and picks up a suffix from the de-dup pass. Both
-- sides are checked against the same unique index, so they cannot disagree
-- about what is taken — only about what they would have preferred.
UPDATE "tmp_partner_slugs"
   SET "base" = COALESCE(
       NULLIF(
           trim(both '-' from
               left(trim(both '-' from regexp_replace(lower("display_name"), '[^a-z0-9]+', '-', 'g')), 120)
           ),
           ''
       ),
       'partner'
   );

-- ── Resolve collisions deterministically ────────────────────────────────────
-- First row of any duplicated base (ordered by id, so a re-run of this migration
-- on the same data produces the same answer) keeps the bare slug; the rest take
-- a short id-derived suffix.
UPDATE "tmp_partner_slugs" s
   SET "slug" = CASE WHEN r."rn" = 1 THEN s."base" ELSE s."base" || '-' || left(s."id"::text, 6) END
  FROM (
      SELECT "id", row_number() OVER (PARTITION BY "base" ORDER BY "id") AS "rn"
        FROM "tmp_partner_slugs"
  ) r
 WHERE r."id" = s."id";

-- Safety net: two rows sharing a base AND the first 6 characters of their uuid
-- would still collide, and the unique index below would take the whole release
-- down. Fall back to the full uuid, which cannot. (`min` over the id as TEXT —
-- `min(uuid)` is not available on every server version this may meet.)
UPDATE "tmp_partner_slugs" s
   SET "slug" = s."base" || '-' || replace(s."id"::text, '-', '')
 WHERE EXISTS (
     SELECT 1 FROM "tmp_partner_slugs" d
      WHERE d."slug" = s."slug" AND d."id" <> s."id"
 )
   AND s."id"::text <> (
       SELECT min(k."id"::text) FROM "tmp_partner_slugs" k WHERE k."slug" = s."slug"
   );

-- ── Pass 2: write it back, one tenant scope at a time ───────────────────────
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT id FROM tenants LOOP
        PERFORM set_config('app.tenant_id', t.id::text, false);
        UPDATE "partners" p
           SET "slug" = s."slug",
               "updated_at" = now()
          FROM "tmp_partner_slugs" s
         WHERE s."id" = p."id"
           AND p."tenant_id" = t.id;
    END LOOP;
    -- Leave no tenant scope set for whatever runs next in this session.
    PERFORM set_config('app.tenant_id', '', false);
END $$;

-- ── Lock it down ────────────────────────────────────────────────────────────
-- SET NOT NULL validates as the table owner, below the policy, so it sees every
-- row — which makes it the real assertion that the backfill above reached all of
-- them. If a row escaped the loop, this migration fails here rather than leaving
-- a null slug to surface later as a 404 on someone's public profile.
ALTER TABLE "partners" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "partners_slug_unique" ON "partners"("slug");

DROP TABLE "tmp_partner_slugs";
