# 46 — `@sparx/site-ui`: The Tenant-Themed Component Library

Version: 1.5
Author: Brandon Korous
Last Updated: 2026-06-03

> The Builder composition model ([40](40-sitebuilder-composition-model.md)) walks a
> node tree; the site render path ([44](archive/44-builder-site-render.md)) turns a
> published tree into live markup; the editor canvas previews the same tree inside the
> dashboard. Today the **leaf and container visuals** in those two render paths are written
> **twice** — once as `.bx-*` CSS in the editor canvas, once as inline styles in the
> site renderer — and they drift. This doc defines **`@sparx/site-ui`**, a single
> tenant-themed component library that **both** paths consume, so the editor renders the exact
> components the site ships: _what you see is what you ship._

---

## 1. The problem

A Builder primitive — say a CTA button or a photo panel — exists in two places:

| Surface           | Where                                                                          | How it's styled                              |
| ----------------- | ------------------------------------------------------------------------------ | -------------------------------------------- |
| **Editor canvas** | `apps/dashboard/app/(dashboard)/builder/_builder/registry.tsx` + `builder.css` | `.bx-btn`, `.bx-btn--primary`, … (`--bxc-*`) |
| **Live site**     | `apps/site/components/builder-renderer.tsx`                                    | inline `style={buttonStyle(...)}` (`--st-*`) |

Two implementations of one thing. The canvas knows `primary | soft | link`; the site
(after the Tesla work) knows `primary | soft | dark | glass | link`. They already disagree.
Every new primitive doubles the surface area and the drift. The north-star goal — recreate a
reference landing page so the preview **exactly matches** production — is structurally
impossible while the preview and production are different code.

**`@sparx/site-ui` collapses both into one set of components**, themed entirely by the tenant
`--st-*` tokens. The site renderer and the editor canvas both render these components.
The preview cannot drift from production because they are the same code.

---

## 2. The boundary: `@sparx/ui` vs `@sparx/site-ui`

Two component libraries, cleanly split by **whose brand they wear**:

| Library                     | Theme tokens                                          | Wears the brand of    | Consumers                                                   |
| --------------------------- | ----------------------------------------------------- | --------------------- | ----------------------------------------------------------- |
| `@sparx/ui` (`packages/ui`) | `--color-*`, `--module-active`, `--sparx-*`           | **sparx** (the admin) | `apps/dashboard`, marketing `apps/web`                      |
| `@sparx/site-ui` (this doc) | `--st-*` (Token Model v2, [33](33-token-model-v2.md)) | **the tenant**        | `apps/site` chrome, the Builder renderer, the editor canvas |

They never overlap. `@sparx/ui` is the operator's tools, in sparx Indigo. `@sparx/site-ui` is
the tenant's published site, in the tenant's brand. The dashboard chrome around the Builder
(toolbar, rail, inspector) stays `@sparx/ui`; only the **canvas content** — the tenant's site
preview — is `@sparx/site-ui`.

**What `site-ui` owns.** The renderer keeps its tree-walking engine (box → CSS, layout, binding,
iteration, scope). `site-ui` owns the **leaf and container _components_** that engine renders:
Button, the photo-panel surface (box base → background image + overlay scrim + text tone),
Heading, Text, Image, Divider, PriceTag, NavMenu, Logo, SocialLinks, plus the Tesla-era
additions (Carousel, Video, Map, Stat). The engine maps box/layout semantics to style; the
components own the **treatment** (variants, surfaces, type scale).

**The hard rule.** No component hardcodes a color. Every value resolves to a `--st-*` token, or
to a **documented fallback** baked into the `var()` call (`var(--st-primary, #3f6b52)`) for the
handful of cases where the producer doesn't emit the token yet (§4). This is the same discipline
`@sparx/ui` follows with `--color-*`.

---

## 3. Decisions

### 3.1 Styling mechanism — self-contained semantic CSS keyed on `--st-*` (NOT Tailwind utilities, NOT inline styles)

This is the load-bearing decision. Three candidates were on the table:

1. **Tailwind utility classes** (what `@sparx/ui` does). Rejected for `site-ui`: it would force
   _every_ consumer's Tailwind build to scan `packages/site-ui/**` into its `content`, and the
   dashboard's Tailwind theme maps utilities like `bg-primary` to the **admin** palette
   (`--color-*`), not the tenant's. We'd be reduced to arbitrary-value classes
   (`bg-[var(--st-primary)]`) everywhere — Tailwind buying us nothing while adding a build
   coupling and a real risk of the canvas resolving the wrong palette.
2. **Inline styles** (what the site renderer does today). Self-contained and FOUC-free,
   but inline styles **cannot express `:hover` / `:focus-visible` / `:disabled`** — a real
   component library needs interaction states. (The current site buttons have none.)
3. **Self-contained semantic CSS, authored once against `--st-*`, shipped as a stylesheet.**
   ✅ **Chosen.**

`site-ui` components emit **semantic class names** (`st-btn st-btn--primary`) and ship a single
token-driven stylesheet (`@sparx/site-ui/styles.css`). This is exactly the established pattern in
this repo — `site.css` and `builder.css` are both plain token-driven CSS, and `@sparx/ui`
already ships `tokens.css`. It gives us:

- **One source of visual truth** consumed identically by site and canvas — no per-consumer
  Tailwind wiring, no palette ambiguity.
- **Full interaction states** (`:hover`, `:focus-visible`, `:disabled`) that inline styles can't do.
- **No FOUC**: a static stylesheet in the document head paints with the first frame, same as
  `site.css`/`builder.css` today.
- **Server-renderable**: emitting a `className` requires no client runtime.

**Division of labor between class and inline.** Visual _treatment_ (variant, surface, tone) →
**class**. Per-node _data_ that can't be a class (a background-image URL, a grid column count, a
gap value chosen by the box/layout engine) → **inline style**, set by the renderer's existing
box→CSS layer. Components own the former; the engine owns the latter. They compose on one element.

> **Amended by [47](47-class-first-authoring-model.md) §5.3 (2026-06-02).** This decision rejected
> _shipping unresolved Tailwind utilities_ — still correct. But `site-ui` is being grown into the
> **Surface** system, which authors its semantic classes with `@apply` over a tenant-flavored
> Tailwind theme (utilities → `--st-*` vars) and **compiles to plain CSS at its own build**. So
> consumers still receive a static, token-driven stylesheet and the coupling rejected here never
> occurs; only the _authoring source_ is Tailwind, not the shipped output. The dynamic color × variant
> axis stays a role var (`var(--c-*)`), since `@apply` cannot interpolate a `{color}`.

### 3.2 SSR-first, selective `'use client'`

The site is server-rendered; the canvas is a client tree. Components must work in both, so
they are **server components by default** — they emit markup + class names with no client runtime.
Only components that genuinely need browser state opt into `'use client'`:

| Component                                                                                     | Boundary                                                                 |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Button, Heading, Text, Image, Divider, PriceTag, Logo, NavMenu, SocialLinks, Stat, Map, Video | **Server** — pure markup + classes (Map/Video are `<iframe>`s; no state) |
| Carousel                                                                                      | **`'use client'`** — index state, autoplay timer, drag                   |

`'use client'` is a per-file boundary at the leaf, so importing `site-ui` from a server component
(the site renderer) stays server-side except where a client island is actually used. This
mirrors `@sparx/ui`'s selective-`'use client'` discipline ([23](23-frontend-component-architecture.md)).

### 3.3 No canonical token ownership — `site-ui` _consumes_, `site-themes` _produces_

`@sparx/site-themes` is the single producer of `--st-*` (`buildThemeCssV2` /
`compileThemeForTenant`, [33](33-token-model-v2.md)). `site-ui` never emits a canonical token
file — that would create a competing source of truth. It only **reads** `--st-*`, with inline
fallbacks for graceful degradation. The token contract `site-ui` depends on is enumerated in §4.

### 3.4 Package shape mirrors `@sparx/ui`

`type: module`, `private`, `exports` map with subpath entries, `tsconfig` extends
`tsconfig.base.json` with `declaration: false` / `declarationMap: false` (source-only workspace
package, same as `@sparx/ui`). React/`react-dom`/`tailwindcss` are **peer** deps so the consuming
app owns the single React copy. The package ships **no Tailwind config** — it doesn't author
utilities (§3.1).

### 3.5 Class-name prefix: `st-`

All `site-ui` classes are prefixed `st-` (e.g. `st-btn`, `st-c-primary`, `st-v-solid`,
`st-carousel__slide`), matching the `--st-*` token namespace and clearly distinct from the editor
chrome's `bx-*` and `@sparx/ui`'s Tailwind output. The legacy `.bx-*` canvas classes are retired
during migration (§7).

### 3.6 The variant recipe is the foundation — four-axis `color × variant × size`, for ALL color-bearing elements

**This is load-bearing and applies to every color-bearing component, not just Button** (docs/35).
There is no flat `variant: primary | soft | …` enum anywhere — `primary` is a **color**, `soft` is a
**treatment**. site-ui ships the `--st-*` analog of `@sparx/ui`'s `_recipes/variants.ts`
([packages/site-ui/src/components/\_recipes/variants.ts](../packages/site-ui/src/components/_recipes/variants.ts)
\+ [styles/recipes.css](../packages/site-ui/src/styles/recipes.css)):

- **`color` axis** — a `.st-c-{color}` role-var class (the `--st-*` analog of tokens.css `.sx-c-*`)
  that maps the five role vars `--c-bg / --c-fg / --c-ink / --c-hover / --c-tint` from `--st-*`
  (oklch mixes toward the readable ink, mirroring `@sparx/ui`). Slots: `primary, secondary, accent,
neutral, info, success, warning, danger` **+ `surface`** (base-100 fill / base-content ink — the
  light-glass / chrome case). Any string is accepted (`color="brand-mint"`) once a matching
  `.st-c-*` rule exists.
- **`variant` axis** — treatments authored **once** in CSS against the `--c-*` role vars:
  `solid · soft · outline · dashed · ghost · link · glass`. `color × variant` composes through the
  role vars — **no cartesian product, no codegen**. `chipTreatmentVariants` is the reduced subset
  (solid/soft/outline/dashed) for chips/badges.
- **`size` axis** — the shared `sm | md | lg` scale; what each step means dimensionally is the
  component's own CSS (e.g. `.st-btn--sz-md`).

Every color-bearing component is a **thin consumer**: it emits
`cx('st-{component}', colorClass(color), treatmentVariants[variant], sizeClass(size))`. `recipes.css`
is imported **last** so a treatment's resets (e.g. `.st-v-link` → `padding:0`) win over size classes.

---

## 4. The token contract (`--st-*` `site-ui` consumes)

These are produced by `@sparx/site-themes` (`colorVars` + `sharedVars` in
`packages/site-themes/src/v2/css.ts`) and declared as fallbacks in `apps/site/app/site.css`.
Every `site-ui` class reads from this set:

**Color** — `--st-base-100/200/300`, `--st-base-content`, `--st-primary` (+ `-content`, `-hover`,
`-active`, `-tint`), `--st-secondary` (+ `-content`), `--st-accent` (+ `-content`, `-tint`),
`--st-neutral` (+ `-content`), `--st-info/success/warning/danger` (+ `-content`), `--st-border`.
Text tiers: `--st-text-secondary`, `--st-text-muted`, `--st-text-tertiary`.

**Shape** — `--st-radius-selector`, `--st-radius-field`, `--st-radius-box`, `--st-border-width`.

**Type** — `--st-font-heading`, `--st-font-body`, `--st-font-fallback`.

**Rhythm / layout** — `--st-space-base`, `--st-space-{1..24}`, `--st-container` (alias `--st-max`).

**Effect** — `--st-shadow-sm/md/lg`, `--st-depth`.

### 4.1 Overlay/scrim tokens — SUPERSEDED by the recipe (glass × surface/neutral)

> **Superseded 2026-06-02.** An earlier pass added `--st-overlay-dark/-content/-light/-content` to
> the producer for flat `dark`/`glass` buttons. With the four-axis recipe (§3.6) those CTAs are now
> **compositions** — `glass × neutral` (frosted dark) and `glass × surface` (frosted light) — so the
> standalone overlay tokens were **removed** from the producer as redundant. The `glass` treatment
> frosts `--c-bg` at ~82% over transparent + backdrop-blur; the Carousel arrows dogfood the same
> `glass × surface`. Recorded here for history; no consumer reads `--st-overlay-*`.

<details><summary>Original (pre-recipe) proposal — kept for the record</summary>

The `dark` and `glass` button variants the team-lead shipped are **legibility scrims over arbitrary
photos**, not tenant-brand colors — a tenant's `--st-primary` over a busy hero photo is often
illegible, so these are deliberately a frosted near-black / near-white. To honor "no hardcoded
color" while staying faithful to the shipped look, `site-ui` reads them through **dedicated tokens
now emitted by the v2 producer** (`sharedVars` in `packages/site-themes/src/v2/css.ts`), with
the team-lead's exact values; `site-ui` CSS also keeps them as `var()` fallbacks for graceful
degradation:

| Token                        | Fallback (matches `builder-renderer.tsx`) | Meaning                     |
| ---------------------------- | ----------------------------------------- | --------------------------- |
| `--st-overlay-dark`          | `rgba(23, 26, 35, 0.78)`                  | frosted dark scrim surface  |
| `--st-overlay-dark-content`  | `#ffffff`                                 | text on the dark scrim      |
| `--st-overlay-light`         | `rgba(255, 255, 255, 0.86)`               | frosted light scrim surface |
| `--st-overlay-light-content` | `#171a23`                                 | text on the light scrim     |

These are mode-independent constants in `sharedVars` (a scrim is a fixed legibility veil, not a
per-mode color). Scoped to the four button scrims for now; the box-background photo scrim (the
renderer's `SCRIM` map in `bgProps`) reads overlay tokens in a later pass — left untouched here per
the team-lead. A tenant theme can later override them to tune scrim legibility.

</details>

---

## 5. Component inventory + prop contracts

The first wave harvests the proven implementations in `builder-renderer.tsx` and the editor
`registry.tsx` into typed components. Prop contracts are intentionally **presentational and
SSR-safe** — no event handlers in the base components (interactivity arrives via `href` links or a
thin client wrapper), so they render in both the server site and the client canvas.

> **Status: the full first wave is now BUILT** greenfield in `packages/site-ui` (gate green;
> migration still on hold per §7). Each component below emits `st-*` classes against the §4 tokens
> and ships a CSS partial aggregated into `styles.css`.

### 5.1 `Button` — the reference consumer of the recipe (§3.6, §6)

```ts
interface ButtonProps {
  color?: ColorKey | (string & {}); // default 'primary' — st-c-{color}
  variant?: TreatmentKey; // solid|soft|outline|dashed|ghost|link|glass — default 'solid'
  size?: SizeKey; // sm|md|lg — default 'md'
  href?: string; // present → <a>, absent → <button>
  target?: HTMLAttributeAnchorTarget;
  rel?: string;
  type?: 'button' | 'submit' | 'reset'; // native button only
  className?: string;
  style?: CSSProperties;
  id?: string;
  title?: string;
  'aria-label'?: string;
  children?: ReactNode;
}
```

Emits `cx('st-btn', colorClass(color), treatmentVariants[variant], 'st-btn--sz-' + size, className)`.
The old flat scrim CTAs are compositions: **Order Now = `glass` × `neutral`**, **Learn More =
`glass` × `surface`**.

### 5.2 The rest of the inventory (built — exported from the barrel)

| Component           | Boundary        | Key props                                                                  | Harvested from                        |
| ------------------- | --------------- | -------------------------------------------------------------------------- | ------------------------------------- |
| `Heading`           | server          | `level: 'h1'\|'h2'\|'h3'`, `children`                                      | `headingStyle` / `.bx-h*`             |
| `Text`              | server          | `variant: 'body'\|'eyebrow'\|'meta'`, `children`                           | `textStyle` / `.bx-text--*`           |
| `Image`             | server          | `src?`, `alt`, `ratio: 'wide'\|'square'\|'portrait'`                       | `Image`/`ImageDisplay` leaf, `.bx-ph` |
| `Divider`           | server          | —                                                                          | `.bx-divider`                         |
| `PriceTag`          | server          | `amount?: number`, `currency?`                                             | `PriceTag` leaf                       |
| `Logo`              | server          | `name?`, `src?`, `href?`                                                   | `Logo` leaf, `.bx-logo`               |
| `NavMenu`           | server          | `items: {label,url}[]`, `orientation: 'row'\|'stack'`                      | `NavMenu` leaf, `.bx-nav`             |
| `SocialLinks`       | server          | `items: {platform,url}[]`                                                  | `SocialLinks` leaf, `.bx-social`      |
| `EmbedFrame`        | server          | `src`, `title`, `ratio: 'wide'\|'square'\|'portrait'\|'pano'`              | `embedFrame`                          |
| `Video`             | server          | `url`, `title`, `ratio`                                                    | `youtubeEmbed` + `embedFrame`         |
| `Map`               | server          | `query?`, `embedUrl?`, `ratio`                                             | `mapEmbed` + `embedFrame`             |
| `Stat`              | server          | `value`, `label`, `caption?`                                               | (new, Tesla)                          |
| `Carousel`          | **client**      | `slides: ReactNode[]`, `autoplay?`, `interval?`, `arrows?`, `dots?`        | `builder-carousel.tsx`                |
| `PhotoPanel` helper | server (helper) | `photoPanelStyle({ image?, overlay?, tone?, surfaceBg? }) → CSSProperties` | `bgProps`, `SCRIM`, `TONE`            |

`PhotoPanel` is a **style helper** (`photoPanelStyle`), not a wrapper component — confirmed by the
team-lead: it returns the `CSSProperties` the renderer's box layer composes onto the box element, so
the box→CSS engine keeps owning structure while the scrim/tone treatment lives in `site-ui` (a
wrapping component would fight the tree-walker and duplicate the box spine, docs/40). `Overlay` /
`TextTone` types come from `@sparx/builder-schemas` (`node.ts`), which `site-ui` depends on for the
box/layout vocabulary — a one-way dependency (`builder-schemas` is zod-only and server-safe; it
never imports `site-ui`). `Video`/`Map` render through `EmbedFrame`; `youtubeEmbed`/`mapEmbed` are
exported so the renderer can dedupe onto them at migration.

### 5.3 Core-library expansion — Tier 1–3 (2026-06-02)

The first wave harvested the renderer's leaves; this wave fills out the **core library** so
Surface is a complete component set, not a starter. Everything below ships the same way: `st-*`
classes against the §4 tokens, a CSS partial aggregated into `styles.css` (recipes.css last), and a
vitest per component. Server by default; none needed `'use client'`. Built priority-ordered:

**Tier 1 — layout archetypes (docs/47 §11 B1).** The biggest hole, and the home for the one bit of
box "magic."

| Component   | Boundary | Axes / key props                                                     | Notes                                                                                                                                         |
| ----------- | -------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `Section`   | server   | `surface` (color recipe) · `contentWidth` full/contained · `padding` | The keystone: full-bleed band + contained inner; background via `photoPanelStyle` (+ `overlay`/`tone`). Re-homes the outer/inner box pattern. |
| `Container` | server   | `width` sm/md/lg/full                                                | `lg` reads `--st-container`.                                                                                                                  |
| `Grid`      | server   | `cols` 1–6 · `gap` · `responsive`                                    | Mobile-first: single column below `md`; `responsive={false}` holds the count.                                                                 |
| `Stack`     | server   | `direction` · `gap` · `align` · `justify` · `wrap`                   | One-dimensional flex flow.                                                                                                                    |

**Tier 2 — color-bearing primitives (recipe consumers).** Each composes `color × variant (× size)`
off the shared recipe — no flat enum (§3.6).

| Component | Boundary | Axes / parts                                                 | Notes                                                                                                                                      |
| --------- | -------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `Badge`   | server   | `color` × `chipTreatment` × `size`                           | Status/count pill.                                                                                                                         |
| `Tag`     | server   | `color` × `chipTreatment` × `size`, `dot`                    | Field-radius chip with an optional leading dot.                                                                                            |
| `Alert`   | server   | `color` × `chipTreatment`, `vertical`; parts Icon/Title/Body | Compound (Card pattern); `role="alert"`.                                                                                                   |
| `Callout` | server   | `color` × `chipTreatment`, `icon`, `title`                   | Editorial block with a left accent in `--c-bg`.                                                                                            |
| `Avatar`  | server   | `color` (placeholder fill) × `size` × `shape`, `status`      | Initials fallback (`initials()` exported); presence dot.                                                                                   |
| `Label`   | server   | `required` marker                                            | **Judgment: no color axis** — typographic (same split as Text/Heading); the required `*` is the fixed danger token, not a selectable axis. |

**Tier 2b — structural primitives.**

| Component    | Boundary | Axes / parts                            | Notes                                                                                                                                                                                          |
| ------------ | -------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Skeleton`   | server   | `shape` block/text/circle               | Pulse animation, reduced-motion aware.                                                                                                                                                         |
| `Spinner`    | server   | `kind` spinner/ring/dots/bars × `size`  | Color via `currentColor`; `role="status"` + visually-hidden label.                                                                                                                             |
| `Progress`   | server   | `color` × `size`, `value`/`max`         | **Judgment: color-bearing** — its fill is a color, so hard-rule §3.6 wins over the "structural" grouping; daisyUI gives progress colors too. Defaults `primary`; omit `value` → indeterminate. |
| `Breadcrumb` | server   | parts Item (`href`/`current`)           | Compound; `<nav><ol>`, CSS separators.                                                                                                                                                         |
| `Pagination` | server   | `page`/`total`/`hrefFor`/`siblingCount` | Link-based (no onClick); `paginationRange()` exported; active = fixed primary accent (not a color axis).                                                                                       |

**Tier 3 — form controls.** Presentational shells forwarding standard input props; the recipe shows
up in the **focus ring** (`--c-bg`) and the **invalid** state (danger role).

| Component              | Boundary | Axes / key props                                     | Notes                                                                 |
| ---------------------- | -------- | ---------------------------------------------------- | --------------------------------------------------------------------- |
| `Input`                | server   | `color` × `size`, `variant` default/ghost, `invalid` | Shared `.st-input` base.                                              |
| `Textarea`             | server   | same                                                 | `.st-input` + `.st-textarea` (min-height, vertical resize).           |
| `NativeSelect`         | server   | same + children options                              | `.st-input` + chevron via a `currentColor` mask (no hardcoded color). |
| `Checkbox`             | server   | `color` × `size`                                     | `appearance:none`; checked fill `--c-bg`, masked tick `--c-fg`.       |
| `Radio` / `RadioGroup` | server   | `color` × `size`; group `orientation`                | Inner dot `--c-bg`; group is a `role="radiogroup"` layout wrapper.    |
| `Switch`               | server   | `color` × `size`                                     | Track + sliding knob; `role="switch"`; checked track `--c-bg`.        |
| `Field`                | server   | `label`/`hint`/`error`/`required`                    | Wraps Label + control; error in danger, error overrides hint.         |

### 5.4 Tier 4 interactive + the full catalog (2026-06-03)

To make Surface a complete library, the remaining daisyUI-class catalog was built in one pass.
Two boundary notes:

- **Tier 4 wraps Radix, styled entirely by Surface.** The interactive primitives use
  `@radix-ui/react-*` for behavior only (focus, keyboard, portalling, `data-state`); **no Radix
  class convention is adopted** — every part carries an `st-*` class and is themed by `--st-*` +
  the role-var recipe, with interaction styling keyed off Radix's `data-state`/`data-highlighted`
  attributes. This is a deliberate **dependency decision** (team-lead chose Radix over the
  hand-authored approach `@sparx/ui` uses); the new runtime deps are `react-accordion`,
  `-collapsible`, `-tabs`, `-tooltip`, `-dialog`, `-dropdown-menu`, `-popover`. Each is a
  `'use client'` island.
- **Expanded `'use client'` set (amends §3.2).** Beyond Carousel, the client components are now: all
  Tier 4 (Radix) primitives, plus **HoverGallery** and **TextRotate** (hover/timer state). Swap is
  server (a CSS-`:checked` toggle); everything else in the catalog stays server.

**Tier 4 — interactive (Radix behavior, Surface CSS):** `Accordion` (icon: arrow/plus) · `Collapse`
· `Tabs` (variant line/box/lift × color) · `Tooltip` (color × side) · `Dialog`/Modal (placement) ·
`Drawer` (side) · `DropdownMenu` · `Popover` — all compound, parts attached + named-exported.

**Catalog — color-bearing (recipe consumers):** `Link` (color × underline), `Status` (color × size,
pulse), `Steps`/`Step` (color, orientation, per-step state), `RadialProgress` (color × size, conic
mask), `ChatBubble` (placement; colored Message), `Range` (accent-color), `Rating` (color × size,
interactive radios or readOnly), `FAB` (recipe solid), `Filter` (checked chip), `FileInput`
(file-button color).

**Catalog — structural (no color axis):** `Kbd`, `Hero`, `Footer`, `Navbar`, `Menu`, `Dock`, `List`,
`Table` (zebra/pin/size), `Indicator` (9 placements), `Join`, `Mask` (clip/SVG shapes), `Toast`
(anchor), `Countdown`, `Diff`, `Hover3DCard`, `HoverGallery`, `TextRotate`, `Swap`, `Calendar`
(`calendarMonth` helper), `Validator` (`:user-invalid`), and the mockups `Browser` / `Code` / `Phone`
/ `Window`. Menu/Dock/Calendar/Pagination active states use the fixed primary accent (a semantic
token, not a selectable color axis — same judgment as Label).

**`ThemeController`** (client) switches the site between **light / dark / system** by setting
`data-theme` on the document root (or a target element). It persists to a **cookie** by default
(`sparx_theme`, `light`/`dark`; `system` clears it) — the same contract the site's no-flash `<head>`
script reads (`apps/site/app/layout.tsx`), so it's a drop-in for the hand-rolled `mode-toggle`;
`localStorage` and `none` are also available via `persist`. It drives the exact contract
`@sparx/site-themes` emits — `:root` (light) + `:root[data-theme="dark"]` + a `prefers-color-scheme`
fallback an explicit `[data-theme="light"]` opts out of (`buildThemeCssV2`, docs/33). It is a **mode
toggle within the tenant's one active brand**, _not_ a multi-named-theme picker: the brand designer
(`/builder/brand`) manages many named themes (`SiteTheme` rows), but "Use this theme" applies one
onto the tenant's single active brand, which the producer compiles to light + dark — so `data-theme`
only takes `light` / `dark` / (absent = system). Runtime named-theme switching would require the
producer to emit `[data-theme="<name>"]` blocks first; the control already writes an arbitrary
attribute value, so it extends cleanly.

---

## 6. The reference component: `Button`

The first/reference consumer of the recipe (§3.6), proving the whole contract end to end:

- **Server component** (no `'use client'`) — emits `<a>`/`<button>` + classes; no client runtime.
- **Themed only by `--st-*`** — Button owns nothing but base layout + the `sm/md/lg` padding scale
  in `styles/button.css`; all color/treatment comes from the shared `.st-c-*` / `.st-v-*` recipe.
  No hardcoded color. (The focus ring picks up the active `--c-bg`.)
- **Renders identically in both contexts.** The site defines `--st-*` globally (via
  `site.css`); the editor canvas defines a compiled `--st-*` block scoped to `.bx-canvas`
  (today aliased to `--bxc-*`; see `builder.css`). Because `.st-c-primary` reads `--st-primary`
  directly, the **same button** picks up the tenant brand in the site and the same compiled
  brand in the canvas — no per-context code.

`vitest` asserts each axis (color → `st-c-*`, variant → `st-v-*`, size → `st-btn--sz-*`), the
runtime-custom color, the `glass × neutral` / `glass × surface` compositions, and the `href`→`<a>` /
no-`href`→`<button>` polymorphism; a recipe test covers `colorClass`, `treatmentVariants`, and the
`chipTreatmentVariants` subset.

---

## 7. The canvas ↔ site unification plan (LATER — coordinated)

Greenfield work (the doc, the scaffold, Button) touches nothing else. The migration is a separate,
coordinated pass **after the team-lead's Tesla primitives land**, executed roughly in this order:

1. **Land `styles.css` import points.** Add `import '@sparx/site-ui/styles.css'` to the site
   root layout (after `@sparx/ui/tokens.css`/`site.css`) and to the `/builder` editor route.
   Static stylesheet → no FOUC.
2. **Point the site renderer at `site-ui`.** Replace `buttonStyle`/leaf inline styles in
   `builder-renderer.tsx` with `site-ui` components, leaf by leaf. The box/layout engine and
   binding resolution are untouched — only the leaf/container _visuals_ move.
3. **Point the editor canvas at `site-ui`.** Replace the `.bx-*` leaf rendering in `registry.tsx`
   with the same `site-ui` components. The canvas already compiles `--st-*` onto `.bx-canvas`, so
   the components theme correctly. The `--bxc-*` aliases become a thin compatibility shim and are
   then deleted from `builder.css`; the leaf `.bx-*` rules go with them.
4. **Verify parity.** With both paths on `site-ui`, the canvas preview and the published page are
   the same components — confirm against the reference landing page (the team's north star).

**No-FOUC guarantee.** Because treatment is a static, head-loaded stylesheet (not runtime-injected
styles), the first paint is already themed in both SSR (site) and client (canvas) — there is
no unstyled frame to flash.

### 7.1 New-package wiring checklist (migration-time, do NOT do during greenfield)

- **Dockerfile COPY.** Each consumer image (`apps/site`, `apps/dashboard`) must add
  `COPY packages/site-ui` lines (plus the transitive closure), or the image build fails even though
  `tsc`/`lint` pass locally — per the project's Dockerfile-package-wiring rule.
- **Keep React out of backends.** `site-ui` is frontend-only; no `services/*` or backend package
  may depend on it. Shared box/layout _types_ come from `@sparx/builder-schemas` (server-safe),
  never from `site-ui`.
- **`pnpm-lock.yaml`** gains the `@sparx/site-ui` entry on first `pnpm install`; ship it with the
  scaffold.

---

## 8. Package layout

```
packages/site-ui/
  package.json            # @sparx/site-ui — type:module, exports ., ./styles.css
  tsconfig.json           # extends ../../tsconfig.base.json; declaration:false
  eslint.config.js        # extends root flat config (explicit, mirrors apps/*)
  vitest.config.ts        # jsdom + Testing Library
  src/
    index.ts              # public barrel
    utils/
      cx.ts               # tiny dependency-free class joiner (no Tailwind merge needed)
      embed.ts            # youtubeEmbed / mapEmbed (server-safe)
      photo-panel.ts      # photoPanelStyle() — the PhotoPanel helper
    styles.css            # aggregate: @imports partials, then recipes.css LAST
    styles/               # one CSS partial per component, all --st-* keyed
      recipes.css         # THE FOUNDATION: .st-c-{color} + .st-v-{variant} (§3.6)
      button.css carousel.css divider.css embed-frame.css heading.css
      image.css logo.css nav-menu.css price-tag.css social-links.css stat.css text.css
    components/           # one file per component (+ co-located *.test.tsx)
      _recipes/variants.ts  # COLOR_KEYS, colorClass, treatmentVariants, SIZE_KEYS (§3.6)
      button.tsx heading.tsx text.tsx divider.tsx price-tag.tsx image.tsx
      logo.tsx nav-menu.tsx social-links.tsx embed-frame.tsx video.tsx
      map.tsx stat.tsx carousel.tsx   # carousel is the only 'use client'
```

Subpath exports: `.` (the barrel, types + components) and `./styles.css` (the stylesheet). A
component never imports its own CSS — consumers import `styles.css` once, so the bundle stays free
of duplicated style injection and the server renderer carries no CSS-in-JS runtime.

---

## 9. Resolved decisions (team-lead, 2026-06-02)

1. **Four-axis recipe is the foundation (§3.6) — for ALL color-bearing elements.** No flat
   `variant` enum anywhere; every such component composes `color × variant (× size)` off the shared
   `.st-c-*` / `.st-v-*` recipe. Button is the first/reference consumer. (Corrected from an earlier
   flat-`variant` Button.) Audit of the built set: only Button is color-bearing; `Text`/`Heading`
   variants are typographic roles (same split as `@sparx/ui`), the rest are structural — nothing
   else needed conversion.
2. **`PhotoPanel` (§5.2) — HELPER.** `photoPanelStyle()` returns `CSSProperties` for the box→CSS
   engine to compose; no wrapping component.
3. **Button interactivity (§6) — server base.** Base `Button` stays server/presentational;
   interactive CTAs get a thin `'use client'` wrapper later.
4. **Overlay tokens (§4.1) — SUPERSEDED.** The dark/glass scrim pair became `glass × neutral` /
   `glass × surface`; the standalone `--st-overlay-*` producer tokens were removed.

---

## 10. Status

- [x] §1–§9 decisions locked + approved by team-lead.
- [x] Scaffold `packages/site-ui` (§8).
- [x] **Variant recipe** (`_recipes/variants.ts` + `recipes.css`) — the four-axis foundation (§3.6).
- [x] `Button` reworked to four-axis `color × variant × size` as the reference consumer (§5.1, §6).
- [x] Full first-wave inventory built greenfield (§5); `--st-overlay-*` removed (§4.1, superseded).
- [x] Gate green: site-ui **51 tests**, site-themes **55 tests**, tsc/eslint/prettier clean.
- [x] **Core-library expansion built (§5.3)** — Tier 1 layout (Section/Container/Grid/Stack), Tier 2
      color-bearing (Badge/Tag/Alert/Callout/Avatar/Label), Tier 2b structural
      (Skeleton/Spinner/Progress/Breadcrumb/Pagination), Tier 3 forms
      (Input/Textarea/NativeSelect/Checkbox/Radio+RadioGroup/Switch/Field). Exported, partials
      imported (recipes.css last), **98 tests**, tsc/eslint clean, `dist/styles.css` compiles
      (plain CSS, `--st-*` preserved, no preflight).
- [x] **Tier 4 interactive built (§5.4)** — Accordion/Collapse/Tabs/Tooltip/Dialog/Drawer/
      DropdownMenu/Popover on `@radix-ui/react-*` (behavior only) wrapped in `st-*` classes; the
      team-lead chose Radix over hand-authoring. Client islands; jsdom polyfilled for tests.
- [x] **Full daisyUI-class catalog built (§5.4)** — color-bearing (Link/Status/Steps/RadialProgress/
      ChatBubble/Range/Rating/FAB/Filter/FileInput) + structural (Kbd/Hero/Footer/Navbar/Menu/Dock/
      List/Table/Indicator/Join/Mask/Toast/Countdown/Diff/Hover3DCard/HoverGallery/TextRotate/Swap/
      Calendar/Validator/ThemeController + Browser/Code/Phone/Window mockups). ThemeController drives
      `data-theme` light/dark/system (one active brand), not a multi-named-theme picker.
- [x] Gate green for the whole library: **142 tests** across 16 files, tsc/eslint clean,
      `dist/styles.css` compiles (~101 KB plain CSS, `--st-*` preserved, `@apply` fully resolved, no
      preflight).
- [ ] **Button migration PULLED FORWARD** — team-lead wires `builder-renderer.tsx` + the editor
      canvas at `<Button>` and adds the `styles.css` imports (site-ui delivers; lead wires).
- [ ] **HOLD: the rest of the §7 migration** — gated on the Tesla page being built + verified on
      the inline renderer (the parity baseline), then a coordinated leaf-by-leaf swap.
