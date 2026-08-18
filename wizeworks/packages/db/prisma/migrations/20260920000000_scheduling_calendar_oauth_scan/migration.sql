-- ─────────────────────────────────────────────────────────────────────────
-- Layer-3 OAuth calendar sync (docs/79 §8.3): broaden the due-connection scan to
-- also surface `oauth` connections, so the in-process calendar-sync tick can RENEW
-- their push channels and run a safety-net incremental poll.
--
-- OAuth connections are push-driven (Google watch / Graph subscription) + synced
-- inline on connect, so they intentionally were NOT in the original scan
-- (20260917000000). But push channels expire (Google ~7d, Graph ~3d) and a webhook
-- can be missed, so the tick needs to find oauth rows that:
--   · never synced            (last_synced_at IS NULL — initial / push couldn't register)
--   · have no push channel     (channel_id IS NULL — poll fallback, e.g. non-public host)
--   · have a channel expiring   (channel_expires_at within ~1 day — re-register)
--   · are simply stale          (a ≥30-min safety-net incremental even with push live)
--
-- CREATE OR REPLACE keeps the SAME signature + RETURNS TABLE, so the existing tick
-- query (SELECT … FROM find_due_calendar_connections(…)) is unchanged; only the WHERE
-- broadens. Until this migration is applied, oauth rows simply don't surface (the
-- old function still works) — push + inline-connect sync are unaffected.
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
    AND (
      -- Layer-2 polling kinds: stale beyond p_stale_seconds (or never synced).
      (connection_kind IN ('ical_feed', 'caldav')
        AND (last_synced_at IS NULL OR last_synced_at <= NOW() - make_interval(secs => p_stale_seconds)))
      OR
      -- Layer-3 oauth: initial sync, missing channel, channel renewal due, or the
      -- ≥30-min safety-net poll (push handles the rest in near-real-time).
      (connection_kind = 'oauth'
        AND (
          last_synced_at IS NULL
          OR channel_id IS NULL
          OR (channel_expires_at IS NOT NULL AND channel_expires_at <= NOW() + interval '1 day')
          OR last_synced_at <= NOW() - make_interval(secs => GREATEST(p_stale_seconds, 1800))
        ))
    )
  ORDER BY last_synced_at ASC NULLS FIRST
  LIMIT p_limit;
$$;

REVOKE EXECUTE ON FUNCTION find_due_calendar_connections(int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_due_calendar_connections(int, int) TO sparx_app;

COMMENT ON FUNCTION find_due_calendar_connections IS
  'Returns up to p_limit active calendar connections due for sync: ical_feed/caldav polls stale beyond p_stale_seconds, plus oauth connections needing initial sync, a push channel, channel renewal (<1 day left), or a ≥30-min safety-net poll. SECURITY DEFINER (sparx_owner) so the calendar-sync tick scans across tenants without sparx_app having RLS bypass.';
