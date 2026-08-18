---
title: The marketplace is one shelf, and sparx publishes itself onto it
node: architecture
type: decision
status: active
applies-to: [n/a]
sources:
  - wizeworks/services/api-rest/src/lib/marketplace/self-register.ts
  - wizeworks/services/api-rest/src/lib/marketplace/blueprint-bundles.ts
  - wizeworks/services/api-rest/src/lib/marketplace/resolve.ts
  - marketplace-catalog/blueprints/
---

**The marketplace is ONE shelf with MANY publishers, and sparx is a publisher like
any other.** Every listing — theme, component, blueprint, integration — is a row in the
same table, owned by a `MarketplacePublisher`, told apart from a licensed
collaborator's only by which publisher wrote it. There is no first-party table, no
first-party code path, and no first-party resolver.

The single thing that IS special about sparx: **its source ships inside the image, so
it publishes itself at runtime.** `selfRegisterFirstPartyCatalog()` runs on every
api-rest boot, after `listen()` and non-fatal, and does three things:

1. **Publishes** — upsert by slug, from the shipped source.
2. **Stages bytes** — a blueprint's manifest and card imagery go to object storage
   (the same storage an upload writes to); themes and components carry their whole
   payload in the row, which is why they need none.
3. **Retracts by absence** — what sparx no longer ships, sparx no longer lists,
   scoped to `publisherId` so a collaborator's listing is never touched.

**ALL FOUR CATEGORIES, including integrations, which have no upload story yet.** That
is the point rather than an oversight: this is the only thing that writes a first-party
listing, so there is no second mechanism for the next person to find or copy. A category
left on a seed loop reads as "this one is different" precisely when someone is deciding
how uploads should work.

**Why:** publishing used to be a **release stage** (an ingest Job) plus a **seed loop**
plus **code**, three mechanisms for one job, and the stage failed in four distinct
ways that a boot-time publish answers structurally.

| the ingest was…                            | consequence                                                                     | answered by                                              |
| ------------------------------------------ | -------------------------------------------------------------------------------- | -------------------------------------------------------- |
| a **release stage**, wired to one cloud    | `marketplace_themes` held 0 rows on both clouds for a month against 20 committed bundles | runs at boot, on whatever cluster the image is on         |
| a **second code path**                     | bundles validated and stored by machinery no upload would ever exercise           | writes the same rows an upload writes                     |
| **add-only** (upsert, never prune)         | 25 of production's 96 component listings were retired or orphaned rows            | prune by absence, scoped to the publisher                 |
| mounting the media volume **separately from the service** | a missing mount wrote every object to its own container filesystem and exited 0 | the process that writes the media is the one that serves it |

**Source vs. served bytes** is the distinction that makes this work. The authored
bundle is SOURCE and ships in the image — that is what lets the service publish with
no deploy step. The bytes a browser fetches come from **object storage**. If
first-party media were served off the filesystem, sparx and a partner would resolve
through two different paths and only one would get exercised day to day.

**How to apply:**

- Adding a blueprint is adding `marketplace-catalog/blueprints/<slug>/`. **Removing one
  is deleting that directory** — there is no purge task, and there must not be one.
- Never add a deploy stage, workflow, or seed loop that publishes catalog content. If
  it can be skipped, it will be.
- Bump `version` in **both** `sparx.json` and the payload; they are cross-checked and a
  mismatch fails the load rather than pointing the row at the wrong artifact.
- Resolve a blueprint manifest through `resolveBlueprintManifest` only. It is
  publisher-blind by construction, so the path an upload will take is the path that
  runs every day.
- Integration listings are **authored copy, not derived** from the provider registry —
  `ProviderMetadataDescriptor` has no `tagline`/`accent`/`sortWeight`, and the registry
  is populated by import side effect that api-rest never triggers, so `listProviders()`
  is empty there. Known drift: `stripe` is listed with no `@sparx/provider-stripe`
  package behind it.
- Bundle loading is **all-or-nothing**: one bad bundle aborts the whole publish, because
  a bundle that failed to load is indistinguishable from one that was withdrawn, and a
  tolerant pass would retract a listing for a blueprint that is merely broken.
  `blueprint-bundles.test.ts` is what pays for that safety — the failure lands on a PR
  instead of on a booting pod.

Related: [[deploy-workflows]], [[data-is-a-deploy-stage]], [[rls-multi-tenancy]]
