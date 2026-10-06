# 040 — Owner changes took up to five minutes to reach the live site

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 2
**Surface:** tenant site cache; event-worker; every console save that changes what the site shows
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** worker side against a recording endpoint with the real Gillett tenant: `site.updated` POSTed `{"tenant":"gillettdiesel"}` with the secret; `product.updated` added `"scopes":["commerce"]`; `order.paid` sent nothing. End to end, after the restart: changed the cookie banner title on Legal pages and saved; the live homepage carried "Cookies at Gillett Diesel" 3 s later (68 s before the fix). Publishing his homepage reached the live site in 10 s
**Blocked on:** —

## What happened

Doty saved his cookie banner; the live site showed it 68 seconds later. His theme,
his policy links and his footer took a while too, with nothing on screen saying
so. The site caches the business details for 300 s, and the only thing that
cleared that cache, `cache-revalidation-worker`, was a Cloud Run service that was
never deployed (`terraform/envs/prod/main.tf` said so). No owner save published
an event it would map, and `SPARX_REVALIDATE_SECRET` was set nowhere, so the
site's purge route answered 503 anyway. The handler's own comment described the
worst case: a site that went dark for non-payment stays dark for minutes after
the owner pays.

## The fix (built by a helper agent, reviewed here)

- The handler is now a fleet package, `wizeworks/packages/cache-revalidation-worker`
  (`createSubscription`, durable `cache-revalidation-worker`), registered in
  `event-worker`. It subscribes to 37 named events (no prefixes, so pick lists and
  late purchase orders do not purge the catalog). 19 tests; proved red.
- New event `site.updated` (`events/src/types.ts`, event catalog, terraform topic),
  published best-effort after commit by every save that changes what the site
  shows: cookie banner, site identity (and make-primary / delete), brand, commerce
  site settings and theme, saved-theme apply, logo/favicon, legal footer links,
  blueprint update / uninstall, payment presets and gateway changes. Not
  `tenant.updated`, which would re-sync the tenant into sparx's own CRM each time.
- Secret wiring: `k8s/apps/site.yaml` (optional key), event-worker URL
  `http://site.sparx-prod.svc.cluster.local:3000/api/revalidate`,
  `.github/workflows/release.yml` creates the secret on first release (or keeps
  the live one). Local `.env` files for the site and event-worker now carry a
  dev value.
- The old Cloud Run service directory is removed (nothing referenced it).
  `pnpm-lock.yaml` edited to the minimal change; `--frozen-lockfile` passes.

Checks (agent): tsc 0 for the package, events, event-worker, api-rest; eslint and
prettier 0; api-rest `CI=true` 281/281; `check:events`, `check:worker-events`,
`check:docker`, `check:routes`, `check:service-env`, `check:broker-topics`,
`check:webhooks`, `check:deletability`, `check:boundaries` and more, all 0.

## Seen, not settled

- The site's edge check for suspended sites (`lib/dark-at-the-edge.ts`) keeps its
  own 10-minute cache per host, which this purge does not clear.
- Moving a review from approved to rejected publishes no event.

## Rating effect

—
