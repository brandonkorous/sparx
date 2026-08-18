-- Social post performance snapshots (docs/133 §4 getMetrics seam +
-- docs/implementation/social.md "Measure"). One row per (post target, collection) —
-- a time series, filled by the social-worker on a social.metrics.collect event.
-- Every metric is NULLABLE: a platform that can't report reach/impressions leaves
-- them null rather than a misleading zero.

CREATE TABLE social_post_metrics (
  id             uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id      uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  post_id        uuid        NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  post_target_id uuid        NOT NULL REFERENCES social_post_targets(id) ON DELETE CASCADE,
  platform       varchar(40) NOT NULL,
  likes          int,
  comments       int,
  shares         int,
  impressions    int,
  reach          int,
  collected_at   timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON social_post_metrics (tenant_id, post_id);
CREATE INDEX ON social_post_metrics (post_target_id, collected_at);

ALTER TABLE social_post_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_post_metrics FORCE  ROW LEVEL SECURITY;
CREATE POLICY social_post_metrics_tenant_isolation ON social_post_metrics
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());
