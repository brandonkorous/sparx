# 61 — Utility Authoring: The Property-Panel Style System

**Version:** 1.4.0
**Author:** Brandon Korous
**Last Updated:** 2026-06-07

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

| Already built & wired                                                                                                                                                                                                                                    | Where                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **Per-tenant Tailwind compile** — tree-shake class literals → compile through a tenant-flavored theme (`bg-primary`/`p-6`/`rounded-box` → `--sf-*`) → content-hashed `tenant.css`; real `@tailwindcss/node` compiler, so _any_ utility compiles for free | `packages/surface-compile/*`                                                         |
| **Three compile endpoints** — `getPublishedStylesheet` (`tenant.css`), `getDraftStylesheet`, `compilePreview` (live editor)                                                                                                                              | `packages/builder/src/services/surface-css-service.ts`                               |
| **Rich token theme** — semantic palette + `-content`/hover/active/tint, 12-step spacing, 3 radius scales, depth shadows, container width, fonts; `@theme` maps color/spacing/radius/shadow/font/container                                                | `packages/site-themes/src/v2/*`, `surface-compile/src/theme.ts`                      |
| **Surface component library** — 100+ components on the five-axis recipe, `@apply` over the same theme                                                                                                                                                    | `packages/site-ui/*`                                                                 |
| **Component builder** — reuses the page builder shell, panel-gated by surface; PropSpec/slots; **Save-as-component**; versioning; publish-time `custom:* → primitives` expansion                                                                         | `apps/dashboard/.../builder/_builder/*`, `packages/builder/.../component-service.ts` |
| **Class-group control bridge** — `readClassGroup`/`setClassGroup`; inspector Style/Advanced panels already write class tokens                                                                                                                            | `_builder/class-controls.ts`, `@sparx/builder-schemas`                               |

**What is missing (this doc's scope):** the **expanded utility vocabulary** in the panel, the
**breakpoint authoring model**, the **allowlist**, **motion**, **wiring the compiled stylesheet into
both render paths**, and **deleting the box** (a hard cutover — see §3).

## 3. No back-compat — a hard cutover

There are effectively no tenant sites in production yet. We therefore do **not** build a migration
bridge or a dual-render path — those are what made the current system fragile (two styling models
coexisting). Instead:

- **Delete** the `box`→CSS engines in _both_ renderers, the `bx-*` classes, and the device-derived JS
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

| Old `box`/`layout` field                                            | Becomes                                                                                     |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `surface`                                                           | `bg-base-100` / `bg-primary` / … (recipe or token utility)                                  |
| `padding`                                                           | `p-*` (token spacing scale)                                                                 |
| `height`                                                            | `min-h-*` / `h-*`                                                                           |
| `backgroundWidth` / `contentWidth`                                  | a Section archetype (`sf-section` full-bleed + contained inner)                             |
| `align`                                                             | `text-*` / `items-*` / `justify-*`                                                          |
| `backgroundImage` / `…Binding`                                      | `props.bg` (URL/binding) + `bg-cover bg-center` classes; renderer sets `style` from `props` |
| `overlay` / `textTone`                                              | Section/PhotoPanel archetype classes (scrim + tone)                                         |
| `pin`                                                               | `relative` / `sticky` utilities (never `fixed`, §8)                                         |
| `hiddenOn`                                                          | `hidden @md:block` (responsive visibility)                                                  |
| `direction` / `columns` / `gap` / `justify` / `alignItems` / `wrap` | `flex`/`grid` + `flex-row`/`grid-cols-*`/`gap-*`/`justify-*`/`items-*`/`flex-wrap`          |

## 5. The two-surface contract

|               | **Page builder** (`/builder/page`)                                                                                               | **Component builder** (`/builder/components/[key]/edit`)                                 |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Job**       | compose + bind                                                                                                                   | construct                                                                                |
| **Styling**   | component modifiers (color × variant × size) + the **arrangement families on containers** (§5.2) + layout-archetype props (§5.1) | the **full vocabulary** (§6) incl. all **skin** families + breakpoints + states + motion |
| **Utilities** | **arrangement family only** (layout / flex / grid / spacing / sizing / visibility); **no skin utilities** (§5.2)                 | yes, allowlist-gated                                                                     |
| **Safety**    | safe by construction; responsive by default                                                                                      | allowlist + author-time validation                                                       |
| **Audience**  | general users, light AI                                                                                                          | power users, AI, Sparx                                                                   |
| **Escape**    | "Edit as component" → opens the component builder                                                                                | —                                                                                        |

The shell already gates panels by `surface` (`BuilderWorkspace`), so this is "add the full panel for
`surface==='component'` and curated presets for `surface==='page'`," not new plumbing.

### 5.1 Page-level richness = the layout archetypes' props

A page composes **layout archetypes** (`Section`, `Container`, `Grid`, `Stack` — already in `site-ui`).
Their existing props _are_ the curated page-level controls: arrangement (stack/row/grid), column count,
gap, align/justify, padding, surface, content width. Each control **writes a class string** under the
hood and **seeds responsive defaults** (e.g. dropping a `Grid` seeds `grid-cols-1 @md:grid-cols-3`), so
a page stays responsive and coherent without the author touching a raw utility. The archetype props
are the _seeded default_; the page author can also reach the arrangement families directly (§5.2).

### 5.2 The real line: arrange vs. re-skin

The page builder is **not** "no utilities" — it is **arrange, don't re-skin.** The thing that must
stay uniform was never _arrangement_: every section legitimately arranges differently, so there is no
uniformity to protect there. What must stay governed is _treatment/skin_.

- **Page builder → the arrangement families, on containers** (Section / Grid / Stack / Container):
  `display`, `position` (`relative`/`sticky`; `absolute` via an overlay preset), **Flexbox & Grid**,
  `gap`, `justify`/`items`/`self`, `overflow`, **Sizing** (`w`/`h`/`min`/`max`), and responsive
  **visibility** (`hidden @md:block`). These are _structural_ and **vital** — you cannot build a real
  page (two-column hero, logo strip, full-bleed band) without them.
- **Component builder → the skin families:** raw color, backgrounds, borders, shadows, radius, free
  typography, filters, transforms, and arbitrary one-off values. A page author sets a
  component's color × variant × size through the **recipe** (governed, brand-safe), never raw fill +
  foreground.

**Motion is the exception among the skin families — it lives on _both_ surfaces ([§9](#9--motion--transitions--animations)).**
Its only failure mode is a janky-_looking_ page: visible and self-correcting, exactly the risk class
the page builder already accepts for arrangement — never the silent, compounding brand drift that gates
the rest of skin. So motion carries arrangement's risk profile, not skin's, and an author or AI agent
reaches it on the page builder too. We don't gate against jank; we engineer against it (curated
vocabulary + compositor-only entrances + reduced-motion default — §9.6).

This is the **same line the platform already draws** (CLAUDE.md brand rule, [23](23-frontend-component-architecture.md)
§1/§15): _"Layout/positioning/spacing/sizing utilities … are fine; the banned pattern is **re-skinning
a control** — a background fill paired with a foreground text color."_ We apply that exact boundary to
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

| Family            | Utilities (representative)                                                                                                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Layout**        | `block` `flex` `grid` `inline-*` `hidden`; `relative` `absolute` `sticky` (no `fixed`); `inset-*`/`top-*`…; `z-{0..50}` (bounded); `overflow-*`; `object-cover`/`object-*`                    |
| **Flexbox**       | `flex-row`/`-col`/`-wrap`; `justify-*`; `items-*`; `self-*`; `grow`/`shrink`; `basis-*`; `gap-*`; `order-*`                                                                                   |
| **Grid**          | `grid-cols-{1..12}` (+ arbitrary); `grid-rows-*`; `col-span-*`/`row-span-*`; `grid-flow-*`; `auto-cols-*`/`auto-rows-*`; `gap-*`; grid-areas (raw, advanced)                                  |
| **Sizing**        | `w-*` `h-*` `min-*` `max-*` (token scale + `full`/`screen`/`%`/`fr`/arbitrary)                                                                                                                |
| **Spacing**       | `p-*` `m-*` (per-side) `space-*` (token scale → `--spacing`)                                                                                                                                  |
| **Typography**    | `font-heading`/`font-body`; `text-{xs..9xl}`; `font-*` weight; `leading-*`; `tracking-*`; `text-left/center/right`; `uppercase`…; `underline`…; `line-clamp-*`; `text-{color}` (recipe/token) |
| **Backgrounds**   | `bg-{color}` (recipe/token); `bg-cover`/`bg-center`/`bg-no-repeat`; gradients `bg-gradient-* from-* via-* to-*` (token colors only)                                                           |
| **Borders**       | `border`/`border-{side}-*` width; `border-{style}`; `border-{color}` (token); `rounded-*` (token radius, per-corner)                                                                          |
| **Effects**       | `shadow-{sm,md,lg}` (token); `opacity-*`; `mix-blend-*`; `backdrop-blur-*`                                                                                                                    |
| **Transforms**    | `scale-*` `rotate-*` `translate-*` `skew-*` `origin-*`                                                                                                                                        |
| **Motion** (§9)   | `transition*` `duration-*` `ease-*` `delay-*`; `animate-{spin,ping,pulse,bounce,<custom>}`                                                                                                    |
| **Interactivity** | `cursor-*` `select-*` `pointer-events-*` (bounded)                                                                                                                                            |

**Variants** layer on every control: **breakpoints** (`@sm`…`@2xl`, §7), **states** (`hover:` `focus:`
`focus-visible:` `active:` `disabled:` `group-hover:`), and **`dark:`** (themes already ship a dark
mode — free win). Arbitrary values (`top-[37px]`, `grid-cols-[1fr_320px]`) are allowed on safe
properties and compile through the existing pipeline; they are blocked only where dangerous (§8).

**Surface split (§5.2).** The **arrangement** families — Layout, Flexbox, Grid, Spacing, Sizing, and
responsive visibility — are available on the **page builder** (on containers; Sizing + visibility also
on leaves). The **skin** families — Typography, Backgrounds/color, Borders, Effects, Transforms — plus
arbitrary values are **component-builder only**. **Motion ([§9](#9--motion--transitions--animations))
is available on _both_ surfaces** — safe-because-visible like arrangement, not silent like skin. Color ×
variant × size of a placed component is reachable on the page through the **recipe** (governed), not as
raw skin utilities.

## 7. Breakpoints & responsive — container queries

**Locked: container queries, full Tailwind scale, no iframe.** Every page root and every component
renders inside a `@container` context; responsive variants are container-query variants
(`@sm @md @lg @xl @2xl @3xl …`). This gives:

- **True preview == production with no iframe.** The canvas sets a container element to the chosen
  device width; the _same_ compiled `@container` rules fire there as on the live site (whose root
  container is the viewport width). One stylesheet, one mechanism, single-document editor — no
  cross-frame selection/DnD. This is the keystone that finally kills the two-renderer duplication.
- **Correct component semantics.** A card in a narrow slot collapses on _its own_ width, not the
  viewport's — which is what a component system _should_ do. (Nested containers query themselves.)

The breakpoint scale (the `@*` container sizes) is defined once in the compile theme and tunable. The
one semantic difference from viewport breakpoints — `@md` keys off container width, not `768px` — is a
feature for components, and is documented in the panel so authors aren't surprised.

**Editing model.** The panel has a **breakpoint context switcher** wired to the canvas device preview:
selecting "Tablet (@md)" resizes the preview container _and_ scopes new utilities to the `@md:` prefix.
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

> **Phase 5 execution spec.** Motion is a first-class family **available on both surfaces** (§5.2/§6
> amendment): its only failure mode is a janky-_looking_ page — visible and self-correcting, the risk
> class the page builder already accepts — never silent brand drift, so it isn't gated. The compile
> pipeline already makes it nearly free; what's left (this phase) is the **friendly control**, the
> **scroll trigger**, and the **render wiring**. _Already shipped:_ the tokenized entrance keyframes in
> the compile theme (`--animate-fade-in/-up/-down`, `--animate-scale-in`, `--animate-slide-in-left/-right`,
> `theme.ts`), the reduced-motion baseline (`motion.ts`), the allowlist passing all motion utilities, and
> a raw entrance/transition control in the component-builder Appearance panel (§12.3).

### 9.1 The model — three independent dimensions

A motion composes from:

- **Entrance** — _what_ plays: the tokenized keyframes in the compile theme (`fade-in`, `fade-up`,
  `fade-down`, `scale-in`, `slide-in-left`, `slide-in-right`) plus Tailwind built-ins
  (`spin`/`ping`/`pulse`/`bounce`, for loaders/accents). The curated set; arbitrary keyframes are the
  raw escape hatch only.
- **Trigger** — _when_ it plays: **on scroll into view** (default — the alive-feeling one), **on load**,
  or **on hover**.
- **Tempo** — _how_ it plays: **speed** (fast/normal/slow → `animation-duration`) and **delay**, plus a
  container **stagger** (a per-child delay increment).

Plus the always-available **interactive transitions** for hover/focus affordances (`transition`,
`duration-*`, `ease-*`) — these stay raw classes on the component-builder Appearance panel (§12.3); the
Motion control below is specifically the **entrance** surface.

### 9.2 Where it lives — the class string (consistent with everything else)

Motion is authored **as classes on `node.class`**, through the same class-group control bridge every
other docs/61 control uses (`readClassGroup`/`setClassGroup`) — _not_ a side-channel `props` object. The
key realization: a scroll trigger needs a runtime hook, but the **authoring is still a static class** —
the class declares the intent and the resting/target states; the island only flips one state class
(`.sf-in`) at the right moment. This is how the deprecated `[data-sf-reveal]` reveal already worked,
re-expressed as a marker _class_ so it merges naturally onto **both** render paths (the wrapper div _and_
a class-on-leaf element) with **zero renderer translation** — the renderer already applies `node.class`
verbatim to the one styled element per node.

The three triggers map to three class shapes:

| Trigger       | Classes on `node.class`        | Mechanism                       |
| ------------- | ------------------------------ | ------------------------------- |
| **On load**   | `animate-<token>`              | pure CSS, fires on paint        |
| **On hover**  | `hover:animate-<token>`        | pure CSS variant                |
| **On scroll** | `sf-reveal sf-reveal--<token>` | island toggles `.sf-in` in view |

Tempo rides along as ordinary allowlisted utilities: **speed** → `[animation-duration:300ms|500ms|800ms]`,
**delay** → `[animation-delay:Nms]`. Container **stagger** → `sf-reveal-stagger` (+ `--bold`), a CSS-only
rule that fades its direct children in sequence. The standalone entrance-Animation picker shipped in
Phase 3 (§12.3) **folds into** this Motion control rather than running in parallel — it already wrote
`animate-*` via the class-group bridge, so this is an extension, not a parallel system.

### 9.3 The `.sf-reveal` contract — the one new runtime

The render layer ships **one self-contained stylesheet block** (`SCROLL_MOTION_CSS`, beside
`REDUCED_MOTION_CSS` in `@sparx/surface-compile`'s `motion.ts`) and **one client island**
(`MotionController`). That island is the _entire_ runtime this whole doc adds.

- `SCROLL_MOTION_CSS` is **self-contained** — it defines its own `@keyframes` plus the per-token
  `animation` shorthands literally, so it never depends on whether the per-tenant compile happened to
  emit the `--animate-*` theme vars (which tree-shake on usage). It ships once on the render surface, not
  per tenant.
- The hidden initial state is **gated on `html.sf-anim-ready`**, set by a tiny before-paint script **only
  when motion is allowed**, so JS-off _or_ reduced-motion never hides content (the proven
  [reveal](59-responsive-rendering.md) gate, generalized off the deprecated section path):

  ```css
  html.sf-anim-ready .sf-reveal:not(.sf-in) {
    opacity: 0;
  }
  html.sf-anim-ready .sf-reveal--fade-up.sf-in {
    animation: sf-fade-up 0.6s ease-out both;
  }
  /* …one rule per token; the @keyframes are defined in the same block… */
  ```

- `MotionController` (one shared `IntersectionObserver`, `rootMargin` tuned to fire just before entry, low
  `threshold`) queries `.sf-reveal`, adds `.sf-in` on intersect, then unobserves (one-shot). Re-scans on
  route change (`usePathname`). Early-returns under `prefers-reduced-motion`. It needs **no per-token
  knowledge** — the token-specific rule lives in CSS; the island just flips `.sf-in`.
- **on load** (`animate-<token>`) and **on hover** (`hover:animate-<token>`) are pure CSS, no island. The
  global `REDUCED_MOTION_CSS` neutralizes all three triggers under the OS setting — no per-class
  `motion-safe:` needed.

### 9.4 Render impact — almost none

Because motion is just classes the renderer already applies, **the site renderer needs no change to
_apply_ motion**. The only work is render-surface plumbing, done once:

- **Site** (`apps/site/app/layout.tsx`): inject `SCROLL_MOTION_CSS` in `<head>`, add the `sf-anim-ready`
  before-paint line, mount `MotionController` in `<body>`. (The legacy
  `RevealController`/`[data-sf-reveal]` path is retired when the legacy section renderer goes.)
- **Canvas** (`_builder/canvas.tsx`): inject `SCROLL_MOTION_CSS`; the editor shows motion elements in
  their **resting (visible) state** by default — an author never loses sight of content mid-edit — with a
  canvas toolbar **"Play motion"** that adds `sf-anim-ready` and runs the observer for a single replay.
  Preview == production for the _result_, without the hostile UX of content vanishing while you arrange
  it.

### 9.5 The panel

A **Motion** group in the inspector, on **every node**, on **both surfaces** (containers additionally get
**Stagger**):

- **Entrance** — picker of the curated tokens (with "None").
- **Trigger** — segmented: Scroll / Load / Hover.
- **Speed** — Fast / Normal / Slow. **Delay** — a small stepper (ms).
- **Stagger** (containers) — off / subtle / bold.

It reads/writes the coordinated motion class set on `node.class` — a small composite over the existing
`readClassGroup`/`setClassGroup` bridge. Entrance × trigger don't form a single flat group, so the
control clears the whole motion set and re-emits the right shape for the chosen trigger. Reduced motion
needs no control; it's the default posture, not an opt-in.

### 9.6 Anti-jank guarantees — the "don't make it slow" contract

Restraint is **engineered, not gated**:

- **Compositor-only** entrances — every shipped keyframe animates `opacity`/`transform` only; no
  layout/paint thrash, no reflow.
- **Curated vocabulary** — the picker offers six tasteful entrances + the built-ins; an arbitrary or
  aggressive keyframe requires the deliberate raw-class escape hatch.
- **Reduced-motion by default** — already shipped (`motion.ts`); the OS setting wins globally.
- **One shared observer**, one-shot, ~40 lines — the entire added client runtime; no per-element
  listeners, no polling.
- **No JS animation library** — everything compiles through the existing per-tenant Tailwind pipeline;
  zero new bundle weight on the tenant site beyond the island.

## 10. Render unification — the keystone

One compiled stylesheet drives both surfaces:

- **Site:** the published `tenant.css` (already produced by `getPublishedStylesheet`) loads in the site
  `<head>`, after the per-request `--sf-*` theme. The renderer applies `node.class` + `node.props`
  (image URLs etc. via `style`) and renders leaves/containers through **Surface components** — finishing
  the [46](46-site-ui-component-library.md) §7 migration, now unblocked.
- **Canvas:** the live `compilePreview`/`getDraftStylesheet` output injects into the canvas; the canvas
  applies the _same_ `node.class` through the _same_ Surface components inside a `@container` preview.
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
namespace _stays_ — plumbing; authors never type it. (2) **Component classes** (`sf-btn`, `sf-card`,
parts) and the **recipe** (`sf-c-*`/`sf-v-*`) _stay_, but the recipe is **internal to Surface
components only** — an author never types `sf-c-primary`. (3) The **author-facing utility surface**
goes **Tailwind-native now**: retire the bespoke `util-box.css` set (`sf-radius-*` → `rounded-*`,
`sf-m-*` → `m-*`, `sf-border-*` → `border`, `sf-shadow-*` → `shadow-*`), and color a generic element
with `bg-primary`/`text-primary-content` (which `surface-compile` already resolves to `--sf-*`). This
is nearly free (the compile already maps the native names) and is done in **Phase 0** so the Phase 1
re-seed bakes native names from the start — post-launch it would be a stored-content migration; now it
is code-only.

## 12. Build phases

| Phase                                   | Scope                                                                                                                                                                                                                                                                                                                                                                       | Ships                                |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| **0 — Vocabulary & safety**             | Lock the family list + allowlist; extend the compile theme for missing families (flex/grid/position/inset/z/transform/transition + **custom keyframes** + container-breakpoint scale); add `validateClasses()` to `surface-compile`; ship the reduced-motion baseline. No UI.                                                                                               | Compile coverage + allowlist + tests |
| **1 — Node cutover** _(destructive)_    | `BuilderNode` → `{ class, props }`; delete `box`/`layout`; update validators + types; **re-seed** starters/default-templates/blueprints onto classes.                                                                                                                                                                                                                       | New schema, green seeds              |
| **2 — Render unification** _(keystone)_ | Load `tenant.css`/draft into site + canvas; renderers apply `class` + `props` via Surface components inside `@container`; **delete both box engines + `bx-*` + device-JS**.                                                                                                                                                                                                 | Preview == production, one sheet     |
| **3 — Utility panel**                   | Full property panel in the component builder — all families as class-group controls, with breakpoint/state/`dark:` context. Allowlist-enforced.                                                                                                                                                                                                                             | Power authoring                      |
| **4 — Page presets + escalation**       | Replace the page box panel with the layout-archetype prop controls (write classes, seed responsive defaults); polish "Edit as component."                                                                                                                                                                                                                                   | Safe human surface                   |
| **5 — Motion (both surfaces)**          | Motion classes (entrance × trigger × tempo) on every node, **both** surfaces; the `.sf-reveal` in-view island + self-contained `SCROLL_MOTION_CSS` (the one new runtime); canvas "Play motion"; container stagger; consolidate the Phase 3 entrance picker; teach motion in the Builder MCP guide. (Breakpoint switcher ↔ device-preview linkage landed in Phase 3, §12.3.) | Animation authoring, all surfaces    |
| **6 — Governance & demos**              | Brand designer governs the archetype set + the utility allowlist; re-author blueprints/Tesla/PDP onto archetypes; supersede the box sections in 40/44/45/46/59.                                                                                                                                                                                                             | Polished + documented                |
| **7 — Tier 4 raw CSS** _(deferred)_     | Scoped + sanitized raw CSS, Enterprise-gated.                                                                                                                                                                                                                                                                                                                               | Later                                |

Phases **0–2** are the foundation and land together (the destructive schema change + render cutover
must ship as one release). **3–5** are the product. **6** is polish + docs.

### 12.1 Build log — Phases 0–2 landed (2026-06-06)

The destructive cutover shipped (gate-green: typecheck 48/48, lint 48/48, the changed packages' tests
all pass — only a pre-existing `api-mcp` vite-transform issue on `packages/email/src/send.tsx` remains,
unrelated). Decisions made during execution:

- **Node shape** is `{ id, type, name?, class?, props, binding?, children? }`. `name?` was added as
  top-level metadata (sibling to `id`, for the Layers label) — a deliberate one-field addition to the
  §4 shape; it is not styling. `box`/`layout` and every box/layout enum + `DEFAULT_BOX`/`DEFAULT_LAYOUT`
  are deleted from `@sparx/builder-schemas`.
- **The box vocabulary survives only as a build-time DTO.** `packages/builder-schemas/src/box-to-class.ts`
  exports `BoxStyle`/`LayoutStyle` (ergonomic, all-optional authoring inputs) + `boxLayoutClass()`
  (single-element compile, used by `makeNode` + the registry drop-defaults) + `seedNode()` (the seed
  factory). Seed data (starters + the 7 blueprints) keeps its readable `box: {...}, layout: {...}`
  call-sites — they now type against `BoxStyle`/`LayoutStyle` and compile to a `class` string — so the
  ~657 blueprint literals never had to be hand-rewritten. Phase 6 re-authors them onto archetypes.
- **Full-bleed band + contained content** is the one structural case a single element can't express, so
  `seedNode` emits a 2-node wrap (outer `w-full {surface}{height}` band → inner `mx-auto max-w-site`
  Stack carrying the layout) only when `backgroundWidth:'full' && contentWidth:'contained'` and there's
  a visible band; a height makes the band `flex items-center justify-center`. Everything else is one
  element.
- **Background image/overlay are props, not classes** (a URL can't be a static utility; the allowlist
  blocks `url()`). The converter routes `backgroundImage`/`backgroundImageBinding`/`overlay`/`fit`/
  `position` to `props.bgImage`/`bgImageBinding`/`bgOverlay`/`bgFit`/`bgPosition`; both renderers paint
  them as the single remaining inline style.
- **Render unification.** Both renderers (`apps/site/.../builder-renderer.tsx`, `_builder/canvas.tsx`)
  deleted their box→CSS engines (`boxStyles`/`resolveLayout`/`layoutStyle`/device-JS) and now apply
  `node.class` verbatim on one element. The email renderer can't use classes (mail clients strip them),
  so it **parses** direction/columns/gap/padding/surface/align back out of `node.class`
  (`readEmailLayout`). The canvas's device switcher just fixes the canvas width; **container queries**
  (`container-type: inline-size` on `.bx-canvas` + `.bx-render`) do the responsive reflow — the converter
  seeds `grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-N` for grids and `flex-col @3xl:flex-row` for rows,
  so seeds are responsive-by-default.
- **Inspector** lost the box + arrangement panels (they read the deleted objects); Style + Advanced
  (color/variant + the raw `class` textarea) remain. The friendly arrange/utility controls are Phases
  3–4. `@sparx/site-ui` re-homed its own `Overlay`/`TextTone` types (they were importing the deleted box
  enums).
- **MCP gap (closed 2026-06-07 — see §12.2):** the new `/builder` node-tree authoring had **no MCP tool**;
  today's `write:builder` MCP tools drive the older section/theme sitebuilder (`@sparx/sitebuilder`). That
  gap is now closed by a dedicated Builder MCP tool bundle.

### 12.2 Build log — Builder MCP authoring tools (2026-06-07, gate-green, v1.2.0)

The class-only node model is the real AI-legibility unlock — an agent now writes the same Tailwind a
person does — so the Builder gets first-class MCP authoring. New module
`packages/builder/src/mcp/` (mirrors `@sparx/crm`/`@sparx/sitebuilder`), exposed as **`builderMcpTools`**
via a `@sparx/builder/mcp` **subpath** and registered in `services/api-mcp`'s `ALL_MCP_TOOLS`.

- **The teach-then-author surface.** Reads (`read:builder`): `describe_builder_styling` (the strategic
  one — returns `BUILDER_STYLE_GUIDE`: node model, node-type catalog, the tokenized Tailwind class
  vocabulary, container-query responsive rules, the binding model, the safety allowlist, + worked
  recipes), `list_builder_pages`, `get_builder_page`. Writes (`write:builder`): `create_builder_page`,
  `update_builder_page` (both DRAFT saves, un-gated), `publish_builder_page` + `delete_builder_page`
  (confirmation-gated). Distinct tool names from the sitebuilder set — both share the existing scopes.
- **One parser, every transport.** The write tools take a "document" (page envelope **or** a bare node
  tree, JSON string or object) and run the same `parsePageImport` the editor's Import and the REST
  transport use — auto-fills ids, dedupes, validates against `BuilderNodeSchema`, pulls page meta. So an
  agent emits `{ type, class?, props?, children? }` and gets a valid page.
- **Property resolution.** MCP auth carries tenant+user but no site; `mcp/context.ts` `toPropertyContext`
  mirrors api-rest's `lib/property.ts` (explicit `propertyId` arg wins when it's the tenant's own, else
  the primary site) so MCP and REST scope a site identically.
- **No Tailwind at MCP boot.** The `@sparx/builder/mcp` subpath imports `page-service` **directly**, never
  the services barrel — so `surface-css-service` (and its `@tailwindcss/node` compiler) is never evaluated
  in the api-mcp process. `surface-compile` is still installed (pnpm transitive dep; Dockerfile COPYs it +
  `packages/builder`) but inert at runtime.
- **The guide can't drift.** `vocabulary.test.ts` (7 tests, pass) asserts every example/recipe tree the
  guide teaches validates through `parsePageImport`, plus tool names/scopes/confirmation gating — if the
  node schema changes, the guide fails CI instead of teaching agents an invalid tree.

### 12.3 Build log — Phase 3 component-builder Appearance panel + context axis (2026-06-07, gate-green, v1.3.0)

The component builder gets its full skin surface, and per-breakpoint/state/dark authoring lands across
the inspector. Both files: `_builder/class-controls.ts` + `_builder/inspector.tsx`.

- **The context axis is the keystone.** `activeValue`/`applyValue` gained an optional `prefix` (default
  `''` = base, so every existing caller is unchanged). A control's group becomes the PREFIXED tokens
  (`@lg:grid-cols-3`, `hover:bg-primary`, `dark:bg-base-300`), so base + each context are independent
  mutually-exclusive groups that never clobber each other — `readClassGroup`/`setClassGroup` already match
  exact tokens, so prefixing "just works". A single `ContextSelect` (grouped State / Theme / Screen size)
  re-targets every control in its panel at that layer. This delivers docs/61's "per-breakpoint editing via
  container queries, NOT iframe" + state/dark authoring with NO new read/write machinery.
- **Appearance panel (`SkinPanel`) — component builder only** (`slotEditor` present ⇒ the same `allowSkin`
  gate Phase 4 set). The full skin families: Background + Text color (free, beyond the recipe's
  color×variant), Font family/size/weight/tracking/case, Corners/Border/Shadow (moved here out of
  Advanced), Transition + Transform, and the Surface entrance Animations. All tokenized → resolve to
  `--sf-*`. Entrance Animation is base-only (no variant), so it's dropped off-base. `skinControlsFor(prefix)`.
- **Responsive arrangement.** `ArrangementPanel` (containers, both surfaces) got the context selector too —
  breakpoints only (no hover/dark layout). The structural choice (direction vs columns) follows the BASE
  display; you tune columns/gap/justify/align/padding per breakpoint.
- **Advanced slimmed** to the universal Size + Margin + the raw-`class` escape hatch (`advancedControlsFor`
  lost its `allowSkin` param — skin moved to the Appearance panel).
- **Verified:** a throwaway compile test (deleted) confirmed all 25 representative tokens — including the
  context-prefixed `hover:bg-primary` / `dark:bg-base-300` / `@lg:grid-cols-3` / `@4xl:text-6xl` — pass the
  allowlist (`blocked: []`) and compile to real CSS through the Surface theme. Gates: typecheck 48/48, lint
  48/48, format clean. The editor UI itself still wants a browser drive (dashboard needs auth — deferred).

### 12.4 Build log — Phase 5 motion (2026-06-07, gate-green, v1.4.0)

Entrance motion landed on **both** surfaces, class-based (no `props.motion`, no renderer translation —
the renderer already applies `node.class` verbatim). Decisions made during execution:

- **Class-based, not props-based.** The §9 spec was revised from a `props.motion` object to plain
  classes on `node.class`: load `animate-<token>`, hover `hover:animate-<token>`, scroll
  `sf-reveal sf-reveal--<token>`. The site renderer needed **zero** change to _apply_ motion — only
  render-surface plumbing. Stagger is a container class `sf-reveal-stagger` (+ `--bold`).
- **One new runtime + one self-contained sheet.** `SCROLL_MOTION_CSS` (own `@keyframes` + the
  `.sf-reveal`/`.sf-in`/stagger rules, generated programmatically) and `MotionController` (one shared
  `IntersectionObserver`, one-shot, reduced-motion early-return, route re-scan) ship from
  `@sparx/surface-compile`'s `motion.ts` + `apps/site`. The sheet is self-contained so it never depends
  on the per-tenant compile emitting `--animate-*` (which tree-shakes on use).
- **Delivery path.** Both `REDUCED_MOTION_CSS` (previously exported but **never wired** — now active) and
  `SCROLL_MOTION_CSS` are prepended in `surface-css-service` (`getPublishedStylesheet` /
  `getDraftStylesheet` / `compilePreview`), so they ride the existing HTTP `surfaceCss` path to the live
  site **and** the canvas with no new `apps/site` dependency (the site deliberately has no
  `surface-compile` dep — it would pull Tailwind in). The before-paint gate adds `sf-anim-ready` (next to
  the legacy `sf-reveal-ready`); `<MotionController />` mounts in the site layout body.
- **Inspector.** A cross-surface **Motion** panel (`MotionPanel`) on every node: Entrance picker +
  Trigger (Scroll/Load/Hover); containers also get **Stagger**. It's a small composite over
  `node.class` (`readMotion`/`applyMotion`) since entrance × trigger isn't a single flat group. The
  Phase 3 standalone entrance picker (`ANIMATION_CONTROL`) **folded in** — removed from the
  component-builder Appearance panel (which keeps the interactive `transition`/`transform` skin).
- **§5.2/§6 amendment.** Motion moved out of the "skin, component-only" bucket: it's safe-because-visible
  like arrangement (jank is visible + self-correcting; no silent brand drift), so it's authored on the
  page builder too.
- **MCP.** The Builder style guide teaches the three trigger shapes + stagger, with a worked
  scroll-reveal recipe; `vocabulary.test.ts` asserts the recipe validates and every motion class passes
  the allowlist.
- **Deferred (fast-follows):** (1) the canvas **"Play motion"** replay — the no-iframe canvas shares the
  document, and the reveal CSS is gated on `html.sf-anim-ready`, so a scoped one-shot replay is fiddly;
  the canvas correctly shows the **resting** state today (the dashboard `<html>` never sets the gate).
  (2) **Speed / Delay** controls (the `--animate-*` durations are baked; a clean speed knob wants a CSS
  var threaded through the shorthand). (3) **LCP guard** for above-the-fold scroll entrances. (4)
  Retiring the legacy `RevealController`/`[data-sf-reveal]` path when the legacy section renderer goes.

## 13. Open questions / deferred

- **Container-breakpoint scale values** — align `@md`/`@lg`/… to component-sensible widths; final
  numbers tuned in Phase 0.
- **State authoring** — DONE (Phase 3, §12.3): simple `hover:`/`focus:`/`active:`/`dark:` + the breakpoint
  scale ship via the context selector. RELATIONAL `group-hover:`/`peer-*` still deferred (they need a
  relational concept — which ancestor/sibling — the flat context picker can't express).
- **Gradient & transform editing UX** — basic transform (scale/translate) ships in the Phase 3 Appearance
  panel; multi-stop gradients + transform COMPOSITION (several transforms at once) still need richer
  controls than a single dropdown; Phase 5 candidate.
- **Tier 4 raw CSS** — scoping + sanitization subsystem; deferred (§8, Phase 7).
- **Archetype taxonomy** — the brand-governed starting set of layout/section archetypes; Phase 6.

## 14. Supersessions

- **[40](40-sitebuilder-composition-model.md) §5** (the box/layout base) — the node shape is now §4
  here; box/layout are deleted.
- **[47](47-class-first-authoring-model.md)** — this doc is its execution; node keeps `props` (not
  `data`); the utility layer is Tailwind-native, not the `sf-*` _dialect_, at the author surface.
- **[46](46-site-ui-component-library.md) §7** — the migration is no longer "on hold"; it lands in
  Phase 2 as the render-unification keystone.
- **[59](59-responsive-rendering.md)** — auto-collapse + device-derived JS are replaced by explicit
  container-query authoring; the doc's "single source of truth" responsive rules are retired.
