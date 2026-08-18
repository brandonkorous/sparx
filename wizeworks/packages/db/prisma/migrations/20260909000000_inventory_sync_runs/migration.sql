-- Inventory sync hardening (docs/100 P5 Tier C): record every feed ingest and
-- queue the SKUs a feed reports that we can't map yet.
--
--  • inventory_sync_runs   — one row per CSV pull / external push / scheduled poll,
--    with full bookkeeping (matched / changed / unchanged / unmatched / skipped) so
--    the dashboard sync-health panel can show what each sync did. Append-only.
--  • inventory_unmapped_skus — the tenant-facing review queue: an external SKU that
--    resolved to no inventory_source_link. The tenant maps it to a (variant,
--    warehouse) — which mints a link and deletes the row — or ignores it.
--
-- Both are tenant-scoped: FORCE RLS with the canonical
-- `tenant_id = current_tenant_id()` policy; a CHECK pins each status vocabulary.

-- ── Sync runs ───────────────────────────────────────────────────────────────────
CREATE TABLE inventory_sync_runs (
  id             uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id      uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_id      uuid        NOT NULL REFERENCES inventory_sources(id) ON DELETE CASCADE,
  trigger        varchar(20) NOT NULL,
  status         varchar(20) NOT NULL,
  rows_total     int         NOT NULL DEFAULT 0,
  rows_matched   int         NOT NULL DEFAULT 0,
  rows_changed   int         NOT NULL DEFAULT 0,
  rows_unchanged int         NOT NULL DEFAULT 0,
  rows_unmatched int         NOT NULL DEFAULT 0,
  rows_skipped   int         NOT NULL DEFAULT 0,
  error          text,
  started_at     timestamptz NOT NULL DEFAULT now(),
  finished_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_sync_runs_trigger_check
    CHECK (trigger IN ('manual', 'scheduled', 'push', 'api')),
  CONSTRAINT inventory_sync_runs_status_check
    CHECK (status IN ('success', 'partial', 'error'))
);

CREATE INDEX ON inventory_sync_runs (tenant_id, source_id, started_at);

ALTER TABLE inventory_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_sync_runs FORCE  ROW LEVEL SECURITY;
CREATE POLICY inventory_sync_runs_tenant_isolation ON inventory_sync_runs
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- ── Unmapped-SKU review queue ─────────────────────────────────────────────────────
CREATE TABLE inventory_unmapped_skus (
  id                uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id         uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_id         uuid        NOT NULL REFERENCES inventory_sources(id) ON DELETE CASCADE,
  external_sku      varchar(255) NOT NULL,
  external_location varchar(255),
  last_quantity     int         NOT NULL,
  seen_count        int         NOT NULL DEFAULT 1,
  status            varchar(20) NOT NULL DEFAULT 'pending',
  first_seen_at     timestamptz NOT NULL DEFAULT now(),
  last_seen_at      timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_unmapped_sku_unique
    UNIQUE (tenant_id, source_id, external_sku, external_location),
  CONSTRAINT inventory_unmapped_skus_status_check
    CHECK (status IN ('pending', 'ignored'))
);

CREATE INDEX ON inventory_unmapped_skus (tenant_id, source_id, status);

ALTER TABLE inventory_unmapped_skus ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_unmapped_skus FORCE  ROW LEVEL SECURITY;
CREATE POLICY inventory_unmapped_skus_tenant_isolation ON inventory_unmapped_skus
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());
