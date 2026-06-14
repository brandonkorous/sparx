# Creator Marketplace — submissions, the declarative contract, and the no-deploy runtime

**Version:** 0.2.0
**Author:** Brandon Korous
**Last Updated:** 2026-06-10

---

> **Architecture locked — 2026-06-10 (do not re-litigate).** Every compiled artifact
> (theme tokens, component node-tree, blueprint manifest, connector spec) is stored as
> an **immutable, versioned object in storage** — **never** in a SQL column. The catalog
> row is a **thin index**: identity + the filterable facets + media URLs + the artifact's
> (derived) storage key. Browse — the hot path — reads only the thin row; apply/install —
> the cold path — does one storage read. `.ts`/`.tsx` is **authoring only**: it is compiled
> to JSON server-side and is never stored or executed live; the raw bundle is archived to
> storage for re-scan/audit. Storage is the **existing** `MediaStorage` abstraction
> (`getStorage()` → local filesystem in dev, GCS in prod —
> [`services/api-rest/src/lib/storage.ts`](../services/api-rest/src/lib/storage.ts)), not a
> new system. Full rationale and the storage vs. DB call are in **§6**.

## 1. Purpose & relationship to other docs

[docs/60](60-marketplace.md) defines the **catalog** — the categorized browse/detail
surface for Blueprints, Themes, Components, and Integrations, backed by four tables
behind a uniform adapter. This doc defines the layer that makes that catalog a real
**creator marketplace**: how anyone (Sparx first, third parties next) **submits** an
item, how it is **reviewed**, where its artifact is **stored**, how the runtime
**applies/installs it with no deploy**, and how creators eventually **get paid**.

It builds directly on decisions already made:

- **Blueprints** are a declarative manifest, "no code exec, marketplace-safe" ([docs/54](54-tenant-blueprints.md) D2).
- **Components** are declarative node-trees rendered by expansion — "never code; tenants writing JS would be RCE" ([docs/53](53-builder-tenant-components.md)).
- **Integrations** ride the typed provider framework (`@sparx/integration-framework`) and the external-data connectors of [docs/63](63-external-data-connections.md).
- **Auth/publishers/RLS** per [docs/16](16-auth-security.md); **billing** per [docs/17](17-billing-subscriptions.md).

This doc supersedes docs/60 §15 (public funnel) and §16 (publishing/monetization,
previously deferred).

## 2. The vision in one paragraph

Anyone can publish a **blueprint, theme, component, or integration** to the Sparx
marketplace and optionally **charge** for it (within platform price caps). A
submission is a small **bundle** (a zip) that is **scanned and approved or denied**.
Approved items are **applied/installed at runtime from stored data — never a code
deploy**. Sparx publishes its own first-party catalog **through the same pipeline**;
we are simply the first, auto-approved publisher.

## 3. The load-bearing principle: data in, data out

The single rule everything else hangs from:

> A submitter may author in TypeScript/TSX for ergonomics, but the pipeline
> **compiles the bundle, server-side, into a declarative data artifact** (token JSON
> / node-tree JSON / manifest JSON / connector JSON). **Only the artifact is stored
> and applied. Untrusted submitter code is never executed** to render a theme,
> install a blueprint, or place a component.

This is what preserves the multi-tenant / RLS security model. It is also why three of
the four categories need no sandbox at all.

### 3.1 The data-vs-code map

| Category    | Artifact (data)                                 | Runs submitter code?        | Acquire verb |
| ----------- | ----------------------------------------------- | --------------------------- | ------------ |
| Theme       | `DataThemePreset` (v1 tokens + v2)              | never                       | **Apply**    |
| Component   | builder node-tree + `propSpec`                  | never                       | **Add**      |
| Blueprint   | declarative site manifest                       | never                       | **Install**  |
| Integration | declarative connector (auth/resources/webhooks) | **declarative tier:** never | **Connect**  |

Integrations that need real logic (a new payment/shipping/tax **provider**) are a
separate **sandboxed code tier** (§9) — out of the open submission contract until
that sandbox exists.

## 4. The package contract

The canonical templates live in [`marketplace-templates/`](../marketplace-templates/)
— one folder per category, each the exact, allow-listed shape a submission takes.

```
<slug>/
  sparx.json          REQUIRED  metadata manifest (category, slug, name, version,
                                tagline, description, payload, facets, pricing,
                                media[], author, requires)
  <payload>           REQUIRED  exactly ONE category payload (theme.ts / component.tsx
                                / blueprint.ts / integration.ts)
  media/
    icon.png          REQUIRED  square mark for cards/lists (512×512, ≤256 KB)
    preview.png       REQUIRED  detail-view hero (1600×1000, 16:10, ≤2 MB)
    …                 OPTIONAL  more images: .png .jpg .jpeg .webp .svg
  README.md           OPTIONAL  markdown, no HTML
  CHANGELOG.md        OPTIONAL  markdown
```

**Strict allow-list ("no other things").** A bundle containing anything outside this
list is denied with the offending path(s): a second payload file, any `.js`/`.ts`
besides the one payload, `node_modules/`, lockfiles, shell/batch scripts, binaries
other than the allowed image types, symlinks, oversize files. A bundle **missing** a
required file — the payload, `icon.png`, or `preview.png` — is denied just the same
(the validator checks both presence and the dimension/format/size bounds above). See
each template's README for the per-category payload fields and per-category facets.

`sparx.json` is the common metadata; `facets`/`requires` are category-specific and
map 1:1 onto the docs/60 adapter facets (theme: mood/colorFamily/density/industry;
component: group/surfaces; blueprint: vertical/requiredModules; integration:
kind/scopes).

## 5. The submission pipeline

```
upload(.zip) → unpack → ALLOW-LIST → COMPILE → VALIDATE → INTEGRITY → SCAN-MEDIA
            → PRICE-CAP → STORE → catalog row (status: submitted|published)
```

1. **Unpack** the zip in an isolated workspace (size + file-count caps; reject
   symlinks/traversal).
2. **Allow-list** every path against §4. Any stray file → **deny**.
3. **Compile** the single payload in an **isolated build** with an allow-listed
   import surface (only the authoring helpers: the `node()` vocabulary from
   `@sparx/builder-schemas`, types from `@sparx/marketplace-schemas`). No Node APIs,
   no network, no filesystem. Output = the declarative artifact JSON. The build runs
   in the same isolation we will reuse for the integration sandbox (§9).
4. **Validate** the artifact against its Zod schema (`DataThemePreset`,
   `BuilderNodeSchema` + `PropSpecListSchema`, `BlueprintSchema`, the connector
   schema).
5. **Integrity** cross-refs (blueprints: handles/refs resolve, one default variant +
   one primary image, options-before-variants; components: every `$prop` slot has a
   `propSpec` entry; themes: AA-contrast; connectors: every `secret` ref resolves, no
   inline secrets, https only).
6. **Scan media** — type/size/dimension checks; strip metadata; optional malware/NSFW
   scan via `media-worker`.
7. **Price-cap** — enforce §8 (over-cap → deny with the cap explained).
8. **Store** the artifact + media + the archived original bundle (§6) and create/
   update the catalog row.

Every stage is **deny-with-reason**; nothing partial reaches storage. The pipeline
runs as a Pub/Sub worker (`marketplace.submission.received` → a Cloud Run
`submission-worker`), so a large bundle never blocks a request.

## 6. Storage — where every artifact lives (locked)

**"Storage" = the existing `MediaStorage` abstraction, not the repo and not SQL.**
`getStorage()` ([`services/api-rest/src/lib/storage.ts`](../services/api-rest/src/lib/storage.ts))
resolves to **`LocalStorage` (local filesystem, `MEDIA_LOCAL_DIR`) in dev** and
**`GcsStorage` (Google Cloud Storage, `GCS_MEDIA_BUCKET`) in prod** — the same layer
that already backs tenant media. We reuse it; we do not build a new storage system, and
nothing here is committed to git or written to a SQL column.

One namespace, three kinds of object:

| Key                                                   | Access                     | Contents                                         |
| ----------------------------------------------------- | -------------------------- | ------------------------------------------------ |
| `marketplace/<category>/<slug>/<version>.json`        | private (read by api-rest) | the compiled declarative **artifact**            |
| `marketplace/media/<category>/<slug>/…`               | public-read (CDN)          | `icon.png`, `preview.png`, screenshots, logos    |
| `marketplace/bundles/<category>/<slug>/<version>.zip` | private (review/audit)     | the archived original submission (`.ts` + media) |

**The DB never holds a payload.** The catalog row (docs/60) is a **thin index**:
identity, the **filterable facets** (theme: mood/colorFamily/density/industry;
component: group/surfaces; blueprint: vertical/requiredModules; integration:
kind/scopes), a `media[]` of public CDN URLs, `version`, and the publisher. The
artifact's storage key is **derived by convention** from `(category, slug, version)` —
no pointer column, no migration. The legacy `tokens` / `definition` / `tree` /
`propSpec` JSON columns are **left unused** (new items write nothing into them).

**Why storage, not the DB column (decided 2026-06-10):**

- **The DB stays lean.** Browse — the hot, frequent path — reads only thin columns and
  never pulls a payload. Apply/Install — cold, user-initiated, latency-insensitive —
  does one storage read.
- **Uniform with code + media + bundles, which must be in storage regardless.** The §9
  integration code tier, the archived raw bundle, and every image already live in
  storage; resolving the declarative artifacts from the same place gives **one** artifact
  path, not "DB for three categories, storage for the fourth."
- **No drift, no 2-phase commit.** Artifacts are **immutable per version**: a new version
  is a new object at a new key; the row's `version` is flipped only after the object is
  written. A row can never point at a missing artifact, and a failed write leaves a
  harmless orphan (GC'd later).
- **Not a performance fix.** At hundreds–thousands of small JSON items the DB would be
  fine too (column projection + Postgres TOAST). We choose storage for **leanness +
  uniformity**, not because JSONB is slow — so we don't pretend a speed problem we won't
  hit.

**Blueprint facet carve-out.** A blueprint's _artifact_ lives in storage like the rest;
only the handful of **filterable/reportable** fields (vertical, requiredModules, the
content counts shown on the card) are duplicated onto the thin row so the catalog can
filter/sort/report without fetching the artifact. The manifest internals stay in the
storage object.

Media flows through the existing `media-worker` for derivatives; a CDN fronts the public
`marketplace/media/` prefix. Signed upload URLs gate a submitter's zip (Phase 2);
first-party items are ingested directly (§14).

## 7. Runtime resolution — apply/install/add/connect with no deploy

Each acquire verb reads the **artifact from storage** (the derived
`marketplace/<category>/<slug>/<version>.json` key, via `getStorage().readObject`,
cached — it is immutable per version) and replays it through the platform's existing
services. No SQL payload, no code-registry lookup by slug, no deploy.

- **Theme → Apply.** Load `DataThemePreset`; write it into the tenant's
  `SiteConfig.draftSettings.themePreset`; the compile engine compiles from the inline
  preset (the `compileTokensFromDefaults` / `compileThemeForTenant({preset})` seam
  added in `@sparx/site-themes`). Publish snapshots it forward; the site renders
  from the snapshot. **No code preset, no closed enum.**
- **Blueprint → Install.** `parseBlueprint(artifact)` → `installBlueprint(ctx, bp)`
  (the installer already takes a `Blueprint` object). Routes resolve the manifest from
  the **storage artifact**, not a SQL column or the code registry.
- **Component → Add.** `componentService.create({ tree, propSpec, … })` clones the
  artifact into the tenant's own component library (editable copy). Publish expands
  `custom:*` → primitives, so the site only sees data.
- **Integration → Connect.** Render the connector's `configSchema`, store secrets
  encrypted, register the resources as `ext.*` data sources (docs/63) and the webhooks
  on the tenant bus. The platform's HTTP client executes the connector; no submitter
  code runs.

The compile-from-data theme engine and install-from-definition routes are the only
_new_ runtime plumbing; the rest reuses existing services.

## 8. Monetization & price caps

- **Pricing models:** `free | one_time | subscription`, in `sparx.json.pricing`.
- **Caps are platform-enforced and size-aware.** Blueprints cap by **feature counts**
  (a function of products + pages + content entries + emails + components); themes and
  components have flat ceilings; the cap is computed at submission and a price above it
  is denied with the number shown. Free is always allowed. Caps live in one
  `pricing-policy` module so they tune without a schema change.
- **Payouts (later phase):** Stripe Connect — each publisher onboards a connected
  account; the platform takes a revenue share; tax forms, refunds, chargebacks, and
  fraud handling ride Stripe Connect's primitives. This is the heaviest non-technical
  lift and is **deferred to Phase 3** behind the free catalog.

## 9. Integrations: the code tier (deferred)

The open submission tier is declarative (§3.1). Real provider logic — a new payment,
shipping, or tax provider implementing the `@sparx/integration-framework` interfaces —
is a **sandboxed code tier**:

- Reviewed manually, then run in **isolation** (a V8 isolate / WASM / isolated worker
  with no ambient credentials, a capability-scoped host API, CPU/memory/time limits,
  and per-tenant secret injection).
- The same isolation primitive powers the §5 payload compile step, so we build it once.
- **Deferred** until the declarative tier proves out and demand is real. The connector
  tier is expected to cover the majority of "connect my SaaS" needs first.

## 10. Publisher model, review, versioning

- **Publishers** (`marketplace_publishers`, docs/60 D9): `sparx | tenant | partner`.
  Sparx is verified + auto-approved. Tenant/partner publishers onboard, agree to terms,
  and (for paid items) connect Stripe.
- **Review:** automated scan (§5) for everyone; **manual** approve/deny for
  third-party submissions (a review queue with the offending paths / cap explanation
  surfaced); first-party auto-approves after the automated scan.
- **Versioning/updates.** A new `version` is a **new immutable artifact** at a new
  storage key (`…/<version>.json`); an existing version is never overwritten. This is
  version-addressed _by construction_ — but two pieces must exist **from the first write**
  (retrofitting version-addressing later is the painful migration):
  - **Ingest guard (Phase 1):** the validator requires a valid **semver**, enforces a
    **monotonic bump** (no going backwards, no re-using a published version), and
    **refuses to clobber** an already-stored artifact object.
  - **Acquire pins the version (Phase 1):** acquire copies the artifact into the tenant's
    own space, so a tenant is decoupled from later updates. Blueprints record
    `blueprintVersion` on the install row; a theme **Apply** copies the artifact into
    `draftSettings.themePreset`; a component **Add** clones the tree into the tenant's
    library. The source `slug@version` is stamped on the copy so "update available" can be
    computed later.
  - **Deferred (Phase 2+):** the self-service "publish an update" flow, **update-available**
    hints + one-click update for themes/components, and **deprecate/yank** of a bad version
    with a per-item version history. Applying an update across tenant customizations is the
    acknowledged-hard 3-way merge that docs/54 already flags; Phase 1's answer stays
    pin + manual re-install (re-install reconciles the same way blueprint reset/reinstall
    does). Old versions remain readable from storage for any tenant pinned to them.

## 11. Security summary

Strict allow-list • compile-to-declarative (no runtime code for 3 of 4 categories) •
isolated payload compile • Zod + integrity validation • https-only connectors with
named (never inline) secrets • image scanning + metadata strip • signed-URL uploads •
private bundles/artifacts, public CDN media only • RLS-scoped catalog writes
(`marketplace_visibility`, docs/60) • the code tier (§9) sandboxed and deferred.

## 12. Phasing

| Phase                          | Ships                                                                                                                                                                                                                                                                        | Notes                                                                                                           |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **1 — Data runtime + dogfood** | The no-deploy apply/install/add runtime (§7) reading **storage-backed artifacts** + Sparx's own 10/10/10 catalog authored to the §4 contract, **ingested to storage** (compile → `writeObject` → thin row) and pushed through validation. The `DataThemePreset` engine seam. | Delivers the original ask; proves the contract **and the storage path** end-to-end. No self-service intake yet. |
| **2 — Submission + review**    | The **self-service** front door: zip upload → §5 pipeline → review queue → publish. Publisher onboarding (tenant/partner). Declarative **integration connector** tier (Connect). (Storage + ingest already exist from Phase 1; Phase 2 adds the upload UI + review queue.)   | Opens third-party intake for free items.                                                                        |
| **3 — Monetization**           | Price caps enforced + Stripe Connect payouts + paid acquire/billing.                                                                                                                                                                                                         | The financial subsystem.                                                                                        |
| **4 — Code tier**              | The integration sandbox (§9) for code providers.                                                                                                                                                                                                                             | The hardest/riskiest; demand-driven.                                                                            |

## 13. Open questions

- ~~Inline-artifact vs storage threshold per category~~ — **resolved 2026-06-10 (§6):**
  all compiled artifacts live in storage; the DB row is a thin index. No inlining.
- Revenue-share percentage and refund window (Phase 3).
- Trademark/brand-impersonation policy for third-party themes/blueprints (review policy).
- Connector-tier coverage ceiling — when does the code tier become blocking?
- Reconciling the in-flight code-preset themes (commit `428fbbd`) into data themes via Phase 1.

## 14. Dogfood

The 10 themes, 10 components, and 10 blueprints already planned are **submission #1**:
authored to the [`marketplace-templates/`](../marketplace-templates/) contract,
validated by the Phase-1 pipeline, and published as first-party. They are how we prove
the contract before opening third-party intake.
