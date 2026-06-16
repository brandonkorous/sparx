# Builder v2 — Full Customization Rebuild

**Version:** 1.0
**Author:** Brandon Korous / WizeWorks
**Last Updated:** 2026-06-15

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

### 3.3 Inspector → full-surface + a friendly layer

Rebuild the inspector around a **state × breakpoint matrix** as its organizing spine. Every control writes into the active `prefix` layer (e.g. selecting "center" under `md:`+`hover` writes `md:hover:justify-center`). `applyValue(class, control, value, prefix)` already takes a prefix — generalize it to the full matrix. On top of an exhaustive, **searchable** property panel covering the entire Tailwind surface, keep **curated quick-controls** for the common 20% so "center this header" stays one click.

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

## 5. The component library is DATA, not code — a platform-managed catalog

The common + comprehensive components must be **addable ad-hoc** (from a future admin app, without a deploy) and **submittable for review** by outside consultants. So they are **never** hardcoded TS literals (`PLATFORM_ARCHETYPES`-as-the-library is rejected). They live in a new **global, platform-managed component catalog**:

- **Data model — `PlatformComponent`** (platform-scoped, NOT per-tenant): `{ id, key, name, family, kind (section|common|comprehensive), tree (JSON BuilderNode), behaviors, thumbnail, tags, status, authorId, reviewerId, version, visibility, createdAt/updatedAt }`. `tree` is the same serialized `BuilderNode` a tenant archetype carries — raw elements + Tailwind + behaviors.
- **Lifecycle / review workflow** — `status ∈ { draft, submitted, in_review, approved, published, archived, rejected }`. A consultant authors a `draft`, **submits** it (`submitted`), a reviewer moves it to `in_review` → `approved` → **publishes** it (`published`). Only `published` entries reach tenants. This is the consultant-submission pipeline the user requires.
- **Access model (careful RLS)** — the catalog is **global**: any tenant may READ the `published` set; only platform admins/reviewers may WRITE or see non-published rows. This differs from the tighten-only tenant tables — it is a platform-owned table with read-all-published + admin-write, documented as such in `packages/db/CLAUDE.md`.
- **Admin app + API (API-first, admin app is future)** — the **API ships now** (`/v1/platform/catalog/*`: CRUD + status transitions + submit/review/publish), so the catalog is fully operable before any admin UI exists; the future admin app is just another consumer. Seed populates the **initial** library AS catalog rows (data-as-code via the seed pipeline, line-limit-exempt), so nothing is baked into the runtime.
- **Consumption** — a tenant's Add palette merges the **published platform catalog** with the tenant's own `BuilderArchetype` rows (Phase 6b, tenant-authored "save as brand section"). Stamping a catalog entry forks its `tree` (fresh ids) into the page exactly like an archetype — the catalog is the _source_, the page gets an editable copy.

This **reconciles Phase 6b**: the global catalog becomes the source of _platform-provided_ components; `BuilderArchetype` stays for _tenant-authored_ sections. The shipped `PLATFORM_ARCHETYPES` constant is demoted to a **seed of the catalog**, not a per-tenant runtime seed.

daisyUI is a **reference for breadth/naming only** — catalog entries are skinned via our token system and described in our own language (no competitor names in shipped artifacts).

## 6. The seven pillars

1. **Raw-element foundation** — universal `Element` node, safe tag/attr whitelist, `renderElement` in `renderLeaf` + both walkers, Add-palette "HTML elements" group.
2. **Full-surface inspector** — state × breakpoint spine, comprehensive searchable property panel, friendly quick-controls.
3. **Binding spine** — entity/collection binding + scope propagation + actions + a Data panel + live load (the store fix).
4. **Mediated unlocks** — background-image-anywhere, animation library, position control, extended z-scale.
5. **Behavior runtime** — `behaviors/` in `@sparx/builder-render`, hydrated on storefront + previewed in canvas, Behavior panel.
6. **Platform component catalog (data-driven)** — the `PlatformComponent` model + review-workflow API (§5), seeded with the daisyUI-grade **common** library and the **comprehensive** composites (carousel hero, brand marquee, scroll-adaptive nav, hover-reveal cards, bento, testimonial slider, mega-menu, mobile menu, FAQ accordion, pricing) AS catalog rows. The Add palette merges published catalog + tenant archetypes.
7. **Catalog content + acceptance** — author the initial published library (seed), and prove ad-hoc add + consultant submit→review→publish through the API.

## 7. Sequencing (deploy-early, each phase ships)

Phase 0 (this doc) → 1 (raw elements) → 2 (inspector) → 3 (binding spine, high priority — unblocks selling) → 4 (unlocks) → 5 (behaviors) → 6 (common library) → 7 (composites). Phases 1–4 are largely independent and can interleave; 6–7 depend on 1/4/5. Each phase: own commit/PR, gate-green (`format`/`lint`/`typecheck` + the pre-push RLS audit), deploy.

## 8. Acceptance

A tenant can, end-to-end on the live storefront: build a product grid pinned to a real collection; pin a featured card to a specific product whose "Add to cart" adds the **right** variant; lay out arbitrary raw-HTML sections with the full Tailwind surface incl. hover/responsive states; set an asset-backed background image; and run a working carousel hero, a brand marquee, and a scroll-adaptive sticky nav. As a stretch acceptance, reproduce 2–3 of the reference mockups (tesla hero panels, notion marquee, a nike product carousel).

## 9. Out of scope

Tenant-authored raw JS and raw `@keyframes` (mediated unlocks instead); the Phase 6a re-author of the ~657 box-DTO seed literals onto archetypes (separate sweep); an open behavior/plugin marketplace (closed platform set for now).
