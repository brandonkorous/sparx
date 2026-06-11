# marketplace-catalog — Sparx first-party bundles (dogfood)

This tree holds Sparx's own marketplace items, authored to the
[`marketplace-templates/`](../marketplace-templates/) contract and ingested through
the **same** pipeline a third party will use (docs/85 §14). One folder per item:

```
marketplace-catalog/
  themes/<slug>/        sparx.json + theme.ts      + media/{icon,preview}.png
  components/<slug>/     sparx.json + component.tsx  + media/{icon,preview}.png
  blueprints/<slug>/     sparx.json + blueprint.ts   + media/{icon,preview}.png
  integrations/<slug>/   sparx.json + integration.ts + media/{icon,preview}.png
```

These are **source**, not artifacts. The ingest
([`services/api-rest/src/lib/marketplace/ingest.ts`](../services/api-rest/src/lib/marketplace/ingest.ts))
compiles each payload to a JSON **artifact written to object storage**
(`marketplace/<category>/<slug>/<version>.json` — GCS in prod, local-fs in dev) and
upserts a **thin catalog row**. No payload is ever written to a SQL column, and no
compiled artifact is committed to git.

Run it:

```bash
pnpm --filter @sparx/api-rest marketplace:ingest
```

Idempotent: re-running the same `version` is a no-op write (the artifact is
immutable); bump the `version` in `sparx.json` to publish an update.

## Running in prod (the follow-up that lights up the catalog)

Pushing the bundles to `main` ships the **sources**; prod object storage + the
catalog rows stay empty until the ingest runs **with the prod env** (GCS bucket +
Cloud SQL). The runtime already reads from storage, so the moment the prod ingest
runs, all items appear in the marketplace browse (the dashboard `/marketplace` and
`/v1/blueprints` are DB-first).

The prod ingest is the same `marketplace:ingest` script run in-cluster — it needs
(a) the `marketplace-catalog/` bundles and (b) the app env (`GCS_MEDIA_BUCKET`,
`MEDIA_PUBLIC_URL`, `DATABASE_URL` via the Cloud SQL Auth Proxy). The intended
mechanism, mirroring the DB seed (see [packages/db/CLAUDE.md](../packages/db/CLAUDE.md)):
a K8s Job from the api-rest image (which must `COPY marketplace-catalog/`) with the
Auth Proxy sidecar + the app SA (GCS write), triggered by a workflow flag
(e.g. `db-migrate.yml -f run_marketplace_ingest=true`). Until that's wired, the
items are authored, validated, and committed — ready to ingest.
