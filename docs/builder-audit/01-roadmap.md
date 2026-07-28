# Builder audit — roadmap to 10/10

Version: 1.9.0
Author: Brandon Korous
Last Updated: 2026-07-28

> **`pnpm install` IS REQUIRED before the next push.** Slice 9 adds a new workspace
> package (`packages/site-lint`), and the pre-push guard runs
> `pnpm install --frozen-lockfile` — which fails on a lockfile with no `importers:`
> entry for it. Two installs have been run and both landed. **One more is due:** slice
> 11 added `@sparx/site-lint` to `services/api-rest`'s dependencies. Until it runs,
> that one edge is a hand-made junction — good enough for `tsc` and `vitest`, and
> nothing else.

> **Status — WAVE 1 COMPLETE (slices 1–8), uncommitted in the working tree (2026-07-28).**
> `20270123000000_builder_component_silica_tree` is APPLIED to local docker and the
> Prisma client regenerated (the operator brought dev down and authorised it). Verified
> in the DB: `silica_tree` present, `tree` now nullable, RLS still ENABLED + FORCED, and
> all 6 pre-existing version rows untouched with their legacy trees — the additive,
> no-backfill outcome the migration claimed. **Prod still needs the DB Migrate
> workflow** on push to `main`; Cloud SQL is private-IP only.
> Gate-green (typecheck + lint) across `@sparx/seo-audit`, `@sparx/builder`,
> `@sparx/builder-schemas`, `@sparx/db`, `@sparx/silica-catalog`, `@sparx/api-rest`,
> `@sparx/site` and `@sparx/workbench`; 502 unit tests pass.
> Nothing is committed — the operator commits.
>
> **Decisions taken, so they are not re-litigated:**
>
> - **The silicaui asks go to [doc 139](../139-silicaui-builder-asks.md), not 119.** 119 is
>   SUPERSEDED — written against silicaui-builder 0.8.0, and its framing question ("adopt
>   the engine or keep ours?") is answered and executed. Only Q22/Q26 were still live and
>   are carried into 139 §7.
> - **Wave 3 is filed, not built.** The silicaui repo is present locally but is not being
>   edited from here this pass.
> - **Slice 7 resolution: keep `BuilderComponent` tenant-wide.** Cross-site reuse is the
>   capability silica symbols cannot provide (`Site.symbols` is per-site), so it is not
>   retired into them. It is surfaced by MATERIALIZING each piece as a `tenant:<key>`
>   symbol — not via `catalog().extend`, which the slice note explains.
>
> **Files in flight for slices 1–8 — verified against `git status`, 2026-07-28.**
>
> `apps/site/lib/silica.ts` · `apps/site/app/{page,layout}.tsx` ·
> `apps/site/app/{products/[handle],blog/[slug],collections/[handle]}/page.tsx` ·
> `apps/workbench/app/globals.css` ·
> `apps/workbench/surfaces/builder/{saved-piece-detail.tsx,saved-pieces-data.ts}` ·
> `apps/workbench/surfaces/builder/studio/{studio-surface,host,data,builder-live,version-history}.tsx`
>
> - NEW `studio/{page-settings.tsx,undo-history.tsx,saved-pieces.ts}` ·
>   `packages/builder-schemas/src/{component,index}.ts` + NEW `silica-op-invert{,.test}.ts` ·
>   `packages/builder/src/mcp/silica-vocabulary.ts` ·
>   `packages/builder/src/services/{site-service,site-service.test,component-service,index}.ts` ·
>   `packages/db/prisma/schema/51-builder.prisma` + NEW
>   `packages/db/prisma/migrations/20270123000000_builder_component_silica_tree/` ·
>   `packages/seo-audit/src/{extract,extract.test,index}.ts` ·
>   `packages/silica-catalog/src/{builder-vocabulary.css,vocabulary-patterns,vocabulary-check,vocabulary-check.test,site,site-chrome,site-chrome.test,cms,commerce,host-nodes}.ts` ·
>   `services/api-rest/src/lib/seo-audit.ts` ·
>   `services/api-rest/src/routes/v1/{public/builder,builder/site,builder/components}.ts` ·
>   `docs/119-silicaui-builder-gap-questions.md` · NEW `docs/139-silicaui-builder-asks.md` ·
>   NEW `docs/builder-audit/`
>
> **Slices 9–11 add:** NEW `packages/site-lint/` (whole package) ·
> NEW `services/api-rest/src/lib/site-check{,.test}.ts` +
> `services/api-rest/{Dockerfile,package.json,src/routes/v1/builder/site.ts}` ·
> NEW `packages/site-themes/src/v2/brand-theme.ts` + `v2/index.ts` ·
> NEW `apps/workbench/surfaces/builder/studio/site-check.tsx` +
> `studio/{studio-surface.tsx,data.ts,brand-theme.ts}` ·
> `packages/silica-catalog/src/attr-binding.ts` (exports `carrierBoundAttrs`) ·
> `packages/site-themes/src/v2/color.ts` + `color.test.ts` + `package.json` (a `./color`
> subpath export, and the OKLCH/OKLab math the hex-only module lacked) ·
> `apps/site/app/robots.txt/route.ts` · `docs/139-silicaui-builder-asks.md` (§9) — plus
> the three catalog defects the linter found, in `silica-catalog`'s `commerce.ts`,
> `host-nodes.ts` and `site-chrome.ts` (all already ours from slice 6).
>
> **Also ours, and unrelated to the builder:**
> `services/api-rest/test/{helpers.ts,integration/market-merchant-handle.test.ts}` +
> `packages/commerce/src/services/market/projection.ts` (a doc note only). The api-rest
> suite had one failure that predated this work — `dropTestTenant` claimed the tenant
> cascade "reaches every tenant-scoped table", but the two sparx.market GLOBAL
> projections are FK-less by design, so every run of `market-merchant-handle.test.ts`
> permanently orphaned a row holding the globally-unique handle `savory-donuts`. Every
> subsequent full run then died on a unique violation inside the projection writer.
> Fixed at both ends (explicit teardown + a per-run random handle), the two orphan rows
> cleared from local docker, and the suite is green: 54 files, 268 tests.
>
> **That list is exhaustive. Everything else dirty in the tree belongs to a DIFFERENT
> agent building the social module in this same checkout**, and its footprint keeps
> growing — re-derive it from `git status` rather than trusting a stale list.
>
> As of this writing it also holds three things easily mistaken for ours:
>
> - `services/api-rest/src/index.ts` — social background loops. NOT our api-rest work.
> - `apps/workbench/surfaces/automations/` — the whole directory.
> - The DELETION of `marketplace-templates/blueprint/` and
>   `docs/guides/building-a-template.md`.
>
> Its wider footprint: `packages/social/`, `packages/db/prisma/schema/02-tenant.prisma`,
> `08-property.prisma`, `87-social.prisma` and the `20270122_` migrations,
> `packages/db/src/advisory-locks.ts`, `packages/email/`, `packages/events/`,
> `services/social-worker/`, `services/email-worker/`, `services/api-rest/src/lib/social-*`
> and `src/routes/v1/social/`, `apps/workbench/surfaces/social/` and
> `surfaces/commerce/product-detail.tsx`, `apps/workbench/lib/surfaces/`,
> `apps/workbench/components/module-panel.tsx`, `apps/workbench/package.json`,
> `pnpm-lock.yaml`, `terraform/`, `marketplace-catalog/blueprints/`, and
> `docs/social-audit/` + `docs/implementation/`.
>
> **The workbench and `packages/db` are SHARED — the split there is per-file, not
> per-app or per-package.** Stage by path, never `git add -A`, and re-check the branch
> before committing: HEAD can move under a parallel session.

> The execution half of [00-README.md](00-README.md). Scope is the **silicaui builder** — the
> engine as hosted by the workbench, its host seam, its catalog, and the storefront that renders
> what it publishes. Nothing here targets the retired `.bx-*` dashboard builder.
>
> Every slice carries a tag — **in-our-control** · **silicaui-ask** · **cost-decision** — and a
> rough size. Sizes are shape, not a commitment. Tick a slice when it lands and bump this doc's
> version; move anything actionable-now into kanNINJA per
> [brain/tasks](../brain/tasks/kanninja-is-the-record.md).

---

## Wave 1 — close the broken chains

Nothing in this wave is new capability. It is making already-built work reach the tenant. This
is the cheapest wave and the one that moves the score most: 5.5 → roughly 7.5.

- [x] **1. Silica preview serves the draft.** DONE. A `SiteStage` parameter threads through all four readers in [site-service.ts](../../packages/builder/src/services/site-service.ts); every silica handler in [public/builder.ts](../../services/api-rest/src/routes/v1/public/builder.ts) resolves it via a shared `previewStage()`; the token is threaded through [app/page.tsx](../../apps/site/app/page.tsx) (body **and** `generateMetadata`) and [layout.tsx](../../apps/site/app/layout.tsx). — _in-our-control · S_

  > Two findings beyond the audit: the PDP, blog and collections routes had the SAME bug (a collection template could never be previewed), and Preview always opened `/`. It now opens the page being edited, via `onActivePageChange`.
  >
  > The published↔draft boundary is pinned by unit tests (`stagedTree` / `hasStagedTree`) — a published read must never consult the draft column, or unpublished work leaks to the public.

- [x] **2. Media picker.** DONE. `host.pickAsset` implemented and `MediaPickerProvider` mounted above the editor. silica renders its "Browse…" affordance only when the host supplies this, so the image field was a bare URL box until now. — _in-our-control · S_

  > `alt` is deliberately NOT auto-filled from the filename: "IMG_2381.jpg" read aloud by a screen reader is worse than silence, and it would make the alt-text check pass on every image while helping nobody. A missing alt is a finding for slice 9, not something to paper over.

- [x] **3. Page settings panel.** DONE — [page-settings.tsx](../../apps/workbench/surfaces/builder/studio/page-settings.tsx): title, description, sharing picture (through slice 2), indexing, and canonical behind an Advanced disclosure, with a live "in a search result" preview. — _in-our-control · M_

  > Folded into the ONE Save button via a combined `unsaved` signal (silica never fires `onChange` for these, so the button would otherwise stay greyed out), and flushed AFTER the site sync — a page created in the session has no row until then.
  >
  > Name and slug are deliberately excluded: silica's page switcher owns them, and duplicating them would give one field two owners.

- [x] **4. SEO audit tells the truth.** DONE. `extractSilicaTreeSignals` walks the real node shape; `buildAuditableEntity` prefers the silica columns; `siteService.publish` re-grades every page of the property. — _in-our-control · M_

  > A test asserts the old extractor returns all zeroes on a real silica tree, so the reported defect is pinned rather than merely fixed.

- [x] **5. Co-editing undo is safe.** DONE — and NOT the stopgap. `invertOps` ([silica-op-invert.ts](../../packages/builder-schemas/src/silica-op-invert.ts), 19 tests) computes an action's inverse ops against the document it started from; [undo-history.tsx](../../apps/workbench/surfaces/builder/studio/undo-history.tsx) installs it as silica's `setHistoryDelegate`. Undo is now targeted — one node, one value — instead of a whole-site snapshot swap, so the stack stays alive across a co-editor's edit. — _in-our-control · M_

  > **The audit's framing was half right and worth correcting.** At 0.35.0 the engine already guards the data loss: `applyRemoteOps` does `if (!this.historyDelegate) { this.past = []; this.future = [] }`, so a remote edit cannot be reverted by a local undo — it throws the whole stack away instead. The defect that actually reaches the tenant is the second-order one: an agent editing alongside you over MCP is a DESIGNED-FOR workflow here, so in practice undo dies mid-session with nothing on screen to explain it.
  >
  > Redo replays the action's own ops — every op carries an absolute value, so re-applying IS the original edit. An undo is buffered and relayed like any other edit, because to the server and the other authors that is exactly what it is.
  >
  > Two ops cannot be inverted from outside the engine (creating a saved component; a text edit that flattens rich children). The first drops the history — and **says so**, which is the whole point: a history that empties itself silently is the complaint this slice exists to fix. Both are filed as [doc 139 §8](../139-silicaui-builder-asks.md).

- [x] **6. One responsive vocabulary.** DONE. Every seed factory is off viewport variants and onto container queries under an `@container` — [site.ts](../../packages/silica-catalog/src/site.ts), [site-chrome.ts](../../packages/silica-catalog/src/site-chrome.ts), [cms.ts](../../packages/silica-catalog/src/cms.ts), [commerce.ts](../../packages/silica-catalog/src/commerce.ts), [host-nodes.ts](../../packages/silica-catalog/src/host-nodes.ts). The ban IS enforced on live documents: `validateResponsiveVocabulary` ([vocabulary-check.ts](../../packages/silica-catalog/src/vocabulary-check.ts)) is a silica `ClassValidator` on the host seam, so `Editor.setClass` refuses a viewport variant before it commits and the Classes field shows the container class to write instead. — _in-our-control · S_

  > **It turned out sparx could enforce this itself.** The audit filed enforcement as a silicaui ask; the engine already publishes the seam (`BuilderHost.validateClass` → `setClass` returns `{ok:false, reason}` for the UI). [doc 139 §2](../139-silicaui-builder-asks.md) is narrowed accordingly — what is left upstream is making the rule universal instead of per-host, and the one check a host genuinely cannot do: whether an ancestor declares `@container`.
  >
  > Three defects surfaced beyond the sweep. **The workbench never imported the shared vocabulary** — the canvas had its own viewport-only safelist, so a container variant emitted CSS on the storefront and nothing on the canvas. The studio would have shown a broken version of a page that published fine. It imports the shared file now. **The buy box measured the wrong box**: `@container` and `@2xl:grid-cols-2` sat on the SAME element, and a container query never measures the element that declares it — on the PDP it worked only by borrowing the full-bleed section above it, so the split keyed to the window while the box itself was capped at `max-w-6xl`. **Display utilities were undeclared**, covered only because the seeded chrome happened to use them; sweeping the chrome would have taken `sm:hidden`/`sm:flex` out of the bundle and left already-published navs rendering both halves at once, or neither.
  >
  > Viewport variants stay DECLARED (not authorable) on purpose: they are wrong in the preview, correct on the live page, so dropping them would silently flatten every site authored before this. Measured cost of carrying both, gzipped: **25.7 KB → 40.4 KB**, of which ~13 KB is the compatibility half — deleting the viewport declarations once the fleet has published through the sweep returns it to ~27.6 KB. Eleven container steps measured 49.0 KB, which is why the set is five (`@sm @md @2xl @3xl @5xl`).
  >
  > The regression guard is a test that walks every shipped tree — starter site (three module combinations), record templates, chrome, commerce composites — and fails on any viewport variant or any self-querying `@container`. It carries a tripwire asserting the walk reached a non-zero number of classes, because the first version of it passed on all thirteen trees while inspecting none of them.

- [x] **7. Saved pieces reach the palette.** DONE. The tenant library is materialized into the document's symbol map as `tenant:<key>` ([saved-pieces.ts](../../apps/workbench/surfaces/builder/studio/saved-pieces.ts)), the deep link is a plain `enterSymbol`, and Save routes tenant masters to the library while the per-site symbols go to the property. — _in-our-control · L (was M)_

  > **Decided: keep `BuilderComponent` tenant-wide.** Cross-site reuse is the capability per-site silica symbols cannot provide, so it is surfaced alongside them rather than retired into them.
  >
  > **The audit understated this one, and the reason is a data-model fact it never checked: `BuilderComponent` stores RETIRED-builder trees.** `{id, type, props, children}`, not silica's `{kind, tag, class, children}`. The surviving editor cannot render, insert or open one — so "surface the library in the palette" was never a wiring job. Legacy pages were re-seeded at the cutover rather than migrated, so no BuilderNode→silica converter exists anywhere in the tree, and writing one would mean re-implementing the retired renderer to keep a format we are deleting. The library had to become silica-native instead.
  >
  > **Not `catalog().extend`, which is what the audit proposed.** silica already ships the entire saved-component system — a Components board, instance insertion, live master→instance propagation, per-instance overrides, detach, and a public `editor.enterSymbol`. Materializing each tenant piece as a symbol hands all of it over for free; a palette group would have been a second, worse component system sitting beside the real one, and inserting from it would stamp a dead copy rather than a live instance — silently breaking the "change it once, it changes everywhere" promise the Saved-pieces pane already makes in those words.
  >
  > The symbol id is DERIVED (`tenant:<key>`), never minted: the same piece is materialized independently into every site's document on every load, so a random id would differ per site and per session and an instance saved yesterday would point at nothing today. That prefix is also what `partitionSymbols` splits on at Save — site-owned symbols to the property row, tenant masters to the shared library, and only the ones whose tree actually changed (otherwise every Save mints a junk version for every piece in the library).
  >
  > **Q26 is no longer a blocker for this.** The audit filed "a host cannot deep-link into a mode" as upstream; `enterSymbol` is public and retargets the whole editing spine, so the `componentId` link works today. Q26 still stands for landing on the Components BOARD.
  >
  > Legacy pieces stay listed, keep their name/notes, and keep working wherever they are already placed — but "Edit design" is disabled on them with a plain-language reason, rather than opening an editor that renders nothing.
  >
  > **Still unverified in a browser** (the migration landed with dev down): that a master round-trips — edit it, Save, reload, still there — and that editing a master updates its instances on other pages. Both are the acceptance tests for the live-link promise, and neither is provable from types.

- [x] **8. Published-release rollback in the UI.** DONE — [version-history.tsx](../../apps/workbench/surfaces/builder/studio/version-history.tsx). The drawer is now two tabs over the two ladders that already existed server-side: **Your drafts** (every Save) and **Published** (every sealed release), the second driving `artifactService.restoreRelease`. — _in-our-control · S_

  > **Tabs, not one merged timestamp-ordered list, and that is the whole design.** The two histories restore different things and only one is visible to the public: a draft restore rewrites the working copy and nobody sees it until Publish; a release rollback changes the live site the moment it returns, with no publish step in between. Interleaved by time they would read as one ladder, and the only thing separating "changes my copy" from "changes my website" would be a badge. The tab is the wall. The rollback confirm is `danger` and names the AUDIENCE ("visitors will see that version straight away"), not just the operation.
  >
  > **A bug found while writing it: the rollback must NOT reload the editor.** The draft restore does, correctly — it rewrote the draft, so the canvas is stale. A rollback rewrites only the PUBLISHED trees, so remounting from the server draft would throw away any unsaved edit on screen to fix nothing. Rolling back a bad publish is precisely when someone is mid-repair with unsaved work open, so it was the worst possible place to reload. The stale "not live yet" badge is handled by invalidating the publish-state query instead, which never touches the canvas.
  >
  > The toast reports `pagesUnpublished` in words, because that number is otherwise invisible and alarming: a page created after the chosen release is not in its manifest, so a rollback takes it OFF the live site. The drafts survive, so the sentence says both halves — what went dark, and that one Publish brings it back.
  >
  > **Verified the chain is complete TODAY, and found the coupling that breaks it:** nothing emits a `builder.*` event on publish OR rollback, so `cache-revalidation-worker` never purges — which is harmless only because all 19 storefront routes are `force-dynamic`. Slice 21 inherits this: **turning on ISR without giving both the publish and the rollback paths a purge would leave a rolled-back site still serving the broken HTML.**

## Wave 2 — pre-publish confidence

The "Preview & Check" the audit went looking for. It does not exist today in any form, and
nobody in the comparison set does it well — this is where the builder can lead rather than catch up.

- [x] **9. `@sparx/site-lint`.** A pure engine over a resolved tree: broken internal links (against the real page roster plus product/collection handles), missing alt text, heading order, empty CTAs and dead buttons, classes with no backing CSS, missing SEO fields. — _in-our-control · M_

  > **What "resolved" turned out to mean.** Not `resolveTree` — that needs a database, and an engine that needs one cannot run from the editor. It means the COMPOSED document: the frame with the page body spliced into its outlet and every symbol instance expanded through `applyOverrides`, walked once per page with each node carrying the tree it was AUTHORED in. That provenance is what makes the report readable: a broken footer link on a twelve-page site is ONE finding whose `seenOn` lists twelve pages, not twelve findings. Data-bound nodes are exempt from every emptiness check — a product template has no words until a product fills them in.
  >
  > 23 rules across links (broken path · broken record handle · no destination · dead in-page anchor · empty `mailto:`), images (no source · no description), headings (no main heading · two main headings · skipped level · empty), controls (nothing wired to it · nothing in it), styling (emits no CSS · invisible in the device preview), structure (empty page · frame with no outlet · deleted saved piece · duplicate block id) and search metadata (missing/duplicate title + description · hidden page). Advisory only: `status` is a severity summary and nothing in the package can block a publish.
  >
  > **Two contracts worth not re-deriving.** (1) In `LinkTargets`, `undefined` means "the caller did not tell us what exists" and `[]` means "there are none" — so an unsupplied roster is never used to call a working link broken. (2) An ABSENT `alt` is reported and an explicit `alt=""` is not: empty is the correct deliberate marking for a decorative image, and the catalog already uses it that way.
  >
  > **It found four real defects on its first run, three of them in our own shipped catalog** — which is the validation that matters, and they are fixed: `gap-2.5` in the wordmark's `defaultClass` and `gap-1.5` in the product card (half steps the declared vocabulary does not contain, compiling only while their source file is `@source`-scanned and emitting nothing once copied into a tenant's tree); the footer column heading at `h3` under a page whose body ends at `h1`, leaving a hole in the reading order on four seeded pages; and — from the finding that all six transactional pages had no search description — that `robots.txt` never disallowed `/cart`, `/checkout` or `/account/`, so a password-reset page was crawlable. It also caught a false positive in itself: the product card's `href` arrives through the `bindAttr` carrier, invisible to anything reading the node, so `carrierBoundAttrs` is now exported from `@sparx/silica-catalog` and consulted.
  >
  > `routes.test.ts` reads `apps/site/app` off the filesystem and asserts the route table both covers every route the router serves and declares none it does not — the table is the only part of the package that is knowledge about the rest of the repo, so it is the only part that can go stale silently.

- [x] **10. Contrast check.** Token-aware contrast over resolved theme × authored class pairs, reusing [site-themes/v2/color.ts](../../packages/site-themes/src/v2/color.ts). — _in-our-control · M_

  > **Two rules, because there are two decisions.** The theme's own color/`-content` pairs are checked ONCE at site scope — `btn-primary`, `badge-primary` and `alert-primary` are all the same pairing, decided in the theme, so a per-node check would print thousands of copies of one fact and attach the wrong fix to each. The author's own pairings (`bg-primary` with the inherited ink on it, `text-base-300` on white, a `soft` tint under text chosen for the solid color) are per-node, because only a walk can find them. A node whose classes spell out the theme's own pair is skipped by the second rule so the same fact is never reported twice.
  >
  > **Theme pairs are scoped to colors the site actually paints with**, collected from `bg-<c>` and every component variant across every page's composed document. A theme carries eight roles and most sites use three; reporting the other five is a problem the owner does not have on a page that does not exist. It takes a fresh starter site from 3–6 findings to 0 (quartz) or 1 (ocean/grape/sunset — and those are real).
  >
  > **What had to be reproduced exactly**, in [palette.ts](../../packages/site-lint/src/palette.ts): the OKLCH token format silica's presets are written in; the `-content` auto-derivation (`--silica-content-threshold`, default 0.68, override honoured); and the `soft` tint, `color-mix(in oklab, <accent> 15%, base-100)` — mixed in OKLab because that is where the browser mixes it, and sRGB lands somewhere visibly different. `@sparx/site-themes/color` gained `parseColor`, `oklchToRgb`, `mixOklab` and `cssLightness` for it; the module was hex-only and `hexToRgb` falls back to BLACK, so it would have read every silica preset as black-on-black.
  >
  > **What is deliberately not judged:** an opacity suffix over an unknown backdrop, a gradient, `glass`, or a component painting its own surface with no authored override (a `.badge` paints `base-100` from the plugin's base layer, so inheriting the dark section behind it would invent a failure). Modelling silicaui's component layer here would be re-implementing the plugin, and a copy that drifts is worse than a gap.
  >
  > **Dark mode is checked as a second pass**, not skipped: a theme carrying a `dark` delta genuinely renders both ways, and findings name the mode — but only when there is more than one to name.
  >
  > **Two defects found, one mine and one upstream.** Mine: deriving the OKLCH lightness from a round-tripped sRGB value moves it by up to 0.02, and the derivation is a THRESHOLD comparison, so quartz's `info` — written `oklch(68% …)`, exactly the default threshold — flipped to the wrong ink and a 7.4:1 pairing reported as 2.8:1. `cssLightness` reads it off the token. Upstream: **silicaui's `autoContent` picks the wrong ink across the whole 0.55–0.68 band**, so six token/foreground pairs across the four shipped presets fail AA while the ink the rule rejected would have passed. Filed with the measurements as [doc 139 §9](../139-silicaui-builder-asks.md). sparx's own compiler is unaffected — `deriveContent` already picks by measured contrast — so only tenants on a silica preset are hit.

- [x] **11. The Check step.** Run the lint in the Publish flow; show pass / warn / fail with click-to-node. **Never block** — the owner decides, the tool advises. — _in-our-control · M_

  > **`GET /v1/builder/site/check` first, panel second** (API-first). The route is `viewer` — reading what is wrong with a site is not a change to it — and `POST /publish` does not call it, does not read its status, and cannot be made to. The assembly lives in [api-rest/lib/site-check.ts](../../services/api-rest/src/lib/site-check.ts) beside `lib/seo-audit.ts`, not in `@sparx/builder`: the answer is gathered ACROSS modules (the builder's trees, commerce's handles, the CMS's page entries, the tenant's brand), and a builder service reaching into all of them would be a builder service in name only.
  >
  > **A disabled module contributes `undefined`, not `[]`** — and the roster is never even queried. That is the engine's contract from slice 9 held at the boundary: `[]` means "there are none, so that link is broken", so emitting it for a module a tenant simply has not switched on would report every product link on the site as broken. Pinned by a test that asserts the query was not issued, not merely that the result was empty.
  >
  > **The theme derivation moved rather than being copied.** A site's theme is `null` in the database until an author opens the Design inspector, which most never do — so "what does `bg-primary` actually paint here" is only answerable by compiling the tenant's brand, with the per-site override applied. That lived in the workbench, where the canvas was its only caller. A second copy in the check would eventually disagree, and the failure mode is a check judging colours nobody sees; so `tenantTheme` + `applyBrandOverride` are now `@sparx/site-themes/v2/brand-theme.ts` and the studio file is a re-export.
  >
  > **Where the friction is.** The panel is a drawer off the studio toolbar, grouped by what each severity MEANS ("Someone visiting your site right now would hit this and it would not work"), and every finding that names a block has a **Show me** that opens the page, the header and footer, or the saved piece and selects it. Both routes in save the draft first — the endpoint reads the saved draft, and a check that is one save behind says "clean" about work it has not seen. The publish flow interrupts **only on errors**, once, with a confirm whose primary answer is "Publish anyway"; warnings and suggestions never interrupt. A check that fails to run does not hold up a publish that would otherwise succeed.
  >
  > `packages/site-lint` was added to api-rest's Dockerfile — a new workspace dependency without a `COPY` line typechecks fine and crashloops the image.

- [ ] **12. Publish-time budget.** Rendered HTML weight, image count and bytes, unbacked classes — reported next to the check. — _in-our-control · S_

## Wave 3 — the editing experience

Upstream. Filed in [doc 139](../139-silicaui-builder-asks.md); [02-silicaui-asks.md](02-silicaui-asks.md) is the bridge from the audit's evidence.

- [ ] **13. Per-breakpoint authoring** + an honest device canvas (iframe, or container-queries-only enforced). — _silicaui-ask · L_
- [ ] **14. Multi-select** and group operations. — _silicaui-ask · L_
- [ ] **15. Alignment guides, arrow-key nudge, select-parent, `Cmd+X` / `Cmd+A`.** — _silicaui-ask · M_
- [ ] **16. Q22** (`resolveTree` stops resolving children once a node's binding is filled) and **Q26** (editor mode is private state, so a host cannot deep-link). Both already filed, both still open. — _silicaui-ask · S_
- [ ] **17. Per-page frame selection** — a chrome-off landing page is currently unrepresentable. — _silicaui-ask · M_

## Wave 4 — payoff and content

Where "no better in the world" is actually won or lost.

- [ ] **18. 20–40 blueprints.** Across verticals — a shop, a services business, a publisher, a restaurant, a studio, a B2B distributor, a nonprofit. The machinery is done; the shelf is empty. — _cost-decision (authoring time) · L_
- [ ] **19. Section catalog from 18 toward 80–120.** Galleries, comparison tables, timelines, process, careers, locations, menus, case studies, before/after, calculators. — _in-our-control + silicaui · L_
- [ ] **20. Image pipeline.** Three or four widths generated on upload, `srcset` / `sizes` on emit, focal point in the picker. — _cost-decision (storage vs transform service) · M_
- [ ] **21. ISR the storefront.** Remove `force-dynamic` where the tag-purge pipeline already covers invalidation; delete the dead legacy render tiers beneath the always-true silica branch. — _cost-decision (staleness risk; likely reduces spend) · M_
  > **Blocked on a purge that does not exist yet, found during slice 8.** `cache-revalidation-worker` maps `builder.*` / `sitebuilder.*` events onto the `builder:<slug>` tag — but NOTHING emits one: neither `siteService.publish` nor `artifactService.restoreRelease` publishes an event, and there is no `builder.*` member in the `EventType` union. That is harmless only because all 19 storefront routes are `force-dynamic`, which is exactly what this slice removes. Turning on ISR without wiring both paths would mean a publish shows nothing and a ROLLBACK leaves the broken page live — the failure the rollback exists to fix, made permanent.
- [ ] **22. Close the measurability loop.** A Pages list in the Builder module showing, per page: views · visitors · conversion · revenue attributed · SEO score · load time. Consumes the already-built `top-pages` and `sources` endpoints joined to the existing order attribution. — _in-our-control · M_
  > This is the builder's equivalent of what email attribution did for email: the owner finds out whether the thing they built worked.
- [ ] **23. Collection pagination**, plus sort, filter and conditional visibility in the binder. Removes the silent 24-record cap. — _in-our-control + silicaui · L_
- [ ] **24. Cursors and selection presence**, plus per-node soft locks. — _silicaui-ask · M_

---

## Sequencing notes

- **Wave 1 slices 1–4 are the critical path.** Preview, media, SEO authoring and a truthful audit are what a tenant hits in the first hour. Nothing in Waves 3–4 pays off while those are broken.
- **Slice 6 gates slice 13.** Fixing the vocabulary first means the breakpoint UI, when it lands, has one axis to author against instead of two.
- **Slice 2 gates slice 3.** The Page settings panel's social-image field needs the media picker.
- **Slice 9 gates slices 10–12.** The lint engine is the substrate; contrast, the Check step and the budget are consumers of it.
- **Wave 4 slice 18 is independent of everything** and can start in parallel at any point — it is authoring, not engineering.

Related: [00-README.md](00-README.md) · [02-silicaui-asks.md](02-silicaui-asks.md) · [docs/139 — the silicaui asks register](../139-silicaui-builder-asks.md)
