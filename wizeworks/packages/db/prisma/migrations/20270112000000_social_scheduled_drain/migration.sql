-- Social scheduled-drain helper (docs/133 §7, docs/134 Slice 5).
--
-- The social scheduled-publish tick in services/api-rest runs as `sparx_app`,
-- which is FORCE RLS-bound. To find posts that have passed their `scheduled_at`
-- across ALL tenants without granting the app role wholesale RLS bypass, we
-- expose a SECURITY DEFINER function — the exact pattern as
-- `find_due_scheduled_entries` (migration 20260601100000) for content publishes.
-- The function is OWNED BY sparx_owner (the migration role) and EXECUTEs under
-- that role at call time, so the SELECT inside it bypasses RLS — but only the
-- column subset declared in the RETURNS clause makes it back to the caller. The
-- per-post UPDATE the tick then runs still rides `withTenant({tenantId})`, so the
-- write goes through the standard tenant_isolation policy.

CREATE OR REPLACE FUNCTION find_due_social_posts(p_limit int DEFAULT 100)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  scheduled_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT id, tenant_id, scheduled_at
  FROM social_posts
  WHERE status = 'scheduled'
    AND scheduled_at IS NOT NULL
    AND scheduled_at <= NOW()
  ORDER BY scheduled_at ASC
  LIMIT p_limit;
$$;

-- Revoke from PUBLIC so only explicitly-granted roles can call it.
REVOKE EXECUTE ON FUNCTION find_due_social_posts(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_due_social_posts(int) TO sparx_app;

COMMENT ON FUNCTION find_due_social_posts IS
  'Returns up to p_limit social posts with status=scheduled whose scheduled_at <= NOW(). Runs as SECURITY DEFINER (sparx_owner) so the api-rest tick can scan across tenants without sparx_app having RLS bypass. Mirrors find_due_scheduled_entries.';
