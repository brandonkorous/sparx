-- Social module, second wave (docs/social-audit/01-roadmap.md).
--
-- Five things, in one migration so the pipeline runs once:
--   1. A health cursor on a connection, so a grant is refreshed AHEAD of expiry and
--      flipped to `expired` the moment a refresh fails — instead of the tenant
--      discovering a dead account from a lost post (audit GAP 1).
--   2. A reviewer note on a post, so "send back" carries a reason.
--   3. A per-destination send time, so one composed post can land at the right local
--      hour on each platform.
--   4. The evergreen pool + the weekly posting cadence it fills.
--   5. The engagement inbox — the inbound half of the module.
--
-- Plus four SECURITY DEFINER drain functions, all following find_due_social_posts
-- (migration 20270112000000_social_scheduled_drain): owned by sparx_owner, EXECUTE
-- granted only to sparx_app, returning a narrow column projection so a tick can scan
-- across tenants without the app role gaining wholesale RLS bypass. Every write those
-- ticks then perform still rides withTenant({tenantId}) through tenant_isolation.

-- ── 1. Connection health cursor ──────────────────────────────────────────────────

ALTER TABLE social_connections
  ADD COLUMN health_checked_at timestamptz;

COMMENT ON COLUMN social_connections.health_checked_at IS
  'When the social-worker health sweep last checked this grant. Null = never checked, so it sorts first.';

-- Partial index: the sweep only ever scans ACTIVE connections, which is a small slice
-- of the table once a tenant has churned through a few accounts.
CREATE INDEX social_connections_health_sweep_idx
  ON social_connections (health_checked_at NULLS FIRST)
  WHERE status = 'active';

-- ── 2. Reviewer note ─────────────────────────────────────────────────────────────

ALTER TABLE social_posts
  ADD COLUMN review_note text;

COMMENT ON COLUMN social_posts.review_note IS
  'Why a reviewer sent this post back. Cleared on resubmit.';

-- ── 3. Per-destination send time ─────────────────────────────────────────────────

ALTER TABLE social_post_targets
  ADD COLUMN scheduled_at timestamptz;

COMMENT ON COLUMN social_post_targets.scheduled_at IS
  'This destination''s own send time. NULL = inherit social_posts.scheduled_at.';

CREATE INDEX social_post_targets_status_scheduled_at_idx
  ON social_post_targets (status, scheduled_at);

-- ── 4. Evergreen pool ────────────────────────────────────────────────────────────

ALTER TABLE social_posts
  ADD COLUMN evergreen        boolean NOT NULL DEFAULT false,
  ADD COLUMN last_recycled_at timestamptz;

COMMENT ON COLUMN social_posts.evergreen IS
  'In the recycle pool: once published it stays available for the slot filler to run again.';

-- The filler picks the least-recently-used evergreen post, so this is its whole query.
CREATE INDEX social_posts_evergreen_pool_idx
  ON social_posts (tenant_id, last_recycled_at NULLS FIRST)
  WHERE evergreen = true;

-- ── 5. Inbox sync cursor on a destination ────────────────────────────────────────

ALTER TABLE social_targets
  ADD COLUMN inbox_synced_at timestamptz;

COMMENT ON COLUMN social_targets.inbox_synced_at IS
  'When the engagement inbox last polled this destination. Null = never, so it backfills on the first pass.';

CREATE INDEX social_targets_inbox_sweep_idx
  ON social_targets (inbox_synced_at NULLS FIRST)
  WHERE enabled = true;

-- ── Saved hashtag blocks ─────────────────────────────────────────────────────────

CREATE TABLE social_hashtag_sets (
  id          uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   uuid         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  property_id uuid                  REFERENCES properties(id) ON DELETE CASCADE,
  name        varchar(120) NOT NULL,
  tags        varchar(120)[] NOT NULL DEFAULT '{}',
  platform    varchar(40),
  created_at  timestamptz  NOT NULL DEFAULT now(),
  updated_at  timestamptz  NOT NULL DEFAULT now()
);

-- NULLS NOT DISTINCT so a tenant-wide set (property_id IS NULL) can't be created twice
-- under the same name — the plain unique would allow unlimited (tenant, NULL, 'Launch').
CREATE UNIQUE INDEX social_hashtag_sets_tenant_property_name_unique
  ON social_hashtag_sets (tenant_id, property_id, name) NULLS NOT DISTINCT;
CREATE INDEX ON social_hashtag_sets (tenant_id, property_id);

ALTER TABLE social_hashtag_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_hashtag_sets FORCE  ROW LEVEL SECURITY;
CREATE POLICY social_hashtag_sets_tenant_isolation ON social_hashtag_sets
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- ── The weekly posting cadence ───────────────────────────────────────────────────

CREATE TABLE social_posting_slots (
  id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  property_id   uuid                 REFERENCES properties(id) ON DELETE CASCADE,
  weekday       int         NOT NULL,
  minute_of_day int         NOT NULL,
  timezone      varchar(64) NOT NULL DEFAULT 'UTC',
  target_ids    uuid[]      NOT NULL DEFAULT '{}',
  enabled       boolean     NOT NULL DEFAULT true,
  auto_fill     boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT social_posting_slots_weekday_range CHECK (weekday BETWEEN 0 AND 6),
  CONSTRAINT social_posting_slots_minute_range  CHECK (minute_of_day BETWEEN 0 AND 1439)
);

CREATE INDEX ON social_posting_slots (tenant_id, property_id);
CREATE INDEX ON social_posting_slots (enabled, auto_fill);

ALTER TABLE social_posting_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posting_slots FORCE  ROW LEVEL SECURITY;
CREATE POLICY social_posting_slots_tenant_isolation ON social_posting_slots
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- ── The engagement inbox ─────────────────────────────────────────────────────────

CREATE TABLE social_inbox_items (
  id                 uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id          uuid         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  property_id        uuid                  REFERENCES properties(id) ON DELETE CASCADE,
  -- FK-less on purpose: conversation history outlives a disconnect that cascades the
  -- destination away (same reasoning as social_post_targets.social_target_id).
  social_target_id   uuid         NOT NULL,
  target_name        varchar(255) NOT NULL,
  platform           varchar(40)  NOT NULL,
  post_target_id     uuid,
  kind               varchar(20)  NOT NULL,
  direction          varchar(10)  NOT NULL DEFAULT 'inbound',
  external_id        varchar(255) NOT NULL,
  thread_external_id varchar(255),
  parent_external_id varchar(255),
  author_name        varchar(255),
  author_handle      varchar(255),
  author_avatar_url  text,
  text               text,
  rating             int,
  permalink          text,
  status             varchar(20)  NOT NULL DEFAULT 'open',
  received_at        timestamptz  NOT NULL,
  replied_at         timestamptz,
  handled_by_id      uuid,
  metadata           jsonb        NOT NULL DEFAULT '{}',
  created_at         timestamptz  NOT NULL DEFAULT now(),
  updated_at         timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT social_inbox_items_rating_range CHECK (rating IS NULL OR rating BETWEEN 1 AND 5)
);

-- Idempotent sync: re-polling a destination never duplicates a comment.
CREATE UNIQUE INDEX social_inbox_items_target_external_unique
  ON social_inbox_items (social_target_id, external_id);
CREATE INDEX ON social_inbox_items (tenant_id, status, received_at);
CREATE INDEX ON social_inbox_items (tenant_id, property_id);
CREATE INDEX ON social_inbox_items (thread_external_id);

ALTER TABLE social_inbox_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_inbox_items FORCE  ROW LEVEL SECURITY;
CREATE POLICY social_inbox_items_tenant_isolation ON social_inbox_items
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- ── Cross-tenant drain functions ─────────────────────────────────────────────────
-- All four mirror find_due_social_posts: SECURITY DEFINER, owned by sparx_owner,
-- narrow projection, EXECUTE granted only to sparx_app.

-- Connections due a health check: never checked, or checked longer ago than the
-- interval, or already inside the refresh window ahead of token expiry. Ordered so a
-- grant about to die is looked at before one merely stale.
CREATE OR REPLACE FUNCTION find_due_social_connections(
  p_limit int DEFAULT 100,
  p_stale_minutes int DEFAULT 360,
  p_expiry_window_minutes int DEFAULT 4320
)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  platform text,
  token_expires_at timestamptz,
  health_checked_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT id, tenant_id, platform::text, token_expires_at, health_checked_at
  FROM social_connections
  WHERE status = 'active'
    AND (
      health_checked_at IS NULL
      OR health_checked_at <= NOW() - make_interval(mins => p_stale_minutes)
      OR (
        token_expires_at IS NOT NULL
        AND token_expires_at <= NOW() + make_interval(mins => p_expiry_window_minutes)
      )
    )
  ORDER BY token_expires_at ASC NULLS LAST, health_checked_at ASC NULLS FIRST
  LIMIT p_limit;
$$;

REVOKE EXECUTE ON FUNCTION find_due_social_connections(int, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_due_social_connections(int, int, int) TO sparx_app;

COMMENT ON FUNCTION find_due_social_connections IS
  'Active social connections needing a health check — never checked, stale, or nearing token expiry. SECURITY DEFINER so the worker sweep can scan across tenants without sparx_app holding RLS bypass.';

-- Destinations whose fan-out row carries its OWN send time and has come due. The
-- parent-post drain (find_due_social_posts) does not see these: the post itself may
-- already be `publishing` or `partially_published` while one destination waits for
-- its later hour.
CREATE OR REPLACE FUNCTION find_due_social_post_targets(p_limit int DEFAULT 100)
RETURNS TABLE(
  id uuid,
  post_id uuid,
  tenant_id uuid,
  scheduled_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT t.id, t.post_id, t.tenant_id, t.scheduled_at
  FROM social_post_targets t
  JOIN social_posts p ON p.id = t.post_id
  WHERE t.status = 'pending'
    AND t.scheduled_at IS NOT NULL
    AND t.scheduled_at <= NOW()
    -- Only once the post itself has cleared approval. A pending_approval post's
    -- destinations must never fire on their own clock.
    AND p.status IN ('scheduled', 'publishing', 'partially_published', 'published')
  ORDER BY t.scheduled_at ASC
  LIMIT p_limit;
$$;

REVOKE EXECUTE ON FUNCTION find_due_social_post_targets(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_due_social_post_targets(int) TO sparx_app;

COMMENT ON FUNCTION find_due_social_post_targets IS
  'Fan-out rows with their own scheduled_at that has come due, on posts past the approval gate. Mirrors find_due_social_posts for per-destination scheduling.';

-- Published destinations whose numbers are worth re-reading. A post''s engagement
-- climbs for days then flattens, so the cadence decays with age: hourly for the first
-- day, every six hours to a week, daily to 30 days, then never again.
CREATE OR REPLACE FUNCTION find_due_social_metric_targets(p_limit int DEFAULT 100)
RETURNS TABLE(
  id uuid,
  post_id uuid,
  tenant_id uuid,
  published_at timestamptz,
  last_collected_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT t.id, t.post_id, t.tenant_id, t.published_at, m.last_collected_at
  FROM social_post_targets t
  LEFT JOIN LATERAL (
    SELECT MAX(collected_at) AS last_collected_at
    FROM social_post_metrics
    WHERE post_target_id = t.id
  ) m ON true
  WHERE t.status = 'published'
    AND t.published_at IS NOT NULL
    AND t.published_at >= NOW() - interval '30 days'
    AND (
      m.last_collected_at IS NULL
      OR m.last_collected_at <= NOW() - (
        CASE
          WHEN t.published_at >= NOW() - interval '1 day'  THEN interval '1 hour'
          WHEN t.published_at >= NOW() - interval '7 days' THEN interval '6 hours'
          ELSE interval '1 day'
        END
      )
    )
  ORDER BY t.published_at DESC
  LIMIT p_limit;
$$;

REVOKE EXECUTE ON FUNCTION find_due_social_metric_targets(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_due_social_metric_targets(int) TO sparx_app;

COMMENT ON FUNCTION find_due_social_metric_targets IS
  'Published fan-out rows due a metrics re-read, on a cadence that decays with post age (hourly < 1d, 6h < 7d, daily < 30d). Replaces collect-on-publish-only.';

-- Destinations due an engagement-inbox poll.
CREATE OR REPLACE FUNCTION find_due_social_inbox_targets(
  p_limit int DEFAULT 100,
  p_stale_minutes int DEFAULT 15
)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  connection_id uuid,
  platform text,
  inbox_synced_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT t.id, t.tenant_id, t.connection_id, t.platform::text, t.inbox_synced_at
  FROM social_targets t
  JOIN social_connections c ON c.id = t.connection_id
  WHERE t.enabled = true
    AND c.status = 'active'
    AND (
      t.inbox_synced_at IS NULL
      OR t.inbox_synced_at <= NOW() - make_interval(mins => p_stale_minutes)
    )
  ORDER BY t.inbox_synced_at ASC NULLS FIRST
  LIMIT p_limit;
$$;

REVOKE EXECUTE ON FUNCTION find_due_social_inbox_targets(int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_due_social_inbox_targets(int, int) TO sparx_app;

COMMENT ON FUNCTION find_due_social_inbox_targets IS
  'Enabled destinations on active connections due an engagement-inbox poll. SECURITY DEFINER so the worker sweep can scan across tenants.';

-- Slots the evergreen filler may claim. Cheap and small (a tenant has a handful), so
-- there is no due-ness filter here: the filler resolves each slot's next local instant
-- itself — a recurring wall-clock time is not something SQL should be computing across
-- timezones.
CREATE OR REPLACE FUNCTION find_social_autofill_slots(p_limit int DEFAULT 500)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  property_id uuid,
  weekday int,
  minute_of_day int,
  timezone text,
  target_ids uuid[]
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT id, tenant_id, property_id, weekday, minute_of_day, timezone::text, target_ids
  FROM social_posting_slots
  WHERE enabled = true
    AND auto_fill = true
    AND array_length(target_ids, 1) > 0
  ORDER BY tenant_id, weekday, minute_of_day
  LIMIT p_limit;
$$;

REVOKE EXECUTE ON FUNCTION find_social_autofill_slots(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_social_autofill_slots(int) TO sparx_app;

COMMENT ON FUNCTION find_social_autofill_slots IS
  'Enabled auto-fill posting slots with at least one destination, across tenants. The caller resolves each slot''s next local instant (DST-correct wall-clock maths does not belong in SQL).';
