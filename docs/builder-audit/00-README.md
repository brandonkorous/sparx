# Builder audit — the silicaui site builder, scored against the world

Version: 1.2.0
Author: Brandon Korous
Last Updated: 2026-07-28

> **Scope: the silicaui builder ONLY.** The subject is silicaui's `<Builder>` engine as hosted
> by the workbench (`sparx/apps/workbench/surfaces/builder/studio/`), the sparx `BuilderHost` that
> feeds it, the catalog it inserts from, and the storefront that renders what it publishes.
> The bespoke `.bx-*` dashboard builder is **out of scope and gone** — `apps/dashboard` no
> longer exists in the tree. Legacy code appears below only where it actively breaks a
> silica chain (two places: the SEO audit's column read, and which publish route triggers it).

> **Standing goal this is scored against:** _"make it a 10/10 site builder; don't stop until
> you can confidently say there is no better site builder in the world."_ The comparison set
> is Webflow, Framer, Shopify's editor, Wix Studio, and Squarespace Fluid — not a low bar.

**Companion docs**

- [01-roadmap.md](01-roadmap.md) — the impact-ordered slices to close the gap, tagged and sized.
- [02-silicaui-asks.md](02-silicaui-asks.md) — Wave 3: what went upstream and why. The register itself is [docs/silicaui/01](../silicaui/01-builder-asks.md).

---

## 1. Method, and what it can and cannot tell you

Read-only source trace across the builder host, the engine's shipped type surface and bundle,
the catalog packages, the publish service, the public read API, and the storefront routes. Every
finding below names the file that produces it.

**Nothing here is browser-verified.** No dev server was running during the audit (3000 / 3001 /
3010 / 3011 / 3100 all closed) and starting one is not this audit's business. Where a claim
depends on runtime behaviour rather than on what the source can only do, it is marked
**unverified** with the check that would settle it.

## 2. What the builder is now

The architecture changed under the older docs, and the change is the frame for everything else.
sparx no longer owns an editor. It owns a **host**.

| Layer                                                                                        | Owner                                             | Where                                                                                        |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Canvas, Insert palette, Navigator, Inspector, undo/redo, pages, symbols, theme UI            | **silicaui** `@wizeworks/silicaui-builder@0.35.0` | `node_modules`                                                                               |
| What a binding means, the commerce composites, the pinned functional cores, the class policy | **sparx** — 74 lines                              | [studio/host.ts](../../apps/workbench/surfaces/builder/studio/host.ts)                       |
| Save / Publish / Preview / version history / live co-editing / dirty guard                   | **sparx**                                         | [studio/studio-surface.tsx](../../apps/workbench/surfaces/builder/studio/studio-surface.tsx) |
| One render path — `flattenSymbols → composeFrame → resolveTree → toHtml`                     | **sparx over silica**                             | [silica-catalog/render.ts](../../packages/silica-catalog/src/render.ts)                      |
| Published reads, with the code starter as universal fallback                                 | **sparx**                                         | [wizeworks/apps/site/lib/silica.ts](../../apps/site/lib/silica.ts)                           |

That single render path is the strongest thing in the system: preview==production is
_structurally_ true, not aspirational, because the canvas and the storefront walk the same node
shape through the same projection. Most of what follows is not an architecture problem. It is
capability that stops one step short of reaching the tenant.

## 3. Scorecard

Most broken first. "Gap to 10" is what the score is missing, not a wish list.

| #   | Dimension                          | Score | Gap to 10                                                                                                                                                                                                                                                                                                    |
| --- | ---------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Pre-publish confidence**         | **1** | Preview renders the _published_ site, not the draft. No lint of any kind — no broken-link, a11y, SEO, or performance check before Publish.                                                                                                                                                                   |
| 2   | **Media / images in the editor**   | **2** | `host.pickAsset` is unimplemented, so silica hides its "Browse…" button and the image field is a bare URL textbox. A non-technical owner cannot place their own photo.                                                                                                                                       |
| 3   | **Templates (blueprints)**         | **2** | Install machinery, gallery, and per-site install lifecycle all ship. `marketplace-catalog/blueprints/` is **empty**.                                                                                                                                                                                         |
| 4   | **SEO / metadata / OG**            | **3** | No UI anywhere sets a page's title, description, social image, canonical, or indexing. The audit engine reads the wrong column and is never triggered by the real publish.                                                                                                                                   |
| 5   | **Responsive editing**             | **3** | No per-breakpoint authoring at all. The device toggle is a `max-width` on a div. ~~Half the catalog uses viewport variants the toggle physically cannot reflow.~~ _Vocabulary fixed ([slice 6](01-roadmap.md)); the authoring half is [docs/silicaui/01 §1](../silicaui/01-builder-asks.md) and still open._ |
| 6   | **Measurability**                  | **4** | Analytics and order attribution are real, but two of four endpoints are unconsumed, nothing surfaces in the builder, and no page carries a conversion number.                                                                                                                                                |
| 7   | **Published-output performance**   | **4** | 23 `force-dynamic` storefront routes (no HTML caching) despite a working tag-purge pipeline; no `srcset` generated for author-placed images.                                                                                                                                                                 |
| 8   | **Accessibility of output**        | **4** | Good token contrast derivation, semantic tags, lazy images. Zero author-time checking, enforcement, or reporting.                                                                                                                                                                                            |
| 9   | **Reusable symbols / site chrome** | **5** | Two disconnected component libraries. The tenant-wide Saved-pieces library is absent from the Insert palette and its deep link is ignored.                                                                                                                                                                   |
| 10  | **Catalog breadth & quality**      | **5** | ~120 primitives + **18** section blocks + 4 commerce composites + 14 host cores. Competitors ship 10–100× the section library.                                                                                                                                                                               |
| 11  | **Editing UX**                     | **6** | Real drag/drop, Navigator, undo/redo, clipboard, fuzzy palette search, symbols. No multi-select, no alignment guides, no nudge; the escape hatch is a mono textarea.                                                                                                                                         |
| 12  | **Collaboration**                  | **6** | Ops relay, presence, catch-up, agent activity — ahead of Webflow. But no history delegate, so **any co-editor or agent edit silently destroys the author's whole undo history** (corrected — see below).                                                                                                     |
| 13  | **Layout system**                  | **7** | Free canvas, frame + Outlet, raw elements, retagging, pinned cores. One frame per site: no per-page layout, no chrome-off landing page, no named slots.                                                                                                                                                      |
| 14  | **Dynamic content & binding**      | **8** | Best-in-class domain reach — CMS types, commerce, categories-by-handle, CRM, scheduling, per-record templates. Capped at 24 records with no pagination; no conditionals, filter, or sort.                                                                                                                    |
| 15  | **Publishing lifecycle**           | **8** | Content-addressed artifacts, sealed releases, per-save draft versions with non-destructive restore. Release rollback is API/MCP-only; no per-page or scheduled publish.                                                                                                                                      |
| 16  | **Theming & brand fidelity**       | **8** | Token themes, per-site brand override, light/dark, WCAG `-content` derivation, saved-theme library, 10 shipped themes, canvas font loading. Legacy `--st-*` still bridged in the storefront.                                                                                                                 |

## 4. The four highest-impact gaps

### GAP 1 — Preview shows the published site, not the draft

The most load-bearing promise a builder makes — _look before you publish_ — does not work, and
because the code starter is a universal fallback, a tenant who has never published sees the
**starter**, not their own work.

**The chain, and where it snaps:**

1. [studio-surface.tsx](../../apps/workbench/surfaces/builder/studio/studio-surface.tsx) `onPreview` saves the draft, mints a token, opens `${origin}/?sparxSitePreview=${token}`. ✅
2. [wizeworks/apps/site/app/page.tsx:78](../../apps/site/app/page.tsx#L78) calls `getPublishedSilicaHome(site.slug)` with **no options**. `sp.sparxSitePreview` is not read until line 92, and the silica branch has already returned at line 84. `generateMetadata` does the same at line 41. ❌
3. Even on `[...slug]`, where the token **is** threaded, none of the four silica handlers in [public/builder.ts](../../services/api-rest/src/routes/v1/public/builder.ts) call `tryVerifySitePreview` — the legacy `page` / `home` / `styles` handlers in the same file do. ❌
4. [site-service.ts](../../packages/builder/src/services/site-service.ts) exposes `getPublishedFrame` / `getPublishedHome` / `getPublishedPageBySlug` / `getPublishedByRecordType`. **There is no draft-serving read at all.** ❌
5. [wizeworks/apps/site/app/layout.tsx:289](../../apps/site/app/layout.tsx#L289) calls `getPublishedSilicaFrame(site.slug)` — a signature with no token parameter — so draft header/footer edits never preview either. ❌

[wizeworks/apps/site/lib/silica.ts](../../apps/site/lib/silica.ts) builds an `Authorization: Preview` header that the server ignores, which is why this reads as working from the client side.

**Fixed looks like:** the four silica handlers verify the token and serve `silicaDraftTree`;
`app/page.tsx` and `layout.tsx` thread it. Completes: _edit → Preview → see exactly what
publishing would ship._

### GAP 2 — SEO is authored nowhere, audited against the wrong tree, and never recomputed

Three independent breaks in one chain.

1. **No authoring surface.** `grep seoTitle sparx/apps/workbench/surfaces/builder/` returns **zero hits**. [host.ts](../../apps/workbench/surfaces/builder/studio/host.ts) implements neither `inspectorPanels` nor a page-settings toolbar surface. The workbench rebuild dropped the page-settings surface that [docs/118](../118-builder-silicaui-html-migration.md) records as shipped in the old dashboard studio. Products, categories and CMS entries all have SEO fields in the workbench; builder pages do not.
2. **The storefront reads fields that are always null.** [wizeworks/apps/site/app/page.tsx](../../apps/site/app/page.tsx) `generateMetadata` faithfully reads `seoTitle` / `seoDescription` / `canonical` / `ogImage` / `noindex`, so every page ships the site name and **no description**.
3. **The audit reads the wrong column.** [lib/seo-audit.ts:88](../../services/api-rest/src/lib/seo-audit.ts#L88) — `extractBuilderTreeSignals(page.publishedTree ?? page.draftTree)`. Silica pages store in `silicaPublishedTree` / `silicaDraftTree`; sync parks a **blank tree** in `draftTree` ([site-service.ts:582](../../packages/builder/src/services/site-service.ts#L582)). Every silica page therefore audits as 0 H1s, 0 words, 0 internal links, and a false "no images" pass.
4. **And it never runs.** `auditAndStore` fires on the legacy `POST /v1/builder/pages/:id/publish` route ([builder/pages.ts](../../services/api-rest/src/routes/v1/builder/pages.ts)). The studio's Publish calls `siteService.publish`, which does artifacts, releases, the node index and an audit-log entry — but no SEO audit.

The engine itself ([wizeworks/packages/seo-audit/src/audit.ts](../../packages/seo-audit/src/audit.ts)) is good: 12
weighted checks, real tips, a computed `fixFirst`. It is grading the wrong data and offering
"Add a title" actions that open no editor.

**Fixed looks like:** a Page settings panel (name, slug, title, description, social image via the
media picker, canonical, indexing), a silica-aware extractor, and `auditAndStore` on the silica
publish. Completes: _write the page → say how it appears in search → publish → the scorecard
grades the real page → the storefront serves the real tags._

### GAP 3 — Responsive is not authorable, and the canvas is not honest about it

- **The device toggle is cosmetic.** `DEVICE_WIDTH = {desktop:'100%', tablet:'768px', mobile:'390px'}`, applied as `style.maxWidth` on the canvas board. It is not an iframe.
- **The Inspector cannot write a breakpoint.** Every chip group (Display, Direction, Columns, Justify, Align, Gap, Width, Max width, Position, Self align, typography, Animate) writes an **unprefixed** class. Grepping the whole shipped bundle for `sm:` / `md:` / `lg:` authoring returns nothing. The only escape is the Classes field — a 3-row `font-mono text-xs` textarea.
- **The catalog speaks two vocabularies.** [commerce.ts](../../packages/silica-catalog/src/commerce.ts) correctly uses `@2xl:grid-cols-3` under an `@container`; [site.ts](../../packages/silica-catalog/src/site.ts) uses `sm:text-5xl` and `sm:grid-cols-3`. Because the canvas is not an iframe, **`sm:` resolves against the browser window** — switching to Mobile will not reflow the starter home page's hero or value row. _Fixed by [roadmap slice 6](01-roadmap.md): one vocabulary across the catalog, enforced at write time._

For non-technical business owners ([brain/business/audience](../brain/business/audience.md)),
"type `@2xl:grid-cols-3` into a monospace box" is not a responsive editor. This is the one dimension where the comparison set is flatly better:
Webflow, Framer and Wix Studio all make breakpoint editing a first-class mode.

**Fixed looks like:** a breakpoint selector in the Inspector header that prefixes every chip
write, an "overridden at this size" indicator, and one vocabulary across the catalog so the
device toggle tells the truth. The third is **done** — slice 6 swept the catalog and now refuses
a viewport variant at write time through the host's `validateClass` seam, which the audit had
wrongly filed as needing an engine change. The first two remain a silicaui ask — see
[02-silicaui-asks.md](02-silicaui-asks.md) and [docs/silicaui/01 §1–2](../silicaui/01-builder-asks.md).

### GAP 4 — No media picker in the site editor

[host.ts](../../apps/workbench/surfaces/builder/studio/host.ts) returns a `BuilderHost` with no
`pickAsset`. In the engine, the "Browse…" button on the image field renders **only** when
`host.pickAsset` exists. Without it the field is a raw URL input.

The email builder already solved this problem harder: [email-asset-panel.tsx](../../apps/workbench/surfaces/builder/email/email-asset-panel.tsx)
bridges the asset library through `inspectorPanels` **because silica's email host has no
`pickAsset` seam**. The site editor _has_ the seam and does not use it.

**Fixed looks like:** `pickAsset` wired to the media library, with upload-in-place. Completes:
_upload a photo → place it → it is on the live site._ Today that chain requires knowing what a
URL is.

## 5. Full findings

### 5.1 In our control

| Finding                                                                            | Where                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preview ignores the draft (GAP 1)                                                  | `public/builder.ts` silica handlers · `app/page.tsx:78` · `layout.tsx:289`                                                                                                                                                                                                                                                                                                                                                                                                       |
| No page SEO UI; audit reads legacy column; not triggered on silica publish (GAP 2) | `lib/seo-audit.ts:88` · `builder/pages.ts` · zero `seoTitle` in `surfaces/builder/`                                                                                                                                                                                                                                                                                                                                                                                              |
| `pickAsset` unimplemented (GAP 4)                                                  | `studio/host.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `inspectorPanels` unimplemented — no product-pin panel, no per-module editor       | `studio/host.ts`; product-pin is listed deferred in docs/118                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Zero blueprints shipped                                                            | `marketplace-catalog/blueprints/` empty; `blueprints/registry.ts` is `{}` by design                                                                                                                                                                                                                                                                                                                                                                                              |
| Saved pieces absent from the Insert palette; `componentId` deep link ignored       | `saved-piece-detail.tsx` opens `builder.studio` with `componentId`; the studio reads only `pageId`                                                                                                                                                                                                                                                                                                                                                                               |
| No history delegate → a co-editor's edit wipes the author's undo history           | `studio-surface.tsx` never calls `setHistoryDelegate`. **Corrected on re-read of the 0.35.0 bundle:** `applyRemoteOps` does `if (!this.historyDelegate) { this.past = []; this.future = [] }`, so the engine already prevents undo from reverting someone else's work — it discards the whole stack instead. The reachable defect is that second-order one, and an agent editing alongside the author is a designed-for workflow here. Fixed by [roadmap slice 5](01-roadmap.md) |
| Bound collections silently capped at 24, no pagination                             | `wizeworks/apps/site/lib/silica-data.ts` `COLLECTION_PAGE_SIZE` + the `console.warn` it emits                                                                                                                                                                                                                                                                                                                                                                                    |
| Mixed responsive vocabulary (`sm:` vs `@2xl:`)                                     | `silica-catalog/site.ts` vs `silica-catalog/commerce.ts`. Fixed by [roadmap slice 6](01-roadmap.md), which also turned up three the audit missed: the workbench canvas never imported the shared vocabulary (container variants emitted CSS on the storefront and none in the editor), the buy box declared `@container` on the same element that queried it, and the display utilities the chrome's phone/desktop swap depends on were never declared at all                    |
| Release rollback has no UI                                                         | `artifact-service.ts` `restoreRelease` + `builder/site.ts`; the History drawer lists **draft** versions only                                                                                                                                                                                                                                                                                                                                                                     |
| `top-pages` and `sources` analytics endpoints built, never consumed                | `builder/analytics.ts`; only `summary` + `timeseries` are used, in `surfaces/sites/traffic.tsx`                                                                                                                                                                                                                                                                                                                                                                                  |
| No per-page performance or conversion feedback in the builder                      | Builder surfaces are Editor, Email designs, Site, Blueprints, Saved pieces, Form submissions — no Pages list, no metrics                                                                                                                                                                                                                                                                                                                                                         |
| 23 `force-dynamic` storefront routes                                               | `wizeworks/apps/site/app/**`, despite a working `builder:<slug>` tag-purge pipeline                                                                                                                                                                                                                                                                                                                                                                                              |
| No `srcset` / `sizes` generated for author-placed images                           | the attrs are allowlisted in `silicaui-html`; nothing emits them, and `wizeworks/packages/media` has no variant pipeline                                                                                                                                                                                                                                                                                                                                                         |
| No a11y checking and no broken-link checking over authored trees                   | `axe` / `contrastRatio` / `brokenLink` appear nowhere outside theme derivation                                                                                                                                                                                                                                                                                                                                                                                                   |
| silica's shipped blocks include an `eyebrow` part                                  | `silicaui-html/dist/blocks` — "Content — prose section", "Feature — media split". Violates RULE #2 and ships into tenant sites.                                                                                                                                                                                                                                                                                                                                                  |

**Noted, out of scope:** `wizeworks/apps/site/app/page.tsx` still carries four legacy render tiers beneath
an always-true silica branch. Storefront cleanup, not builder work — tracked by the docs/118
deletion gate, not by this audit.

### 5.2 Needs a silicaui change

Summarised here; the filable form is [02-silicaui-asks.md](02-silicaui-asks.md).

Per-breakpoint authoring · multi-select · canvas fidelity for viewport variants · alignment
guides and arrow-key nudge · `Q22` (`resolveTree` stops at a filled binding) · `Q26` (editor mode
is private state) · per-page frame selection · a richer image node.

### 5.3 Cost / scope decisions — for the owner, not assumed

| Decision                                                       | Tradeoff                                                                                                                                                      | Note                                                                                                                                                          |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Image transform pipeline** (`srcset`, WebP/AVIF, focal crop) | On-the-fly transform service or CDN ≈ $20–200/mo scaling with traffic. Build-on-upload into GCS ≈ near-zero marginal cost, more storage, no arbitrary resize. | Build-on-upload fits "start cheap" and the builder only needs 3–4 fixed widths.                                                                               |
| **Static / ISR storefront rendering**                          | Latency and pod-count win if the tag-purge pipeline is trusted; the risk is a stale page after publish.                                                       | No new spend; likely _reduces_ spend.                                                                                                                         |
| **Managed RUM beyond the current beacon**                      | The beacon already collects LCP / CLS / load first-party at zero cost.                                                                                        | Surface what is already collected; buy nothing.                                                                                                               |
| **Authoring 20–40 blueprints**                                 | No infrastructure cost. The cost is authoring time — roughly 1–3 days each for design, copy, trees and media — or contracting it.                             | The single largest lever on perceived quality, and the one that cannot be engineered around.                                                                  |
| **Automated a11y / link checking at publish**                  | In-process rules ≈ free. Real headless-browser axe runs need a render worker (a pod, or Cloud Run per publish).                                               | In-process first: heading order, alt text, contrast on resolved tokens, and internal links against the real page roster cover most of it with no new service. |

## 6. Verdict

**Current overall: 5.5 / 10.**

The architecture is a 9 and in places genuinely better than the comparison set. One render path,
so preview==production is structural rather than aspirational. Content-addressed publish
artifacts sealed into releases, with per-save draft versions and non-destructive restore. A
binding layer that reaches CMS content types, commerce categories by handle, CRM and scheduling
from one picker — Webflow's CMS cannot touch a live product catalog, and Shopify's editor cannot
touch a CRM. Pinned functional cores, so cart, checkout, search and account are editable shells
around real behaviour. An ops-relay collaboration substrate that folds a human co-editor and an
AI agent through the identical path. Nobody else has that combination.

What stands between it and "no better in the world" is not architecture. It is that **too many of
those capabilities stop one step short of the tenant.** Preview shows the published site. SEO
fields exist in the database, are read by the storefront, and are graded by a scoring engine —
and no screen sets them. The media-picker seam is offered by the engine and left unimplemented,
so an owner cannot place their own photograph. Blueprints have an install pipeline, a gallery and
a per-site lifecycle, and zero entries. Two analytics endpoints are written and unconsumed.
Release rollback is API-only. This is the same shape as the email-links problem before
attribution existed: the mechanism shipped, the payoff did not.

The second thing is responsive editing, and it is the one dimension where a competitor is simply
better. The device toggle is a `max-width`, the Inspector cannot write a breakpoint at all, and
half the shipped catalog uses viewport variants the canvas physically cannot simulate.

The ratio is the good news. Wave 1 of [01-roadmap.md](01-roadmap.md) is eight slices, six of them
S or M, all in our control, and it moves the honest score to roughly **7.5** — because the hard
parts are built and merely disconnected. Wave 2 buys pre-publish confidence, which nobody in this
market does well. Waves 3 and 4 are where the real time goes: the silicaui responsive and
multi-select work, and the blueprint library — the only item on the list that must simply be
authored.

Related: [docs/silicaui/01 — the silicaui asks register](../silicaui/01-builder-asks.md) · [docs/118 — silicaui migration](../118-builder-silicaui-html-migration.md) · [docs/122 — editable storefront + host cores](../122-editable-storefront-and-configurable-commerce.md) · [docs/126 — op protocol](../126-builder-op-protocol.md) · [docs/98 — customization rebuild](../98-builder-customization-rebuild.md)
