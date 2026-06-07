# 61 — Utility Authoring: The Property-Panel Style System

**Version:** 1.0.0
**Author:** Brandon Korous
**Last Updated:** 2026-06-06

> This doc **executes** the class-first model ([47](47-class-first-authoring-model.md)) and
> **finishes** the unification [46](46-site-ui-component-library.md) and [59](59-responsive-rendering.md)
> started. It retires the freeform `box` for good, makes a **tokenized utility layer** the styling
> surface, and surfaces that layer to non-developers as a **structured property panel**. Where this
> doc and 40/46/47/59 disagree on the styling/render model, **this doc wins**; the affected sections
> are superseded (§14).

---

## 1. Purpose & the one-paragraph model

A node carries a **class string** of tokenized, Tailwind-native utilities (`bg-primary`, `grid-cols-4`,
`@md:flex-row`, `animate-pulse`) plus **semantic component classes** from the Surface library
(`sf-btn`, `sf-card`, the recipe). The class owns **all styling**; the tree owns **structure +
binding**; a thin **`props`** slot owns per-instance data (image/embed URLs, labels, the component
`$ref`/`$prop` machinery). The freeform `box` and `layout` objects are **deleted**. One per-tenant
stylesheet — compiled from the tenant's own tree by `@sparx/surface-compile` — drives **both** the
live site and the editor canvas, so preview == production by construction. The utility surface is
exposed two ways: a **curated** subset on the page builder (safe by design) and the **full** vocabulary
in the component builder (power, gated). This is a **semantic component library over a tokenized
utility layer, built for business users instead of developers** — the component library guarantees
coherence; the utility layer enables anything.

## 2. The reframe — most of this is already built

This is an **execution** doc, not a greenfield one. Current state (verified 2026-06-06):

| Already built & wired | Where |
| --- | --- |
| **Per-tenant Tailwind compile** — tree-shake class literals → compile through a tenant-flavored theme (`bg-primary`/`p-6`/`rounded-box` → `--sf-*`) → content-hashed `tenant.css`; real `@tailwindcss/node` compiler, so *any* utility compiles for free | `packages/surface-compile/*` |
| **Three compile endpoints** — `getPublishedStylesheet` (`tenant.css`), `getDraftStylesheet`, `compilePreview` (live editor) | `packages/builder/src/services/surface-css-service.ts` |
| **Rich token theme** — semantic palette + `-content`/hover/active/tint, 12-step spacing, 3 radius scales, depth shadows, container width, fonts; `@theme` maps color/spacing/radius/shadow/font/container | `packages/site-themes/src/v2/*`, `surface-compile/src/theme.ts` |
| **Surface component library** — 100+ components on the five-axis recipe, `@apply` over the same theme | `packages/site-ui/*` |
| **Component builder** — reuses the page builder shell, panel-gated by surface; PropSpec/slots; **Save-as-component**; versioning; publish-time `custom:* → primitives` expansion | `apps/dashboard/.../builder/_builder/*`, `packages/builder/.../component-service.ts` |
| **Class-group control bridge** — `readClassGroup`/`setClassGroup`; inspector Style/Advanced panels already write class tokens | `_builder/class-controls.ts`, `@sparx/builder-schemas` |

**What is missing (this doc's scope):** the **expanded utility vocabulary** in the panel, the
**breakpoint authoring model**, the **allowlist**, **motion**, **wiring the compiled stylesheet into
both render paths**, and **deleting the box** (a hard cutover — see §3).

## 3. No back-compat — a hard cutover

There are effectively no tenant sites in production yet. We therefore do **not** build a migration
bridge or a dual-render path — those are what made the current system fragile (two styling models
coexisting). Instead:

- **Delete** the `box`→CSS engines in *both* renderers, the `bx-*` classes, and the device-derived JS
  responsive layer ([59](59-responsive-rendering.md)).
- **Delete** `box` and `layout` from the node schema.
- **Re-seed** the shipped starters, blueprints, and reference pages (Tesla, product PDP) onto the new
  class model so the platform's own demos work. There is no tenant data to migrate.
- Things that aren't re-seeded **break loudly now** — which is the point: it surfaces every dependency
  while there's no user to disrupt.

## 4. The node shape

```
{ id, type, class?, props, binding?, children? }
```

- **`class`** — the styling surface. Tokenized utilities + semantic component classes. Empty = an
  unstyled element. Bounded free string; allowlist-governed (§8). **Owns all presentation.**
- **`props`** — per-instance, non-class data: leaf config (`heading.level`, `button.label`,
  `image.src`, embed URLs), and the component machinery (`$ref`, `$prop`, `$bind`). (We keep the name
  `props` rather than 47's `data` — same concept, far less churn across the component system.)
- **`binding`** — unchanged ([43](43-builder-binding-schema.md)).
- **`children`** — unchanged.

**`box`/`layout` are removed.** Every old field decomposes into class utilities or `props`:

| Old `box`/`layout` field | Becomes |
| --- | --- |
| `surface` | `bg-base-100` / `bg-primary` / … (recipe or token utility) |
| `padding` | `p-*` (token spacing scale) |
| `height` | `min-h-*` / `h-*` |
| `backgroundWidth` / `contentWidth` | a Section archetype (`sf-section` full-bleed + contained inner) |
| `align` | `text-*` / `items-*` / `justify-*` |
| `backgroundImage` / `…Binding` | `props.bg` (URL/binding) + `bg-cover bg-center` classes; renderer sets `style` from `props` |
| `overlay` / `textTone` | Section/PhotoPanel archetype classes (scrim + tone) |
| `pin` | `relative` / `sticky` utilities (never `fixed`, §8) |
| `hiddenOn` | `hidden @md:block` (responsive visibility) |
| `direction` / `columns` / `gap` / `justify` / `alignItems` / `wrap` | `flex`/`grid` + `flex-row`/`grid-cols-*`/`gap-*`/`justify-*`/`items-*`/`flex-wrap` |

## 5. The two-surface contract

| | **Page builder** (`/builder/page`) | **Component builder** (`/builder/components/[key]/edit`) |
| --- | --- | --- |
| **Job** | compose + bind | construct |
| **Styling** | component modifiers (color × variant × size) + the **arrangement families on containers** (§5.2) + layout-archetype props (§5.1) | the **full vocabulary** (§6) incl. all **skin** families + breakpoints + states + motion |
| **Utilities** | **arrangement family only** (layout / flex / grid / spacing / sizing / visibility); **no skin utilities** (§5.2) | yes, allowlist-gated |
| **Safety** | safe by construction; responsive by default | allowlist + author-time validation |
| **Audience** | general users, light AI | power users, AI, Sparx |
| **Escape** | "Edit as component" → opens the component builder | — |

The shell already gates panels by `surface` (`BuilderWorkspace`), so this is "add the full panel for
`surface==='component'` and curated presets for `surface==='page'`," not new plumbing.

### 5.1 Page-level richness = the layout archetypes' props

A page composes **layout archetypes** (`Section`, `Container`, `Grid`, `Stack` — already in `site-ui`).
Their existing props *are* the curated page-level controls: arrangement (stack/row/grid), column count,
gap, align/justify, padding, surface, content width. Each control **writes a class string** under the
hood and **seeds responsive defaults** (e.g. dropping a `Grid` seeds `grid-cols-1 @md:grid-cols-3`), so
a page stays responsive and coherent without the author touching a raw utility. The archetype props
are the *seeded default*; the page author can also reach the arrangement families directly (§5.2).

### 5.2 The real line: arrange vs. re-skin

The page builder is **not** "no utilities" — it is **arrange, don't re-skin.** The thing that must
stay uniform was never *arrangement*: every section legitimately arranges differently, so there is no
uniformity to protect there. What must stay governed is *treatment/skin*.

- **Page builder → the arrangement families, on containers** (Section / Grid / Stack / Container):
  `display`, `position` (`relative`/`sticky`; `absolute` via an overlay preset), **Flexbox & Grid**,
  `gap`, `justify`/`items`/`self`, `overflow`, **Sizing** (`w`/`h`/`min`/`max`), and responsive
  **visibility** (`hidden @md:block`). These are *structural* and **vital** — you cannot build a real
  page (two-column hero, logo strip, full-bleed band) without them.
- **Component builder → the skin families:** raw color, backgrounds, borders, shadows, radius, free
  typography, filters, transforms, motion, and arbitrary one-off values. A page author sets a
  component's color × variant × size through the **recipe** (governed, brand-safe), never raw fill +
  foreground.

This is the **same line the platform already draws** (CLAUDE.md brand rule, [23](23-frontend-component-architecture.md)
§1/§15): *"Layout/positioning/spacing/sizing utilities … are fine; the banned pattern is **re-skinning
a control** — a background fill paired with a foreground text color."* We apply that exact boundary to
the builder's two surfaces. The risk asymmetry justifies it: a wonky layout is visible and
self-correcting; brand/treatment drift is subtle, invisible, and compounding — and responsiveness is
held by container queries + seeded defaults regardless of how a container is arranged.

**Scoping.** The arrangement panel shows on **containers** (the nodes with children to arrange).
**Leaves** (Heading / Image / Button) get **self-alignment + sizing + visibility** only — no flex/grid
— plus their component props and the recipe modifiers.

## 6. The utility vocabulary

Because `surface-compile` runs the real Tailwind compiler, the question is never "what compiles" — it
is "what gets a **structured control**" and "what's on the **allowlist** (§8)." The component-builder
panel surfaces these families, grouped Common / Advanced:

| Family | Utilities (representative) |
| --- | --- |
| **Layout** | `block` `flex` `grid` `inline-*` `hidden`; `relative` `absolute` `sticky` (no `fixed`); `inset-*`/`top-*`…; `z-{0..50}` (bounded); `overflow-*`; `object-cover`/`object-*` |
| **Flexbox** | `flex-row`/`-col`/`-wrap`; `justify-*`; `items-*`; `self-*`; `grow`/`shrink`; `basis-*`; `gap-*`; `order-*` |
| **Grid** | `grid-cols-{1..12}` (+ arbitrary); `grid-rows-*`; `col-span-*`/`row-span-*`; `grid-flow-*`; `auto-cols-*`/`auto-rows-*`; `gap-*`; grid-areas (raw, advanced) |
| **Sizing** | `w-*` `h-*` `min-*` `max-*` (token scale + `full`/`screen`/`%`/`fr`/arbitrary) |
| **Spacing** | `p-*` `m-*` (per-side) `space-*` (token scale → `--spacing`) |
| **Typography** | `font-heading`/`font-body`; `text-{xs..9xl}`; `font-*` weight; `leading-*`; `tracking-*`; `text-left/center/right`; `uppercase`…; `underline`…; `line-clamp-*`; `text-{color}` (recipe/token) |
| **Backgrounds** | `bg-{color}` (recipe/token); `bg-cover`/`bg-center`/`bg-no-repeat`; gradients `bg-gradient-* from-* via-* to-*` (token colors only) |
| **Borders** | `border`/`border-{side}-*` width; `border-{style}`; `border-{color}` (token); `rounded-*` (token radius, per-corner) |
| **Effects** | `shadow-{sm,md,lg}` (token); `opacity-*`; `mix-blend-*`; `backdrop-blur-*` |
| **Transforms** | `scale-*` `rotate-*` `translate-*` `skew-*` `origin-*` |
| **Motion** (§9) | `transition*` `duration-*` `ease-*` `delay-*`; `animate-{spin,ping,pulse,bounce,<custom>}` |
| **Interactivity** | `cursor-*` `select-*` `pointer-events-*` (bounded) |

**Variants** layer on every control: **breakpoints** (`@sm`…`@2xl`, §7), **states** (`hover:` `focus:`
`focus-visible:` `active:` `disabled:` `group-hover:`), and **`dark:`** (themes already ship a dark
mode — free win). Arbitrary values (`top-[37px]`, `grid-cols-[1fr_320px]`) are allowed on safe
properties and compile through the existing pipeline; they are blocked only where dangerous (§8).

**Surface split (§5.2).** The **arrangement** families — Layout, Flexbox, Grid, Spacing, Sizing, and
responsive visibility — are available on the **page builder** (on containers; Sizing + visibility also
on leaves). The **skin** families — Typography, Backgrounds/color, Borders, Effects, Transforms,
Motion — plus arbitrary values are **component-builder only**. Color × variant × size of a placed
component is reachable on the page through the **recipe** (governed), not as raw skin utilities.

## 7. Breakpoints & responsive — container queries

**Locked: container queries, full Tailwind scale, no iframe.** Every page root and every component
renders inside a `@container` context; responsive variants are container-query variants
(`@sm @md @lg @xl @2xl @3xl …`). This gives:

- **True preview == production with no iframe.** The canvas sets a container element to the chosen
  device width; the *same* compiled `@container` rules fire there as on the live site (whose root
  container is the viewport width). One stylesheet, one mechanism, single-document editor — no
  cross-frame selection/DnD. This is the keystone that finally kills the two-renderer duplication.
- **Correct component semantics.** A card in a narrow slot collapses on *its own* width, not the
  viewport's — which is what a component system *should* do. (Nested containers query themselves.)

The breakpoint scale (the `@*` container sizes) is defined once in the compile theme and tunable. The
one semantic difference from viewport breakpoints — `@md` keys off container width, not `768px` — is a
feature for components, and is documented in the panel so authors aren't surprised.

**Editing model.** The panel has a **breakpoint context switcher** wired to the canvas device preview:
selecting "Tablet (@md)" resizes the preview container *and* scopes new utilities to the `@md:` prefix.
**Mobile-first**: the base (no-prefix) layer is the foundation; prefixed layers override upward.
Smart defaults seed common responsiveness so the general path needs no per-breakpoint thought.

## 8. Allowlist & safety tiers

Defense in depth — the same boundary [47](47-class-first-authoring-model.md) §6 named:

1. **Author-time:** the panel only emits allowlisted classes.
2. **Compile-time:** `surface-compile` runs `validateClasses()` and drops disallowed tokens.
3. **Publish-time:** a final gate refuses a tree carrying a disallowed token.

**Allowed:** all layout/flex/grid/spacing/sizing/typography/border/radius/shadow/opacity/transform/
motion utilities; `--sf-*`-mapped colors; container-query + state + `dark:` variants; arbitrary values
on safe properties. **Blocked/constrained:** `position: fixed` (clickjacking — `relative`/`absolute`/
`sticky` only); `z-index` capped to a bounded scale (no `z-[9999]`); raw `url()` and `content-[…]`
(image URLs go through `props` + the asset picker, never a class); `@import`. **Tier 4 (raw CSS)** is
deferred and Enterprise-gated behind scoping + sanitization.

The threat model is narrower than a general CMS: utilities are authored in the **component builder** by
the tenant, for the tenant's own isolated site — but the allowlist is cheap insurance against footguns
and abuse, and keeps the contract honest.

## 9. Motion — transitions & animations

A first-class **Motion** family, nearly free because it compiles through the existing pipeline:

- **Transitions:** `transition`/`transition-{colors,transform,opacity,all}`, `duration-*`, `ease-*`,
  `delay-*` — meaningful in combination with `hover:`/`focus:` states.
- **Animations:** built-ins `animate-{spin,ping,pulse,bounce}` + **custom keyframes** defined once in
  the compile theme (`--animate-fade-in`, `--animate-slide-up`, …) so they're tokenized and shared.
- **Reduced motion is the default posture.** The shipped sheet wraps animation/transition so
  `prefers-reduced-motion` neutralizes it (`motion-reduce:*`); authors opt *out* of the guard, never in
  to accessibility.
- **Triggers:** `hover`/`focus`/`load` are pure CSS. **In-view** (scroll) needs a tiny client island —
  an `IntersectionObserver` keyed on a `data-animate` attribute — the only new runtime this doc adds.
- **Panel:** a Motion section — transition toggle + duration + easing + delay; animation picker; trigger
  (hover / in-view / load).

## 10. Render unification — the keystone

One compiled stylesheet drives both surfaces:

- **Site:** the published `tenant.css` (already produced by `getPublishedStylesheet`) loads in the site
  `<head>`, after the per-request `--sf-*` theme. The renderer applies `node.class` + `node.props`
  (image URLs etc. via `style`) and renders leaves/containers through **Surface components** — finishing
  the [46](46-site-ui-component-library.md) §7 migration, now unblocked.
- **Canvas:** the live `compilePreview`/`getDraftStylesheet` output injects into the canvas; the canvas
  applies the *same* `node.class` through the *same* Surface components inside a `@container` preview.
- **Deleted:** both `boxStyles`/`layoutStyle` engines, `bx-*`, the device-JS derivation, the `--bxc-*`
  aliases. The styling is now **one artifact**, not two re-implementations.

## 11. The property panel (control registry)

Extends the existing class-group bridge (`class-controls.ts`, `readClassGroup`/`setClassGroup`):

- Each control is a **class group** (mutually-exclusive token set) read/written on `node.class`, the
  pattern already shipped for color/variant/radius/margin/border/shadow.
- A control resolves under the **active variant context** (breakpoint × state × `dark:`) — the switcher
  determines the prefix the group reads/writes.
- The full family set (§6) is registered for `surface==='component'`; the curated archetype-prop set
  (§5.1) for `surface==='page'`.
- A bounded **raw class field** remains the final author escape hatch (allowlist-checked).

**Naming — keep two populations, switch one (Phase 0, pre-launch).** (1) The **`--sf-*` token**
namespace *stays* — plumbing; authors never type it. (2) **Component classes** (`sf-btn`, `sf-card`,
parts) and the **recipe** (`sf-c-*`/`sf-v-*`) *stay*, but the recipe is **internal to Surface
components only** — an author never types `sf-c-primary`. (3) The **author-facing utility surface**
goes **Tailwind-native now**: retire the bespoke `util-box.css` set (`sf-radius-*` → `rounded-*`,
`sf-m-*` → `m-*`, `sf-border-*` → `border`, `sf-shadow-*` → `shadow-*`), and color a generic element
with `bg-primary`/`text-primary-content` (which `surface-compile` already resolves to `--sf-*`). This
is nearly free (the compile already maps the native names) and is done in **Phase 0** so the Phase 1
re-seed bakes native names from the start — post-launch it would be a stored-content migration; now it
is code-only.

## 12. Build phases

| Phase | Scope | Ships |
| --- | --- | --- |
| **0 — Vocabulary & safety** | Lock the family list + allowlist; extend the compile theme for missing families (flex/grid/position/inset/z/transform/transition + **custom keyframes** + container-breakpoint scale); add `validateClasses()` to `surface-compile`; ship the reduced-motion baseline. No UI. | Compile coverage + allowlist + tests |
| **1 — Node cutover** *(destructive)* | `BuilderNode` → `{ class, props }`; delete `box`/`layout`; update validators + types; **re-seed** starters/default-templates/blueprints onto classes. | New schema, green seeds |
| **2 — Render unification** *(keystone)* | Load `tenant.css`/draft into site + canvas; renderers apply `class` + `props` via Surface components inside `@container`; **delete both box engines + `bx-*` + device-JS**. | Preview == production, one sheet |
| **3 — Utility panel** | Full property panel in the component builder — all families as class-group controls, with breakpoint/state/`dark:` context. Allowlist-enforced. | Power authoring |
| **4 — Page presets + escalation** | Replace the page box panel with the layout-archetype prop controls (write classes, seed responsive defaults); polish "Edit as component." | Safe human surface |
| **5 — Motion & breakpoint UX** | Motion panel + reduced-motion + in-view island; breakpoint switcher ↔ device-preview linkage; responsive-by-default seeding. | Animation + responsive authoring |
| **6 — Governance & demos** | Brand designer governs the archetype set + the utility allowlist; re-author blueprints/Tesla/PDP onto archetypes; supersede the box sections in 40/44/45/46/59. | Polished + documented |
| **7 — Tier 4 raw CSS** *(deferred)* | Scoped + sanitized raw CSS, Enterprise-gated. | Later |

Phases **0–2** are the foundation and land together (the destructive schema change + render cutover
must ship as one release). **3–5** are the product. **6** is polish + docs.

## 13. Open questions / deferred

- **Container-breakpoint scale values** — align `@md`/`@lg`/… to component-sensible widths; final
  numbers tuned in Phase 0.
- **Group/peer state authoring** — `group-hover:`/`peer-*` are powerful but add a relational concept to
  the panel; surface in Phase 3 or defer.
- **Gradient & transform editing UX** — multi-stop gradients and transform composition need richer
  controls than a single dropdown; Phase 5 candidate.
- **Tier 4 raw CSS** — scoping + sanitization subsystem; deferred (§8, Phase 7).
- **Archetype taxonomy** — the brand-governed starting set of layout/section archetypes; Phase 6.

## 14. Supersessions

- **[40](40-sitebuilder-composition-model.md) §5** (the box/layout base) — the node shape is now §4
  here; box/layout are deleted.
- **[47](47-class-first-authoring-model.md)** — this doc is its execution; node keeps `props` (not
  `data`); the utility layer is Tailwind-native, not the `sf-*` *dialect*, at the author surface.
- **[46](46-site-ui-component-library.md) §7** — the migration is no longer "on hold"; it lands in
  Phase 2 as the render-unification keystone.
- **[59](59-responsive-rendering.md)** — auto-collapse + device-derived JS are replaced by explicit
  container-query authoring; the doc's "single source of truth" responsive rules are retired.
