-- Web-vitals capture on the first-party site-analytics events (docs/97 §4/§5).
--
-- Real-user performance (load time, LCP, CLS) is captured by the storefront
-- beacon as type='vital' rows on the existing site_analytics_events table —
-- one row per metric, carrying the metric name + its value (milliseconds for
-- timing metrics, unitless for CLS). The Builder overview reads AVG(value) per
-- metric over the window for its "Avg. load time" KPI.
--
-- Additive, nullable columns only — pageview/signup rows leave them NULL. No new
-- index: the vitals aggregate filters property_id + a time window (covered by the
-- existing (tenant_id, property_id, created_at) index) and type='vital' is a
-- minority of rows, filtered in-scan. RLS already applies to the table.

ALTER TABLE "site_analytics_events" ADD COLUMN "metric" VARCHAR(16);
ALTER TABLE "site_analytics_events" ADD COLUMN "value" DOUBLE PRECISION;
