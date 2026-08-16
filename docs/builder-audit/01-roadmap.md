# Builder audit — roadmap to 10/10

Version: 2.23.0
Author: Brandon Korous
Last Updated: 2026-08-03

> **Status — EVERY SLICE IS DONE except industry blueprints (18b).** Waves 1, 2 and 4 are complete,
> **wave 3 is fully closed** — silicaui answered all nineteen asks — and as of 2026-08-02 the sparx
> side is adopted for every one of them.
>
> **`0.45.0` closed the last three upstream asks and all three are now BUILT**
> (see [docs/silicaui/01](../silicaui/01-builder-asks.md)):
>
> - **§16 → slice 24 SHIPPED.** `/ws/builder` relays `selection` and `claim` per editor; the studio
>   hands the roster to `<Builder peers>`. A colleague's selection draws as a named ring, and the
>   subtree they are actively editing greys and refuses local edits until they stop. Both halves
>   verified in two live browsers, including the refusal and its release at the six-second TTL.
> - **§18 → the check count IS the trigger.** `StatusItem` in the status bar opens the panel; the
>   toolbar Check button is gone. One target, at the number that motivates pressing it.
> - **§19 → the custom-color workaround is retired.** `custom-colors.ts` calls silicaui's supported
>   `customColorCss` instead of diffing two plugin runs.
>
> **`0.45.0` also REMOVED named layouts** (`Site.frames`, `Page.frameId`, `setPageFrame`) — a
> deliberate upstream removal, because the feature was breaking the engine. Slice 25 is amended
> below rather than un-ticked: the capability that mattered survives, in sparx's own hands.
>
> **Slices 13 and 15 were ticked on 2026-07-30 after re-reading the shipped bundle** — both had been
> resolved upstream for two versions with the boxes left unchecked. 15 is partly a DECLINE that
> stands: alignment guides and pixel nudge are absolute-position concepts and this document model has
> no x/y, so the ask was a category error. Recorded, not deferred.
>
> **The DATABASE is no longer outstanding.** `prisma migrate status` reports all **239** migrations
> applied, `20270129000000_builder_page_published_frame` among them.
>
> **The four claims this roadmap could never verify are now closed by tests, not by eyeballing**
> (2026-07-30): named-layout persistence round-trips (`site-service.test.ts`, 39), `?page=2` walks a
> 137-product catalog with no gap or overlap (`list-paging.test.ts`, 20 — the arithmetic moved to
> `@sparx/builder-schemas` because no app in this repo has a test runner), the `srcset` ladder
> survives `toHtml` (`responsive-images.test.ts`, 18), and every section is graded against every
> shipped theme through the REAL linter (`catalog-sweep.test.ts`, 6).
>
> **That sweep found two contrast bugs that had shipped.** The product price and buy-box price used
> `text-primary` as ink, which is **1.5:1 on `salon`, 1.6:1 on `petal`, 2.0:1 on `workshop`** — those
> themes deliberately carry a bright primary that holds dark ink, so primary is a FILL there and the
> price was pale-on-pale. And `inclusion_list`'s green tick failed AA on `lodge` / `academy` for a
> signal carrying no information (every row in an inclusion list is included). Both fixed; the
> equivalent defect in the two CMS composites was fixed with them.
>
> **Everything else is committed and pushed — `main` is in sync with `origin/main`.** The
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
> The standing rule still applies to anything NEW: other agents are working in this checkout,
> so stage by path, never `git add -A`, and re-check the branch first. Dirty files that are NOT
> ours as of 2026-07-30: `.gitignore`, `terraform/envs/prod/automation.tf`,
> `terraform/modules/cloud-run-worker/main.tf`.
>
> **Staging hazard: `packages/site-lint/src/catalog-sweep.test.ts` is UNTRACKED.** Staging by
> path is what the rule above requires, and a path-by-path `git add` of MODIFIED files silently
> skips it — which would land the two contrast fixes without the sweep that found them, leaving
> nothing to catch the third one.
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
> claimed).
>
> **On prod it is now CONFIRMED, not assumed (2026-07-30).** The earlier note here said
> UNVERIFIED and told the reader to check `gh run list --workflow=db-migrate.yml` before
> believing prod had the column; that check has been run. The latest successful DB Migrate run
> is **`30434420770`** at `faa9411b` (2026-07-29 08:09 UTC), and each migration's ADDING commit
> is an ancestor of it — `20270123000000_builder_component_silica_tree` (`d839df26`),
> `20270125000000_builder_page_frame` (`208382f6`) and
> `20270129000000_builder_page_published_frame` (`b53fc940`). That is the whole builder set;
> `20270129000000_*` is also the newest migration in the tree, so **nothing builder-side is
> waiting on a deploy**. Verified by ancestry rather than by trusting cumulativeness — a
> `migrate deploy` only carries what was in the tree at ITS sha, so a migration authored after
> the last run would sit unapplied while the workflow reported nothing but successes.
>
> **Gates at the last full pass (2026-07-30, on 0.41.0):** workspace `pnpm typecheck` **98/98**,
> `pnpm lint` **96/96 with zero errors**, `pnpm format:check` clean. Unit tests: **609
> silica-catalog** · **295 builder-schemas** · **109 site-lint** · **88 builder** · 89
> site-themes. `apps/workbench` has no test script by design (no automated UI specs).
>
> After the threshold fix below, the workspace typecheck could NOT be re-run end to end: dev was
> up, and 17 node processes (including api-rest on 3100) hold the Prisma engine DLL, so
> `@sparx/db#build` EPERMs. Freeing it means killing the user's dev stack, which is theirs to
> restart, so the two changed packages were typechecked directly (`tsc --noEmit`, both clean) and
> linted directly. Re-run `pnpm typecheck` once dev is down before trusting a green workspace.
>
> **RE-RUN ON 0.45.0 (2026-08-02), dev down.** `pnpm format:check` **clean** · `pnpm typecheck`
> **96/96** · `pnpm lint` **92/94** · `pnpm test` **81/87**. The count fell from 98 because the
> workspace is now 96 packages (`packages/site-ui` went in the `@sparx/ui` prune, `783f47ab`), and
> ALL 96 declare `typecheck` — so coverage is total, not two short.
>
> **Both red stages are other agents' live work, and neither is builder-side.** Lint: 9 errors, all
> in `services/api-rest/src/lib/marketplace/self-register.ts`, which is UNTRACKED. Tests: one
> failure, `automation-worker`'s reconcile-seeds tick (`automations_tenant_id_fkey` violated), whose
> spec is dirty in the tree. This checkout carries several agents at once, so a red workspace gate
> is the normal state mid-flight and is NOT evidence about the builder. Scope your own read of it:
> the builder packages and the touched api-rest websocket files lint and typecheck clean on their
> own. Note the pre-push guard runs `lint` over the WHOLE tree, so whoever owns those files has to
> land them before anyone can push.
>
> **`themes-ink.test.ts` was red on `main` for five releases, and the themes were never wrong.**
> An earlier draft of this note blamed five `secondary` values and called nudging them an
> aesthetic decision for their owner. That was wrong, and measuring it is what showed it: the
> test carried its own `CSS_THRESHOLD = 0.68` while **silicaui moved the default to 0.57 in
> 0.36.0** — the very release whose other eleven answers we adopted. Against the real threshold
> all **320 role slots across 20 themes agree**, none sits in the crossover band, and every
> derived ink clears AA. Ten failures, zero defects, one stale constant accusing correct work.
>
> **The same stale constant was in LIVE code, which is the part that mattered.**
> `@sparx/site-lint`'s `palette.ts` — the pre-publish contrast check — predicted the ink for
> every role from `0.68`, so for any color between the two values it measured against WHITE
> where the site actually paints BLACK. That is a false alarm on a correct theme or a pass on an
> illegible button, silently, for five releases. Both copies now read
> `SILICA_CONTENT_THRESHOLD` from `packages/silica-catalog/src/content-ink.ts`.
>
> They also **disagreed on the boundary**, in opposite directions: site-lint had
> `l < t ? light : dark`, the audit had `l > t ? dark : light`, which differ at exactly
> `l === t`. The CSS settles it (`clamp(0, (t - l) * 1000, 1)` is `0` there, selecting dark
> ink) — so sharing the _decision_ as `inkForLightness`, not just the number, was the point.
>
> **Nothing automated can catch the next upstream change**, and the note in `content-ink.ts` says
> so plainly rather than implying a guard exists: the ground truth is a string inside the
> Tailwind plugin, and neither package depends on it (only on `@wizeworks/silicaui-html`).
> Re-verify by hand on every bump — already the standing rule (docs/silicaui/01 §9) — with the `grep`
> recorded in that file. A real guard needs one devDependency and a `pnpm install`.
>
> Two test fixtures had quietly stopped testing anything, and both are re-cut: site-lint's
> "bad" theme pair was only bad BECAUSE of `0.68` (a derived pair can now barely fail at all —
> the derivation picks between pure white and pure black, one of which always clears ~4.58:1),
> so it now exercises an AUTHORED ink, which is how a pair realistically fails; and the
> read-the-token-not-the-round-trip regression case had drifted off the boundary it was written
> to sit on. The derived branch keeps its coverage via a theme that overrides the threshold
> itself — which is also the only way that branch is still reachable.
>
> **The push guard could not see any of this**: `pnpm test` is not in it, only `format:check` /
> `lint` / `typecheck`. Suites after the fix: **silica-catalog 609** (from 559 pass / 10 fail —
> +40 of those are a new assertion that the winning ink clears AA, which agreement alone never
> proved) and **site-lint 109**.
>
> **~~Not settled by any of that — only a browser can.~~ SETTLED IN TWO LIVE BROWSERS,
> 2026-08-02.** This list used to be the standing warning that a green suite is not a verified
> screen. It has now been walked end to end against a real tenant, and the warning was earned:
> five claims held, and the walk found **six defects that every green suite had missed**.
>
> **PASS, with the evidence that settles each:**
>
> - **(5) two-tab undo.** A edits a heading, B edits a paragraph, both relay. `Ctrl+Z` in A
>   inverted ONLY A's node and left B's bold intact — and, the sharper case, two further
>   `Ctrl+Z` on A's exhausted stack did NOTHING rather than falling through to the shared op
>   log and eating B's work.
> - **(7) saved pieces.** "Save as component" → duplicate → ONE master color edit turned BOTH
>   instances green; after save + hard reload both returned still linked and still green.
> - **(1) preview vs draft.** Same URL, token only: live serves the published design, the
>   `?sparxSitePreview=` token serves the DRAFT, fully themed.
> - **(17) `frame: 'none'`.** The chrome-free page renders with **`<nav>` 0 / `<footer>` 0** and
>   is still FULLY THEMED (the half `silicaActive` would have broken), while the live page stays
>   at `<nav>` 1 / `<footer>` 1 until Publish. Round-trips back to `null` cleanly.
> - **(20) the `srcset` mechanism.** On `/blog` the ladder is real — 400w/800w/1200w/2000w, four
>   DISTINCT urls — and the browser genuinely selected **1200w**. `sizes` resolution works.
> - Also cleared from the never-eyes-verified list: **Search & sharing** renders on the Page root
>   (search-result preview, title, description, sharing picture) and on no other element.
>
> **DEFECTS FOUND — none of which a test was ever going to catch. ALL FOUR ARE NOW FIXED,
> each with the regression test its absence explains.**
>
> 1. **Preview was completely broken.** `window.open('', '_blank', 'noopener,noreferrer')`
>    returns NULL by specification, so the "pop-up-blocker-safe" handle was discarded at birth;
>    the placeholder tab sat at `about:blank` and the fallback `open` ran after two awaits,
>    outside the user gesture, where the blocker killed it. Every click stranded a blank tab and
>    reported nothing, because no failure branch had run. **Fixed** — opened without those
>    flags, `opener` nulled on the child instead, which keeps the isolation and the handle.
> 2. **The width ladder reached only ONE of the three render paths.** `responsiveImages` lives
>    inside `renderSilicaBody`, so `SilicaFunctionalBody` and `SilicaChrome` — the two React
>    walks — skipped it. Whether a page got responsive images therefore depended on something
>    no author can see or control: whether it happens to contain a host node. The storefront
>    home took the walk and shipped **28 images at one full-size URL each**, while `/blog` (no
>    host node) correctly offered 400/800/1200/2000. **Fixed** in `silica-chrome.tsx`; home went
>    **0 → 26 of 28**. The two remaining are the brand logo, a host-node `<img>` that is usually
>    an SVG, where a width ladder means nothing.
> 3. **`/blog?page=2` published the template's placeholder.** An out-of-range page served a card
>    headed "Post title" with a src-less image — the unbound collection template — to the public.
>    The cause is NOT a resolution bug: a repeat over `[]` renders its template once on purpose,
>    because on the studio canvas no record is ever in scope. Making empty collections drop their
>    children would silently delete authored placeholder copy from every published site. **Fixed
>    at the HTTP layer instead** — `pageOutOfRange` in `list-paging.ts`, and the routes 404. Page
>    one is never out of range, so an empty blog still renders its empty state.
> 4. **The Page results table double-counted a null-slug page.** `page.slug ?? '/'` collapsed
>    "no address" into "the home page", so "Home — Landing" (`slug: null`) read the home row's
>    metrics and rendered as a second `/` with identical figures. **Fixed** — an unaddressed page
>    is still listed (a page nobody can reach is worth surfacing) but claims no path and no
>    traffic. Verified live: Home 12 people / 105 opens alone; the orphan 0 / 0 / no path.
> 5. **Preview opened the CANONICAL PRODUCTION origin in local dev** — `siteOrigin` resolves the
>    tenant's real domain, so a locally-minted preview JWT went to an external host and the draft
>    could never be shown. **Fixed** behind `NEXT_PUBLIC_STOREFRONT_ORIGIN`, which also appends
>    the `?tenant=`/`?property=` the storefront needs where there is no per-tenant DNS. Unset —
>    every deployed environment — the branch is dead and production behaviour is unchanged.
>
> **TWO REPORTED DEFECTS WERE RETRACTED, and both were measurement error rather than code:**
>
> - **"`sizes` does not match the layout"** — not a defect. `responsive-images.ts` already
>   explains it: `grid-cols-*` is authored as a CONTAINER query and `sizes` can only express
>   VIEWPORT conditions, so dividing by column count risks understating, and an understated
>   `sizes` is a blurry image — worse than a wasteful one. A documented, deliberate trade-off.
> - **"`/shop` emits `sizes` with zero `srcset`"** — the grep was case-sensitive and React emits
>   `srcSet`. `/shop` has a full next/image ladder (256→3840) through the custom loader.
>
> Both are worth keeping in the record: the verification pass that found four real defects also
> produced two false ones, and in each case the tool was wrong rather than the tree.
>
> **Still not settled, stated as such rather than glossed:**
>
> - **The collection-template row (22)** could not be inspected: all 8 pages on the test site are
>   `kind: singleton`, so the row the check asks for does not exist. Needs a fixture with a
>   collection page.
> - **"The pager hides when everything fits" (23)** is consistent with what was seen but NOT
>   proven — no `rel="next"`/`rel="prev"` exists anywhere and every collection fits on one page.
>   Needs a collection larger than the page size.
> - **Phone rung selection (20)** was read from the live DOM at desktop width; a real narrow
>   viewport was not exercised.
> - `site-service.test.ts`'s named-layout UI half (25) is **moot** — 0.45.0 withdrew the feature.
> - `catalog-sweep.test.ts` grades structure and contrast, but **"does it look good" is not a
>   judgement a test can make** (19).
> - Never eyes-verified, still: the status badges beside "Page" in the footer · Check and History
>   dimming only the editor pane rather than the whole MDI · a header/footer finding's **Show me**
>   switching to Layout mode with the block selected.
>
> **Decisions taken, so they are not re-litigated:**
>
> - **The silicaui asks go to [docs/silicaui/01](../silicaui/01-builder-asks.md), not 119.** 119 is
>   SUPERSEDED — written against silicaui-builder 0.8.0, and its framing question ("adopt
>   the engine or keep ours?") is answered and executed. Only Q22/Q26 were still live and
>   are carried into docs/silicaui/01 §7.
> - **~~Wave 3 is filed, not built.~~ SHIPPED — silicaui answered all eleven asks in
>   `0.36.0`** (2026-07-28) and the sparx side is adopted. See
>   [docs/silicaui/01](../silicaui/01-builder-asks.md) for the resolutions, including the two
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

- [x] **5. Co-editing undo is safe.** DONE — and NOT the stopgap. an action's inverse ops are computed against the document it started from — originally by a host module (`silica-op-invert.ts`, 19 tests), now by the engine's own `editor.inverseOf(ops, before)` (silicaui 0.36.0), which handles the two cases the host could not; [undo-history.tsx](../../apps/workbench/surfaces/builder/studio/undo-history.tsx) installs it as silica's `setHistoryDelegate`. Undo is now targeted — one node, one value — instead of a whole-site snapshot swap, so the stack stays alive across a co-editor's edit. — _in-our-control · M_

  > **The audit's framing was half right and worth correcting.** At 0.35.0 the engine already guards the data loss: `applyRemoteOps` does `if (!this.historyDelegate) { this.past = []; this.future = [] }`, so a remote edit cannot be reverted by a local undo — it throws the whole stack away instead. The defect that actually reaches the tenant is the second-order one: an agent editing alongside you over MCP is a DESIGNED-FOR workflow here, so in practice undo dies mid-session with nothing on screen to explain it.
  >
  > Redo replays the action's own ops — every op carries an absolute value, so re-applying IS the original edit. An undo is buffered and relayed like any other edit, because to the server and the other authors that is exactly what it is.
  >
  > Two ops cannot be inverted from outside the engine (creating a saved component; a text edit that flattens rich children). The first drops the history — and **says so**, which is the whole point: a history that empties itself silently is the complaint this slice exists to fix. Both are filed as [docs/silicaui/01 §8](../silicaui/01-builder-asks.md).

- [x] **6. One responsive vocabulary.** DONE. Every seed factory is off viewport variants and onto container queries under an `@container` — [site.ts](../../packages/silica-catalog/src/site.ts), [site-chrome.ts](../../packages/silica-catalog/src/site-chrome.ts), [cms.ts](../../packages/silica-catalog/src/cms.ts), [commerce.ts](../../packages/silica-catalog/src/commerce.ts), [host-nodes.ts](../../packages/silica-catalog/src/host-nodes.ts). The ban IS enforced on live documents: `validateResponsiveVocabulary` ([vocabulary-check.ts](../../packages/silica-catalog/src/vocabulary-check.ts)) is a silica `ClassValidator` on the host seam, so `Editor.setClass` refuses a viewport variant before it commits and the Classes field shows the container class to write instead. — _in-our-control · S_

  > **It turned out sparx could enforce this itself.** The audit filed enforcement as a silicaui ask; the engine already publishes the seam (`BuilderHost.validateClass` → `setClass` returns `{ok:false, reason}` for the UI). [docs/silicaui/01 §2](../silicaui/01-builder-asks.md) is narrowed accordingly — what is left upstream is making the rule universal instead of per-host, and the one check a host genuinely cannot do: whether an ancestor declares `@container`.
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
  > **Two defects found, one mine and one upstream.** Mine: deriving the OKLCH lightness from a round-tripped sRGB value moves it by up to 0.02, and the derivation is a THRESHOLD comparison, so quartz's `info` — written `oklch(68% …)`, exactly the default threshold — flipped to the wrong ink and a 7.4:1 pairing reported as 2.8:1. `cssLightness` reads it off the token. Upstream: **silicaui's `autoContent` picks the wrong ink across the whole 0.55–0.68 band**, so six token/foreground pairs across the four shipped presets fail AA while the ink the rule rejected would have passed. Filed with the measurements as [docs/silicaui/01 §9](../silicaui/01-builder-asks.md). sparx's own compiler is unaffected — `deriveContent` already picks by measured contrast — so only tenants on a silica preset are hit.

- [x] **11. The Check step.** Run the lint in the Publish flow; show pass / warn / fail with click-to-node. **Never block** — the owner decides, the tool advises. — _in-our-control · M_

  > **`GET /v1/builder/site/check` first, panel second** (API-first). The route is `viewer` — reading what is wrong with a site is not a change to it — and `POST /publish` does not call it, does not read its status, and cannot be made to. The assembly lives in [api-rest/lib/site-check.ts](../../services/api-rest/src/lib/site-check.ts) beside `lib/seo-audit.ts`, not in `@sparx/builder`: the answer is gathered ACROSS modules (the builder's trees, commerce's handles, the CMS's page entries, the tenant's brand), and a builder service reaching into all of them would be a builder service in name only.
  >
  > **A disabled module contributes `undefined`, not `[]`** — and the roster is never even queried. That is the engine's contract from slice 9 held at the boundary: `[]` means "there are none, so that link is broken", so emitting it for a module a tenant simply has not switched on would report every product link on the site as broken. Pinned by a test that asserts the query was not issued, not merely that the result was empty.
  >
  > **The theme derivation moved rather than being copied.** A site's theme is `null` in the database until an author opens the Design inspector, which most never do — so "what does `bg-primary` actually paint here" is only answerable by compiling the tenant's brand, with the per-site override applied. That lived in the workbench, where the canvas was its only caller. A second copy in the check would eventually disagree, and the failure mode is a check judging colors nobody sees; so `tenantTheme` + `applyBrandOverride` are now `@sparx/site-themes/v2/brand-theme.ts` and the studio file is a re-export.
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

Upstream. Filed in [docs/silicaui/01](../silicaui/01-builder-asks.md); [02-silicaui-asks.md](02-silicaui-asks.md) is the bridge from the audit's evidence.

- [x] **13. Per-breakpoint authoring** + an honest device canvas. — _~~silicaui-ask~~ → shipped in silicaui 0.36.0 (docs/silicaui/01 §1 + §2); host half adopted · L_

  > **Both halves landed, and the answer was better than the ask.** The Inspector writes CONTAINER
  > variants (`@md:`), not viewport ones, and the device toggle drives the prefix through
  > `useBreakpoint` — so "what I am looking at" and "what I am editing" cannot drift, which is what
  > the iframe alternative was only approximating. The canvas is an element whose width the toggle
  > sets, so a viewport variant would never reflow with it; that is why the honest device canvas
  > turned out to be "container-queries-only", not an iframe.
  >
  > **And it is ENFORCED on live documents, not just preferred.** `validateResponsiveVocabulary`
  > ([vocabulary-check.ts](../../packages/silica-catalog/src/vocabulary-check.ts)) rides the host's
  > `validateClass` seam, so `Editor.setClass` refuses a viewport variant before it commits and the
  > Classes field names the container class to write instead. §2's point that this belongs in a
  > liftable POLICY rather than the security-load-bearing floor was correct and is how it shipped.

- [x] **14. Multi-select** and group operations. — _~~silicaui-ask~~ → shipped in silicaui 0.37.0 · L_

  > `selectedIds` (ordered, last entry is the primary), `selectMany`, `toggleSelect`, and the batch op API 0.36.0 already carried. **No host work.** The studio touches selection in exactly one place — the Check panel's "Show me" calls `editor.select(nodeId)` to jump to a single finding — which is still the right call, and the canvas gestures are the engine's. `selection` stays the primary id so every existing reader is unchanged.

- [x] **15. Alignment guides, arrow-key nudge, select-parent, `Cmd+X` / `Cmd+A`.** — _~~silicaui-ask~~ → the keyboard half shipped in 0.36.0; guides + nudge DECLINED, correctly (docs/silicaui/01 §4) · M_

  > **Shipped:** `selectParent`, `Cmd+A` and `Cmd+X` are in `useEditorShortcuts` — verified in the
  > 0.41.0 bundle, not taken from a changelog. Escape now steps UP the tree instead of clearing to
  > nothing, which was the actual daily friction in the list.
  >
  > **Declined, and this was the right call rather than a deferral.** Alignment guides, distribute
  > and pixel nudge are ABSOLUTE-POSITION concepts. This is a flow + class-only model: there is no
  > x/y on a node to nudge, and "align these two" is `items-center` on their parent. Building
  > guides would have meant inventing a geometry layer the document cannot express, so the honest
  > answer is that the ask was a category error — recorded here rather than left looking unfinished.

- [x] **16. Q22** (`resolveTree` stops resolving children once a node's binding is filled) and **Q26** (editor mode is private state, so a host cannot deep-link). — _~~silicaui-ask~~ → both answered; the host half adopted · S_

  > **Q22 was never real, and that is recorded rather than quietly dropped.** `resolveNode`'s value branch recurses — the same finding that made §10's premise wrong. The audit had carried it forward from 119 without re-reading the resolver at 0.35.0.
  >
  > **Q26 is answered by `initialMode` + `onModeChange`, and the studio now uses both.** `builder.studio` takes a `{mode}` param (`page` · `layout` · `component` · `theme`, validated — a typo opens the editor normally rather than handing silica a mode it has no case for), and `onModeChange` retitles the pane, because "Editor" on four torn-off windows tells an operator nothing.
  >
  > **The deep link this earns, and why it is not decoration.** The nav catalog has always claimed `header` / `footer` / `menu` land in the Editor — and they did, on a page BODY, with no signpost to the chrome. Site identity says twice that it owns the header's CONTENT and that the editor owns its arrangement, and offered no way there. It now carries two links: **Design the header & footer** (`mode: 'layout'`) and **Colors & type** (`mode: 'theme'`), on the same shift/alt target contract as every other list.
  >
  > **What is still not possible, deliberately:** `initialMode` seeds at mount and is never re-read, and there is no `editor.setMode`. So an affordance INSIDE the editor — "edit the header this page uses", from the frame picker in `toolbarSlot` — cannot switch surface itself. Not re-raised: a controlled mode would let a parent re-render pull an author out of the surface they are working in, which is the worse failure. Weighed, not missed.

- [x] **17. Per-page frame selection** — a chrome-off landing page is currently unrepresentable. — _~~silicaui-ask~~ → shipped in silicaui 0.36.0 + wired here · M_

  > **The engine half arrived**: `Page.frameId` (`undefined` = site default, `null` = bare, a string = `Site.frames[id]`), `Site.frames`, and `frameFor`/`frameDiagnostic`. A dangling id resolves to NO frame rather than falling back — the author moved this page off the default deliberately, and restoring it is the worse repair.
  >
  > **Storage was already most of the way there.** `builder_layouts` has ALWAYS been a per-property CATALOG with exactly one `is_active`; the shells existed, only the per-page pointer was missing. So this is one column — `builder_pages.frame_id`, three states in ONE column (`NULL` = default, `'none'` = bare, a uuid = that layout) with a CHECK keeping the sentinel from drifting into a typo. Deliberately not a uuid + a `frameless` boolean: "which frame" and "whether a frame" are one decision, and two columns make a meaningless third state representable.
  >
  > **The real obstacle was the App Router, not the engine.** `layout.tsx` renders the chrome and is handed its children but never their route, so it cannot ask "which page am I wrapping" — per-page frames are impossible while the layout asks for _the_ frame. Rather than move `<SilicaChrome>` into all twelve routes that render a silica body (twelve copies, and a thirteenth route later that silently has none), `proxy.ts` mirrors the pathname onto `x-sparx-path` and the frame read takes `&path=`, answering with the chrome THAT page asks for. Chrome stays in one place.
  >
  > **Two bugs this would have shipped with, caught on the way.** (1) `getPublishedSilicaFrame` falls back to the code starter frame whenever `frame` is null — which would have put a header straight back onto the landing page built to avoid one. Hence `frameless` on the DTO: two opposite instructions were wearing the same `null`. (2) `silicaActive` was `Boolean(silicaFrame.frame)`, and it gates the silica THEME stylesheet, the web fonts and the accent color — all site-level. A bare page has a null frame, so reading that alone shipped the one page an author most wants to look designed with no theme and no fonts.
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

- [x] **18a. The BASE shelf — 21 one-size-fits-all starter themes.** SHIPPED. `marketplace-catalog/blueprints/`: the golden `sparx` bundle plus 20 themed clones from `_gen/gen-sparx-themed.ts`, each a complete multi-module starter (shop · journal · booking · wholesale). — _done · L_

  > **They share one 7-page structure BY DESIGN, and that is not a deficiency.** Brandon,
  > 2026-08-02: _"the 21 bundles are the base themes. They should be this way. They should NOT be
  > thought of as specifics to an industry… these are intended to be one size fits all."_ The
  > per-theme `audience` strings in the generator (`petal` → florists, `garage` → vehicle service)
  > are marketing framing for the marketplace CARD, not a promise of vertical-specific content.
  >
  > **An earlier version of this entry read their uniformity as an empty shelf and scored the
  > builder down for it. That was the wrong frame** and is corrected here so it is not re-derived.
  > Real defects in these bundles are still worth fixing — 346 lint findings were, on 2026-08-02
  > (see slice 28) — but "every base theme is the same layout" is not one of them.

- [ ] **18b. Industry-specific blueprints.** A restaurant, a B2B distributor, a nonprofit, a studio — authored ALONGSIDE the base shelf, never by specialising it. Wanted, and starting once the rest of the builder is signed off. — _cost-decision (authoring time) · L_

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
  > **Where the honesty is.** Conversion is `null`, not 0%, when nobody came — 0% reads as failure rather than as silence. An unmeasured load time is `neutral`, never green: painting "we have no idea" the same color as "fast" is the one thing this must not do. Folded load times are re-weighted by sample count, so a path measured twice cannot outvote one measured two thousand times. Traffic on paths no page owns (products, posts, legal) is reported in `otherPaths` rather than dropped, so the totals reconcile with the traffic card instead of quietly disagreeing with it. With Commerce off the money columns are absent rather than permanently zero. One known limitation, stated in the code: a folded template's `visitors` is a SUM across its records, so one person who browsed four products counts four times — deduplicating would cost a `COUNT(DISTINCT)` per template, and the surface words it as visits.

- [x] **23. Collection pagination**, plus sort, filter and conditional visibility in the binder. Removes the silent 24-record cap. — _in-our-control + silicaui · L_

  > **This was silent DATA LOSS, not a page size.** A bound `commerce.product` grid fetched 24 records, the storefront offered no pagination, and nothing said the other 113 existed — not to the shopper, not to the author, not to a log. It is a real page size now: `?page=2` reaches the rest, and `COLLECTION_PAGE_SIZE` is one named constant instead of a `24` inlined at each fetch.
  >
  > **The pager is a HOST CORE (`site.pagination`), and that is the whole design decision.** Pagination is almost entirely conditional — no Previous on page one, no Next on the last, the current page is text not a link, the number window shifts as you walk, and the control must render _nothing_ when everything fits. A bound tree has no conditional, so a hand-authored pager would ship a **dead "Previous" on page one of every site on the platform** and offer a page 25 that is not there. Same wall `site.brand`'s `show` and `site.legal-links` hit; it is now filed as [docs/silicaui/01 §10](../silicaui/01-builder-asks.md) with all four cases, because each one costs an author-editable region.
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
  > **Conditional visibility is NOT built — it is filed.** `resolveTree` substitutes and expands; it never drops a node, and a host pre-pass cannot stand in because an item-scoped condition (`show the Sale badge only when there is a compare-at price`) can only be evaluated inside the expansion the engine owns. docs/silicaui/01 §10 asks for a `when` on `NodeBase` with a small closed predicate set.

- [x] **24. Cursors and selection presence**, plus per-node soft locks. — _~~silicaui-ask~~ → answered in silicaui `0.45.0` ([docs/silicaui/01 §16](../silicaui/01-builder-asks.md#16--other-editors-selections-and-a-soft-claim-on-a-subtree)) and **SHIPPED here 2026-08-02** · M_

  > **The only open item on this roadmap that is not blueprint authoring, and it was the one ask
  > never written up.** Filed 2026-07-30. Reframed on the way: the ask is PEER SELECTIONS, not
  > cursors — a pixel cursor is the wrong primitive for a node tree with no x/y, which is the same
  > reason §4's nudge was declined. "Ana is in this block" is the fact that matters.
  >
  > **Deliberately filed as POLISH, not correctness.** The document is already safe without it —
  > per-node last-write-wins, the append-only op log, and draft version history — and presence
  > already answers the coarse question (who is here, on which page). What is missing is
  > attribution: two authors on ONE page see each other's edits land with nothing on screen
  > connecting them to a name.
  >
  > **The upstream half landed on 2026-08-02 in `0.45.0`**, and the shape is better than the ask:
  > ONE `peers` roster instead of the proposed two lists, because a claim with no name and no color
  > cannot say WHO is holding a block, and two lists keyed differently drift the moment one updates
  > without the other. `selection` draws (named ring + Navigator marker); `claim` enforces (the
  > subtree greys and refuses local mutation, while everything around it stays editable).
  >
  > **SHIPPED the same day.** `BuilderPresence` gained `selection` and `claim`; two client→server
  > events carry them; the api-rest namespace stores each on the socket and rebroadcasts the roster;
  > `BuilderLiveSync` reports it up and the studio hands it to `<Builder peers>`.
  >
  > **The two are sent on DELIBERATELY different rules, and that is the whole design.** A selection
  > is where a person is LOOKING, so it is broadcast freely, binds nobody, and rides a 200ms
  > trailing throttle — what a colleague wants to see is where someone settled, not every block
  > they passed through. A claim is what a person is CHANGING, so it is asserted only while they
  > are actually changing it and released six seconds after they stop. Collapsing them — claiming
  > whatever is selected — would mean clicking a block to read it locks a colleague out of it, and
  > people would learn to distrust the greying, which is worse than never having built it.
  >
  > **Three things had to be got right for a claim to stay honest.** It is renewed LOCALLY, so
  > typing a paragraph is one message rather than one per keystroke. Relayed ops raise a depth
  > guard, so folding in a colleague's edit never claims on their behalf. And it dies with the
  > socket, so a tab that crashes mid-edit releases what it held as soon as socket.io notices,
  > with no TTL to get wrong on the server.
  >
  > Nothing is relayed for claims and nothing touches the undo stack, so a claim can never be why a
  > remote op was dropped — which is what keeps this polish rather than correctness.
  >
  > **One finding came out of building it, and it is the reason the wiring looks inside-out.** A
  > claim has to be driven by a real EDIT, and `editor.subscribe` does not deliver one: it fires
  > for `selection`, `peers` and `replace`, but a class change that returned `ok` — and that every
  > other client received — arrives with `ops` EMPTY. Ops surface only through `<Builder onChange>`,
  > which belongs to the studio, so the studio calls INTO the socket component through a ref rather
  > than the socket component listening out. (`subscribe` does see selection, which is the other
  > half of the same lesson: it is a usable trigger for one of these two and useless for the other.)
  >
  > **VERIFIED end to end in two browsers 2026-08-02**, both halves: a peer's selection draws as a
  > dashed named ring plus a Navigator marker while the receiving client's own inspector correctly
  > still reads "No selection"; a peer's claim renders the engine's banner — _"E2E Staff is editing
  > this. Your changes here are paused until they move on."_ — and **refuses the local edit**
  > (clicking a size pill on a claimed heading left it unchanged; the identical click on the
  > identical control succeeded the moment the claim expired). The roster carried
  > `selection` → `claim` → claim-gone at exactly the six-second TTL.
  >
  > **A claim cannot be verified from outside the browser, and assuming otherwise cost a session.**
  > Any out-of-band check — attaching a socket, reading presence from a script — costs more than six
  > seconds, so it reads back an expired claim and a working implementation looks broken. Watch the
  > OTHER client inside the window; that is also the only thing a user ever experiences.

- [x] **25. Named layouts — a second (and third) header/footer design.** — _~~silicaui-ask~~ → shipped in silicaui 0.37.0 + persisted here; **the engine half was WITHDRAWN in 0.45.0 — see the amendment at the end** · M_

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
  >
  > ### AMENDED 2026-08-02 — silicaui 0.45.0 withdrew the engine half
  >
  > `Site.frames`, `Page.frameId`, `setPageFrame`, `createLayout` and the switcher UI are gone: 17 references in `0.44`'s builder declarations, zero in `0.45`. A DELIBERATE removal — the feature was breaking the engine — not a regression to chase.
  >
  > **What survives, which is nearly all of it.** `builder_layouts` is sparx's own table and is untouched: many rows per site, one `is_active`, draft/published per row, and the MCP tools (`create_builder_layout`, `set_active_layout`, `publish_builder_layout`, …) still create, publish and switch them. `Site.frame` — the ONE shared shell every page wears — is still an engine concept, still edited in Layout mode, and still seeded by the starter and all 21 blueprints. `builder_pages.frame_id`, `page-frame.ts`'s tri-state resolution, the publish pipeline and the storefront read are all ours and all still correct.
  >
  > **What was actually lost: editing a NON-active shell on the canvas.** Zero of the 21 shipped blueprints have ever used one.
  >
  > **Two silent data-loss paths had to be closed on the way**, and both are worth naming because each would have destroyed tenant work on the first Save after the upgrade rather than failing loudly:
  >
  > 1. **`deletedFrameIds` subtracts what the engine reports from what we loaded.** An engine that reports NOTHING therefore says "delete all of them", and `framesToDelete` obeys. A business with three header designs would have had one. The studio no longer speaks about `frames` at all — saying nothing preserves them.
  > 2. **`frameId: frameIdToStored(p.frameId)` maps `undefined` to the site-default sentinel.** With the engine no longer carrying a `frameId`, every page would have been reset to the default on save — wiping every "this page renders bare" choice. The field is now ABSENT from the sync, which `site-service` reads as "leave the column alone".
  >
  > **The per-page chrome control came back to sparx, as a SWITCH.** It lived in page settings originally, was deleted when 0.37 shipped the engine's picker (two controls writing one column through two endpoints), and returns now as the single owner. It is two-state rather than three because the third option — "use this OTHER named design" — has nothing to point at and no way to be created. The RESOLVER stays tri-state: a page stored against a named layout must keep rendering as it always has, and that is decoding what is on disk rather than a choice worth showing anyone.

---

## Wave 5 — the two surfaces that break the MDI

Raised by Brandon on 2026-07-30, looking at the shipped studio. Both are **surfaces I built as
drawers**, and the objection is not cosmetic: _"nowhere in this MDI platform do we have panels,
they completely break the flow."_ An earlier pass this session made these drawers PANE-SCOPED so
they stopped covering the whole MDI — that treated the symptom. The container itself is wrong.

- [x] **26. History belongs in the right panel as a third tab — `Design` · `Settings` · `History`.**
      — _silicaui-ask → SHIPPED in `0.43.0`; adopted and browser-verified 2026-07-31 · M_

  > **Why it could not be built host-side, and what changed.** Against `0.41.0` the engine offered
  > exactly one inspector seam, `BuilderHost.inspectorPanels?(node): InspectorPanel[]`, wrong on
  > both axes: it appends SECTIONS INSIDE an existing tab rather than adding a tab, and it is
  > NODE-SCOPED, so a document-scoped tool would appear and vanish with the selection. Filed as
  > **docs/silicaui/01 §17**; `0.43.0` answered it with
  > `inspectorTabs?(node: SelectableNode | undefined): InspectorTabDef[]` and a `scope: "panel"`
  > variant that renders with nothing selected.
  >
  > **What shipped here.** The drawer is gone. History is a panel-scoped tab at `order: 20`
  > (Design is 0, Settings 10), returned unconditionally — filtering it on the selection is the
  > documented way to make it unreachable the moment the author clicks empty canvas. Each side
  > fetches only while its own sub-tab is showing, so opening History costs one request.
  >
  > **The rail is not the drawer, and the first pass proved it.** Porting the rows verbatim into a
  > 16–34%-wide column produced four identical bordered cards, each with a grey "You saved" badge
  > and an outlined button. Brandon: _"it still looks like absolute garbage."_ The rebuild is in
  > [DESIGN.md](../../DESIGN.md) §5 as the canonical worked example:
  > clock times under day headings (three saves in an afternoon all read "3 hours ago"), the actor
  > badge colored by WHO — `info` / `module-ai` / `warning` — so the rows differ with the text
  > covered, `info`/`warning` on the tab strip itself to carry draft-vs-live, solid `primary`
  > Restore and solid `danger` Put back.
  >
  > Two smaller corrections found on the way: silica's `<ListTitle>` is an 11px uppercase 60%-opacity
  > micro-cap (replaced with real ink at real size), and `<TabsTab className="text-base-content">`
  > — carried over from the drawer — was overriding the ACTIVE pill's own `-content` foreground.
  > Brandon caught that one: _"why the hell did you set the tab to be text-base-content instead of
  > letting our theme engine handle it?"_ The resting tab was never faded; the override only broke
  > the selected state.

- [x] **27. The Check surface does not earn a person's attention.** — _design · REBUILT and
      browser-verified 2026-07-30 · L_

  > **What shipped.** The drawer is a **popover** anchored to the Check button — no scrim, canvas
  > never covered, `PaneScope`'d so a torn-off window opens it on the right monitor
  > (`PopoverContent` reads `usePortalContainer`). Findings are **one line each** — dot, title,
  > place — with the paragraph behind a per-row disclosure. **The row itself is the button**;
  > "Show me" was a second target for the thing clicking a row obviously does. Page weight is
  > collapsed: it is reference, not a worklist, and expanded it was most of the panel's length.
  >
  > **The count moved to the status bar** (`CheckCount` → `statusBarSlot`), which is the half a
  > busy person actually reads — "15 to fix" without opening anything. Brandon asked for the popup
  > to hang off the status bar itself; §14 documents that slot as non-interactive, so the COUNT is
  > down there and the CONTROL stayed in the toolbar — which is the engine's own split, state below
  > and actions above. The rule looks one case too broad and is challenged as **docs/silicaui/01 §18**,
  > without pre-empting it.
  >
  > **§18 was answered on 2026-08-02 in `0.45.0`, so the split can now close.** silicaui shipped a
  > `StatusItem` component rather than a softened sentence: no `onClick` and it is a plain `<span>`
  > like the engine's own labels; with one it becomes a ghost `btn-xs` sized so the 28px strip never
  > changes height, carrying `aria-expanded`/`aria-controls`. `CheckCount` becomes the trigger and
  > the toolbar button goes away — **not yet done**, and the only reason the count and its list are
  > still two floors apart.
  >
  > **And it no longer runs on open** — opening cost a save plus a full walk of every page to
  > re-read a list you had just read. There is a Run button. The studio marks the report stale on
  > the next edit and **drops the count rather than showing one that has stopped being true**: fix
  > three broken links and a strip still reading "3 broken" is the number you were meant to trust
  > telling you the one lie that matters.
  >
  > **Verified in a browser end to end:** popover opens anchored with the canvas visible · Run
  > produces 15 findings · the status bar picks up "15 to fix" · a chevron expands one row's prose
  > and `gap-2.5` evidence while the other 14 stay one line · clicking a row closes the popover,
  > selects the `<a>` in Layers, rings it on canvas and opens the inspector on it · **one padding
  > edit and the count disappears**.
  >
  > **AND IT FIXES THINGS NOW.** I argued this should wait — every correction is a real edit to the
  > author's document, and "the check silently changed your page" is a worse failure than the wall
  > of text was. Brandon wanted it, and the objection turned out to be satisfiable rather than a
  > reason to defer: the danger is entirely in WHICH findings offer it, so that judgement was made
  > server-side where the evidence is, and the edit goes through `setClass` — an op, so **Ctrl+Z
  > takes it back like any other edit**. That was the condition for building it at all.
  >
  > **Two separate questions decide whether a finding may offer a fix**, and conflating them is how
  > this ships a "fix" that makes a page worse:
  >
  > 1. **Is there a single answer?** `VocabularyIssue.replacement` (silica-catalog) — set only when
  >    there is one, and never for an `arbitrary-value`: `leading-[1.05]` could become any of a
  >    dozen tokens, and picking one would be a guess wearing the clothes of a fix. The prefix is
  >    preserved, so `@2xl:gap-7` → `@2xl:gap-6` and not `gap-6`, which would have moved the spacing
  >    to every width at once.
  > 2. **Would applying it here make things worse?** An ANCESTOR question, so only the site walk can
  >    answer it (`site-lint`'s `fixFor`). A viewport variant is withheld unless the node is inside
  >    an `@container`: rewriting `md:grid-cols-3` → `@3xl:grid-cols-3` with no container above it
  >    swaps a rule that works on a real device for one that matches nowhere — and the author would
  >    have been told it was a fix. The finding still reports; only the button is withheld.
  >
  > Most findings will never carry one, and that is the design rather than a gap: "choose a
  > destination for this link" and "pick a readable color" are the author's decisions.
  > **`fix.test.ts` (6 tests) is where the whole risk lives**, including a sweep asserting that no
  > non-class rule ever attaches one. site-lint is now **116**.
  >
  > **Verified live:** Fix it appeared on exactly one of the 15 rows — the `gap-2.5` — and on none
  > of the link or contrast findings. Clicking it moved the spine to the FRAME tree (that class is
  > in the header/footer), applied the change, marked the row **Fixed**, raised the stale banner and
  > dropped the status-bar count. One unsaved change, undone with Ctrl+Z.

  > Brandon: _"I have no idea what to do with this because it doesn't do anything. It feels like a
  > wall of text that will never get a user to engage."_ Both halves are fair and they are separate
  > problems.
  >
  > **It reads as prose because it IS prose.** Every finding carries a multi-sentence `detail`
  > written for a non-technical owner (correct per the audience rule — see `contrast.ts`, where one
  > finding's detail runs to four sentences). What was never designed is what happens when twenty of
  > those stack: an explanatory paragraph is right for ONE finding a person already cares about, and
  > is a wall when it is the list format.
  >
  > **"It doesn't do anything" is the deeper half.** The panel narrates problems and hands every
  > one of them back as homework. Its only action is **Show me**, which navigates — it does not FIX.
  > A check that can name "your price text is 1.6:1 on this theme" precisely enough to find the node
  > can very often also offer the correction.
  >
  > **Directions, none chosen — Brandon's call.** (a) Kill the standalone surface and put findings
  > where the problem IS: a marker on the layer row and the canvas node, so the check is ambient
  > rather than a place you visit. (b) Keep a list but make it a scannable ledger — one line per
  > finding, the prose behind a disclosure — and add **Fix it** wherever the correction is
  > mechanical. (c) Fold it into publish as a blocking gate only for errors, which is already half
  > true. My read: (a)+(b) together, since the current thing is a report and what an author needs is
  > a worklist. **Do not build until Brandon picks** — this is design, not a defect.

- [x] **28. The shipped blueprints were never graded by the tool that grades tenant sites.** — _in-our-control · M · DONE 2026-08-02_

  > **346 findings across the 21 bundles, 6 of them errors.** The engine had a linter, a Check panel
  > and a per-section catalog sweep; the CONTENT those tools ship had none of it. Every defect below
  > shipped to every tenant who installs a starter site, and none was visible by reading the JSON.
  >
  > - **Repeater cards with no bound `href` (63).** The product and post cards sit inside
  >   `data: {kind:"collection"}` repeaters, so the destination must be BOUND
  >   (`{kind:"value", ref:"url", attr:"href"}`) — the capture that produced these bundles lost it.
  >   Every blueprint shipped a featured-products grid and a journal grid whose REAL records were
  >   unclickable. A bound `<a>` and a forgotten one are indistinguishable in the tree, which is
  >   exactly what `attr-binding.ts`'s own comment warns about.
  > - **Viewport variants in the header (168).** `hidden … sm:flex` on the desktop nav and
  >   `relative sm:hidden` on the hamburger — measured against the BROWSER WINDOW, while the
  >   editor's phone preview resizes the BLOCK. The one piece of responsive behaviour on the page,
  >   invisible in the preview built to check it. Fixed by adding `@container` to the frame's
  >   `<nav>` / `<footer>` and two page sections (what `site-chrome.ts` already does), then
  >   `sm:` → `@sm:`.
  > - **`text-primary` as INK on `bg-base-100` (6 errors).** A fill token used as a text color, so
  >   it inherits whatever lightness the theme's brand happens to have; on petal, salon and workshop
  >   the product PRICE was near-invisible.
  > - `gap-2.5` (21 — emits no CSS at all), an `h3` footer heading under the page `h1` (42), and six
  >   pages with no search description (21).
  >
  > **One finding was a defect in the LINTER, not the content.** A `<Button type="submit">` inside a
  > `<Form>` was reported as "This button doesn't go anywhere" — and the remedy it suggested (open it
  > and choose a page) would have broken a working contact form. It fired on all 21 bundles and would
  > fire on every tenant contact form on the platform. `links.ts` now skips `submit`/`reset`; a bare
  > `<Button>Learn more</Button>` still reports.
  >
  > **Fixed at the SOURCE.** Twenty of the bundles are generated clones, so every change landed in
  > the golden `sparx` bundle and propagated through `_gen/gen-sparx-themed.ts` — 21 files, and the
  > diff is only the intended lines. Hand-editing a clone is pointless; the next generate overwrites it.
  >
  > **346 → 2**, and both survivors are the sparx ember at 4.1:1 light / 3.2:1 dark against its own
  > `-content` pair — a THEME-token decision, accepted as-is by Brandon on 2026-08-02.
  > [blueprint-sweep.test.ts](../../packages/site-lint/src/blueprint-sweep.test.ts) locks it in with a
  > rule per fix plus a catch-all that tolerates exactly that one site-scoped `contrast-low`, so a new
  > rule or a new bundle cannot land findings quietly.

---

## Sequencing notes

- **Wave 1 slices 1–4 are the critical path.** Preview, media, SEO authoring and a truthful audit are what a tenant hits in the first hour. Nothing in Waves 3–4 pays off while those are broken.
- **Slice 6 gates slice 13.** Fixing the vocabulary first means the breakpoint UI, when it lands, has one axis to author against instead of two.
- **Slice 2 gates slice 3.** The Page settings panel's social-image field needs the media picker.
- **Slice 9 gates slices 10–12.** The lint engine is the substrate; contrast, the Check step and the budget are consumers of it.
- **Wave 4 slice 18 is independent of everything** and can start in parallel at any point — it is authoring, not engineering.

Related: [00-README.md](00-README.md) · [02-silicaui-asks.md](02-silicaui-asks.md) · [docs/silicaui/01 — the silicaui asks register](../silicaui/01-builder-asks.md)
