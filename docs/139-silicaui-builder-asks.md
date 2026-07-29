# 139 — silicaui-builder: the open asks (ANSWERED in 0.36.0)

**Version:** 2.2.0
**Author:** Brandon Korous
**Last Updated:** 2026-07-29

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

> **This supersedes [doc 119](119-silicaui-builder-gap-questions.md).** 119 was written 2026-07-11
> against silicaui-builder **0.8.0**, and its framing question — _"should sparx adopt silica's
> engine, or keep its own?"_ — has since been answered and executed: `/builder/studio` **is** the
> silica editor, sparx's bespoke editor is deleted, and `apps/dashboard` no longer exists. 119's
> load-bearing five are shipped. Only two of its items are still live (Q22, Q26), and they are
> carried forward here as §7.
>
> **What this doc is.** The current register of things sparx **cannot** fix from the host seam,
> each naming the specific missing API. It is the input to silicaui's own roadmap — WizeWorks owns
> both sides — and the companion to [docs/builder-audit](builder-audit/00-README.md), which is
> where the evidence and the sparx-side work live.
>
> **The generic-first bar from 119 still applies and is still right:** every ask below must have an
> answer a _different_ host — a CMS, an email tool, a static-site generator — could implement and
> get the same builder from. If an answer only fits sparx, it belongs in the host, not the engine.

**Originally verified against** `0.35.0`, the version pinned when these were written. **Resolved in
`0.36.0`, with §3 and §5 extended in `0.37.0`** — which is what `pnpm-workspace.yaml` now pins.
Every resolution in the table above was confirmed by reading the shipped `.d.ts` and bundle, not
the changelog: 0.37.0 was diffed against the installed 0.36.0 tree before the catalog was moved.

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
[builder-audit roadmap](builder-audit/01-roadmap.md) slice 6 swept the sparx catalog onto
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
document ([`silica-op-invert.ts`](../packages/builder-schemas/src/silica-op-invert.ts)), and 22
of the 24 op kinds invert cleanly against `Editor.applyOp`.

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
[site-themes/v2/color.ts](../packages/site-themes/src/v2/color.ts) picks whichever of near-white and
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
[RULE #2](../CLAUDE.md) bans, and because those blocks are in the default Insert palette, it ships
into tenant sites by default.

Either drop the part from those two blocks upstream, or sparx hides them via `catalog().hide` and
ships replacements. Worth settling upstream, since WizeWorks owns both sides.

---

## What sparx is doing meanwhile

None of the above blocks the sparx-side work. [docs/builder-audit/01-roadmap.md](builder-audit/01-roadmap.md)
Waves 1, 2 and 4 are all host-side and in flight; this register is Wave 3.

Related: [builder-audit](builder-audit/00-README.md) · [119 (superseded)](119-silicaui-builder-gap-questions.md) · [118 — silicaui migration](118-builder-silicaui-html-migration.md) · [126 — op protocol](126-builder-op-protocol.md)
