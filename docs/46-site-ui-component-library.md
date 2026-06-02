# 46 — `@sparx/site-ui`: The Tenant-Themed Component Library

Version: 1.2
Author: Brandon Korous
Last Updated: 2026-06-02

> The Builder composition model ([40](40-sitebuilder-composition-model.md)) walks a
> node tree; the storefront render path ([44](44-builder-storefront-render.md)) turns a
> published tree into live markup; the editor canvas previews the same tree inside the
> dashboard. Today the **leaf and container visuals** in those two render paths are written
> **twice** — once as `.bx-*` CSS in the editor canvas, once as inline styles in the
> storefront renderer — and they drift. This doc defines **`@sparx/site-ui`**, a single
> tenant-themed component library that **both** paths consume, so the editor renders the exact
> components the storefront ships: _what you see is what you ship._

---

## 1. The problem

A Builder primitive — say a CTA button or a photo panel — exists in two places:

| Surface             | Where                                                                          | How it's styled                              |
| ------------------- | ------------------------------------------------------------------------------ | -------------------------------------------- |
| **Editor canvas**   | `apps/dashboard/app/(dashboard)/builder/_builder/registry.tsx` + `builder.css` | `.bx-btn`, `.bx-btn--primary`, … (`--bxc-*`) |
| **Live storefront** | `apps/storefront/components/builder-renderer.tsx`                              | inline `style={buttonStyle(...)}` (`--sf-*`) |

Two implementations of one thing. The canvas knows `primary | soft | link`; the storefront
(after the Tesla work) knows `primary | soft | dark | glass | link`. They already disagree.
Every new primitive doubles the surface area and the drift. The north-star goal — recreate a
reference landing page so the preview **exactly matches** production — is structurally
impossible while the preview and production are different code.

**`@sparx/site-ui` collapses both into one set of components**, themed entirely by the tenant
`--sf-*` tokens. The storefront renderer and the editor canvas both render these components.
The preview cannot drift from production because they are the same code.

---

## 2. The boundary: `@sparx/ui` vs `@sparx/site-ui`

Two component libraries, cleanly split by **whose brand they wear**:

| Library                     | Theme tokens                                          | Wears the brand of    | Consumers                                                         |
| --------------------------- | ----------------------------------------------------- | --------------------- | ----------------------------------------------------------------- |
| `@sparx/ui` (`packages/ui`) | `--color-*`, `--module-active`, `--sparx-*`           | **Sparx** (the admin) | `apps/dashboard`, marketing `apps/web`                            |
| `@sparx/site-ui` (this doc) | `--sf-*` (Token Model v2, [33](33-token-model-v2.md)) | **the tenant**        | `apps/storefront` chrome, the Builder renderer, the editor canvas |

They never overlap. `@sparx/ui` is the operator's tools, in Sparx Indigo. `@sparx/site-ui` is
the tenant's published site, in the tenant's brand. The dashboard chrome around the Builder
(toolbar, rail, inspector) stays `@sparx/ui`; only the **canvas content** — the tenant's site
preview — is `@sparx/site-ui`.

**What `site-ui` owns.** The renderer keeps its tree-walking engine (box → CSS, layout, binding,
iteration, scope). `site-ui` owns the **leaf and container _components_** that engine renders:
Button, the photo-panel surface (box base → background image + overlay scrim + text tone),
Heading, Text, Image, Divider, PriceTag, NavMenu, Logo, SocialLinks, plus the Tesla-era
additions (Carousel, Video, Map, Stat). The engine maps box/layout semantics to style; the
components own the **treatment** (variants, surfaces, type scale).

**The hard rule.** No component hardcodes a color. Every value resolves to a `--sf-*` token, or
to a **documented fallback** baked into the `var()` call (`var(--sf-primary, #3f6b52)`) for the
handful of cases where the producer doesn't emit the token yet (§4). This is the same discipline
`@sparx/ui` follows with `--color-*`.

---

## 3. Decisions

### 3.1 Styling mechanism — self-contained semantic CSS keyed on `--sf-*` (NOT Tailwind utilities, NOT inline styles)

This is the load-bearing decision. Three candidates were on the table:

1. **Tailwind utility classes** (what `@sparx/ui` does). Rejected for `site-ui`: it would force
   _every_ consumer's Tailwind build to scan `packages/site-ui/**` into its `content`, and the
   dashboard's Tailwind theme maps utilities like `bg-primary` to the **admin** palette
   (`--color-*`), not the tenant's. We'd be reduced to arbitrary-value classes
   (`bg-[var(--sf-primary)]`) everywhere — Tailwind buying us nothing while adding a build
   coupling and a real risk of the canvas resolving the wrong palette.
2. **Inline styles** (what the storefront renderer does today). Self-contained and FOUC-free,
   but inline styles **cannot express `:hover` / `:focus-visible` / `:disabled`** — a real
   component library needs interaction states. (The current storefront buttons have none.)
3. **Self-contained semantic CSS, authored once against `--sf-*`, shipped as a stylesheet.**
   ✅ **Chosen.**

`site-ui` components emit **semantic class names** (`sf-btn sf-btn--primary`) and ship a single
token-driven stylesheet (`@sparx/site-ui/styles.css`). This is exactly the established pattern in
this repo — `storefront.css` and `builder.css` are both plain token-driven CSS, and `@sparx/ui`
already ships `tokens.css`. It gives us:

- **One source of visual truth** consumed identically by storefront and canvas — no per-consumer
  Tailwind wiring, no palette ambiguity.
- **Full interaction states** (`:hover`, `:focus-visible`, `:disabled`) that inline styles can't do.
- **No FOUC**: a static stylesheet in the document head paints with the first frame, same as
  `storefront.css`/`builder.css` today.
- **Server-renderable**: emitting a `className` requires no client runtime.

**Division of labor between class and inline.** Visual _treatment_ (variant, surface, tone) →
**class**. Per-node _data_ that can't be a class (a background-image URL, a grid column count, a
gap value chosen by the box/layout engine) → **inline style**, set by the renderer's existing
box→CSS layer. Components own the former; the engine owns the latter. They compose on one element.

### 3.2 SSR-first, selective `'use client'`

The storefront is server-rendered; the canvas is a client tree. Components must work in both, so
they are **server components by default** — they emit markup + class names with no client runtime.
Only components that genuinely need browser state opt into `'use client'`:

| Component                                                                                     | Boundary                                                                 |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Button, Heading, Text, Image, Divider, PriceTag, Logo, NavMenu, SocialLinks, Stat, Map, Video | **Server** — pure markup + classes (Map/Video are `<iframe>`s; no state) |
| Carousel                                                                                      | **`'use client'`** — index state, autoplay timer, drag                   |

`'use client'` is a per-file boundary at the leaf, so importing `site-ui` from a server component
(the storefront renderer) stays server-side except where a client island is actually used. This
mirrors `@sparx/ui`'s selective-`'use client'` discipline ([23](23-frontend-component-architecture.md)).

### 3.3 No canonical token ownership — `site-ui` _consumes_, `storefront-themes` _produces_

`@sparx/storefront-themes` is the single producer of `--sf-*` (`buildThemeCssV2` /
`compileThemeForTenant`, [33](33-token-model-v2.md)). `site-ui` never emits a canonical token
file — that would create a competing source of truth. It only **reads** `--sf-*`, with inline
fallbacks for graceful degradation. The token contract `site-ui` depends on is enumerated in §4.

### 3.4 Package shape mirrors `@sparx/ui`

`type: module`, `private`, `exports` map with subpath entries, `tsconfig` extends
`tsconfig.base.json` with `declaration: false` / `declarationMap: false` (source-only workspace
package, same as `@sparx/ui`). React/`react-dom`/`tailwindcss` are **peer** deps so the consuming
app owns the single React copy. The package ships **no Tailwind config** — it doesn't author
utilities (§3.1).

### 3.5 Class-name prefix: `sf-`

All `site-ui` classes are prefixed `sf-` (e.g. `sf-btn`, `sf-c-primary`, `sf-v-solid`,
`sf-carousel__slide`), matching the `--sf-*` token namespace and clearly distinct from the editor
chrome's `bx-*` and `@sparx/ui`'s Tailwind output. The legacy `.bx-*` canvas classes are retired
during migration (§7).

### 3.6 The variant recipe is the foundation — four-axis `color × variant × size`, for ALL color-bearing elements

**This is load-bearing and applies to every color-bearing component, not just Button** (docs/35).
There is no flat `variant: primary | soft | …` enum anywhere — `primary` is a **color**, `soft` is a
**treatment**. site-ui ships the `--sf-*` analog of `@sparx/ui`'s `_recipes/variants.ts`
([packages/site-ui/src/components/\_recipes/variants.ts](../packages/site-ui/src/components/_recipes/variants.ts)
\+ [styles/recipes.css](../packages/site-ui/src/styles/recipes.css)):

- **`color` axis** — a `.sf-c-{color}` role-var class (the `--sf-*` analog of tokens.css `.sx-c-*`)
  that maps the five role vars `--c-bg / --c-fg / --c-ink / --c-hover / --c-tint` from `--sf-*`
  (oklch mixes toward the readable ink, mirroring `@sparx/ui`). Slots: `primary, secondary, accent,
neutral, info, success, warning, danger` **+ `surface`** (base-100 fill / base-content ink — the
  light-glass / chrome case). Any string is accepted (`color="brand-mint"`) once a matching
  `.sf-c-*` rule exists.
- **`variant` axis** — treatments authored **once** in CSS against the `--c-*` role vars:
  `solid · soft · outline · dashed · ghost · link · glass`. `color × variant` composes through the
  role vars — **no cartesian product, no codegen**. `chipTreatmentVariants` is the reduced subset
  (solid/soft/outline/dashed) for chips/badges.
- **`size` axis** — the shared `sm | md | lg` scale; what each step means dimensionally is the
  component's own CSS (e.g. `.sf-btn--sz-md`).

Every color-bearing component is a **thin consumer**: it emits
`cx('sf-{component}', colorClass(color), treatmentVariants[variant], sizeClass(size))`. `recipes.css`
is imported **last** so a treatment's resets (e.g. `.sf-v-link` → `padding:0`) win over size classes.

---

## 4. The token contract (`--sf-*` `site-ui` consumes)

These are produced by `@sparx/storefront-themes` (`colorVars` + `sharedVars` in
`packages/storefront-themes/src/v2/css.ts`) and declared as fallbacks in `apps/storefront/app/storefront.css`.
Every `site-ui` class reads from this set:

**Color** — `--sf-base-100/200/300`, `--sf-base-content`, `--sf-primary` (+ `-content`, `-hover`,
`-active`, `-tint`), `--sf-secondary` (+ `-content`), `--sf-accent` (+ `-content`, `-tint`),
`--sf-neutral` (+ `-content`), `--sf-info/success/warning/danger` (+ `-content`), `--sf-border`.
Text tiers: `--sf-text-secondary`, `--sf-text-muted`, `--sf-text-tertiary`.

**Shape** — `--sf-radius-selector`, `--sf-radius-field`, `--sf-radius-box`, `--sf-border-width`.

**Type** — `--sf-font-heading`, `--sf-font-body`, `--sf-font-fallback`.

**Rhythm / layout** — `--sf-space-base`, `--sf-space-{1..24}`, `--sf-container` (alias `--sf-max`).

**Effect** — `--sf-shadow-sm/md/lg`, `--sf-depth`.

### 4.1 Overlay/scrim tokens — SUPERSEDED by the recipe (glass × surface/neutral)

> **Superseded 2026-06-02.** An earlier pass added `--sf-overlay-dark/-content/-light/-content` to
> the producer for flat `dark`/`glass` buttons. With the four-axis recipe (§3.6) those CTAs are now
> **compositions** — `glass × neutral` (frosted dark) and `glass × surface` (frosted light) — so the
> standalone overlay tokens were **removed** from the producer as redundant. The `glass` treatment
> frosts `--c-bg` at ~82% over transparent + backdrop-blur; the Carousel arrows dogfood the same
> `glass × surface`. Recorded here for history; no consumer reads `--sf-overlay-*`.

<details><summary>Original (pre-recipe) proposal — kept for the record</summary>

The `dark` and `glass` button variants the team-lead shipped are **legibility scrims over arbitrary
photos**, not tenant-brand colors — a tenant's `--sf-primary` over a busy hero photo is often
illegible, so these are deliberately a frosted near-black / near-white. To honor "no hardcoded
color" while staying faithful to the shipped look, `site-ui` reads them through **dedicated tokens
now emitted by the v2 producer** (`sharedVars` in `packages/storefront-themes/src/v2/css.ts`), with
the team-lead's exact values; `site-ui` CSS also keeps them as `var()` fallbacks for graceful
degradation:

| Token                        | Fallback (matches `builder-renderer.tsx`) | Meaning                     |
| ---------------------------- | ----------------------------------------- | --------------------------- |
| `--sf-overlay-dark`          | `rgba(23, 26, 35, 0.78)`                  | frosted dark scrim surface  |
| `--sf-overlay-dark-content`  | `#ffffff`                                 | text on the dark scrim      |
| `--sf-overlay-light`         | `rgba(255, 255, 255, 0.86)`               | frosted light scrim surface |
| `--sf-overlay-light-content` | `#171a23`                                 | text on the light scrim     |

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
thin client wrapper), so they render in both the server storefront and the client canvas.

> **Status: the full first wave is now BUILT** greenfield in `packages/site-ui` (gate green;
> migration still on hold per §7). Each component below emits `sf-*` classes against the §4 tokens
> and ships a CSS partial aggregated into `styles.css`.

### 5.1 `Button` — the reference consumer of the recipe (§3.6, §6)

```ts
interface ButtonProps {
  color?: ColorKey | (string & {}); // default 'primary' — sf-c-{color}
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

Emits `cx('sf-btn', colorClass(color), treatmentVariants[variant], 'sf-btn--sz-' + size, className)`.
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

---

## 6. The reference component: `Button`

The first/reference consumer of the recipe (§3.6), proving the whole contract end to end:

- **Server component** (no `'use client'`) — emits `<a>`/`<button>` + classes; no client runtime.
- **Themed only by `--sf-*`** — Button owns nothing but base layout + the `sm/md/lg` padding scale
  in `styles/button.css`; all color/treatment comes from the shared `.sf-c-*` / `.sf-v-*` recipe.
  No hardcoded color. (The focus ring picks up the active `--c-bg`.)
- **Renders identically in both contexts.** The storefront defines `--sf-*` globally (via
  `storefront.css`); the editor canvas defines a compiled `--sf-*` block scoped to `.bx-canvas`
  (today aliased to `--bxc-*`; see `builder.css`). Because `.sf-c-primary` reads `--sf-primary`
  directly, the **same button** picks up the tenant brand in the storefront and the same compiled
  brand in the canvas — no per-context code.

`vitest` asserts each axis (color → `sf-c-*`, variant → `sf-v-*`, size → `sf-btn--sz-*`), the
runtime-custom color, the `glass × neutral` / `glass × surface` compositions, and the `href`→`<a>` /
no-`href`→`<button>` polymorphism; a recipe test covers `colorClass`, `treatmentVariants`, and the
`chipTreatmentVariants` subset.

---

## 7. The canvas ↔ storefront unification plan (LATER — coordinated)

Greenfield work (the doc, the scaffold, Button) touches nothing else. The migration is a separate,
coordinated pass **after the team-lead's Tesla primitives land**, executed roughly in this order:

1. **Land `styles.css` import points.** Add `import '@sparx/site-ui/styles.css'` to the storefront
   root layout (after `@sparx/ui/tokens.css`/`storefront.css`) and to the `/builder` editor route.
   Static stylesheet → no FOUC.
2. **Point the storefront renderer at `site-ui`.** Replace `buttonStyle`/leaf inline styles in
   `builder-renderer.tsx` with `site-ui` components, leaf by leaf. The box/layout engine and
   binding resolution are untouched — only the leaf/container _visuals_ move.
3. **Point the editor canvas at `site-ui`.** Replace the `.bx-*` leaf rendering in `registry.tsx`
   with the same `site-ui` components. The canvas already compiles `--sf-*` onto `.bx-canvas`, so
   the components theme correctly. The `--bxc-*` aliases become a thin compatibility shim and are
   then deleted from `builder.css`; the leaf `.bx-*` rules go with them.
4. **Verify parity.** With both paths on `site-ui`, the canvas preview and the published page are
   the same components — confirm against the reference landing page (the team's north star).

**No-FOUC guarantee.** Because treatment is a static, head-loaded stylesheet (not runtime-injected
styles), the first paint is already themed in both SSR (storefront) and client (canvas) — there is
no unstyled frame to flash.

### 7.1 New-package wiring checklist (migration-time, do NOT do during greenfield)

- **Dockerfile COPY.** Each consumer image (`apps/storefront`, `apps/dashboard`) must add
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
    styles/               # one CSS partial per component, all --sf-* keyed
      recipes.css         # THE FOUNDATION: .sf-c-{color} + .sf-v-{variant} (§3.6)
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
   `.sf-c-*` / `.sf-v-*` recipe. Button is the first/reference consumer. (Corrected from an earlier
   flat-`variant` Button.) Audit of the built set: only Button is color-bearing; `Text`/`Heading`
   variants are typographic roles (same split as `@sparx/ui`), the rest are structural — nothing
   else needed conversion.
2. **`PhotoPanel` (§5.2) — HELPER.** `photoPanelStyle()` returns `CSSProperties` for the box→CSS
   engine to compose; no wrapping component.
3. **Button interactivity (§6) — server base.** Base `Button` stays server/presentational;
   interactive CTAs get a thin `'use client'` wrapper later.
4. **Overlay tokens (§4.1) — SUPERSEDED.** The dark/glass scrim pair became `glass × neutral` /
   `glass × surface`; the standalone `--sf-overlay-*` producer tokens were removed.

---

## 10. Status

- [x] §1–§9 decisions locked + approved by team-lead.
- [x] Scaffold `packages/site-ui` (§8).
- [x] **Variant recipe** (`_recipes/variants.ts` + `recipes.css`) — the four-axis foundation (§3.6).
- [x] `Button` reworked to four-axis `color × variant × size` as the reference consumer (§5.1, §6).
- [x] Full first-wave inventory built greenfield (§5); `--sf-overlay-*` removed (§4.1, superseded).
- [x] Gate green: site-ui **51 tests**, storefront-themes **55 tests**, tsc/eslint/prettier clean.
- [ ] **Button migration PULLED FORWARD** — team-lead wires `builder-renderer.tsx` + the editor
      canvas at `<Button>` and adds the `styles.css` imports (site-ui delivers; lead wires).
- [ ] **HOLD: the rest of the §7 migration** — gated on the Tesla page being built + verified on
      the inline renderer (the parity baseline), then a coordinated leaf-by-leaf swap.
