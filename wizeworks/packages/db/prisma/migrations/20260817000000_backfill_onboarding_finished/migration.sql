-- Backfill: mark EXISTING tenants as having finished onboarding.
--
-- The auth-pages redesign adds a mandatory-onboarding guard: any tenant whose
-- `settings.onboarding.finishedAt` is null is routed into the setup wizard
-- before it can reach the dashboard. That is correct for brand-new signups, but
-- existing tenants (already set up, with real sites/data) must NOT be force-
-- routed back through onboarding. This stamps a finishedAt on every tenant that
-- doesn't already have one, so the guard only ever catches fresh signups.
--
-- `tenants` is the RLS-EXEMPT dispatch table (see routes/v1/tenant.ts), so a
-- plain UPDATE touches every row — no per-tenant `set_config` loop is needed
-- (that footgun only applies to FORCE-RLS tables). `settings` is jsonb.
--
-- Idempotent: the WHERE clause only fills a missing/empty finishedAt, and the
-- jsonb merge preserves every other settings key and onboarding field.

UPDATE "tenants"
SET "settings" = COALESCE("settings", '{}'::jsonb)
  || jsonb_build_object(
       'onboarding',
       COALESCE("settings" -> 'onboarding', '{}'::jsonb)
         || jsonb_build_object(
              'finishedAt',
              to_jsonb(to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
            )
     )
WHERE COALESCE("settings" -> 'onboarding' ->> 'finishedAt', '') = '';
