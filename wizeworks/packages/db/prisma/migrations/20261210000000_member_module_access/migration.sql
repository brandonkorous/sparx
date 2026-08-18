-- Per-member module access (Settings → Team).
--
-- Until now a teammate's reach was decided entirely by their org role, which is
-- coarse: "editor" is the same permission whether the business runs Commerce
-- alone or eleven modules. This adds a second, orthogonal axis — WHICH modules a
-- given member may open — without touching the role hierarchy.
--
-- The default is deliberately a no-op. Every existing member backfills to
-- `all`, which means "no restriction, the role is the only gate" — exactly
-- today's behaviour. Nobody's access changes when this ships.

-- ── members.module_access_mode ────────────────────────────────────────────────
-- NOT NULL with a DEFAULT, so the backfill is implicit and this stays a
-- metadata-only change on Postgres 11+ (no table rewrite, no lock held while
-- every row is touched). `members` is small, but the same statement shape is
-- what we want habitually.
ALTER TABLE "members"
  ADD COLUMN "module_access_mode" VARCHAR(20) NOT NULL DEFAULT 'all';

-- The mode is a closed vocabulary and the access layer branches on it, so an
-- unexpected value would fail open (unrecognised mode → no restriction applied).
-- A check constraint makes that unreachable rather than merely unlikely.
ALTER TABLE "members"
  ADD CONSTRAINT "members_module_access_mode_check"
  CHECK ("module_access_mode" IN ('all', 'selected'));

-- ── member_module_access ──────────────────────────────────────────────────────
CREATE TABLE "member_module_access" (
  "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
  "member_id"  UUID         NOT NULL,
  "module"     VARCHAR(32)  NOT NULL,
  "created_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "member_module_access_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "member_module_access_member_id_fkey"
    FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "member_module_access_member_module_unique"
  ON "member_module_access" ("member_id", "module");

CREATE INDEX "member_module_access_member_id_idx"
  ON "member_module_access" ("member_id");

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- ENABLE but NOT FORCE, matching `members` / `invitations` / `users` / `sessions`
-- (see 03-auth-org.prisma's header and migration 20261002000000). This is an
-- auth-layer table: @sparx/auth connects as `sparx_owner` and must resolve a
-- user's access BEFORE any tenant context exists, so it cannot be behind a
-- policy keyed on current_tenant_id(). `sparx_app` stays filtered as
-- defence-in-depth.
--
-- The policy reaches the tenant through `members`, since this table has no
-- tenant_id of its own — access rows belong to a membership, and the membership
-- is what is scoped to a tenant. Duplicating tenant_id here would create a
-- second copy that can disagree with the row it hangs off.
ALTER TABLE "member_module_access" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "member_module_access"
  USING (
    EXISTS (
      SELECT 1 FROM "members" m
      WHERE m."id" = "member_module_access"."member_id"
        AND m."organization_id" = current_tenant_id()
    )
  );

-- ── audit_logs: per-actor lookup ──────────────────────────────────────────────
-- "What has this person been doing?" and "when were they last active?" both
-- filter audit_logs by actor. There is no stored last-active field anywhere in
-- the platform (users.last_login_at is LOGIN; sessions has no touch column), so
-- MAX(created_at) WHERE actor_id = ? is the only honest answer — and without
-- this index it scans every row the tenant has ever written, on the one table
-- every module appends to.
--
-- CONCURRENTLY is deliberately NOT used: it cannot run inside a transaction and
-- prisma migrate wraps each migration in one.
--
-- BE AWARE OF THE COST: a plain CREATE INDEX takes a SHARE lock, which permits
-- reads but BLOCKS WRITES to audit_logs for the whole build. Every
-- state-changing service writes an audit row inside its own transaction, so for
-- that window writes across the platform queue behind this. On a large
-- audit_logs that is a visible stall, not a blip.
--
-- If this table has grown enough for that to matter, do NOT run this statement
-- through the pipeline — cut it from this migration and build the index by hand
-- against Cloud SQL with CREATE INDEX CONCURRENTLY (outside any transaction),
-- then mark it applied. Everything above is small and safe to ship either way.
CREATE INDEX "audit_logs_tenant_actor_created_idx"
  ON "audit_logs" ("tenant_id", "actor_id", "created_at" DESC);
