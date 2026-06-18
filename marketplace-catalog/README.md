# marketplace-catalog — sparx first-party bundles (dogfood)

This tree holds sparx's own marketplace items, authored to the
[`marketplace-templates/`](../marketplace-templates/) contract and ingested through
the **same** pipeline a third party will use (docs/85 §14). One folder per item:

> **Authoring a blueprint?** Read the end-to-end guide first:
> [`docs/guides/building-a-template.md`](../docs/guides/building-a-template.md). It
> walks the full path — manifest → trees → theme → media → ingest → install — and
> how to turn a design mockup into a working template. `blueprints/` ships only
> hand-authored bundles now (the earlier demo set + its scratch generator were
> removed); add a new one as `blueprints/<slug>/` per the guide.

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

The prod ingest is the same `marketplace:ingest` script run in-cluster, wired as a
dedicated manual workflow:

```bash
gh workflow run marketplace-ingest.yml
```

It ([.github/workflows/marketplace-ingest.yml](../.github/workflows/marketplace-ingest.yml))
builds the api-rest image with these bundles baked in (the Dockerfile `COPY
marketplace-catalog`), pushes it under a distinct `marketplace-ingest-<sha>` tag
(never clobbering the deployed `:latest`), then applies a one-off Job
([k8s/sparx-prod/marketplace-ingest-job.yaml](../k8s/sparx-prod/marketplace-ingest-job.yaml)).

No Cloud SQL Auth Proxy sidecar is needed: the Job runs as the `sparx-app` workload
SA and hydrates from the same `sparx-app-env` + `sparx-app-secrets` the live api-rest
pods use — so it gets `DATABASE_URL` (in-cluster PgBouncer) **and** `GCS_MEDIA_BUCKET`
/ `MEDIA_PUBLIC_URL`, writing artifacts + media to the same object storage the runtime
reads from. The runtime is already DB-first, so the moment the Job completes every
item appears in the dashboard `/marketplace` and `/v1/blueprints`.
