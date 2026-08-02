# marketplace-catalog — sparx's own blueprint bundles

This tree holds the **source** for sparx's first-party blueprints, authored to the
[`marketplace-templates/`](../marketplace-templates/) contract — the same contract a
licensed collaborator's upload will take (docs/85 §14).

> **Authoring a blueprint?** Read the end-to-end guide first:
> [`docs/guides/building-a-template.md`](../docs/guides/building-a-template.md). It
> walks the full path — manifest → trees → theme → media → publish → install — and
> how to turn a design mockup into a working template. Add a new one as
> `blueprints/<slug>/` per the guide.

```
marketplace-catalog/
  blueprints/<slug>/     sparx.json + blueprint.ts + media/{icon,preview}.png
```

## Source here, bytes in storage

Nothing in this tree is served to a browser. It is the **authored source**, and it
ships inside the api-rest image so the service can publish itself:

```
marketplace-catalog/blueprints/<slug>/     ← SOURCE (git, and the image)
        │
        │  api-rest boot — selfRegisterFirstPartyCatalog()
        ▼
  object storage   marketplace/blueprints/<slug>/<version>.json    ← the artifact
                   marketplace/media/blueprints/<slug>/*.png       ← the card imagery
  marketplace_blueprints row                                       ← the thin index
```

Keeping those apart is the point. A collaborator will never have anything in our
image, so if first-party listings were served off the filesystem, sparx and a partner
would resolve through two different code paths and only one of them would get
exercised day to day. Instead every blueprint — ours or theirs — is a row pointing at
storage, read back by one publisher-blind resolver.

No payload is ever written to a SQL column, and no compiled artifact is committed to
git.

## Publishing

**You don't.** api-rest publishes this catalog on every boot, so a bundle reaches
every environment by being in the image. There is no deploy step to remember, no
workflow to trigger, and no cluster that can be behind.

**Retracting is deleting.** Publishing retracts by _absence_ — what sparx no longer
ships, sparx no longer lists — so removing a bundle directory removes its listing on
the next boot. (The `marketplace-purge-*` ops tasks that were once the only way to
unlist anything are gone. They were built and never run, which is how production came
to serve 25 dead listings.)

On demand, against docker Postgres or to re-assert the shelf without a restart:

```bash
pnpm --filter @sparx/api-rest marketplace:self-register
```

Idempotent. The artifact is immutable per version so it is written once; media is
rewritten only when its byte length differs; the steady state writes nothing at all.
Bump `version` in **both** `sparx.json` and the payload to publish an update — the two
are cross-checked, and a mismatch fails the load rather than pointing the row at the
wrong artifact.

## Why blueprints are bundles and themes/components are not

`themes/` and `components/` used to live here. They were deleted on 2026-08-02 and are
not coming back: both are authored in code (`FIRST_PARTY_THEMES` /
`FIRST_PARTY_COMPONENTS` in `@sparx/silica-catalog`), so a bundle was a _copy_ of code
that had to be re-published per cluster to stay true — and because the old ingest
upserted and never pruned, a bundle deleted from the repo left its row serving forever.
Production carried 96 component listings of which 25 were exactly that debris.

A blueprint stays a bundle because its payload is too large for a row (a captured site
manifest, ~150 KB) and it ships **binary card imagery**, which a TS module cannot carry.
That is a difference in payload, not in process — all three categories are published by
the same function into the same tables.

It is **not** version history. The `Update` merge ancestor lives in
`tenant_blueprint_install_artifacts` on the tenant's side, and every read here resolves
the current version.
