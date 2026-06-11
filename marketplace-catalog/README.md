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
