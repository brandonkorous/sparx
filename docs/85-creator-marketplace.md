# Creator Marketplace — submissions, the declarative contract, and the no-deploy runtime

**Version:** 0.1.0
**Author:** Brandon Korous
**Last Updated:** 2026-06-10

---

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
  media/              OPTIONAL  images only: .png .jpg .jpeg .webp .svg
  README.md           OPTIONAL  markdown, no HTML
  CHANGELOG.md        OPTIONAL  markdown
```

**Strict allow-list ("no other things").** A bundle containing anything outside this
list is denied with the offending path(s): a second payload file, any `.js`/`.ts`
besides the one payload, `node_modules/`, lockfiles, shell/batch scripts, binaries
other than the allowed image types, symlinks, oversize files. See each template's
README for the per-category payload fields and per-category facets.

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

## 6. Storage (Google Cloud Storage)

One regional bucket, three prefixes:

| Prefix                                       | Access                     | Contents                          |
| -------------------------------------------- | -------------------------- | --------------------------------- |
| `artifacts/<category>/<slug>/<version>.json` | private (read by api-rest) | the compiled declarative artifact |
| `media/<category>/<slug>/…`                  | public-read (CDN)          | preview images, logos, swatches   |
| `bundles/<category>/<slug>/<version>.zip`    | private (review/audit)     | the archived original submission  |

- The **catalog row stays thin** (docs/60): identity + facets + a `media[]` of public
  CDN URLs + a pointer to the artifact object. The heavy artifact is fetched from GCS
  on apply/install and cached (it is immutable per version).
- **Themes are small enough to inline** their artifact in `marketplace_themes.tokens`
  (the column already exists) — no GCS round-trip for the hot path. Larger artifacts
  (blueprint manifests, component trees) may inline in `definition`/`tree` **or**
  pointer to GCS; Phase 1 inlines (they are still small); GCS-pointer is the scale
  valve. Either way the **runtime reads data, never code**.
- Media flows through the existing `media-worker` (Cloud Run) for resize/derivatives;
  a CDN sits in front of the `media/` prefix.
- Signed upload URLs gate the submitter's zip upload; the bucket is otherwise private.

## 7. Runtime resolution — apply/install/add/connect with no deploy

Each acquire verb reads the **artifact** (from the row's JSON column or its GCS
pointer) and replays it through the platform's existing services. No code-registry
lookup by slug; no deploy.

- **Theme → Apply.** Load `DataThemePreset`; write it into the tenant's
  `SiteConfig.draftSettings.themePreset`; the compile engine compiles from the inline
  preset (the `compileTokensFromDefaults` / `compileThemeForTenant({preset})` seam
  added in `@sparx/site-themes`). Publish snapshots it forward; the storefront renders
  from the snapshot. **No code preset, no closed enum.**
- **Blueprint → Install.** `parseBlueprint(definition)` → `installBlueprint(ctx, bp)`
  (the installer already takes a `Blueprint` object). Routes resolve the manifest from
  the DB row, not the code registry.
- **Component → Add.** `componentService.create({ tree, propSpec, … })` clones the
  artifact into the tenant's own component library (editable copy). Publish expands
  `custom:*` → primitives, so the storefront only sees data.
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
- **Versioning/updates:** a new `version` is a new immutable artifact. Installed items
  **pin** their version; a tenant **opts in** to an update. Phase 1's answer is
  pin + manual re-install (re-install reconciles against tenant customizations the same
  way blueprint reset/reinstall does). A true 3-way merge is acknowledged-hard and
  out of scope here (docs/54 already flags it).

## 11. Security summary

Strict allow-list • compile-to-declarative (no runtime code for 3 of 4 categories) •
isolated payload compile • Zod + integrity validation • https-only connectors with
named (never inline) secrets • image scanning + metadata strip • signed-URL uploads •
private bundles/artifacts, public CDN media only • RLS-scoped catalog writes
(`marketplace_visibility`, docs/60) • the code tier (§9) sandboxed and deferred.

## 12. Phasing

| Phase                          | Ships                                                                                                                                                                                                                 | Notes                                                                                 |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **1 — Data runtime + dogfood** | The no-deploy apply/install/add runtime (§7) for themes/components/blueprints + Sparx's own 10/10/10 catalog authored to the §4 contract and pushed through validation. The `DataThemePreset` engine seam. GCS media. | Delivers the original ask; proves the contract end-to-end. No third-party intake yet. |
| **2 — Submission + review**    | Zip upload → §5 pipeline → review queue → publish. Publisher onboarding (tenant/partner). Declarative **integration connector** tier (Connect).                                                                       | Opens third-party intake for free items.                                              |
| **3 — Monetization**           | Price caps enforced + Stripe Connect payouts + paid acquire/billing.                                                                                                                                                  | The financial subsystem.                                                              |
| **4 — Code tier**              | The integration sandbox (§9) for code providers.                                                                                                                                                                      | The hardest/riskiest; demand-driven.                                                  |

## 13. Open questions

- Inline-artifact vs GCS-pointer threshold per category (Phase 1 inlines; revisit at scale).
- Revenue-share percentage and refund window (Phase 3).
- Trademark/brand-impersonation policy for third-party themes/blueprints (review policy).
- Connector-tier coverage ceiling — when does the code tier become blocking?
- Reconciling the in-flight code-preset themes (commit `428fbbd`) into data themes via Phase 1.

## 14. Dogfood

The 10 themes, 10 components, and 10 blueprints already planned are **submission #1**:
authored to the [`marketplace-templates/`](../marketplace-templates/) contract,
validated by the Phase-1 pipeline, and published as first-party. They are how we prove
the contract before opening third-party intake.
