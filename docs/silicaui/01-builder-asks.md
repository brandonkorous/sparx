# silicaui-builder — the asks (1–22, ALL ANSWERED AND ADOPTED)

**Version:** 4.3.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-07

> ## ⚑ §20, §21 AND §22 — FILED AGAINST `0.50.0` AND CLOSED IN `0.51.0`, SAME DAY (2026-08-07)
>
> All three shipped together, and **all three were verified here the same day**. They were
> found by **opening the Add palette in production** and then reading `dist/react/index.js`
> to confirm each one — not by any test, and that is the point: all three lived in how the
> engine RENDERS the palette and inspector, so nothing that asserts on trees or on rendered
> HTML could see them. sparx had shipped a full render sweep (21 blueprints, 237 pages) and
> every one survived it.
>
> **[§20 — a host component is a second-class palette row](#20--a-host-component-is-a-second-class-palette-row)
> — ANSWERED in `0.51.0`,** all five parts. `hostComponentGroups` now takes the base groups
> and reads the def: `icon: hostIcon(def)` (validated with `isIconName`, falling back to the
> plug with a `warnOnce` rather than silently), `hint: def.hint` (a new field — it feeds the
> row's `title` and search ranking), and `hostGroupFor(category, base)` resolves the category
> against the built-in groups by key OR slugged label, so a host can now file its cores INTO
> an existing group instead of shadowing it. `makeInsertNode` stamps `label` for
> `node.kind === "host"`, and `nodeTypeLabel` grew a `host` arm resolving through a new
> `useHostDisplay()` — which derives from `hostComponents()`, so **no host wiring is
> required**. `kindLabelOf` says "Host component" rather than "Outlet".
>
> **[§21 — `hide` cannot reach a host row](#21--hide-cannot-reach-a-host-row)
> — ANSWERED in `0.51.0`.** `catalogForHost` now runs the host groups through
> `mergeCatalog(hostComponentGroups(defs, base), { hide: contributed?.hide })` before
> extending, so a `host:*` key is suppressible like any other row.
>
> **[§22 — a palette row loses its name before it loses its group badge](#22--a-palette-row-loses-its-name-before-it-loses-its-group-badge)
> — ANSWERED in `0.51.0`.** The label is now `min-w-0 flex-auto truncate text-left` and the
> badge `min-w-0 shrink-[99] truncate` — the category gives way ~99× faster than the name,
> which is the right precedence. The icon also gained `shrink-0`.
>
> **What sparx changed on adoption.** Less than expected, because the workarounds were
> naming rather than code. The relabelled cores ("Map on its own") are KEPT — with §21 fixed
> they could now be hidden, and deliberately are not: the bare core is the only way to place
> a map inside an author-built layout, where the whole-section block cannot go. The five
> `category` values are kept as "Your …" for the same reason they were introduced, now as a
> choice rather than collision-avoidance (detail in `host-nodes.ts`). Every host icon was
> re-validated against the 109-name set — all resolve, none falls back to the plug; there is
> still no map or pin glyph, so the map core keeps `contact`.

> ## ⚑ ASKS 1–19 ARE ANSWERED — §16, §18 AND §19 CLOSED IN `0.45.0` (2026-08-02)
>
> The last three open items shipped together, and **all three were adopted here the same day** —
> peers on `/ws/builder` + `<Builder peers>`, the check count as a `StatusItem` disclosure, and
> `custom-colors.ts` calling the supported `customColorCss`. This file is now purely the RECORD of
> nineteen asks and their resolutions; nothing is outstanding on either side.
>
> **`0.45.0` also WITHDREW named layouts** — `Site.frames`, `Page.frameId`, `setPageFrame` and the
> switcher UI, all shipped for §5 in `0.37.0`. A deliberate removal (the feature was breaking the
> engine), so it is recorded rather than re-filed. The capability that mattered — a landing page
> with no header or footer — is sparx's again: the column, the resolver, the publish path and the
> storefront read never moved, and the control returned to the page-settings panel it came from.
> What is genuinely gone is editing a non-active shell on the canvas, which no shipped blueprint
> has ever used. Detail in
> [../builder-audit/01-roadmap.md](../builder-audit/01-roadmap.md) slice 25.
>
> **[§16 — other editors' selections, and a soft claim on a subtree](#16--other-editors-selections-and-a-soft-claim-on-a-subtree)
> — ANSWERED in `0.45.0`.** Shipped as ONE roster rather than the two lists the ask proposed:
> `peers?: readonly Peer[]` on `<Builder>` (and `editor.setPeers`), where each `Peer` carries
> `selection` (DRAWN — a named ring on the canvas + a Navigator marker) and `claim` (ENFORCED —
> the subtree greys, names its holder, and refuses local mutation). Merging them is the better
> call: a claim with no name and no color cannot tell the author who is holding a block, and two
> lists keyed differently drift the moment one updates without the other. Unblocks the audit's
> slice 24.
>
> **[§17 — a host-contributed TAB in the inspector](#17--a-host-contributed-tab-in-the-inspector-for-document-scoped-tools)
> — ANSWERED in `0.43.0`.** `inspectorTabs?(node: SelectableNode | undefined): InspectorTabDef[]`,
> with the `scope: "panel"` variant the ask needed: it renders with NOTHING selected, receives no
> node and no mutation ctx, and the engine hides the identity header + Duplicate/Delete footer
> while it is open. sparx's History moved out of its drawer and is now the rail's third tab.
>
> **[§18 — let a status-bar item be clickable](#18--let-a-status-bar-item-be-clickable)
> — ANSWERED in `0.45.0`.** Not a softened sentence but a typed affordance: `StatusItem`, exported
> from `@wizeworks/silicaui-builder`. No `onClick` renders a plain `<span>` identical to the
> engine's own labels; with one it becomes a ghost `btn-xs` — 24px inside the 28px strip, so the
> row height never moves — carrying `aria-expanded`/`aria-controls`. The `expanded` prop is what
> keeps §14's line intact: an item with no disclosed panel to point at is an action in disguise
> and still belongs in `toolbarSlot`.
>
> **[§19 — a custom color is a canvas-only color](#19--a-custom-color-is-a-canvas-only-color)
> — ANSWERED in `0.45.0`, both halves.** `customColorCss(theme, scope?)` and `customColorRules`
> now ship from `@wizeworks/silicaui-html/theme` — a real render-path entry point that imports no
> React — and they emit the FULL registration, verified at **41 rules** across 37 component
> families (`badge`, `alert`, `input`, `tabs`, `step`, `calendar`, `data-table`, `chat-bubble`, …),
> not the utility trio + `btn` of `0.41`. The optional `scope` is the canvas/published split the
> workaround had to hand-roll. This retires
> [../../packages/silica-catalog/src/custom-colors.ts](../../packages/silica-catalog/src/custom-colors.ts),
> which reached into `plugin.withOptions`' return shape to recover the same rules.
>
> ## ⚑ 1–15 are answered and adopted.
>
> | §    | Raised     | Shipped in    | As                                                                                   |
> | ---- | ---------- | ------------- | ------------------------------------------------------------------------------------ |
> | 1–11 | 2026-07-28 | `0.36`/`0.37` | see the table below                                                                  |
> | 12   | 2026-07-29 | `0.38.0`      | `limit` on a collection binding + `applyCollectionLimit`                             |
> | 13   | 2026-07-29 | `0.40.0`      | `toolbarStatusSlot`                                                                  |
> | 14   | 2026-07-29 | `0.41.0`      | `statusBarSlot` — and it SUPERSEDES §13 for sparx's use                              |
> | 15   | 2026-07-29 | `0.41.0`      | mode follows `activeTree`; `select()` returns whether it landed                      |
> | 16   | 2026-07-30 | `0.45.0`      | `peers` / `setPeers` — one roster carrying `selection` (drawn) + `claim` (enforced)  |
> | 17   | 2026-07-30 | `0.43.0`      | `inspectorTabs` + `scope: "panel"` — History is now the rail's third tab             |
> | 18   | 2026-07-30 | `0.45.0`      | `StatusItem` — a status item may disclose its own detail, `expanded` keeps it honest |
> | 19   | 2026-07-30 | `0.45.0`      | `customColorCss` / `customColorRules` from `silicaui-html/theme` — all 41 rules      |
>
> Turnaround on §12–§15 was same-day or next-morning, and §16–§19 closed inside four days. This
> file is the RECORD of the asks and their resolutions, not a to-do list.

> ## ⚑ ALL ELEVEN WERE ANSWERED AND SHIPPED IN `0.36.0` (2026-07-28)
>
> The catalog is bumped, installed, and every capability is adopted on the sparx side. What
> follows is kept as the RECORD of the asks and their resolutions — read the status table first;
> the sections below are the original argument, not a to-do list.
>
> | §   | Ask                        | Shipped as                                                                              |
> | --- | -------------------------- | --------------------------------------------------------------------------------------- |
> | 1   | Per-breakpoint authoring   | Container variants (`@md:`), NOT viewport; `useBreakpoint`, device toggle drives prefix |
> | 2   | Canvas fidelity            | `rejectViewportVariants` as a liftable POLICY (not the security floor) + `lintTree`     |
> | 3   | Multi-select               | Batch op API (0.36) + `selectedIds` / `selectMany` / `toggleSelect` (**0.37**)          |
> | 4   | Guides / nudge / keyboard  | Keyboard set only — guides declined as a category error (see below)                     |
> | 5   | Per-page frame             | `Page.frameId` tri-state + `frameFor`; named layouts editable in **0.37** (see §5)      |
> | 6   | Richer image node          | `Image` forwards `srcset`/`sizes`; focal point as a quantized 9-grid, not inline style  |
> | 7   | Q22 / Q26                  | Q22 was never real; Q26 → `initialMode` + `onModeChange` — initial, NOT controlled      |
> | 8   | Inverse ops                | `editor.inverseOf(ops, before)` + `node.setChildren`                                    |
> | 9   | `autoContent` contrast     | Measured at build time for owned tokens; CSS fallback threshold 0.68 → **0.57**         |
> | 10  | Conditional visibility     | `{ kind:'visible', ref, negate? }` — **and our premise here was wrong, see §10**        |
> | 11  | Eyebrows / faded body copy | Both eyebrows dropped; 16 of 19 blocks' `text-base-content/NN` fixed                    |
>
> **Two of silicaui's counter-proposals were better than the ask and were taken:** §6's focal point
> (we asked for something requiring an inline `style`, which our own RULE #1 bans — the quantized
> 9-grid lowering to `object-*` utilities is class-only and safelistable), and §4's rejection of
> alignment guides (guides, distribute and pixel nudge are absolute-position concepts; this is a
> flow + class-only model with no x/y to nudge, and "align these two" is `items-center` on their
> parent). §2's point that the viewport ban belongs in a liftable policy rather than the
> security-load-bearing `class-policy.ts` was also correct.
>
> **One thing to carry forward: §9 REPAINTS ALREADY-PUBLISHED TENANT SITES.** Theme tokens are CSS
> custom properties resolved per render, not stamped into published trees, so moving the
> `-content` threshold changes live text colour wherever a brand colour's lightness sits between
> 0.57 and 0.68. It is a correctness fix — those combinations were failing AA — but it is visible,
> and the fallback's "every shipped preset passes at 0.57" has a worst row of 4.51 against a 4.5
> threshold. That is a coincidence, not a safety margin: the measured build-time path is the
> guarantee, the constant is best-effort.

> **This supersedes [doc 119](../119-silicaui-builder-gap-questions.md).** 119 was written 2026-07-11
> against silicaui-builder **0.8.0**, and its framing question — _"should sparx adopt silica's
> engine, or keep its own?"_ — has since been answered and executed: `/builder/studio` **is** the
> silica editor, sparx's bespoke editor is deleted, and `apps/dashboard` no longer exists. 119's
> load-bearing five are shipped. Only two of its items are still live (Q22, Q26), and they are
> carried forward here as §7.
>
> **What this doc is.** The current register of things sparx **cannot** fix from the host seam,
> each naming the specific missing API. It is the input to silicaui's own roadmap — WizeWorks owns
> both sides — and the companion to [docs/builder-audit](../builder-audit/00-README.md), which is
> where the evidence and the sparx-side work live.
>
> **The generic-first bar from 119 still applies and is still right:** every ask below must have an
> answer a _different_ host — a CMS, an email tool, a static-site generator — could implement and
> get the same builder from. If an answer only fits sparx, it belongs in the host, not the engine.

**Originally verified against** `0.35.0`, the version pinned when these were written. **Resolved
across `0.36.0` → `0.41.0`**; `pnpm-workspace.yaml` pins **`^0.41.0`** across all eleven family
packages.

Every resolution in both tables was confirmed by reading the shipped `.d.ts` and bundle, **not the
changelog**, and each bump was diffed against the installed tree before the catalog was moved —
including the plugin CSS `src`, since §9 is the standing proof that a patch release can repaint
live tenant sites. `0.38 → 0.40 → 0.41` were each byte-identical there, and `silicaui-html` was
unchanged in full from `0.40` to `0.41`. **Keep doing this on every bump.**

---

## 1 — Per-breakpoint authoring

**Priority: highest.** This is the one dimension where Webflow, Framer and Wix Studio are flatly
better than what a host can currently assemble, and the affected audience is non-technical
business owners.

**What a host cannot do today.** The Inspector's semantic tier — Display, Direction, Columns,
Justify, Align, Gap, Width, Max width, Position, Self align, typography, Animate — writes
**unprefixed** classes only. Its `setToken` / `activeIn` helpers are private, and
`Editor.setClass(id, className)` takes a whole replacement string. So a host can neither intercept
a chip write to prefix it, nor read back "what is set at `md`" to render an override state.
Grepping the 0.35.0 bundle for `sm:` / `md:` / `lg:` authoring returns nothing.

The only escape today is the Classes field: a 3-row `font-mono text-xs` textarea. Telling a
business owner to type `@2xl:grid-cols-3` into it is not a responsive editor.

**The seam.** A responsive editing context on the engine — ideally all three:

1. A controlled or `initialBreakpoint` prop on `Inspector` (or on `Builder`, alongside the canvas's
   existing `device`), naming the variant prefix every semantic write should carry.
2. `Editor.setClass` — or a sibling `setClassToken(id, group, value, prefix)` — that understands a
   variant group, so "columns = 3 at `md`" is one call rather than host-side string surgery.
3. A read path for per-breakpoint state, so the Inspector can show an "overridden at this size"
   marker rather than silently hiding a cascade.

**Generic?** Yes — every visual builder for a utility-class system needs this, and none of it
names a domain concept.

## 2 — Canvas fidelity for viewport variants

**What is true today.** `Canvas` applies `DEVICE_WIDTH = {desktop:'100%', tablet:'768px',
mobile:'390px'}` as `style.maxWidth` on a plain `<div>`. It is deliberately not an iframe, and the
documented rationale is sound: the frame's width should drive a block's `@container` queries, so
switching device reflows the design instead of opening a second mobile editor.

That reasoning holds **for container queries and only for container queries.** A `md:` class
resolves against the browser window and will not reflow when the toggle changes — so a canvas that
contains any viewport variant is quietly lying about what mobile looks like.

**Two acceptable resolutions, either one:**

- Render the canvas in an iframe, so media queries are honest; **or**
- Declare container queries the only sanctioned vocabulary for live documents and **enforce** it.
  The `deniedToken` denylist already bans viewport variants for _block authoring_; extending the
  same rule to the live class policy would reject a viewport variant at write time, with a reason
  the Inspector can surface.

The second is cheaper and matches the engine's existing philosophy.

**Status: sparx has done the host half, so this ask is now narrower than it was.** The
[builder-audit roadmap](../builder-audit/01-roadmap.md) slice 6 swept the sparx catalog onto
container queries and enforces the rule through the seam the engine already publishes — a
`ClassValidator` on `BuilderHost.validateClass`, which `Editor.setClass` runs before it commits
and whose `reason` the Classes field surfaces. So a host CAN enforce this today; nothing here
is blocking.

What remains is that **every host has to rediscover and re-implement it**, and one authoring
surface still cannot be reached from a host at all:

1. The engine's own semantic Inspector chips write unprefixed classes, so they never produce a
   viewport variant — but they also never produce a container one (that is §1 above).
2. `deniedToken` already encodes the viewport ban for block authoring. Promoting it into the
   live class floor would make the rule universal, consistent with `validateClassString`
   already owning the security floor, and would delete this workaround from every host.
3. A host validator sees only the class STRING. It cannot check that some ancestor declares
   `@container`, which is the other half of a working container query — a correct-looking
   `@2xl:grid-cols-2` with no container above it silently does nothing. The engine knows the
   tree; a `lintTree`-style structural check (or an Inspector marker on the node) is the only
   place that check can live.

## 3 — Multi-select

`Editor.selection` is `string | undefined`, `selectedNode` is a single `Node`, `useSelection()`
returns one id, and every mutation (`setClass`, `setProp`, `move`, `remove`, `duplicate`, `copy`)
is single-id. There is no host-side way to build multi-select on top of this.

**The seam.** A selection _set_ on the engine plus set-aware mutations — or, at minimum, a
documented "apply to these ids" batch that runs inside one `transact`, so a multi-node edit is one
undo step rather than N.

## 4 — Alignment guides, nudge, and structural keyboard moves

The canvas drop model is before / after / inside the hovered node, drawn as a drop-line or a dashed
ring. There is no geometry seam, so a host cannot add alignment guides or distribute.

`useEditorShortcuts` covers undo, redo, duplicate, copy, paste, delete and escape. Missing:
arrow-key nudge, select-parent (escape clears to nothing rather than stepping up), `Cmd+X`,
`Cmd+A`, group.

**The seam.** Arrow-key move/nudge and select-parent in `useEditorShortcuts`; and either built-in
alignment guides, or a canvas geometry hook a host can draw into.

## 5 — Per-page frame selection

`Site.frame` is singular, and `composeFrame` drops the body into its one Outlet. A landing page
with no header and footer — table stakes for campaign pages, and supported by every product in the
comparison set — is currently unrepresentable.

**The seam.** `Page.frameId` (with a null / none option), or a per-page frame-off flag honoured by
`composeFrame` and `renderSite`.

**Shipped, and one thing the ask did not anticipate.** The engine half landed in 0.36.0
(`Page.frameId`, `Site.frames`, `frameFor` / `frameDiagnostic`) and sparx stores the choice in one
tri-state column, `builder_pages.frame_id`.

What the ask missed is that a per-page frame pointer belongs to the **publish lifecycle**, not just
to storage. The first implementation read `frame_id` live on every storefront render, with no
stage — which is invisible while nothing can write the column, and becomes a production defect the
moment an editor can: pressing Save would change the chrome real visitors see, while the page BODY
they see is still the last published one and the Publish button reports nothing to publish. Chrome
is the most visible thing on a page, so its pointer gets the same draft/published pair the trees
have (`published_frame_id`, migration `20270129000000`), written by both publish paths and read by
stage. `publishState` compares it too, so a chrome-only change lights up Publish rather than going
live in silence.

The general shape, for anyone adding per-page metadata later: **if a field changes what a visitor
SEES, it needs a staged counterpart.** A field that only changes what a crawler reads (the SEO
columns beside this one) can defensibly go live on save; a field that moves the header cannot.

## 6 — A richer image node

`toHtml` emits `src` only. `srcset` and `sizes` **are** allowlisted attributes on `img` and
`source`, but nothing generates them — so every published image is a single unoptimised
resolution. The image field also carries no focal point.

**The seam.** An image node (or a `pickAsset` return shape) that carries a set of widths and emits
`srcset` / `sizes`, plus an optional focal point lowering to `object-position`. The host owns
generating the variants; the emission has to happen in the projector both surfaces share, or the
canvas and the storefront diverge.

## 7 — Carried forward from 119

- **Q22 — `resolveTree` stops resolving a node's children once it fills that node's binding.**
  Filed against 0.14.0. **Not re-verified at 0.35.0** by the builder audit — check before
  re-raising. Constrains what a bound card can contain.
- **Q26 — `<Builder>` holds its editor MODE in private local state, so a host can only ever land
  the author on Page.** **Re-verified open at 0.35.0**: `BuilderProps` is `document` /
  `studioTheme` / `host` / `onChange` / `onActivePageChange` / `onPublish` / `persistKey` /
  `toolbarSlot` / `dataToggle` — no mode prop, controlled or initial. Documented upstream as
  roughly three lines.

  **ANSWERED (`initialMode` + `onModeChange`), and adopted — but read the shape before
  assuming more.** `initialMode` seeds the mode at mount and is **never re-read**; there is no
  `editor.setMode`. So a host can LAND the author on a surface and OBSERVE them moving between
  surfaces, and still cannot DRIVE the mode afterwards.

  That is deliberate on silicaui's side and the reasoning is right — a controlled mode lets a
  parent re-render yank someone out of the surface they are working in. It does bound what a host
  can build: an in-editor affordance like "edit the header this page uses", offered from a panel
  inside `toolbarSlot`, cannot switch to Layout mode itself. It has to be a deep link that opens
  the editor, which is a heavier gesture than the one the operator asked for. **Not re-raised** —
  the safety this buys is worth more than the affordance it costs, and it is recorded here so the
  next person to want it knows it was weighed rather than missed.

  Adopted in sparx as the `{mode}` surface param on `builder.studio`, with `onModeChange`
  retitling the pane so several open editors are tellable apart.

## 8 — An inverse for the two ops a host cannot reverse

**Context.** sparx now drives undo through `setHistoryDelegate`, because the built-in
whole-site snapshot stack is discarded on every `applyRemoteOps` — which, in a product where
an agent edits alongside the author over MCP, means the author's undo history quietly
disappears mid-session. The host computes each action's inverse from the ops and the previous
document, and 22 of the 24 op kinds invert cleanly against `Editor.applyOp`. (At the time this
was written the host computed that itself, in `packages/builder-schemas/src/silica-op-invert.ts`;
the engine answered with `editor.inverseOf(ops, before)` in `0.36.0`, so that module is GONE and
the host just binds the engine's — see
[undo-history.tsx](../../apps/workbench/surfaces/builder/studio/undo-history.tsx).)

**The two that do not:**

- **`symbol.set` that CREATES a symbol.** Its inverse is `symbol.delete`, which carries a
  `detach` cascade — a replacement subtree per instance, each with fresh node ids the engine
  mints. A host cannot mint them: the doc itself explains that independently-replayed detaches
  produce different ids on every peer and the documents silently diverge. So "undo save-as-
  component" is the one action that drops the host's history.
- **`node.setText` on an element with rich children.** The op replaces `children` with a single
  string, so `<p>Call <a href=…>us</a></p>` flattens and no `setText` can put the link back.
  The host works around it by re-inserting the whole node — correct, but a wider blast radius
  than the edit deserved (it discards any concurrent edit inside that paragraph).

**The seam.** Either would do, and the first is strictly better:

1. `Editor.inverseOf(ops, before?): Op[] | null` on the engine — it already owns `applyOp` and
   the id minting, so it is the only place a faithful `symbol.delete` cascade can be built. It
   would also let every host stop re-deriving this, and stop it drifting from `applyOp`.
2. Failing that: a `symbol.create` op carrying the instance ids it produced, and a
   `node.setChildren` op so a text edit that flattens structure has a structural inverse.

**Generic?** Yes — any collaborative host wiring `setHistoryDelegate` hits exactly this, and the
API the engine already published (`HistoryDelegate`) implies a host can produce inverses it
currently cannot.

## 9 — `autoContent` picks the wrong ink through the whole mid-lightness band

**The ask:** derive `-content` from CONTRAST, not from a lightness threshold — or move the
threshold down to about 0.60.

> **ANSWERED in silicaui 0.36.0 — the threshold is `0.57`, and it took sparx five releases to
> notice (recorded 2026-07-30).** silicaui took the second option and went further than the ask:
> 0.60 would still have sat above the real crossover, so it picked a value INSIDE it. The shipped
> source now says so in as many words — "0.57 sits inside the crossover range instead of above it,
> and clears AA for every shipped preset token" — and explicitly directs anything visible at build
> time to `deriveContent` instead, leaving the fallback for colors injected into a live document
> that no build step ever saw.
>
> **We adopted the other eleven answers from 0.36.0 and missed this one**, because it is a default
> inside a CSS string rather than an API — nothing failed to compile. Two copies of `0.68` stayed
> in the tree: `themes-ink.test.ts`, which then spent five releases failing 10 assertions against
> **correctly authored themes**, and — the one that mattered — `@sparx/site-lint`'s `palette.ts`,
> the live pre-publish contrast check, which predicted WHITE ink for every color between 0.57 and
> 0.68 where the site actually paints BLACK. A wrong verdict in whichever direction hurt more.
>
> Both now read `SILICA_CONTENT_THRESHOLD` / `inkForLightness` from
> [silica-catalog/content-ink.ts](../../packages/silica-catalog/src/content-ink.ts), which also fixes
> a boundary the two copies disagreed on. **This is the concrete case for the standing rule in this
> document: verify a bump against the shipped bundle, never the changelog.** A changelog line would
> have carried this; a type error never could. `content-ink.ts` records the exact `grep`, and states
> that no test in this repo can catch the next change — neither package depends on the Tailwind
> plugin the value lives in.

`lib/auto-content.js` fills an undefined `--color-<name>-content` with

```css
oklch(from <color> clamp(0, (var(--silica-content-threshold, 0.68) - l) * 1000, 1) 0 0)
```

— white below `l = 0.68`, black above. That is a lightness comparison standing in for a contrast
comparison, and the two part company across a wide band. Measured over the four shipped
`THEME_PRESETS` by `@sparx/site-lint` (slice 10 of the builder audit, which reproduces this
derivation exactly in order to check contrast without rendering):

| preset | token     | `l`  | white (chosen) | black (rejected) |
| ------ | --------- | ---- | -------------- | ---------------- |
| quartz | accent    | 0.64 | **3.1:1**      | 6.7:1            |
| ocean  | primary   | 0.58 | **4.1:1**      | 5.2:1            |
| ocean  | secondary | 0.66 | **2.9:1**      | 7.3:1            |
| ocean  | error     | 0.63 | **3.9:1**      | 5.3:1            |
| grape  | secondary | 0.64 | **3.7:1**      | 5.6:1            |
| sunset | primary   | 0.56 | **3.6:1**      | 5.0:1            |

Every row is a shipped preset failing WCAG AA (4.5:1) for the label on its own buttons and badges,
while the ink the rule rejected would have passed. It is not a rounding problem at the edge — it is
systematic from roughly `l = 0.55` to `l = 0.68`, which is where a mid-tone brand color lives.

sparx's own compiler already does the right thing: `deriveContent` in
[site-themes/v2/color.ts](../../packages/site-themes/src/v2/color.ts) picks whichever of near-white and
near-black has the higher measured contrast, and emits it explicitly — so a tenant on their own
brand colors is unaffected and only silica PRESET themes are hit. CSS cannot compute a contrast
ratio, which is presumably why the threshold exists; a build-time derivation can, and silicaui
already emits per-theme CSS.

**Lower bound if the shape has to stay:** `--silica-content-threshold: 0.6` fixes ocean/sunset
primary and grape secondary. It does not fix ocean secondary at 0.66, where white is 2.9:1 and black
is 7.3:1 — that one needs the contrast comparison.

**One adjacent precision note for whoever implements it:** read `l` from the authored token, not
from a value that has been through sRGB. `oklch(68% 0.1 232)` — quartz's `info`, sitting exactly on
the default threshold — round-trips to `0.6798`, which flips the comparison and swaps the ink. The
CSS is right about this already (`oklch(from …)` normalizes without a round trip); a reimplementation
is the thing that gets it wrong, and this one did before it was fixed.

---

## 10 — Conditional visibility: a node that renders only when a condition holds

> ### ⚠ THE PREMISE BELOW WAS FALSE. Corrected 2026-07-28.
>
> This section claimed "a silica tree has no way to say show this node only if…" and, elsewhere,
> that `resolveTree` never DROPS a node. **Both were wrong**, and silicaui was right to push back.
> `resolve.ts:150-155` has always dropped a node and its whole subtree when the host returns
> `visible: false`, documented at `resolve.ts:36-44` as "the one conditional-visibility primitive
> the engine supports, with no expression language attached". It is scope-aware —
> `resolveBinding(ref, scope)` receives `scope.item` — so the item-scoped Sale-badge argument in
> the table below does not hold either. An `editing` walk ghosts rather than drops, so the author
> can still select the node.
>
> **I asserted an engine limitation without reading the resolver.** The lesson is the cheap one:
> the claim was checkable in one file.
>
> **What was genuinely missing is narrow** — you could not bind visibility WITHOUT consuming the
> node's content slot, because a node carries one `data` binding and a bind fills it. That is what
> `{ kind: 'visible', ref, negate? }` adds, and silicaui was also right to reject the `when` +
> predicate set (`eq`/`neq`/`gt`/`lt`) I proposed: present/empty is the entire real demand, and a
> predicate language buys a debugging surface made of invisible sections for cases nobody has yet.
>
> **Consequence for slice 23.** I justified making the pagination host core a host core partly on
> "a bound tree has no conditional, so a hand-authored pager ships a dead Previous on page one".
> That reason is void — the resolver could have returned `{ visible: false }`. The host core is
> still right, for the reasons that survive: it builds each URL while preserving the other query
> parameters, and it owns the `rel="prev"/"next"` + `aria-current` semantics. The MCP authoring
> vocabulary said the same false thing to agents and has been corrected.

**Priority: high, and it keeps costing us host cores.** A silica tree has no way to say "show this
node only if…". Every time that need appears, the answer has been to move the whole region into a
sparx **host core** so React can make the decision — which works, but each one converts an
author-editable region into an opaque mount point the tenant can style around and nothing more.

**The list is already four long**, and every entry is the same missing primitive:

| Where                        | The condition that could not be expressed                             |
| ---------------------------- | --------------------------------------------------------------------- |
| `site.brand`                 | show logo / name / both — two bound children always both render       |
| `site.legal-links`           | render nothing at all — heading included — when nothing is published  |
| `site.theme-toggle`          | hide unless the tenant's appearance policy offers both themes         |
| `site.pagination` (slice 23) | no Previous on page one, no Next on the last, hide when one page fits |

The pagination case is the clearest, because the alternative is visibly broken rather than merely
absent: a hand-authored pager binding `commerce.productPrevUrl` renders a **dead "Previous" link on
page one of every site on the platform**, and offers a page 25 that does not exist. There is no
authoring workaround — an empty bound `href` still renders a clickable anchor.

**What a host cannot do today.** `resolveTree` substitutes values and expands collections; it never
DROPS a node. A host-side pre-pass cannot stand in for it either: a condition on an item-scoped ref
(`item.compareAtPrice` — "show the Sale badge only when there is one") can only be evaluated per
item, inside the expansion the engine owns. Evaluating before `resolveTree` has no item scope;
evaluating after it, the scope is gone and the values are already inlined into the markup.

**The ask.** A `when` on `NodeBase` — a ref plus a small, closed predicate set (`present` /
`empty` / `eq` / `neq` / `gt` / `lt`), evaluated against the same scope the node's own binding
resolves in, with the node and its subtree omitted from the output when it fails. Closed rather
than an expression language on purpose: an author who can write a contradiction mostly produces an
invisible section they cannot debug.

**Generic-first check:** it passes easily — a CMS hiding an empty author bio, an email tool hiding
a discount block when there is no discount, and a static-site generator hiding a "Read more" link
on a short post are the same feature. Nothing about it is sparx-shaped.

**What sparx does until then:** keeps paying the host-core tax. `site.pagination` is the fourth
core that exists mainly because of this gap, and each one is a region the tenant can no longer
author.

---

## 11 — Not an ask: a house-rule conflict to settle

Two shipped `@wizeworks/silicaui-html` blocks — **"Content — prose section"** and **"Feature —
media split"** — declare an `eyebrow` part. That is the exact pattern
[RULE #2](../../CLAUDE.md) bans, and because those blocks are in the default Insert palette, it ships
into tenant sites by default.

Either drop the part from those two blocks upstream, or sparx hides them via `catalog().hide` and
ships replacements. Worth settling upstream, since WizeWorks owns both sides.

---

## 12 — Per-instance options on a collection binding

**Status: ANSWERED — shipped in `0.38.0` (2026-07-29), installed the same day.**

Delivered exactly as asked: `limit?: number` on the collection binding, `applyCollectionLimit`
in the resolve walk, a `data-sui-repeat-limit` attribute on render, and an inspector number field
(`testId: "data-limit"`) beside the source picker. The `@wizeworks/silicaui` plugin source is
**byte-identical** to `0.37.0`, so unlike §9 this bump repaints nothing on live tenant sites.

One detail silicaui got right that the ask did not specify: the field holds the **raw string**, not
a parsed number, so an empty box means "no limit" (placeholder "All") and survives a keystroke that
leaves it momentarily blank — `0` and `NaN` both fail to express that.

**Consequence for the host:** the engine trims per node at render, so `buildPreviewRoot` only has
to put a source's NATURAL yield in the root (`DataSource.maxItems`) and the canvas count follows
the author's limit for free. The remaining host work is the storefront's fetch — reading `limit`
off the tree during the walk `collectSilicaSourceNeeds` already does, so a landing page capped at 4
requests 4 instead of requesting 30 and discarding 26. The counted-sources fallback below is
**not** being built.

### The ask

Let a collection binding carry author-set options, starting with one:

```ts
| { kind: "collection"; ref: string; omitWhenEmpty?: boolean; limit?: number }
```

…surfaced in the inspector as a number field beside the existing source picker, and honoured by
`resolveTree` (a resolved collection longer than `limit` renders its first `limit` items).

### Why the catalog cannot answer it

A host's `DataSource` catalog says what a source **is**. `limit` says how much of it **this
instance** wants. Those are different questions, and today they share one field — the ref — so
only the first can be asked.

The case is a landing page. A tenant with 30 products wants a strip of 4 above the fold, the
`/shop` grid showing a full page, and a cross-sell rail of 12 on the product page. Same source,
three counts, and no way to say so. Today the count is whatever the host decided when it fetched,
which means it is uniform per source across the entire site.

### Why the obvious workaround is a trap

Encode it in the ref — `commerce.product|limit=4` — and let the host parse it. `resolveTree` never
parses refs, so this looks free.

It isn't, because `scopeAt` **does** read the ref: it narrows the bindable fields for every
descendant by matching an ancestor's `data.ref` against a catalog `key`. A ref that is not exactly
a catalog key matches nothing, so the scope comes back empty — the author can bind the repeat, and
then cannot bind `title` or `price` on the card inside it. Nothing errors; the field list is just
quietly empty. That failure lands on the author, in the inspector, with no way to understand it.

Worth noting the constraint is real and probably right — tying scope to catalog identity is what
makes per-node availability a pure derivation. It just means the ref is load-bearing and cannot
double as an options bag.

### Why we cannot prototype it host-side

`DataBinding` is a Zod discriminated union, so an extra key on a `collection` node is **stripped**
on parse — the same behaviour that bit us on our own `BuilderOpTarget` (a `z.object` silently
dropped an `id`, filing every named-layout op against the default frame). So a host cannot carry
its own option through the document and wait for upstream; the field has to exist in the schema or
it does not survive a round-trip.

### The alternative we are shipping instead, and why it is worse

Enumerate counted sources in the catalog — "Featured products · 4", "· 8", "· 12" — as real keys,
so `scopeAt` still matches. It works and it needs nothing upstream.

It is worse on both axes we care about. The picker multiplies (four rail sources × three counts =
twelve entries where there were four) for an audience of **non-technical business owners**, and
"how many" becomes a fixed menu rather than a number, so the owner who wants 6 picks 4 or 8.

### One thing the ask does NOT need to cover

"Show 4 at a time but load 12" — a carousel — is not a second option. `limit` is how many records
load; how many are _visible_ is layout (`basis-1/4` on a snap rail), which the class model already
does. Keeping those two numbers separate is right, and only the first is a binding concern.

### If it ships

The counted sources collapse back to one source per rail, the storefront reads `limit` off the
tree during the walk it already does (so it fetches 4 rather than fetching 30 and discarding 26),
and the canvas previews the true count — which is the whole reason this came up: a block that will
render 12 cards previewing as 3 is an author laying out against a page that does not exist.

---

## 13 — A STATUS slot in the toolbar, distinct from the action slot

**Status: ANSWERED — shipped in `0.40.0` as `toolbarStatusSlot`, raised the same day against
`0.38.0`.** Adopted in `studio-surface.tsx`; the live-sync indicators moved into it and the
Reload affordance stayed in `toolbarSlot`, because silicaui documented the new slot as
non-interactive for precisely the focus-order reason argued below. §14 is the follow-on: the
right slot in the header turned out to be the wrong FLOOR.

### The ask

A second header slot for non-interactive status, rendered before the theme toggle:

```tsx
toolbarStatusSlot?: React.ReactNode   // status — who else is editing, saved/unsaved
toolbarSlot?: React.ReactNode         // actions — unchanged
```

### Why one slot cannot carry both

`toolbarSlot` renders at ONE fixed position — after the `light`/`dark` toggle group, before
`Publish`. A host with both kinds of chrome therefore gets them interleaved with the engine's
own controls:

```
[Theme|Layout|Page|Component] [undo] [redo] [Desktop|Tablet|Mobile] ⟨spacer⟩
    ⌘/  [Light|Dark]  «hostSlot»  [Publish]
```

Everything a host has — a presence pill, a saved/unsaved badge, page settings, a pre-publish
check, history, preview, save — lands inside `«hostSlot»`. So the status badges end up wedged
between the engine's buttons on their left and the host's buttons on their right, reading as a
gap in a run of controls rather than as state. Ordering within the slot cannot help: the
badges are already first in it.

**CSS `order` cannot reach the position either**, and this is the part worth stating, because
it looks like the obvious host-side fix. The header is a single flex container, so `order: -1`
places the group before EVERY child — left of the mode switcher at the far edge of the toolbar
— and `order: 1` places it after `Publish`. There is no value that lands between the spacer and
the theme toggle, because the target position is mid-container and `order` only sorts against
the whole set.

The remaining host-side option is a portal into the engine's own header DOM at a computed
index. That works and is what we would otherwise do, but it means one package reaching into
another's markup and breaking silently the first time the header's child order changes — which
is worse than asking.

### Why the split is the right shape, not just a second slot

Status and actions are different kinds of thing and want different placement rules: status is
non-interactive and belongs near the surface it describes, actions belong grouped with other
actions and in a stable order a user can build muscle memory for. Keeping them in one slot
forces every host to choose which one reads wrong.

It also keeps FOCUS ORDER honest for free. A host that solves this with `order` moves a
control visually without moving it in the DOM, so a keyboard user meets the theme toggle
before a button that appears ahead of it (WCAG 2.4.3). A real slot puts the status where it
belongs in both orders at once — and because the content is non-interactive, it adds no tab
stop at all.

### Generic?

Yes. "Some header chrome is state and some is action" is true of any host: a CMS showing a
lock holder, an email tool showing a send window, a static-site generator showing a build
status. None of it names a domain concept.

---

## 14 — A STATUS BAR slot, for the state that isn't toolbar chrome

**Status: ANSWERED — shipped in `0.41.0` as `statusBarSlot`, next morning.** Adopted in
`studio-surface.tsx`, and it **replaced** §13's slot rather than joining it: sparx passes no
`toolbarStatusSlot` at all now. Splitting the presence pill from the saved/unsaved badge across
two floors would have put the session's state in two places with neither of them complete.

silicaui's own doc for the slot makes the same argument this section does, and states the
non-interactive rule more strictly than the header's — "the strip is 28px tall, and the engine's
own children are plain text" — so the live-sync Reload BUTTON stays in `toolbarSlot`.

### The ask

A host slot in the editor's footer, mirroring §13's slot in the header:

```tsx
statusBarSlot?: React.ReactNode; // rendered in the footer, after the mode label
```

### Why, when §13 just shipped

§13 was right and `toolbarStatusSlot` was adopted the day it landed. But putting sparx's two
live indicators — "3 editing", "Saved · not live yet" — at the head of the header's right-hand
cluster only made a second question obvious: **the editor already has a status bar, and that is
where status belongs.**

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Theme Layout Page Component  ↶ ↷  Desktop Tablet Mobile   ⌘/  Light Dark │  ← actions
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│ Page                                              Desktop     silicaui  │  ← state
└─────────────────────────────────────────────────────────────────────────┘
```

The footer already carries exactly this kind of fact — which surface you are on, which device
width you are looking at — and nothing else. Two indicators of the same kind sitting in the
header means a person reads state in two places, and the one they read it in is the one packed
with buttons.

The engine's own footer children make the argument: `mode` and `device` are state, not controls,
and they are down there rather than beside the toggles that set them.

### Why a host cannot do this

`<footer>` is engine-owned and takes no children. The alternatives are worse than asking:

- Render our own strip below `<Builder>` → two status bars, one per package, stacked.
- Portal into the engine's footer at a computed index → the §13 objection verbatim: one package
  reaching into another's markup, breaking silently the first time the footer's children change.

### Shape

Same contract as `toolbarStatusSlot`, one floor down — **non-interactive content only**, for the
same reason and with a stronger case: a 28px-tall strip is not somewhere to put a control, and
the engine's own two children are plain `<span>`s. Placement after `mode` (before the `flex-1`
spacer) puts a host's state next to the engine's, reading left to right as one sentence about
the session.

### Generic?

Yes, and arguably more so than §13. "The editor has a status bar and the host has status" is
true of every embedding: a CMS with a lock holder, a build tool with a last-built time, a
collaborative editor with a presence count. None of it names a domain concept, and every host
that has any state at all currently has nowhere honest to put it.

---

## 15 — `setActiveTree('frame')` moves the spine but not the mode toggle

**Status: ANSWERED — shipped in `0.41.0`, next morning. Both halves, including the aside.**

The mode now follows the tree, as one effect mirroring the symbol case:

```js
if (activeTree === 'frame' && mode !== 'layout') setMode('layout');
```

That fixes all three symptoms at once — the chip, the Pages-vs-Layouts rail, and the
`` `${mode}:${activeId}` `` Navigator key that was stranding the selected node inside a collapsed
ancestor.

The closing aside was taken too: **`select(id)` now returns a boolean** and REFUSES an id that
isn't in the active tree rather than storing a phantom selection. sparx uses it — the check panel
closes only on a selection that landed, and a genuinely stale id (deleted between the check and
the click, by the author or a co-editor) now raises "That block is not there any more" from a real
answer instead of from a `catch` that never fired.

### What happens

`Editor.setActiveTree('frame')` retargets the whole spine — canvas, Navigator, Inspector — onto
the frame, correctly. The shell's mode `ToggleGroup` keeps saying **Page**, and the left rail
keeps showing the Pages panel. So the author is editing the header and footer while the editor
insists they are on a page body.

### Why it looks like an oversight rather than a decision

The symbol case is already handled, one screen up in the same component:

```js
// silicaui-builder — shell
React.useEffect(() => {
  if (editingSymbol && mode !== 'component' && mode !== 'theme') setMode('component');
}, [editingSymbol, mode]);
```

`enterSymbol` from a host therefore lands the shell in Component mode on its own. There is no
equivalent effect watching `activeTree`, so the frame — the one other tree a host can point the
spine at — is the case that doesn't self-correct. The fix looks like one more effect of the same
shape (`activeTree === 'frame' && mode === 'page' → setMode('layout')`).

### Why sparx hit it

The pre-publish check's "Show me" jumps to the block a finding names. Most findings on a young
site are in the header and footer — an unfinished nav link, a logo with no description — and
selection is tree-scoped, so `select(frameNodeId)` while the spine is on a page body selects
nothing at all: no ring, no Navigator row, no Inspector. sparx now calls
`setActiveTree('frame')` first, which fixes the jump completely — canvas ring, Inspector and all
— and the stale mode chip is what is left over.

Two knock-on effects come from the same root, which is why it reads as one bug rather than a
cosmetic nit: the left rail keeps showing **Pages** instead of **Layouts**, and `<Navigator>` is
keyed `` `${mode}:${activeId}` `` — so it is not remounted and keeps the page tree's `expanded`
set, meaning the newly-selected frame node can sit inside a collapsed ancestor and have no
visible row. All three go away if the mode follows the tree.

Worth noting that the underlying sharp edge is `select(id)` accepting an id from another tree
silently. A no-op is the safe behaviour, but it means "wrong tree" and "deleted node" are
indistinguishable to a host — an `editor.select()` that returned whether it landed would let a
host say "that block is not there any more" honestly instead of guessing.

---

## 16 — Other editors' selections, and a soft claim on a subtree

**Status: OPEN, raised 2026-07-30 against `0.41.0`.** The last item on the builder audit's own
roadmap (slice 24) and the only one never written up here — filed now rather than left implicit.

### Where sparx already is

Live co-editing works. `/ws/builder` relays `ops:relay`, `applyRemoteOps` folds another author's
edits into the canvas as they land, and presence carries `{socketId, userId, name, activePage}` — so
the editor can say **"3 editing"** and which page each person is on.

What it cannot say is **where in the page they are**. Two authors on the same page see each other's
edits appear with no warning and no attribution: a heading rewrites itself under your cursor and
nothing on screen connects that to the name in the toolbar.

### The ask

Two seams, both small, both additive:

```tsx
// 1. Draw someone else's selection on the canvas.
peerSelections?: { id: string; nodeIds: readonly string[]; name: string; color?: string }[];

// 2. Refuse to edit a subtree someone else is holding.
claims?: { nodeId: string; by: string }[];
```

**Selections, not cursors.** A pixel cursor is the wrong primitive for this editor — the document is
a node tree with no x/y (the same reason §4's nudge was declined). "Ana is in this block" is the
fact that matters, and the engine already has the ring, the hover outline and the Navigator row to
draw it on. A host cannot: the canvas owns its own overlay layer and exposes no seam to paint one
node's chrome, and selection is per-client by design (`select` is deliberately view-only with no
ops), so there is nowhere to put another client's.

**A claim is the softer half of a lock, and the important half.** `setLocked(id, 'host')` already
exists and is exactly wrong here: it is permanent policy, not "someone is typing in this right
now". A claim wants to be advisory and self-expiring — the local editor greys the subtree, names the
holder, and refuses a mutation inside it, while everything around it stays editable. Ops-level
last-write-wins already keeps the DOCUMENT correct; the claim is what stops two people making a
mess they then have to untangle by hand.

### Why a host cannot do either

Both are canvas-rendering concerns inside the engine's own overlay, and the second additionally
needs the mutation chokepoint (`transact`) to refuse. A host can compute who holds what — sparx
already relays it — and has nowhere to hand it.

### Generic?

Yes, and this is the one ask on this list that every multiplayer editor has answered somehow. None
of it names a domain concept: a CMS, an email builder and a static-site generator all want "show me
who else is in here, and stop me editing what they are holding."

### Scope note

`activePage` presence is already enough for the coarse case, so this is a POLISH ask, not a
correctness one — the document is safe without it (per-node LWW + the op log + draft version
history). Filed at the priority that implies.

### ANSWERED — `0.45.0`

Shipped as ONE roster instead of the two lists asked for, and the merge is the right call:

```tsx
<Builder peers={[{ id: socketId, name: 'Ana', selection: [nodeId], claim: [nodeId] }]} />
```

`Peer` is `{ id, name, color?, selection?, claim? }`. Pass the full roster on every change — the
engine diffs it — or reach the same thing imperatively via `editor.setPeers`, whichever matches
how presence already arrives.

- **`selection` is DRAWN and never enforced** — a named ring on the canvas plus a marker in the
  Navigator. Pass it alone and the editor gains attribution and nothing else, which is exactly
  the coarse case sparx is missing today.
- **`claim` is ENFORCED** — the subtree greys, names its holder, and refuses local mutation while
  everything around it stays editable. Nothing is relayed and nothing lands on the undo stack, so
  a claim can never be why a remote op was dropped; `applyRemoteOps` ignores claims entirely,
  including the claim held by the very peer whose ops are arriving. The host owns the lifetime —
  start on focus, end on blur or a timeout.
- `color` defaults to a stable value derived from `id`, and is deliberately NOT a theme role: a
  peer painted `primary` vanishes into a document that is mostly primary, and two peers would
  collide.
- `useClaim(id)` and `usePeers()` are exported for host chrome, plus `peerColor` and
  `editor.claimOn(id)` (which resolves the holder of a node OR any ancestor). `ChangeKind` gains
  `"peers"`.

**Adoption note for sparx.** `/ws/builder` already relays `{socketId, userId, name, activePage}`,
so `selection` is a small addition to the presence payload and `claim` is a focus/blur lifetime on
top of it. That is the audit's slice 24, now unblocked.

---

## 17 — A host-contributed TAB in the inspector, for document-scoped tools

**The ask:** let a host add a TAB alongside `Design` and `Settings` in the right panel —
something like `inspectorTabs?(): InspectorTab[]` with `{ id, title, order?, render(ctx) }` —
where `render` takes NO node.

**Why `inspectorPanels` cannot do this.** It is the only inspector seam on `BuilderHost`
(`dist/react/index.d.ts:1387` in `0.41.0`), and it is the wrong shape on both axes:

1. **It adds sections, not tabs.** A panel is rendered inside an existing tab, wrapped in a
   titled `Group`. There is no way to reach the tab strip; nothing matching `inspectorTab` /
   `panelTab` / `rightPanel` / `tabSlot` exists in the declarations.
2. **It is node-scoped.** `render(node, ctx)` is keyed to the current selection, which is right
   for what it was built for (SEO on a page root, a product pin, a per-module editor) and wrong
   for anything about the DOCUMENT. A document-scoped tool contributed this way would appear and
   disappear as the selection changes, and re-render on every click.

**The concrete case: version history.** sparx has draft-version history (restore a draft, roll
back a publish) and it currently lives in a drawer over the editor. Brandon's objection to that
is a platform rule, not a preference — the workbench is an MDI shell and a drawer breaks its
flow — and the destination he named is exactly a third tab: `Design` · `Settings` · `History`.
It is document-scoped by nature: which version you restore has nothing to do with which element
is selected.

**Why we are not building it host-side.** The host could render its own tab strip next to the
engine's. That is strictly worse: two strips in one panel, one of them owning state the engine
is authoritative for, and a user with two places to click for "what tab am I on". A seam is the
only version of this that isn't a fork.

**Generic?** Yes, and probably under-asked. Any host with a document-scoped tool wants this —
history, comments, a page/asset browser, a publish log, an accessibility report. Today all of
them have to become a drawer or a modal, which is what every host will do, which is what makes
every host's builder look bolted together.

**Not blocking.** The drawer works; it is in the wrong container. Same priority as §16.

### ANSWERED — `0.43.0`

Shipped as `inspectorTabs?(node: SelectableNode | undefined): InspectorTabDef[]`, and the shape is
better than the one asked for. Rather than making every host tab node-free, it splits the two
cases explicitly:

- `InspectorNodeTab` (`scope?: "node"`, the default) — `render(node, ctx)`, a peer of the built-in
  Design and Settings, which are themselves this shape.
- `InspectorPanelTab` (`scope: "panel"`) — `render()`, no node and **deliberately no mutation
  ctx**: those are per-node primitives, and handing them to a tab that is showing something else
  would invite it to edit "the selection" while displaying a document. A panel tab that needs to
  write reaches the editor through the host's own state.

Two details worth keeping in mind when contributing one, both from the shipped declarations:

- **Return panel tabs unconditionally.** The seam is called with the selected node (or `undefined`),
  and a host that filters everything on `node` makes its own history panel unreachable the moment
  the author clicks empty canvas.
- **`order` sorts against the engine's own** — Design is `0`, Settings is `10`. sparx's History is
  `20`. Ids must be unique and `design`/`settings` are reserved; a dupe is dropped with a warning.

The engine also hides the identity header and the Duplicate/Delete footer while a panel tab is
open, so the rail reads as one surface, and a node-scoped tab that stops being returned while open
falls back to Design rather than blanking. Adopted in
[apps/workbench/surfaces/builder/studio/version-history.tsx](../../apps/workbench/surfaces/builder/studio/version-history.tsx)
— the drawer is gone.

---

## 18 — Let a status-bar item be clickable

**The ask:** relax §14's "non-interactive content only" for `statusBarSlot`, so a host's
status item can be the trigger for its own detail — the thing every IDE status bar does.

**Where this came from.** sparx's pre-publish check now reports "3 broken · 15 to fix" into
`statusBarSlot`, which is exactly what that slot is for and is the best thing about the
feature: the count is ambient, so it is read without opening anything. Brandon's instinct on
seeing it was to click the count — and it isn't clickable, so the control that opens the list
is a button in the toolbar, two floors away from the number that motivates pressing it.

**Why the rule exists, and why we think it is one case too broad.** §14 argued — and we
agreed, and still agree — that a 28px strip is no place for a dense cluster of controls, and
that state belongs below while actions belong above. That holds for a _control_. It does not
hold for a **status item that reveals its own detail**: clicking "3 broken" to see which three
is not a new action, it is reading the same fact at more depth. The precedent is universal —
every status item in VS Code's bar is clickable, and none of them are toolbars.

**Shape, if it helps.** Nothing needs to change structurally; the constraint is documentary.
Either soften the doc to "no controls that ACT — a status item may reveal its own detail", or
make it explicit with a small typed affordance:

```tsx
statusBarSlot?: React.ReactNode; // unchanged; the doc stops forbidding a disclosure
```

**Not blocking, and deliberately not pre-empted.** sparx has NOT put a button in the strip on
the theory the rule is wrong — the count is plain text and the trigger stayed in the toolbar
(`site-check.tsx`). That split is defensible on its own terms, so this is a polish ask.

**Generic?** Yes. Any host with a countable state — unsaved conflicts, failing validations,
queued jobs, collaborators — wants the number and the detail to be the same target.

### ANSWERED — `0.45.0`

Answered with a component rather than a softened sentence, which is better than what was asked
for: `StatusItem`, exported from `@wizeworks/silicaui-builder`.

```tsx
<StatusItem onClick={open} expanded={isOpen} controls="site-check-panel">
  3 broken · 15 to fix
</StatusItem>
```

- **No `onClick`** → a plain `<span>`, no tab stop, no hover, identical to the engine's own
  `mode`/`device` labels. That is what most status is.
- **With `onClick`** → a ghost `btn-xs`, 24px inside the 28px strip so the row height never moves,
  carrying `aria-expanded` / `aria-controls` when `expanded` and `controls` are passed — because a
  disclosure that doesn't announce itself is a mystery target for anyone not using a mouse.

`expanded` is what keeps §14's rule intact rather than repealing it. An item with no disclosed
panel to point at is an action wearing a status item's clothes, and it still belongs in
`toolbarSlot` beside Publish. The line moved from "nothing interactive" to "nothing that ACTS —
send, save, publish, navigate away", which is the distinction the ask was arguing for.

**Adoption note for sparx.** `site-check.tsx` renders the count as plain text with its trigger in
the toolbar. The count becomes the trigger, and the toolbar button goes away.

---

## 19 — A custom color is a canvas-only color

**The ask:** widen `customColorCss` to cover every color-aware component (it covers one),
and give it a documented, non-`react` entry point a host can call on its RENDER path.

**Where this came from.** Reported by silicaui against `0.41.0`, on the sparx theme editor:

> Canvas-only. `customColorCss` is imported solely by `Canvas` and `ComponentBoard` —
> publish/export never calls it. A published page needs the host to add the name to
> `@plugin "@wizeworks/silicaui" { colors: … }`, or it ships unstyled.

The diagnosis is right and the suggested remedy is the one thing a host cannot do. That
`colors:` list is a **build-time constant** in each app's `globals.css`; the name is coined
at **runtime**, by a tenant, in the theme editor, on a site whose bundle shipped months ago.
Editing the list means the platform redeploys every time a merchant invents a color.

**Two separate gaps, and the second is the surprising one.**

1. _Nothing carries it to publish._ Expected, and a host's job — see below.
2. _`customColorCss` is much narrower than a real registration._ It emits
   `colorUtilityRules(custom)` + `buttonColorVars(custom)` — `.text-`/`.bg-`/`.border-`
   and `.btn-<name>`. Registering the same name in `colors:` emits **41** rules at
   `0.41.0`: `.badge-`, `.alert-`, `.input-`, `.select-`, `.textarea-`, `.tabs-`,
   `.toggle-`, `.checkbox-`, `.radio-`, `.step-`, `.link-`, `.progress-`, `.range-`,
   `.slider-`, `.switch-`, `.status-`, `.meter-`, `.calendar-`, `.data-table-`,
   `.chat-bubble-`, `.toast[data-type=]`, … plus the utility trio for the `-content`
   pair as well as the color. So an author who adds "sunset" and puts it on a Badge sees
   a bare badge **in the canvas** — which reads as "custom colors are for buttons",
   not as a preview limit.

**What sparx shipped, and why it is a workaround rather than the fix.**
`@sparx/silica-catalog/src/custom-colors.ts` runs the plugin itself against a stub
Tailwind context — once with the custom names and once without — and keeps the
difference. That recovers all 41 rules per name, serializes them into `@layer base`,
and the storefront injects them beside the theme file. It also derives the measured
`--color-<name>-content` via `resolveThemeTokens`, because `addColor` writes only the
base token and the `.text-<name>-content` utility references the pair with no fallback.

It works, and it is forward-compatible (a component added in `0.42` is picked up with no
change). But it depends on `plugin.withOptions`' return shape and on `addBase` being the
only channel that matters — two internals, in a package that publishes no types. The
right home for it is silicaui.

**Shape.** Two halves, and they are independent:

```ts
// (a) widen the existing one — same signature, every component instead of the button
customColorCss(theme: Theme, scope?: string): string;

// (b) a render-path entry point that does not import react, alongside the css/html paths
import { customColorCss } from '@wizeworks/silicaui-html/theme';
```

**Status: (a) is in flight** — silicaui confirmed on 2026-07-31 that the remaining components
are on their way. That closes gap 2 and squares the canvas with the published page. Sparx
needs no change when it lands: `buildCustomColorCss` already emits all 41 and the canvas rule
set is scoped to `.sui-canvas`, so the two never meet.

**(b) is what actually retires the workaround**, and gap 1 stays open without it. Once a host
can call `customColorCss` off the render path, `custom-colors.ts` drops the plugin difference
and calls it — deleting the two internals sparx currently leans on (`plugin.withOptions`'
return shape, and `addBase` being the only channel that matters). Until then the workaround
carries a published site, and the derived `-content` stays sparx-side either way.

**Generic?** Yes, and unavoidably so. It is not a sparx shape: the moment a design system
lets a color be **named at runtime** — any multi-tenant builder, any white-label app, any
CMS with a theme editor — the build-time `colors:` list stops being expressible, and every
such host has to rebuild this. It is also the literal promise in `color-utilities.js`'s own
header ("n named colors cascade through everything") applied one step further out: past the
canvas, onto the page the visitor loads.

**Adjacent, and worth a line in the docs either way.** Nothing between the theme editor and
the live page notices the problem. sparx's class validator only rejects viewport variants,
the engine floor only rejects `fixed`/`url(…)`, and `toHtml` emits `class` verbatim — all
correct individually, but the combined effect is that `btn-sunset` reaches production
looking like a typo nobody made.

---

## 20 — A host component is a second-class palette row

**The ask:** let `hostComponentGroups` carry the whole `HostComponentDef` into the palette
row and onto the inserted node, the way `blockItem` already carries a block's.

**Verified against `0.50.0`** (`dist/react/index.js`), and **found by opening the palette,
not by a test** — every defect below is invisible to any assertion about trees or rendered
HTML, which is why it survived a full render sweep.

`hostComponentGroups` (:6605) builds its item from four of the def's fields and drops the
rest:

```js
const item = {
  key: `host:${def.name}`,
  label: def.label,
  icon: "plug",          // :6611 — def.icon is never read
  make: () => { … }      // no hint, ever
};
const cat = def.category ?? "Host";   // :6618 — used as the group LABEL
```

Five consequences, one root cause:

1. **`icon` is dead.** Every host core in the palette draws the same plug glyph. The field
   is declared on `HostComponentDef` (`index.d.ts`) and read nowhere, so a host spends
   real effort picking a registered `IconName` — sparx has comments in two files
   explaining its choices — and none of it renders. Worse, silence: the honest outcome of
   an unimplemented field is a type error, not a plug.
2. **`hint` cannot be supplied at all** — `HostComponentDef` has no `hint` field. So a host
   row gets no `title` tooltip (`ItemRow` sets `title: item.hint`) and contributes nothing
   to search ranking, which scores over label / key / hint / groupLabel. Catalog rows get
   all four; host rows get two.
3. **`category` is used verbatim as the group's display LABEL**, while its key becomes
   `hostcat:<slug>`. Nothing says so — the name reads like a slug, and every host in the
   world will pass one. sparx passed `'media'` and got a second group heading rendering as
   `MEDIA`, sitting directly beneath silicaui's own built-in `Media` group: two sections,
   one heading, because `mergeCatalog` only ever merges by key.
4. **The registered `label` never reaches the node.** `makeInsertNode` stamps
   `label: item.label` only when the key starts with `block:`, so a placed host core has
   no `label` and `nodeName` falls through to the derived type name. The inspector header
   for `site.map` reads **`Site.map`** — the raw key, sentence-cased — rather than the
   label the host registered two lines away in the same object.
5. **`IdentityHeader` calls a host node an Outlet** (:9397) — the ternary has no arm for
   `kind: "host"`, so it lands in the `else`:

   ```js
   const kindLabel =
     node.kind === 'component' ? 'Component' : node.kind === 'element' ? `<${node.tag}>` : 'Outlet';
   ```

   `kind: "host"` and `kind: "outlet"` are different primitives with different semantics —
   one is a host-rendered region, the other is where a page body lands — and the inspector
   tells the author they are the same thing.

**Why a host cannot do this.** All five are inside the engine's own palette + inspector
rendering. A host supplies `hostComponents()` and has no seam between that call and the
row; `catalog().extend` cannot contribute a `host:` item because only
`hostComponentGroups` knows how to build the `make()` that stamps `locked: "host"`.

**Shape.** No new API — read the fields that already exist, add the one that doesn't:

```ts
interface HostComponentDef {
  icon?: IconName; // read it (fall back to "plug")
  hint?: string; // add it; flow to ItemRow's title + search scoring
  category?: string; // document as DISPLAY COPY, not a slug
}
```

…plus `makeInsertNode` stamping `label` for `host:` keys as it does for `block:`, and a
`"Host"` arm in `IdentityHeader`'s `kindLabel`.

**Generic?** Yes — and this is the ask that most clearly is. Host components are the
engine's declared extension point for "regions the host renders": a CMS's related-posts
strip, an analytics tile, a commerce cart. Any host that registers more than three of them
hits all five, and every one of them will write the same workaround sparx did — encoding
the distinction into the `label` string, because that is the only field that survives.

**What sparx did meanwhile.** Relabelled its bare cores (`Map` → `Map on its own`) because
two of its host labels collided exactly with catalog blocks and there is no other lever
(see §21), and rewrote its five `category` slugs as Title Case display copy. Pinned with
`packages/silica-catalog/src/palette-names.test.ts`.

### ANSWERED — `0.51.0`

All five parts, and `category` came back better than the ask. The ask only wanted it
DOCUMENTED as display copy; `hostGroupFor(category, base)` instead slugs it and looks it up
among the built-in groups by key or slugged label, so a host can file its cores **into**
Media rather than merely avoiding the name. `hostIcon` also does more than read the field —
it validates with `isIconName` and warns once on a miss, which turns the original
silent-empty-glyph footgun into a diagnosable one.

sparx keeps its "Your …" groups (a host core is filled from tenant data on every request;
filing a live map beside a static `<img>` would lose that distinction), and keeps the
distinct labels — see §21. The one thing that did NOT need adopting is `useHostDisplay`: it
derives from `hostComponents()`, which sparx already supplies, so the inspector went from
`Site.map` to the registered label with no code change.

---

## 21 — `hide` cannot reach a host row

**The ask:** apply `host.catalog().hide` AFTER host component groups are merged, so a host
can suppress a `host:*` row.

**Verified against `0.50.0`.** `catalogForHost` (:6629) merges twice, and only the first
merge carries the hide set:

```js
function catalogForHost(base, adapter) {
  let groups = mergeCatalog(base, adapter?.catalog?.()); // ← hide applied here
  const defs = adapter?.hostComponents?.() ?? [];
  if (defs.length) groups = mergeCatalog(groups, { extend: hostComponentGroups(defs) });
  return groups; // ← host rows never filtered
}
```

So a `host:<name>` key can never be in `hidden` at the moment it would matter. Every other
palette row is suppressible; host rows alone are mandatory.

**Why this bites.** A host core is frequently the RAW INGREDIENT of a curated block rather
than something an author should place directly. sparx's `site.map` core is the bare frame;
its `map_embed` catalog block is that core wrapped in a heading and — the part that
matters — the address as readable text, because a map is a picture that cannot be copied
into a phone or read by a screen reader. The palette offers both with equal weight, and
the bare one is the worse answer on every axis. Hiding it is the correct fix and is not
expressible.

**Shape.** One line — filter after the second merge, or thread `hidden` through both.

**Generic?** Yes. It is a plain inconsistency in an existing seam: `hide` is documented as
the way a host curates the palette, and it silently covers everything except the rows the
host itself contributed.

### ANSWERED — `0.51.0`

`catalogForHost` runs the host groups through `mergeCatalog(…, { hide: contributed?.hide })`
before extending, so a `host:*` key is now suppressible like any other row.

**And sparx is not using it** — worth recording, because the ask argued it should. The
argument was that `site.map` is the raw ingredient of `map_embed` and therefore noise. That
is right about the common case and wrong about the composing one: the catalog block is a
whole `<section>`, so an author placing a map inside a column, a card, or a two-up row they
built has no other route. What actually fixed the problem was the naming (§20's label rule),
not removal. The capability is the right one to have; this particular row just is not the
one to spend it on.

---

## 22 — A palette row loses its name before it loses its group badge

**The ask:** in `ItemRow`, let the group badge shrink or drop before the item label does.

**Verified against `0.50.0`** (:8036). The row is a flex button with three children:

```js
jsx(Icon, …),
jsx("span", { className: "truncate", children: item.label }),
groupLabel && jsx("span", { className: "ml-auto shrink-0 text-xs uppercase …", children: groupLabel })
```

The label has `truncate` but no `min-w-0`, and the badge is `shrink-0`. In a narrow panel
the badge keeps its full width — `VIDEO, AUDIO & MAPS` is 19 characters at `text-xs` — and
the label truncates to **nothing**. The result is a search result list where several rows
show an icon and a category and no name at all.

Not host-specific: it hits every row, and it only appears in SEARCH results (the browse
list renders the group as an `<h3>` and passes no `groupLabel`), which is exactly when the
author is reading names rather than scanning sections.

**Why a host cannot do this.** The row is engine-internal; a host cannot restyle it, and
the panel width is the host's own dock, so "make the panel wider" is not a fix — a
tear-off pane or a compact layout reproduces it.

**Shape.** `min-w-0` on the label span, and let the badge shrink (or hide below a width).
The badge is the redundant half — the label is what the author searched for.

**Generic?** Yes; nothing about it involves the host at all.

### ANSWERED — `0.51.0`

```js
(jsx(Icon, { className: 'shrink-0 …' }),
  jsx('span', { className: 'min-w-0 flex-auto truncate text-left', children: item.label }),
  groupLabel && jsx('span', { className: 'min-w-0 shrink-[99] truncate text-xs uppercase …' }));
```

`shrink-[99]` rather than dropping the badge outright is the better call than the one the
ask proposed: the category still degrades gracefully instead of vanishing at a breakpoint,
and the row keeps its shape at every width. The icon also gained `shrink-0`, which the ask
missed — without it the glyph would have been the next thing to collapse. Nothing to adopt;
it is engine-internal.

---

## What sparx is doing meanwhile

None of the above blocks the sparx-side work. [docs/builder-audit/01-roadmap.md](../builder-audit/01-roadmap.md)
Waves 1, 2 and 4 are all host-side and in flight; this register is Wave 3.

Related: [builder-audit](../builder-audit/00-README.md) · [119 (superseded)](../119-silicaui-builder-gap-questions.md) · [118 — silicaui migration](../118-builder-silicaui-html-migration.md) · [126 — op protocol](../126-builder-op-protocol.md)
