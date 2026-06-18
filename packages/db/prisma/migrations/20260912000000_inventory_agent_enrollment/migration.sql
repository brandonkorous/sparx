-- Tier A on-prem bridge enrollment (docs/100 P5d, docs/28 §3).
--
-- An `agent` inventory source is fed by an outbound-HTTPS bridge the tenant
-- installs on their network. Pairing mints a tenant-scoped API key the agent
-- authenticates with; we keep a reference (id + visible prefix) so the connection
-- can show "paired" and rotate/revoke it. `agent_last_seen_at` is bumped on every
-- push AND every heartbeat → it drives the online/offline indicator.
--
-- Pure additive ALTERs — no backfill, no RLS change (inventory_sources is already
-- ENABLE+FORCE RLS with its tenant_isolation policy).

ALTER TABLE inventory_sources
  ADD COLUMN api_key_id         uuid,
  ADD COLUMN api_key_prefix     varchar(16),
  ADD COLUMN enrolled_at        timestamptz,
  ADD COLUMN agent_last_seen_at timestamptz,
  ADD COLUMN agent_version      varchar(50);
