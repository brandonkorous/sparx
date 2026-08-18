-- ─────────────────────────────────────────────────────────────────────────
-- Calendar sync (docs/79 §8) credential storage + the inbound-sync scan.
--
-- The original scheduling migration shipped `*_ref` VARCHAR(255) columns that
-- assumed Google Secret Manager would hold calendar credentials. That can't work
-- for OAuth tokens that are MINTED + REFRESHED at runtime (GSM provisioning is
-- out-of-band, read-only here), so calendar credentials follow the established
-- Search Console pattern instead: AES-256-GCM ciphertext at rest in the DB
-- (key SCHEDULING_CALENDAR_TOKEN_KEY), never plaintext (docs/79 §8.4, §19).
--
-- The CalendarConnection / ExternalBusyBlock tables are brand-new + unused (the
-- feature isn't built yet), so the *_ref columns carry no data — dropping them is
-- safe. RLS (ENABLE + FORCE + tenant_isolation) from 20260915000000 is unchanged;
-- the new columns inherit it.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE scheduling_calendar_connections
  DROP COLUMN IF EXISTS oauth_client_ref,
  DROP COLUMN IF EXISTS credentials_ref,
  DROP COLUMN IF EXISTS ical_url_ref,
  ADD COLUMN ical_url_enc TEXT,
  ADD COLUMN access_token_enc TEXT,
  ADD COLUMN refresh_token_enc TEXT,
  ADD COLUMN token_expires_at TIMESTAMPTZ,
  ADD COLUMN app_password_enc TEXT,
  ADD COLUMN caldav_username VARCHAR(255),
  ADD COLUMN caldav_url VARCHAR(2048),
  ADD COLUMN oauth_client_id VARCHAR(512),
  ADD COLUMN oauth_client_secret_enc TEXT;

-- ─────────────────────────────────────────────────────────────────────────
-- find_due_calendar_connections(int) — SECURITY DEFINER cross-tenant scan so the
-- in-process api-rest calendar-sync tick (sparx_app, FORCE RLS-bound) can find
-- connections due for a refresh across tenants WITHOUT sparx_app gaining RLS
-- bypass. Mirrors find_due_booking_notifications (20260916000000).
--
-- "Due" = an active, non-realtime connection (ical_feed / caldav poll) whose last
-- sync is older than p_stale_seconds, or which has never synced. The per-row sync
-- work runs back under withTenant({tenantId}) so its UPDATE still passes
-- tenant_isolation — only this read scan is cross-tenant.
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION find_due_calendar_connections(
  p_stale_seconds int DEFAULT 900,
  p_limit int DEFAULT 100
)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  resource_id uuid,
  provider varchar,
  connection_kind varchar
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT id, tenant_id, resource_id, provider, connection_kind
  FROM scheduling_calendar_connections
  WHERE status = 'active'
    AND connection_kind IN ('ical_feed', 'caldav')
    AND (last_synced_at IS NULL OR last_synced_at <= NOW() - make_interval(secs => p_stale_seconds))
  ORDER BY last_synced_at ASC NULLS FIRST
  LIMIT p_limit;
$$;

REVOKE EXECUTE ON FUNCTION find_due_calendar_connections(int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_due_calendar_connections(int, int) TO sparx_app;

COMMENT ON FUNCTION find_due_calendar_connections IS
  'Returns up to p_limit active polling calendar connections (ical_feed/caldav) whose last_synced_at is older than p_stale_seconds (or null). SECURITY DEFINER (sparx_owner) so the calendar-sync tick scans across tenants without sparx_app having RLS bypass.';
