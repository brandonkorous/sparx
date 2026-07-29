# Builder audit — roadmap to 10/10

Version: 2.11.0
Author: Brandon Korous
Last Updated: 2026-07-29

> **Status — EVERY SLICE IS DONE EXCEPT THE BLUEPRINT SHELF (18), which is another agent's
> (2026-07-28).** Waves 1, 2 and 4 are complete, and **wave 3 is no longer silicaui-blocked**:
> silicaui answered all eleven asks in `0.36.0` and the sparx side is fully adopted.
>
> **OPEN IN THE WORKING TREE (2026-07-29):** slice 17's **frame picker** + the
> publish-lifecycle defect building it exposed, and slice 25's **named layouts** on
> silicaui **0.37.0** (catalog bumped, `pnpm install` run). Typecheck is **96/96** and lint
> **94/94** — the Prisma client already knows the new column, because `pnpm install`
> regenerates it on postinstall.
>
> **The one thing still outstanding is the DATABASE.** Migration
> `20270129000000_builder_page_published_frame` is authored but NOT applied to local
> docker, so the generated client knows `published_frame_id` and Postgres does not — any
> read of a page's chrome will fail at runtime until `prisma migrate dev` runs. On prod it
> rides the DB Migrate workflow as usual.
>
> **EVERYTHING ELSE IS COMMITTED AND PUSHED — `main` is in sync with `origin/main`.** The
> per-slice file inventories that used to live here are retired: they existed to make staging
> by path possible, and there is nothing left to stage. The slices map to commits as:
>
> | Slice(s)        | Commit                                                                            |
> | --------------- | --------------------------------------------------------------------------------- |
> | 1–11            | `d839df26` + `5f1e1d75`                                                           |
> | 12, 22          | in the same series (pre-publish check + measurability)                            |
> | 19              | `3d249558` a section library for businesses that aren't software                  |
> | 20, 21, 23      | `7593477d` the storefront pages its lists, and stops shipping three chromes       |
> | 21’s blocker    | `7da0ee94` publish and rollback finally emit their purge signal                   |
> | 0.36.0 bump     | `0c0a508c` chore(deps): move the silicaui family to 0.36.0                        |
> | §6, §7 adoption | `aec56864` retire the carrier + expand workarounds silicaui 0.36 made unnecessary |
> | §10             | `44af0630` show a node only when the data behind it exists                        |
> | §1, §2          | `e8f00d71` report responsive styling that never takes effect                      |
> | §8              | `f180289f` let the engine invert an edit, so undo stops being unfaithful          |
> | 17 (§5)         | `208382f6` let a page choose its own chrome, or none at all                       |
>
> The standing rule still applies to anything NEW: a social agent and a blueprint agent are
> both working in this checkout, so stage by path, never `git add -A`, and re-check the
> branch first. Dirty files that are NOT ours right now: `packages/social/*`,
> `services/social-worker/*`, `terraform/envs/prod/serverless.tf`.
>
> **The migration `20270125000000_builder_page_frame` is applied BOTH places.** Locally it
> was swept in by another agent's `migrate deploy` alongside their
> `20270126000000_scan_owner_rls_backfill`, then verified here: column, CHECK, partial
> index, and RLS still ENABLED **and FORCED**. `builder_pages` is empty on local docker, so
> "additive, no backfill" is confirmed structurally rather than against real rows.
>
> **On PROD it has already shipped** — the DB Migrate workflow succeeded on run
> `30424690697` (2026-07-29 05:18 UTC), and `208382f6` is an ancestor of that push, so the
> cumulative `prisma migrate deploy` carried it. Nothing further is needed; an earlier note
> in this file saying prod was untouched was written before that push landed.
>
> **`pnpm install` HAS been run** (the 0.36.0 catalog bump needed it), and `prisma generate`
> with it. No new workspace package and no Dockerfile change. **The file-ownership boundary
> that used to live here is retired** — it listed which files were ours and which were the
> parallel social agent's, and the eleven committed slices no longer need separating. The
> social agent is still working in this checkout, so the standing rule survives it: stage
> by path (the files named above), never `git add -A`, and re-check the branch before
> committing. `apps/workbench/Dockerfile` and `apps/workbench/next.config.mjs` are dirty
> in this tree and are NOT ours.
>
> Four `pnpm install`s were needed across these slices as they added workspace edges
> (`packages/site-lint`, its `@sparx/site-themes` dependency, api-rest's dependency on
> site-lint, then the 0.36.0 catalog bump); all four ran and the lockfile is current.
>
> **Migration `20270123000000_builder_component_silica_tree`** is applied to local docker
> and verified there (`silica_tree` present, `tree` nullable, RLS still ENABLED + FORCED,
> all 6 pre-existing version rows untouched — the additive, no-backfill outcome it
> claimed). On prod it rides the DB Migrate workflow. **UNVERIFIED at the time of
> writing:** no db-migrate run appears for `d839df26` itself, and the run for `5f1e1d75`
> was still in progress. `prisma migrate deploy` is cumulative, so that run should apply
> it — but confirm with `gh run list --workflow=db-migrate.yml` before assuming prod has
> the column.
>
> **Gates at the last full pass (on 0.37.0, after the frame picker + named layouts):**
> workspace `pnpm typecheck` **96/96** and `pnpm lint` **94/94** — the only output is 6
> pre-existing warnings in `@sparx/web`. Unit tests: **197 silica-catalog** · **263
> builder-schemas** · **102 site-lint** · **83 builder** (73 before this pass: +5 for the
> staged chrome pointer, +5 for named layouts, less the deleted inverter's) · 89
> site-themes · and the **full api-rest suite at 291 across 56 files**. `apps/workbench`
> has no test script by design (no automated UI specs).
>
> **Not settled by any of that — only a browser can:** preview-vs-draft (slice 1) · two-tab
> undo, where `Ctrl+Z` must move only your own node (5) · a saved piece round-tripping and
> a master edit reaching its instances (7) · the Check panel's **Show me** landing on the
> right node for all three scopes, and **Open** landing on the right page from the weight
> list (11, 12) · the Page results table against a site with real traffic, where the
> collection-template row is the one to look at (22) · **`?page=2` actually rendering the
> second page, and the pager hiding itself when everything fits** (23) · **a page whose
> frame is set to `none` actually rendering with no header/footer AND still fully themed**
> (17 — the theme half is the bug `silicaActive` would have shipped) · **the frame picker
> round-tripping**: choose "No header or footer", Save, confirm Publish lights up and the
> live page is UNCHANGED until you press it (17) · **the engine's layout switcher creating
> a second design that survives a reload**, and a page pointed at it publishing through it
> (25) · **srcset serving a phone the 400/800 rung rather than the 2000** (20) · **how the
> 66 new sections look on a real theme** — they pass every structural check there is, and
> "does it look good" is not one a test can make (19).
>
> **Decisions taken, so they are not re-litigated:**
>
> - **The silicaui asks go to [doc 139](../139-silicaui-builder-asks.md), not 119.** 119 is
>   SUPERSEDED — written against silicaui-builder 0.8.0, and its framing question ("adopt
>   the engine or keep ours?") is answered and executed. Only Q22/Q26 were still live and
>   are carried into 139 §7.
> - **~~Wave 3 is filed, not built.~~ SHIPPED — silicaui answered all eleven asks in
>   `0.36.0`** (2026-07-28) and the sparx side is adopted. See
>   [doc 139](../139-silicaui-builder-asks.md) for the resolutions, including the two
>   counter-proposals that were better than the ask and the one place OUR premise was
>   wrong (§10: `visible:false` always existed; I asserted an engine limitation without
>   reading the resolver).
> - **Slice 7 resolution: keep `BuilderComponent` tenant-wide.** Cross-site reuse is the
>   capability silica symbols cannot provide (`Site.symbols` is per-site), so it is not
>   retired into them. It is surfaced by MATERIALIZING each piece as a `tenant:<key>`
>   symbol — not via `catalog().extend`, which the slice note explains.
> - **The pre-publish check is ADVISORY and stays that way.** `POST /publish` does not
>   call it, does not read its status, and must not be made to.
> - **Weight is a measurement, not a finding** (slice 12). A heavy page is a trade its
>   owner may have made on purpose, so `budget` carries no severity and cannot move the
>   check's `status`.

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

- [x] **12. Publish-time budget.** Rendered HTML weight, image count and bytes, unbacked classes — reported next to the check. — _in-our-control · S_

  > **NEXT to the findings, never among them.** Weight is not a defect. A photographer's portfolio is _supposed_ to be full of large pictures, and a tool that calls that "broken" is a tool its owner learns to ignore. So `budget` carries no severity, does not move `status`, and the publish confirm cannot see it — the same discipline as slice 11's advisory rule, applied one level down. It renders as its own section of the Check drawer, headed "How much each page weighs".
  >
  > **The number is a FLOOR and every surface has to say so.** Two things are countable from a pure engine: the bytes of the composed HTML (`renderSilicaBody` — the same projection the storefront publishes through, so the measurement and the live page cannot drift), and the bytes of the picture files a page points at. The stylesheet, webfonts, scripts, video and third-party embeds are all on top. A floor presented as a total is a number that lies in the reassuring direction, which is the one direction this must not fail in.
  >
  > **An unknown size is reported as unknown, not as zero.** The engine has no network, so it names the pictures (`imageSourcesOf`) and api-rest looks them up (`imageWeights` → `MediaVariant` first, then `MediaAsset` — a variant is what the page actually downloads, and the original it came from is usually several times larger). A source that matches nothing is counted in `imagesUnsized`; treating it as free would make a hot-linked 4 MB hero photo read as weightless. Inline `data:` pictures need no lookup — the file IS the attribute — so they are measured directly, which is the only way a 2 MB pasted SVG in the header ever becomes visible.
  >
  > **`storageKeysOf` is the fragile part, so it is the tested part.** The platform emits a media URL through four independently-evolving builders (api-rest's variant route, its local-mode file route, the CDN base, the raw GCS bucket base), and a hot-linked asset stores an absolute URL _as_ its key. Rather than guessing which one produced a given `src`, every plausible key is offered and the database decides. Seven cases pin it; without them the rot would surface as "every picture on my site says unknown size".
  >
  > **Dedupe follows what a browser downloads.** A named file counts once per page however often it appears — a logo in the header and again in the footer is one request — while a bound image counts per block, because each one is a different product photo at render time. `heavyImages` reports how many pages carry each one, which is what turns "the logo is 900 KB" into "one change makes all eleven pages lighter". Nothing is truncated: the 500 KB threshold IS the criterion.
  >
  > **The class count is by NAME; the findings are by BLOCK.** One typo repeated across three blocks is one thing to fix and three places to look, and both numbers come from the catalog's `checkClassString`, so they cannot disagree about what is broken — only about what they are counting.
  >
  > **What it does not see.** A collection template renders one card here and many on the live page, so its weight is a floor with a wider gap than a static page's. `typeOf` was hardened to `?? ''` along the way: a restored old release or a hand-written MCP tree can carry a node with neither tag nor component, and a walk that throws on it reports nothing at all — on exactly the site that needed checking.

## Wave 3 — the editing experience

Upstream. Filed in [doc 139](../139-silicaui-builder-asks.md); [02-silicaui-asks.md](02-silicaui-asks.md) is the bridge from the audit's evidence.

- [ ] **13. Per-breakpoint authoring** + an honest device canvas (iframe, or container-queries-only enforced). — _silicaui-ask · L_
- [x] **14. Multi-select** and group operations. — _~~silicaui-ask~~ → shipped in silicaui 0.37.0 · L_

  > `selectedIds` (ordered, last entry is the primary), `selectMany`, `toggleSelect`, and the batch op API 0.36.0 already carried. **No host work.** The studio touches selection in exactly one place — the Check panel's "Show me" calls `editor.select(nodeId)` to jump to a single finding — which is still the right call, and the canvas gestures are the engine's. `selection` stays the primary id so every existing reader is unchanged.

- [ ] **15. Alignment guides, arrow-key nudge, select-parent, `Cmd+X` / `Cmd+A`.** — _silicaui-ask · M_
- [ ] **16. Q22** (`resolveTree` stops resolving children once a node's binding is filled) and **Q26** (editor mode is private state, so a host cannot deep-link). Both already filed, both still open. — _silicaui-ask · S_
- [x] **17. Per-page frame selection** — a chrome-off landing page is currently unrepresentable. — _~~silicaui-ask~~ → shipped in silicaui 0.36.0 + wired here · M_

  > **The engine half arrived**: `Page.frameId` (`undefined` = site default, `null` = bare, a string = `Site.frames[id]`), `Site.frames`, and `frameFor`/`frameDiagnostic`. A dangling id resolves to NO frame rather than falling back — the author moved this page off the default deliberately, and restoring it is the worse repair.
  >
  > **Storage was already most of the way there.** `builder_layouts` has ALWAYS been a per-property CATALOG with exactly one `is_active`; the shells existed, only the per-page pointer was missing. So this is one column — `builder_pages.frame_id`, three states in ONE column (`NULL` = default, `'none'` = bare, a uuid = that layout) with a CHECK keeping the sentinel from drifting into a typo. Deliberately not a uuid + a `frameless` boolean: "which frame" and "whether a frame" are one decision, and two columns make a meaningless third state representable.
  >
  > **The real obstacle was the App Router, not the engine.** `layout.tsx` renders the chrome and is handed its children but never their route, so it cannot ask "which page am I wrapping" — per-page frames are impossible while the layout asks for _the_ frame. Rather than move `<SilicaChrome>` into all twelve routes that render a silica body (twelve copies, and a thirteenth route later that silently has none), `proxy.ts` mirrors the pathname onto `x-sparx-path` and the frame read takes `&path=`, answering with the chrome THAT page asks for. Chrome stays in one place.
  >
  > **Two bugs this would have shipped with, caught on the way.** (1) `getPublishedSilicaFrame` falls back to the code starter frame whenever `frame` is null — which would have put a header straight back onto the landing page built to avoid one. Hence `frameless` on the DTO: two opposite instructions were wearing the same `null`. (2) `silicaActive` was `Boolean(silicaFrame.frame)`, and it gates the silica THEME stylesheet, the web fonts and the accent colour — all site-level. A bare page has a null frame, so reading that alone shipped the one page an author most wants to look designed with no theme and no fonts.
  >
  > **Slice 21's "unreachable" bare-`<main>` branch is now the landing-page render path** — it stopped being dead the moment a page could ask for no chrome.
  >
  > API-first: `PATCH /v1/builder/pages/:id` takes `frameId` (`null` resets to default, `'none'` goes bare), validated against the same sentinel-or-uuid rule as the CHECK constraint so a bad value is a 400 naming the field rather than a 500 naming a constraint.
  >
  > **The picker, and the defect it exposed (2026-07-29).** Page settings now carries a **Header and footer** field — Follow the site default · No header or footer · any layout by name — riding the same pending-edit → one-Save path as the SEO fields. Two things had to be fixed to make it honest, and one of them was a real defect:
  >
  > 1. **`frameId` was write-only.** `PATCH` accepted it and `PAGE_SUMMARY_SELECT` never read it back, so a settings form could set a page's chrome but could not show the author what it was currently set to. Added to `BuilderPageSummaryDto` and both DTO mappers.
  > 2. **The choice bypassed the publish lifecycle.** `getPublishedFrame` read `frame_id` live, with no stage — so pressing Save in the editor would have changed the LIVE site's chrome while the body visitors saw was still the last published one, and Publish reported nothing to publish. This was invisible only because nothing could write the column: MCP had no frame argument and there was no picker, so every row held NULL. Adding the picker is what would have shipped it. Fixed by the pair the tree columns already use — `published_frame_id` (migration `20270129000000_builder_page_published_frame`), written by both publish paths, read by stage, and compared in `publishState` so a chrome-only change lights up Publish. Pinned by `stagedFrameId` + 5 tests, because reading the wrong column here is silent.
  >
  > MCP reached parity in the same pass with **`set_page_frame`** (the roadmap previously claimed MCP could already do this — it could not; `frameId` appeared nowhere under `mcp/`), so an agent can author a chrome-free landing page.
  >
  > **And then silicaui 0.37.0 closed the last gap, hours later.** The note here said the picker's third option would list designs an operator could not yet author, because the studio only edited the `isActive` shell. 0.37.0 makes named layouts an engine concept (`Site.frames`, `createLayout` / `renameLayout` / `deleteLayout` / `editLayout`, ops `frame.create` / `frame.rename` / `frame.delete`, and `{scope:'frame', id}` on node ops) **and ships its own layout switcher UI**, so the host needed persistence and nothing else — see slice 25.

## Wave 4 — payoff and content

Where "no better in the world" is actually won or lost.

- [ ] **18. 20–40 blueprints.** Across verticals — a shop, a services business, a publisher, a restaurant, a studio, a B2B distributor, a nonprofit. The machinery is done; the shelf is empty. — _cost-decision (authoring time) · L_

  > **NOT STARTED.** `assertRequiredMedia` in `api-rest/lib/marketplace/ingest.ts` refuses any bundle missing `media/icon.png` and `media/preview.png`, and the failure is at ingest, so a bundle without them never reaches storage.
  >
  > **~~"two real images that no amount of code can produce"~~ — that was wrong, and it was the load-bearing claim in this entry.** Corrected 2026-07-28 after actually checking:
  >
  > - **`preview.png` is defined as a screenshot.** [docs/guides/building-a-template.md](../guides/building-a-template.md) spells it out: "~1600×1000 — the card hero / **screenshot of the home page**". A blueprint's home page is a silica tree we can render; screenshotting it is mechanical, not artistic.
  > - **`icon.png` is a 512×512 catalog tile**, and this repo already renders PNGs programmatically in **15 places** via Satori `ImageResponse` — `apps/site/app/api/og/route.tsx`, `apps/web/lib/og-*.tsx`, three `opengraph-image.tsx` routes. Composing a tile from the blueprint's own theme colors is the same machinery.
  > - **Content imagery is not a blocker either.** Blueprints **hot-link** external photography — 27 such URLs across the shipped bundle and the ten component bundles — and the public media resolver passes an absolute `http(s)` key through verbatim precisely for blueprint installs (docs/54 §6).
  >
  > What genuinely cannot be produced here is **original photography** or a **bespoke per-vertical logo**. Neither is required by the ingest, and neither is what those two files are: they are marketplace CARD art for the "pick a starting point" screen, not site content.
  >
  > For scale: the one shipped bundle (`marketplace-catalog/blueprints/sparx/`) is ~3,500 lines of `blueprint.ts` + `site.json` + `content.json` + `welcome-email.json`, plus the two PNGs. Twenty to forty of those is still a content project — which is what the _cost-decision (authoring time)_ tag says — but it is an **authoring** cost, not a blocked one.
  >
  > **Slice 19 is the raw material.** The 66-section library is exactly what a vertical blueprint composes, so the per-blueprint cost is far lower than when this line was first written.

- [x] **19. Section catalog from 18 toward 80–120.** Galleries, comparison tables, timelines, process, careers, locations, menus, case studies, before/after, calculators. — _in-our-control + silicaui · L_

  > **Landed at 88 blocks — 18 from the engine plus 70 sparx entries** (4 commerce composites and a **66-section library**), in `packages/silica-catalog/src/sections/`. With the 14 host cores the Insert palette now offers 102 things. The engine's 18 are a good spine for a software marketing page and a thin one for everything this platform actually serves: with no gallery it could not be used by a photographer, with no opening hours not by a shop, with no menu not by a restaurant, with no price list not by a garage.
  >
  > **Ten groups, named for what a page is FOR** rather than for a component taxonomy: Page structure · Pictures · Helping people choose · How it works · People and proof · Where and when · Getting in touch · Writing · Selling (+ the existing Products). The audience is a non-technical owner, so the palette hint IS the product — the test fails a row whose hint is under 20 characters.
  >
  > **The house rules are STRUCTURAL, not a review checklist.** Everything is built from `sections/_shell.ts`, which has no slot above a heading, so an eyebrow cannot be authored through the kit at all. `sections.test.ts` then checks the whole library: no class outside the declared vocabulary, no viewport variant, no gradient, no `shadow-*`, no faded ink on readable text, no `text-xs` anywhere, and every `text-sm` carrying the shared `caption()` string verbatim — so small text can only enter through the one helper that means "deliberately not competing for attention".
  >
  > **Two of those tests were wrong before they were right, and the fix is the interesting part.** Counting small-text nodes failed a _correct_ six-tile gallery, because it was measuring how many cards a section had rather than whether anything was too small to read; it became the caption-class check instead. And a length check on the rendered HTML cannot see a DROPPED TAG — `toHtml` sanitises to an allowlist, so an opening-hours table silently becoming a pile of divs passes it. There is now an explicit assertion that `<table>`/`<address>`/`<form>/<label>/<input>/<textarea>`/`<dl>`/`<aside>`/`<ol>`/`<figcaption>` survive the round trip, because the semantics are the whole point of those sections.
  >
  > **Deliberate omissions, each for a reason.** No calculator — a real one needs inputs a catalog block cannot know, so `cost_examples` gives three worked jobs instead and can never quote wrong. No before/after drag-slider — it hides half the evidence behind an interaction, is hostile to a keyboard, and prints as one arbitrary frame; two labelled pictures make the same argument everywhere. No divider or spacer block — decoration and whitespace-in-a-box are the editorial formatting RULE #2 bans. No stock-icon feature row: generic icons above generic headings add nothing a reader can use and are the fastest way to make a page look generated.
  >
  > **Stamped, not host cores** — and `sections/index.ts` states why: a section is tenant content, so freezing at insert is the correct trade (the author owns every node). A host core is the opposite trade, reserved for regions the platform must keep improving forever. Only three sections use the behaviour runtime (an autoplaying showcase, a single-open FAQ, and every form); the rest are CSS-only, including the photo strip, which scrolls with a finger, a wheel and a keyboard with nothing to hydrate.
  >
  > One palette-wiring hazard closed on the way: the studio merged `COMMERCE_CATALOG` by name, so a host reaching for it alone would ship a builder with no sections and nothing visible to say so. There is now a single `SPARX_CATALOG` export and that is what the host merges.

- [x] **20. Image pipeline.** Three or four widths generated on upload, `srcset` / `sizes` on emit, focal point in the picker. — _~~cost-decision (storage vs transform service)~~ → in-our-control · M_

  > **THE COST DECISION WAS ALREADY MADE AND ALREADY PAID — the tag was stale.** `media-worker` has been generating **400 / 800 / 1200 / 2000 px in three formats** on every upload since it shipped (`VARIANT_WIDTHS` in its `env.ts`), and `media_variants` rows exist for all of them. There was no storage question left to answer and no transform service to buy. Focal point is likewise present (`focal_point_x/y` on `media_assets`, with a focal-aware cover crop in the worker).
  >
  > **The bug was never the ladder — it was that 2000px was what EVERYONE got.** The resolver `GET /v1/public/media/:id` picked `variants.reduce((a, b) => b.width > a.width ? b : a)` — literally "the widest" — and there was no way to ask for anything else. Meanwhile `siteImageLoader` (and the marketplace's) had been appending `?w=<px>` to every `next/image` srcset entry all along, and `RedirectQuery` was `z.object({ tenant })`, so zod stripped the parameter without a word. Every srcset on the storefront was a lie: four URLs, one file, always the largest.
  >
  > **The fix is `pickVariant`** ([public/media.ts](../../services/api-rest/src/routes/v1/public/media.ts)) — narrowest variant covering `w`, **clamped to the widest** when the source was too small to produce one. That clamp is the whole design. It is what dissolves the three-way decision this entry used to pose: derivation is safe precisely because naming a rung that does not exist can no longer 404. No per-page round trip (a), no widths frozen onto the node at publish (b), and no giving up the top rungs (c).
  >
  > **Emit is a tree transform at the one render seam** ([responsive-images.ts](../../packages/silica-catalog/src/responsive-images.ts), step 5 of `renderComposedTree`). It runs AFTER resolution, because a product card's image URL comes from the record — and after lowering, because a product card's image is an `Image` **atom**, not an `<img>`, and silica's `Image.expand` builds a fixed attribute set (`src`/`alt`/`loading`) that drops a `srcset` prop silently. Components whose expansion is an image are expanded through silica's own exported `expandComponent` rather than a local re-implementation, so the `ratio` → aspect-class mapping cannot drift. `sizes` is `100vw` — never under-fetches, and captures the win that matters, since 100vw on a phone is ~390px — except for a fixed-size image (`size-16`, `w-12`), which gets real pixels, because a 64px avatar at 100vw would still pull the 2000px rung on a wide display.
  >
  > **On whether 2000px was ever a good call (asked 2026-07-28): keep it.** Storage is the cheap axis and is already spent; egress is the expensive one and is driven by what gets SERVED, which `sizes` now decides. Dropping the rung would cap the platform at 1200px, which upscales — visibly — on any laptop-width full-bleed hero, and would still leave a phone over-fetching 3×. Wrong lever. The one genuine follow-up is **`avif` content negotiation** (~20–30 % smaller than webp, already generated): it needs an `Accept`-keyed choice on an edge-cached 302, so it must ship with a matching `Vary` or one browser's avif gets served to another that cannot decode it. `w` carries no such risk — it is part of the URL, so each rung is its own cache key.

- [x] **21. ISR the storefront.** Remove `force-dynamic` where the tag-purge pipeline already covers invalidation; delete the dead legacy render tiers beneath the always-true silica branch. — _cost-decision (staleness risk; likely reduces spend) · M_

  > **What "ISR" actually means here, corrected.** Full-route static rendering was never available and never will be: `resolveSite()` awaits `headers()` to map Host → tenant, so every storefront route is dynamically rendered by construction — which is also the guarantee that no tenant's page can ever be served on another tenant's domain. The whole win is the **Data Cache**. `force-dynamic` was forcing `cache: 'no-store'` on every fetch beneath it, which meant the `revalidate` windows and the `builder:` / `tenant:` / `commerce:` tags each reader in `apps/site/lib/*` declares were decorative for as long as it was there. Removing it activates the policy that was already written.
  >
  > **Twelve routes flipped**; eleven keep the directive, each for a stated reason — `cart`, `checkout`, the five `account/*`, `api/health` (per-visitor or liveness), `search` (a query surface), and `book` + `book/[serviceId]`, which is a judgement call rather than the owner's list: appointment availability is the one read where staleness is visible to a customer as a slot they can pick but not get.
  >
  > **The purge chain was verified end to end before flipping anything**, since a cache with a broken purge is worse than no cache. Five publish paths emit (`page`/`layout`/`email` services through `installBuilderPubSubBridge`, plus site publish/rollback through `lib/builder-events.ts`), the worker matches `builder.*` **by prefix**, resolves the envelope's `tenantId` to a slug, and posts the `builder` scope — which is in `SCOPES`. Written up in [docs/127 §6](../127-site-read-path-remediation.md), now marked DONE.
  >
  > **The "dead legacy tiers" line was only PARTLY true, and the difference matters.** Verified per route rather than trusted:
  >
  > - **Genuinely dead, deleted** — the home route's three fallback tiers (`getPublishedSilicaHome` cannot return null: api-rest 404s and the client answers with the starter, whose `starterPages` always has a Home at `/`); the blog route's builder tier and bare-`PageView` tier; the product route's builder tier; and the root layout's `<BuilderSiteChrome>` + `<SiteHeader>`/`<SiteFooter>` branches (`getPublishedSilicaFrame` always returns a frame once `site` resolves).
  > - **NOT dead, kept** — the catch-all `[...slug]` legacy path, because `getPublishedSilicaPage` returns null for any slug that is neither published nor a starter slug, which is every CMS article. And the product route's legacy SECTION path, because `sample` skips the silica branch entirely so a merchant can design a PDP against fixtures before a real product exists. `lib/builder.ts`, `lib/site.ts`, `BuilderRenderer` and `SectionRenderer` therefore all stay.
  >
  > **Two real bugs fell out of it.** The root layout computed `legalLinks` under `if (site && !builderLayout)` — a leftover guard that, once the silica frame always rendered, left the footer's `site.legal-links` host core EMPTY for any tenant still carrying a builder-layout row. And the layout was paying for `getPublishedBuilderLayout`, `listCollections`, and up to two `getNavigationMenu` reads on every request to feed chrome that could not render: **four api-rest round trips per page load, removed.**
  >
  > Net **−505 lines** in `apps/site`, including four fully orphaned components (`site-header`, `site-footer`, `header-scroll`, `mobile-nav`). Where a tier was deleted and something must still be returned, the terminal is a `throw` with a named cause rather than a silent fallback — except in the root layout, which wraps every route, where an unreachable branch degrades to a bare `<main>`: a site with no chrome is degraded, a site that 500s is off.
  > **~~Blocked on a purge that does not exist yet~~ — THE BLOCKER IS CLEARED (2026-07-28).** Found during slice 8: `cache-revalidation-worker` mapped `builder.*` onto the `builder:<slug>` tag and every storefront read already carried the tag, but NOTHING emitted the event — no `builder.*` member in the `EventType` union, and neither publish nor rollback published anything. Dead code that looked healthy, because all 19 routes are `force-dynamic` so nothing is cached.
  >
  > That is now wired, because it is pure engineering with no ongoing cost and it is the precondition for the rest: `builder.published` and `builder.rolled_back` are real `EventType` members, published best-effort **after** the write commits by `POST /v1/builder/site/publish` and `POST /v1/builder/site/releases/:id/restore` (`api-rest/lib/builder-events.ts`). The worker's test now asserts the two names that genuinely exist rather than four plausible ones nobody emitted, plus the prefix behaviour separately. The brain's [event catalog](../brain/api-events/event-catalog.md) records the shape to watch for: a consumer branch with no publisher is silent until caching is switched on.
  >
  > **What remains is the cost decision, and it is the owner's.** Removing `force-dynamic` trades a staleness risk for spend that most likely FALLS (fewer origin renders). Nothing else blocks it.

- [x] **22. Close the measurability loop.** A Pages list in the Builder module showing, per page: views · visitors · conversion · revenue attributed · SEO score · load time. Consumes the already-built `top-pages` and `sources` endpoints joined to the existing order attribution. — _in-our-control · M_

  > This is the builder's equivalent of what email attribution did for email: the owner finds out whether the thing they built worked.
  >
  > **`GET /v1/builder/analytics/pages` first, panel second** (API-first), `viewer` like the rest of that file. The assembly is [api-rest/lib/page-performance.ts](../../services/api-rest/src/lib/page-performance.ts), beside `site-check.ts` and for the same reason: the answer is gathered across four modules — site analytics for traffic and real-user load time, commerce for attributed revenue, the SEO module for the stored grade — and a builder service reaching into all of them would be a builder service in name only. The workbench surface is **Site → Results → Page results**.
  >
  > **`topPages` answers "which are busiest"; this answers "how is each one DOING".** The difference is the join, and popular-but-never-buys is the single most useful thing a page can say. New: `pageMetrics` in `site-analytics-reports.ts` — three grouped reads (pageviews, `metric='load'` vitals, orders by `attribution_landing_path`) merged on the path.
  >
  > **Unpaginated, and the zero row is the point.** A report listing only pages with traffic answers the question the owner already knew the answer to; the page with 0 views means nothing links to it or search has never found it. So every page is returned, sorted busiest-first with the quiet tail stable by name underneath.
  >
  > **A collection template is not a location.** Its slug is a template address — visitors land on `/products/brake-kit`, never on the template — so matching it literally reported a site's busiest page as unvisited. Its row now aggregates every path under the route its record type is served at, and says so in the subtitle along with how many of its records anyone actually opened ("400 products, 6 ever seen" is itself the finding). That needed `recordType → route prefix`, which existed nowhere: it went onto `DYNAMIC_ROUTES` in site-lint — the table that already holds the storefront's parameterized routes — rather than into a second parallel five-row list, with a test asserting it matches the catalog's `ROUTED_RECORD_TYPES` exactly in both directions.
  >
  > **Revenue is credited to the page that BROUGHT the buyer**, not the one they checked out from, because `attribution_landing_path` is the first-touch path (docs/128 §3). A product page cannot take credit for a visitor the home page won. The window and `status <> 'cancelled'` match the revenue-by-source report exactly so the two can never disagree about what a sale is, and it is scoped by `property_id` — an owner with two businesses must not see one site's revenue against the other's home page.
  >
  > **Where the honesty is.** Conversion is `null`, not 0%, when nobody came — 0% reads as failure rather than as silence. An unmeasured load time is `neutral`, never green: painting "we have no idea" the same colour as "fast" is the one thing this must not do. Folded load times are re-weighted by sample count, so a path measured twice cannot outvote one measured two thousand times. Traffic on paths no page owns (products, posts, legal) is reported in `otherPaths` rather than dropped, so the totals reconcile with the traffic card instead of quietly disagreeing with it. With Commerce off the money columns are absent rather than permanently zero. One known limitation, stated in the code: a folded template's `visitors` is a SUM across its records, so one person who browsed four products counts four times — deduplicating would cost a `COUNT(DISTINCT)` per template, and the surface words it as visits.

- [x] **23. Collection pagination**, plus sort, filter and conditional visibility in the binder. Removes the silent 24-record cap. — _in-our-control + silicaui · L_

  > **This was silent DATA LOSS, not a page size.** A bound `commerce.product` grid fetched 24 records, the storefront offered no pagination, and nothing said the other 113 existed — not to the shopper, not to the author, not to a log. It is a real page size now: `?page=2` reaches the rest, and `COLLECTION_PAGE_SIZE` is one named constant instead of a `24` inlined at each fetch.
  >
  > **The pager is a HOST CORE (`site.pagination`), and that is the whole design decision.** Pagination is almost entirely conditional — no Previous on page one, no Next on the last, the current page is text not a link, the number window shifts as you walk, and the control must render _nothing_ when everything fits. A bound tree has no conditional, so a hand-authored pager would ship a **dead "Previous" on page one of every site on the platform** and offer a page 25 that is not there. Same wall `site.brand`'s `show` and `site.legal-links` hit; it is now filed as [doc 139 §10](../139-silicaui-builder-asks.md) with all four cases, because each one costs an author-editable region.
  >
  > **Unpinned, and seeded only where it belongs.** `productsBlock` embeds the pager under a whole-catalog GRID and never under a rail — a Next button below a "Featured" strip is a curation that forgot it was one. It has to be added at authoring time rather than retrofitted: a stamped tree freezes at publish (docs/122), so a block inserted today is the only one this can reach. Unlocked, unlike every other seeded core, because it is a convenience under a grid the tenant may later delete — which tripped the `site-chrome.test.ts` deletability tripwire exactly as designed, and the assertion is now set-based rather than order-based.
  >
  > **The CMS endpoint gained `?page=`, additively.** `/v1/public/content/entries` was cursor-only, and a cursor cannot express "page 4 of 9" in a URL a reader bookmarks or a crawler follows — there is no fourth cursor to put in a link until you have walked the first three. A request naming a page gets offset paging plus a real `total`; every existing caller keeps its cursor, its `next_cursor` and its cost. A page past the end is an empty page, not a 404.
  >
  > **Sort and filter live on the BINDING and are applied by the API.** `source` now takes `sort` (newest / price / title) and `tag`, threaded into `products/full`. Applied in the query, never over the fetched page: sorting after `take` reorders the first 24 instead of choosing the top 24, which is a different list wearing the right label. `collectionSourceKey` carries them, so two grids over the same catalog with different sorts are two lists rather than one silently shared — and a source with neither keys **byte-identically to before**, or every bound grid already published would look up a source nobody loaded.
  >
  > **A separate fetch for page 2+.** The base catalog request feeds the featured rail and the product pins as well as the grid, so it stays pinned to page one; a deeper page gets its own request. A "Featured" rail built from page 3 of the catalog is whatever happened to sort there.
  >
  > **Two bugs found on the way.** The HOME route never asked whether its tree had a host node, so **every host core an author placed on their home page rendered as an empty div** — a brand mark, a theme toggle, the pager, all silently nothing. `treeHasHostNode` was private to the catch-all route; it is now shared in `lib/silica.ts` and the home route branches on it. And `components/pagination.tsx` painted itself with two inline `style` blocks including a hand-written `marginTop: '3rem'`; migrated to utilities under the touching-it-means-fixing-it rule.
  >
  > **Conditional visibility is NOT built — it is filed.** `resolveTree` substitutes and expands; it never drops a node, and a host pre-pass cannot stand in because an item-scoped condition (`show the Sale badge only when there is a compare-at price`) can only be evaluated inside the expansion the engine owns. Doc 139 §10 asks for a `when` on `NodeBase` with a small closed predicate set.

- [ ] **24. Cursors and selection presence**, plus per-node soft locks. — _silicaui-ask · M_

- [x] **25. Named layouts — a second (and third) header/footer design.** — _~~silicaui-ask~~ → shipped in silicaui 0.37.0 + persisted here · M_

  > **The engine took the half a host cannot own, including the UI.** 0.37.0 makes a layout catalog an engine concept — `Site.frames`, `createLayout` / `renameLayout` / `deleteLayout` / `editLayout`, `layouts`, `editingLayoutId`, the ops `frame.create` / `frame.rename` / `frame.delete`, and an `id` on the `frame` op scope — **and ships the switcher UI itself** (a Select plus add / rename / delete in Layout mode). So the host's job was persistence and nothing else. No sparx switcher was built, deliberately: a second one would be a second source of truth for which layout is open.
  >
  > **`builder_layouts` was already this table.** A per-property catalog with exactly one `is_active`, a draft/published pair per row, position ordering. The mapping is therefore one-to-one and needs no translation: the LIVE row is silica's default `Site.frame`, every other row is `Site.frames[id]`, and the key IS `builder_layouts.id` — which is what `builder_pages.frame_id` stores. The engine mints ids with `crypto.randomUUID`, so an id it invents is a valid primary key and satisfies the uuid CHECK on `frame_id` unchanged. (The `n_…` fallback in `defaultMakeId` fires only where `crypto.randomUUID` is missing — not any browser this admin app supports — and would fail as a 400, not as corruption.)
  >
  > **Three things this needed beyond the obvious plumbing**, each of which is a silent failure rather than a visible one:
  >
  > 1. **`BuilderOpTarget` had to accept a frame id.** `z.object` STRIPS unknown keys, so a node op inside a named layout parsed down to `{scope:'frame'}` and was filed against the DEFAULT shell — two layouts sharing one history, which no undo can untangle. It is `ownerId` on the op log now, null for the default.
  > 2. **Publish had to cover every layout, not the active one.** A page pointed at a named layout renders through THAT layout's published tree, so publishing only the live shell left such a page serving whatever the alternative looked like last time — or, for one created since, nothing.
  > 3. **`publishState` had to watch every layout too**, or editing an alternative shell reported "nothing to publish" while a page kept rendering the old one.
  >
  > **Deletion is explicit and the active layout is exempt** (`framesToDelete`), which is the page lesson from docs/126 §4.4 applied one namespace over: the engine hands a client the whole `Site`, so a stale client is missing every layout added since it loaded, and absence must never be read as removal. Pages pointing at a deleted layout fall back to the site DEFAULT rather than to bare — losing a header is a much louder change than the author asked for, and it is what the engine's own `deleteLayout` does.
  >
  > **This is what makes slice 17's picker complete.** Its third option — "use this other design for this page" — now lists designs an operator can actually author by clicking. The picker deliberately does NOT offer the live layout by id: silica's default shell is not a member of `Site.frames`, so such a page would dangle in the editor while resolving fine on the storefront — the same page previewing differently from how it publishes.

---

## Sequencing notes

- **Wave 1 slices 1–4 are the critical path.** Preview, media, SEO authoring and a truthful audit are what a tenant hits in the first hour. Nothing in Waves 3–4 pays off while those are broken.
- **Slice 6 gates slice 13.** Fixing the vocabulary first means the breakpoint UI, when it lands, has one axis to author against instead of two.
- **Slice 2 gates slice 3.** The Page settings panel's social-image field needs the media picker.
- **Slice 9 gates slices 10–12.** The lint engine is the substrate; contrast, the Check step and the budget are consumers of it.
- **Wave 4 slice 18 is independent of everything** and can start in parallel at any point — it is authoring, not engineering.

Related: [00-README.md](00-README.md) · [02-silicaui-asks.md](02-silicaui-asks.md) · [docs/139 — the silicaui asks register](../139-silicaui-builder-asks.md)
