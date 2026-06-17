# Builder v2 — Full Customization Rebuild

**Version:** 1.5
**Author:** Brandon Korous / WizeWorks
**Last Updated:** 2026-06-17

> **Status (v1.5 — all seven pillars built + merged to `main`):** The entire plan is shipped. Beyond v1.4: **Pillar 4** (mediated unlocks — background-image-anywhere, the motion/animation library, the guarded position control, the extended bounded z-scale); **Pillar 5** (the closed `data-sx-*` behavior runtime — carousel/disclosure/tabs/scrollspy/marquee/menu — authored via sanctioned `props.behavior`/`props.sxRole`, lowered to `data-sx-*` and wired into **both** render surfaces); **Pillar 6 composites** (carousel hero, brand marquee, scroll-adaptive nav, mega-menu, single-open accordion, tabbed panels — behavior-bearing catalog rows on the runtime, with a sanctioned `hidden` attribute so closed panels ship collapsed and a cross-package vocabulary drift-guard); the **DB-backed `PlatformComponent` catalog + lifecycle/review API** (§5 — `/v1/platform/catalog/*`, CRUD + `draft→submitted→in_review→approved→published→archived|rejected`, owner-gated, global-table RLS); **Email v2** (§3.6c — the email-safe `class`→inline-style compiler driving **both** the real send renderer and the canvas preview, email-surface inspector gating, and `email` catalog blocks); and **View HTML + one-way HTML import** (§3.8/§4.2). The DB catalog was reconciled to **one shared vocabulary** with the data-as-code entry: `kind` is `common|comprehensive`, grouping is the shared 8-value `category`, plus `surfaces`/`icon`/`description` — so a published row renders in the Add palette identically to a static catalog entry, and the static catalog can seed straight into the table. **Remaining:** the §8 **live-storefront acceptance pass** (pin a card to a real product whose Add-to-cart adds the right variant; reproduce 2–3 reference mockups) is not yet exercised in a browser — everything to date is unit/type/lint-verified.
>
> **Status (v1.3):** Pillars 1–3 shipped (raw elements, full-surface inspector, binding spine). The **component library (§5) is built** as a static data-as-code catalog — **86 components across 8 categories** in `packages/builder-schemas/src/catalog/`, surfaced directly in the Add palette (no DB round-trip for the published initial library; the DB-backed `PlatformComponent` table + lifecycle API is the deferred admin-authoring layer). `PLATFORM_ARCHETYPES` is **removed** — the catalog is the platform library; `BuilderArchetype` is now purely tenant-authored. The **site layout is a free canvas** whose only structural invariant is the Outlet (§3.7). The **navbar is a real component** — a `<nav class="navbar">` with `navbar-start`/`navbar-center`/`navbar-end` zones (CSS verbatim from daisyUI, in surface-compile); the bare `navbar` catalog entry is JUST the bar + empty zones (common), while a pre-filled `navbar_brand` (brand + nav + action) is a separate **comprehensive** entry. There is still ONE navbar primitive — no "centered" variant; centering the brand is just moving it into `navbar-center` (§5). _(v1.3 also fixed a load-bearing studio bug: the Layers-tree rows were missing `ref={sortable.setNodeRef}`, so dnd-kit never measured them and tree drag-reorder silently never landed.)_ **(v1.4)** Adds the §3.8/§4.2 spec for **View HTML** (read-only "view/copy source," both web + email) and **one-way HTML import** (paste a Tailwind fragment → validated Pillar-1 `Element` nodes); **two-way / live HTML editing is explicitly rejected** (§9). _(v1.5: View HTML + one-way import are now built.)_

---

## 1. Why this doc exists

The builder's **compile engine is strong** but its **authoring surface is ~1/10**. docs/61 deleted the `box`/`layout` objects and made the node's `class` string the one styling surface, compiled per-tenant by the real `@tailwindcss/node` through `@sparx/surface-compile` into a single `tenant.css` that drives **both** the editor canvas and the live storefront (preview == production). The plumbing can compile essentially any Tailwind class. What it **cannot** do today:

1. **Drop a raw HTML element.** The registry is a closed set of ~34 curated semantic types (`Section`, `Heading`, `Button`, …). There is no `<div>/<span>/<a>/<ul>/<svg>/<nav>/<header>/<details>/<table>/<form>`.
2. **Expose the full Tailwind surface in the inspector.** `text-center` exists but lives in a collapsed Typography card; there is no per-**state** (`hover/focus/group-hover/peer`) or per-**breakpoint** (`sm/md/lg`) editing. "I can't even center a header" is a real, representative failure.
3. **Express the patterns the references need.** The security denylist blocks background-image `url()`, `fixed`, arbitrary `z-[…]`, and custom `@keyframes` — all of which the 15 reference mockups in `docs/mockups/examples/` (tesla, nike, notion, …) rely on.
4. **Be interactive.** Carousels, mobile menus, scroll-adaptive navs, accordions need behavior a class string can't carry.
5. **Offer a component library** — common (daisyUI-grade) or comprehensive composites.
6. **Sell.** `Binding = { path }` only. A node cannot bind to a concrete product/collection, there is no "this card _is_ Product X," and a button cannot carry an add-to-cart action against the product in its scope. Building a real store fails.

This doc is the deliberation artifact (refs → decisions → doc → build) for the **one correct, production-complete attempt** to close all six. It supersedes nothing in docs/61 — it builds **additively** on that foundation.

The 15 reference mockups (`docs/mockups/examples/`) are the acceptance target: world-class, diverse sites built from raw `div/span/a/section/svg` + the full Tailwind surface + a little JS for carousels/menus/scroll-sync.

## 2. The node model is already right — we extend it, we don't replace it

`BuilderNode = { id, type, name?, class?, props, binding?, children? }` (`packages/builder-schemas/src/node.ts`). `class` is the styling surface; `props` is component data; `binding` wires data; `children` is the tree. This survives intact. Builder v2 adds exactly three things:

- a **universal raw-element** node type (`type: 'Element'`, tag + attributes in `props`);
- a **richer `Binding`** (entity + collection + action, not just `path`);
- a wider **class budget** (the 500-char cap is too small once a node carries base + responsive + state variants — raise to a generous bound).

Everything else is UI (inspector), renderer plumbing (raw elements + behaviors), governance (mediated unlocks), and content (the archetype library).

## 3. Decisions (load-bearing)

### 3.1 Security → mediated unlocks (keep the invariant)

The allowlist stays **tighten-only**; the insecure literal stays un-representable. Tenants never type `url(...)`, `@keyframes`, or `fixed`. The builder **lowers** each dangerous primitive on the tenant's behalf, from a safe knob:

| Reference need                             | Safe emitter (platform-owned)                                                                                                                                                                                                                   |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Background photo (`url()`)                 | Asset-picker → sanctioned inline `background-image` from a **tenant-owned asset URL** (generalize the existing `bgImage` prop + `backgroundStyleFor()`). Raw `url()` in `class` stays denied.                                                   |
| Marquee / float / ken-burns (`@keyframes`) | A platform-owned **animation library** baked into `RENDER_LAYER_CSS`; the Motion card emits `animate-<name>` + tempo. No tenant keyframes.                                                                                                      |
| Sticky / transparent nav, FAB (`fixed`)    | A **position control** with `sticky` (already allowed) + a **guarded `fixed`** the renderer lowers with anti-clickjacking constraints (never a full-viewport fixed overlay). Raw `fixed` literal stays denied; the control is the only emitter. |
| Stacking (`z-[…]`)                         | Extend the **bounded named z-scale** (theme + allowlist). Arbitrary `z-[…]` stays denied.                                                                                                                                                       |

This preserves docs/61 §6 + the Phase 6b governance posture (`packages/surface-compile/src/allowlist.ts`).

### 3.2 Interactivity → a sanctioned behavior runtime (no tenant JS)

A small, **closed, platform-authored** set of declarative behaviors, attached by data-attributes and shipped in the **shared renderer** so the canvas and the storefront behave identically:

`data-sx-carousel`, `data-sx-disclosure`, `data-sx-tabs`, `data-sx-scrollspy`, `data-sx-marquee`, `data-sx-menu`.

No tenant-authored scripts (cross-tenant XSS surface, and it would break the single-renderer guarantee). Comprehensive components are **raw elements + Tailwind + a behavior**, parameterized by attributes from a Behavior panel.

### 3.3 Inspector → the full Tailwind surface, organized exactly like Tailwind

**The binding instruction (repeated by the user, now the spec): every Tailwind class settable on every object, and the inspector's information architecture mirrors Tailwind's OWN documentation sections.** We are implementing Tailwind, so the UI follows Tailwind's published convention — a well-tested, conventional structure — rather than inventing a bespoke "intent layer." No reinvention. The panels ARE Tailwind's categories:

**Layout · Flexbox & Grid · Spacing · Sizing · Typography · Backgrounds · Borders · Effects · Filters · Tables · Transitions & Animation · Transforms · Interactivity · SVG** (base/preflight is global, not per-node).

- **Every object gets the complete set** — the 34 named components AND raw `el:<tag>` elements — with **no per-type gating** of the surface.
- **State + breakpoint are just Tailwind variants** (`hover:`/`focus:`/`active:`/`dark:` and the responsive prefixes), via the already prefix-aware `applyValue(class, control, value, prefix)`.
- A **searchable raw-class add** (allowlist-validated) stays underneath for anything not surfaced as a control.
- "Center a header" was only an EXAMPLE of the real requirement; it is solved for free because `justify-*` / `items-*` / `self-*` / `mx-auto` all live under **Layout** and **Flexbox & Grid** exactly where Tailwind documents them. (The earlier `text-align`-as-element-centering confusion just proves the surface must be complete + correctly placed per Tailwind, not curated.)

`class-controls.ts` already covers much of this vocabulary and is prefix-aware. Phase 2 **reorganizes the inspector panels into Tailwind's sections and fills the gaps to completeness**, then applies the whole surface to every object. The `node.class` cap is raised (500→2000, done) to hold the resulting base+variant strings.

### 3.4 Migration → additive

The 34 curated types and all live tenant pages keep working unchanged. The raw-element primitive is the new **foundation beneath** them; the libraries are compositions on it. No forced migration, and each phase is independently deployable (deploy-early).

### 3.6 Three distinct destinations, shared designer primitives (NOT one merged editor)

The builder module has **three separate destinations** in its sidebar — **Editor** (brand/site/page), **Email**, and **Component designer** — and they stay separate experiences. They **share designer primitives** at the code level (the canvas shell, inspector controls, palette infrastructure, `class-controls`, `renderLeaf`, the raw-element module, behaviors) but are **not** built into one monolithic editor. The codebase already models this split (`EditorSurface = 'page' | 'site' | 'email'`, `paletteForSurface`, the `EMAIL_TYPES` allowlist, separate routes).

**All three destinations are brought to v2.** The web family (Editor + Component designer) gets the full surface; **Email gets a v2 uplift on a medium-adapted track** (§3.6c). What differs between web and email is the _implementation_, dictated by email-client facts — not whether email is included.

#### 3.6c Email v2 — same UX, email-safe implementation

Email is its own destination and its own _medium_, but it gets v2 too. What transfers, and what the medium blocks:

**Transfers (email gets these):**

- The **shared inspector + class-authoring UX** — same controls. `node.class` drives email styling, compiled to **inline styles** at render via React Email's Tailwind (it is largely ignored today — email leaves carry a fixed look). This is the core email v2 win: real styling control.
- A **richer email-safe control set** (typography, color, spacing, alignment, borders, background image with an Outlook VML fallback).
- The **component catalog** (Pillar 5) — email blocks (header, hero, order summary, product grid, CTA, footer) as catalog rows of `kind: email`, admin/consultant-manageable via the same machinery.
- The **binding spine**, adapted — email already binds merge tokens + line items; align it with the v2 data UX (bind order/product fields). No cart actions.

**Blocked by the medium (client facts, not choices):**

- The **JS behavior runtime** (Pillar 4) — clients strip `<script>`; carousels/menus/scrollspy can't run in email.
- **Arbitrary raw HTML** (unrestricted Pillar 1) — Outlook's Word engine breaks on free-form `<div>` layout; email stays **table-based** with an _expanded but curated_ element set, not "any tag."
- **flex / grid / hover / sticky / fixed** and the external **`tenant.css`** — unsupported/inconsistent across clients; email **inlines** styles and designs for the lowest common denominator.

So email shares the designer primitives + inspector UX + catalog, on an **email-safe subset compiled to inline styles**, diverging only where the medium physically forces it.

#### 3.6b The component designer is the web editor scoped to a reusable component

The **Component designer** (`/builder/components`, the existing `BuilderComponent` / `custom:<key>` system) is its own destination but gets the **full** Builder v2 treatment, because it authors the same web building blocks as the Editor:

- It reuses the shared full-surface editor primitives (raw elements, inspector, unlocks, behaviors) — making those full-surface upgrades it largely for free.
- Its **palette offers the full compositional vocabulary**: raw HTML elements (Pillar 1) + published **catalog** components (common/comprehensive, stamped as a forked copy) + the tenant's **own** components (placed as live `custom:<key>` refs). So a tenant builds **a component out of other components** — primitives, platform components, and their own.
- **Cycle + depth guards** are mandatory: a component may not reference itself directly or transitively, and nesting depth is bounded. `expandComponentTree`/publish-expansion is the enforcement point — it already walks refs to pinned versions; it gains an ancestry check that rejects a cycle at author time and a hard depth cap at expand time.

### 3.5 Binding → a first-class spine

Extend `Binding` to carry an **entity** (a concrete product/collection/category/CMS record), a **collection source** (a real repeater over a chosen collection/category, not "all products"), and an **action** (a button that adds-to-cart / buys-now / links / submits against the entity in scope). Scope propagates down the subtree so a button, price, and image inside a product-pinned card all resolve against that product.

### 3.7 The site layout is a free canvas — the Outlet is the only invariant

A "site layout" is **not** a thing that requires a header and a footer. It is a canvas with exactly **one inversion-of-control point — the `Outlet`** (the content box where each routed page renders). The Outlet is the **only** structural necessity; header, footer, subfooter, sidebars are all just **author-composed content around it**, no different from anything on a page. So the page-vs-layout distinction collapses to: _a layout is a page that wraps the routed content._ Same editor, same catalog, same primitives — one special node.

- **The Outlet is `pinned`** (registry def): it cannot be deleted or dragged, and its layers "Remove" affordance is hidden — reusing the existing `pinned` mechanism (the email-wordmark precedent). This guarantees exactly one content box. Nothing else is protected.
- **The default seeded on site creation is composable chrome, fully deletable:** `root(stack) → [ Navbar (the navbar component — `navbar-start`/`navbar-center`/`navbar-end`), Main(row, full-width) → Outlet, Footer (catalog) ]`. Delete the navbar + footer → a **blank slate** (just the content box). Drop an `<aside>` into `Main` beside the Outlet → a **sidebar** — so sidebars work without the Outlet needing to move.
- **Nothing is hardcoded or required.** The default exists only so a new site looks live immediately (the <5-min onboarding goal); it is ordinary, editable seed data. Layouts seed **once**, so this changes only newly created sites — existing layouts are untouched (no migration).
- The default's navbar is the **navbar component** (`navbar` + zones, §5), not a bespoke `navbarHeader()` helper and not a rigid `Section "Header"`. The site "header" is just a navbar placed at the top — placement, not a type. The default centers the brand by putting the Wordmark in `navbar-center`.

### 3.8 Authoring in HTML → view + one-way import, never a two-way source of truth

The node tree is the **canonical model**; HTML is a **lossy projection** of it — flattening to `<div class="…">` discards what the tree carries: bindings (a card pinned to Product X, a repeater over a collection), component identity (a `BuyBox`, not a div), and behaviors (`data-sx-*`). So "let users work in HTML" resolves three ways, not one:

- **View HTML — yes, read-only, both surfaces.** A "View / Copy HTML" affordance that serializes the node/subtree's **clean publish output** (§4.2). Cheap, and it reinforces the canvas==production guarantee. For **email** it is near-expected — the inline-styled output authors paste into other tools or inspect for deliverability.
- **Edit HTML in place (two-way) — no.** Accepting hand-typed HTML back as the source would: (a) collapse the **tighten-only security invariant** (§3.1) from "insecure state un-representable" into free-text sanitize/parse — "we _try_ to catch bad input"; (b) **lose** bindings/behaviors/component identity on every round-trip (a live `BuyBox` silently demotes to a dead div); (c) create a **second source of truth** to reconcile — the Custom-CSS round-trip clash (eval F10), an order of magnitude worse; (d) break **canvas==production** the moment hand-HTML can diverge from the compiled tree. The depth this is reaching for is already served by raw elements (Pillar 1) + the full-surface inspector (Pillar 2) + the Custom CSS class card + JSON import/export of the _real_ model.
- **HTML import — yes, one-way, at insert.** The one genuinely missing capability — the workflow that built the 15 reference mockups (`docs/mockups/examples/`): paste/insert an HTML+Tailwind fragment → parse → §4.1/allowlist-validate → emit real `Element` nodes (Pillar 1) with fresh ids → bind/behavior them in the inspector afterward. One-way, exactly like stamping a catalog entry; no reverse sync (§4.2).

---

## 4. Rendering architecture: raw elements across both walkers

The renderer is deliberately split (docs/builder/02): `renderLeaf` (`packages/builder-render/src/render-leaf.tsx`) is the **one per-type leaf map** both surfaces call; the **host walkers** own the tree walk, per-node wrapper, iteration, and containers — the dashboard canvas (`apps/dashboard/.../_builder/canvas.tsx`) and the site renderer (`apps/site/components/builder-renderer.tsx`).

A universal raw element therefore lands in **three** places, kept in lockstep:

- **`renderLeaf`** gains an `Element` branch for **void/leaf** tags (`img`, `svg`, `hr`, `br`, `input`, an `<a>`/`<span>` with only text) — emitting `<tag class={leafClass} {...safeAttrs}>{children}</tag>`.
- **Both host walkers** learn that an `Element` **container** renders **as its `props.tag`** (with the safe attribute set) instead of the default `bx-inner` wrapper, then walk children normally. This is the one structural change to the walkers; the band-splitting / iteration logic is otherwise untouched.
- A single shared helper in `@sparx/builder-schemas` (`elementTag(node)`, `safeAttrs(node)`, the tag/attr whitelists) is the source of truth both walkers + `renderLeaf` import, so the canvas and the live site can never drift.

### 4.1 Safe-tag + attribute whitelist (the security boundary for raw HTML)

- **Allowed tags** — structural (`div section nav header footer main aside article figure figcaption`), text (`span p h1–h6 a strong em small blockquote address code pre label time`), lists (`ul ol li dl dt dd`), media (`img picture source svg` + svg children, `video audio`), tables (`table thead tbody tfoot tr th td caption colgroup col`), forms (`form input textarea select option optgroup button fieldset legend`), interactive (`details summary`).
- **Denied tags** — `script style object embed link meta base noscript template`. `iframe` is gated behind a separate trusted "embed" control (the existing `EmbedFrame` path for video/maps already proves the pattern).
- **Allowed attributes** — `href src alt type placeholder name value role aria-* id target rel` plus per-tag specifics; `rel="noopener noreferrer"` is forced whenever `target="_blank"`. No `on*` handlers. No raw `style` except the sanctioned background/position emitters (§3.1).

### 4.2 View HTML (serialize) + HTML import (parse) — both ride the §4.1 whitelist

Two additive affordances on the raw-element foundation, decided in §3.8. **Built (v1.5).**

**View HTML (read-only).** Serialize a node/subtree to an HTML string and show it in a read-only panel with a copy button — per-node (the selected subtree) and whole-document.

- The source is the **clean publish render, NOT `canvas.innerHTML`.** The canvas DOM carries editor chrome that never ships: the `data-node-id` / `.bx-node` `display:contents` layer wrappers, `.bx-canvas`-scoped utilities, selection rings. Serialize through the shared `@sparx/builder-render` path in a chrome-free mode (the publish path already emits exactly this), so "View HTML" shows what the storefront actually serves.
- **Web:** the string references compiled `tenant.css` classes (not inlined); the panel notes that pasting it elsewhere needs that stylesheet. An "inline the styles" option is a deferred nicety.
- **Email:** the serialized form is the **inline-styled, table-based publish HTML** (the §3.6c compile path) — self-contained, and the representation authors actually want.

**HTML import (one-way → nodes).** An "Import HTML" palette action (and/or a paste handler) takes an HTML+Tailwind fragment and inserts it as model nodes:

1. **Parse** the fragment to a DOM (a real parser, not regex).
2. **Walk + validate** each element against §4.1: tag against the allow-list (denied tags — `script/style/object/embed/iframe/…` — are dropped); attributes against the attr allow-list (strip `on*` and raw `style` except the sanctioned background/position emitters; force `rel="noopener noreferrer"` on `target="_blank"`); each `class` token allowlist-validated through `@sparx/surface-compile` (out-of-allowlist classes dropped/flagged).
3. **Emit** `Element` nodes (tag + safe attrs + surviving classes) + `Text` for text, with **fresh ids**, via the existing stamp / `cloneWithFreshIds` insert path.
4. **Bindings/behaviors are NOT inferred** — import yields inert styled structure; the author wires data/actions/behaviors in the inspector afterward.

The import is **lossy by design and one-way** — there is no HTML→tree reverse sync; importing is an insert, like stamping a catalog entry, after which the page owns an editable node copy. The validation step **reports what it dropped or changed** (removed tags, stripped classes/attributes) so the import is honest rather than silent. **Web-first;** an email-targeted import would be narrower (the §3.6c curated, table-based, inline-safe subset) and is deferred.

_Reuses:_ the §4.1 `elementTag`/`safeAttrs` whitelists, the `@sparx/surface-compile` allowlist for class validation, and the catalog stamp insert path (`cloneWithFreshIds`).

## 5. The component library is DATA, not code — a platform-managed catalog

The component library is **data, not code** — never bespoke renderer branches or hardcoded guided types.

**What's built today (v1.1).** The initial published library is a **static catalog of composed `BuilderNode` trees** — **86 components across 8 categories** (Layout · Navigation · Actions · Data display · Data input · Feedback · Marketing · Mockup) in `packages/builder-schemas/src/catalog/` (data-as-code, line-limit-exempt; authoring contract in `catalog/CONTRACT.md` + `_kit.ts`). Each entry composes raw elements + named atoms + our `--st-*` token utilities (daisyUI is a breadth/naming reference only — no competitor names ship). The Add palette consumes the published catalog **directly** (it is platform data, identical for every tenant, like the in-code registry — no DB round-trip), grouped by category; stamping forks an entry's `tree` (fresh ids) into the page exactly like an archetype. CSS-native interactivity (`<details>`, scroll-snap, `peer`) makes the interactive entries work before the behavior runtime lands. `PLATFORM_ARCHETYPES` is **removed** (not merely "demoted to a seed"): the catalog is the platform library, authored independently; `BuilderArchetype` is now **purely tenant-authored** ("save as brand section").

**A component is a class + zones, not a bespoke type — the navbar is the exemplar.** A "header" was the original over-built guided type. It is now just the **navbar component**: a `<nav class="navbar">` whose three zones are `navbar-start` / `navbar-center` / `navbar-end`. The zone layout is a real, reusable **utility** — `navbar`, `navbar-start`, `navbar-center`, `navbar-end` live in the surface theme (`packages/surface-compile/src/theme.ts`, `@layer components` so author utilities like `bg-base-100`/`hidden @3xl:flex` always override) and are **verbatim from daisyUI**: the side zones are `width: 50%` (one justifies start, the other end) and the center is `flex-shrink: 0` between them, so center content is dead-center regardless of what sits on either side. There is **ONE navbar primitive** — _not_ a "navbar" plus a separate "centered brand" variant: **centering the brand is just moving the Wordmark into `navbar-center`.** The common/comprehensive split falls out of this cleanly: the catalog's bare **`navbar`** (common) is JUST the bar — the `<nav class="navbar">` shell with its three **empty** zones, which you fill yourself — while **`navbar_brand`** (comprehensive) is that same bar already populated (brand in `navbar-start`, primary nav in `navbar-center`, an action in `navbar-end`, plus a mobile menu). A populated bar is a bigger composite, so it is its own entry; the bare `navbar` never carries content. The seed factory (`navbar()` in `site-chrome.ts`, used by the blank-site starter and every blueprint) emits the same `navbar`/`navbar-*` classes as the catalog, populated like `navbar_brand` so the default site ships a real header. The site "header" is a navbar at the top of the layout — placement, never a type. (This is why the daisyUI library is a _naming + CSS_ reference, not just visual breadth: where a component pattern has well-known, descriptive class names, we adopt them.)

**The admin-authoring layer (v1.5: built; the admin UI is the future consumer).** So the library can also be **added ad-hoc** (from a future admin app, no deploy) and **submitted for review** by consultants, the catalog has a DB-backed home + lifecycle API. This is **additive** (it changes only WHERE non-seed entries come from, never how a tenant uses them):

- **Data model — `PlatformComponent`** (platform-scoped, NOT per-tenant). Reconciled (v1.5) to ONE shared vocabulary with the data-as-code `PlatformCatalogEntry`, so a published row is a persisted catalog entry: `{ id, key, name, category (shared 8-value CatalogCategory), kind (common|comprehensive), icon, description, surfaces (page|site|email), tree (JSON BuilderNode), behaviors, thumbnail, tags, status, authorId, reviewerId, version, visibility, createdAt/updatedAt }`. `category`/`surfaces` are validated STRINGS (the category slugs are hyphenated — invalid as Postgres enum identifiers — so they follow the package's "validated by @sparx/builder-schemas, never the DB" rule, like `tree`); `kind`/`status`/`visibility` are DB enums. `tree` is the same serialized `BuilderNode` a tenant archetype carries — raw elements + Tailwind + behaviors.
- **Lifecycle / review workflow** — `status ∈ { draft, submitted, in_review, approved, published, archived, rejected }`. A consultant authors a `draft`, **submits** it (`submitted`), a reviewer moves it to `in_review` → `approved` → **publishes** it (`published`). Only `published` entries reach tenants. This is the consultant-submission pipeline the user requires.
- **Access model (careful RLS)** — the catalog is **global**: any tenant may READ the `published` set; only platform admins/reviewers may WRITE or see non-published rows. This differs from the tighten-only tenant tables — it is a platform-owned table with read-all-published + admin-write, documented as such in `packages/db/CLAUDE.md`.
- **Admin app + API (API-first, admin app is future)** — the **API ships now** (`/v1/platform/catalog/*`: CRUD + status transitions + submit/review/publish), so the catalog is fully operable before any admin UI exists; the future admin app is just another consumer. Seed populates the **initial** library AS catalog rows (data-as-code via the seed pipeline, line-limit-exempt), so nothing is baked into the runtime.
- **Consumption** — a tenant's Add palette merges the **published platform catalog** with the tenant's own `BuilderArchetype` rows (Phase 6b, tenant-authored "save as brand section"). Stamping a catalog entry forks its `tree` (fresh ids) into the page exactly like an archetype — the catalog is the _source_, the page gets an editable copy.

This **reconciles Phase 6b**: the catalog is the source of _platform-provided_ components; `BuilderArchetype` stays for _tenant-authored_ sections. (v1.1: the `PLATFORM_ARCHETYPES` constant is **removed entirely** — the static catalog replaces it, and the platform-archetype seed is a no-op.)

daisyUI is a **reference for breadth/naming only** — catalog entries are skinned via our token system and described in our own language (no competitor names in shipped artifacts).

## 6. The seven pillars

1. **Raw-element foundation** — universal `Element` node, safe tag/attr whitelist, `renderElement` in `renderLeaf` + both walkers, Add-palette "HTML elements" group.
2. **Full-surface inspector** — state × breakpoint spine, comprehensive searchable property panel, friendly quick-controls.
3. **Binding spine** — entity/collection binding + scope propagation + actions + a Data panel + live load (the store fix).
4. **Mediated unlocks** — background-image-anywhere, animation library, position control, extended z-scale.
5. **Behavior runtime** — `behaviors/` in `@sparx/builder-render`, hydrated on storefront + previewed in canvas, Behavior panel.
6. **Platform component catalog (data-driven)** — **built.** The static data-as-code **common** library (86 components, 8 categories) in `packages/builder-schemas/src/catalog/` (v1.1), surfaced directly in the Add palette merged with tenant archetypes; the behavior-heavy **comprehensive** composites (carousel hero, brand marquee, scroll-adaptive nav, mega-menu, single-open accordion, tabbed panels) as catalog rows on the behavior runtime (v1.5); and the DB-backed `PlatformComponent` model + review-workflow API (§5), vocabulary-reconciled with the data-as-code entry (v1.5).
7. **Catalog content + acceptance** — the initial published library exists as data-as-code; the submit→review→publish lifecycle is operable through `/v1/platform/catalog/*`. Proving it end-to-end through a running browser is the open §8 acceptance item.

## 7. Sequencing (deploy-early, each phase ships)

Phase 0 (this doc) → 1 (raw elements) → 2 (inspector) → 3 (binding spine, high priority — unblocks selling) → 4 (unlocks) → 5 (behaviors) → 6 (common library) → 7 (composites). Phases 1–4 are largely independent and can interleave; 6–7 depend on 1/4/5. Each phase: own commit/PR, gate-green (`format`/`lint`/`typecheck` + the pre-push RLS audit), deploy.

## 8. Acceptance

A tenant can, end-to-end on the live storefront: build a product grid pinned to a real collection; pin a featured card to a specific product whose "Add to cart" adds the **right** variant; lay out arbitrary raw-HTML sections with the full Tailwind surface incl. hover/responsive states; set an asset-backed background image; and run a working carousel hero, a brand marquee, and a scroll-adaptive sticky nav. As a stretch acceptance, reproduce 2–3 of the reference mockups (tesla hero panels, notion marquee, a nike product carousel).

**(v1.5)** The implementation for every item above has shipped and is unit/type/lint-verified; this end-to-end pass has **not yet been exercised in a running browser** — it is the one open verification item for the plan.

## 9. Out of scope

Tenant-authored raw JS and raw `@keyframes` (mediated unlocks instead); **two-way / live HTML editing** — HTML as a second, editable source of truth (view is read-only and import is one-way → nodes, §3.8/§4.2); the Phase 6a re-author of the ~657 box-DTO seed literals onto archetypes (separate sweep); an open behavior/plugin marketplace (closed platform set for now).
