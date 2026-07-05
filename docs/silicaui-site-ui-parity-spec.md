# silicaui → `@sparx/site-ui` Parity Spec

**Version:** 1.2
**Author:** Brandon Korous / WizeWorks
**Last Updated:** 2026-07-05

> **Purpose.** silicaui is a WizeWorks product: a daisyUI-class CSS component library **plus** React components (on Base UI), built as an extension of Tailwind CSS, with **N arbitrary named theme colors** (not daisyUI's fixed slot set). This doc specifies **exactly what silicaui must do before it can replace `@sparx/site-ui`** in the sparx platform — i.e. render every published tenant site, drive the Builder editor canvas, and compile per-tenant themes without regressing a single capability.
>
> **Read this first, one line:** replacing `@sparx/site-ui` is **not** "ship a component library." site-ui is one node in a rendering pipeline whose load-bearing contracts are the token model, an orthogonal recipe, a **class-name vocabulary that is persisted tenant data**, a dual (global + canvas-scoped) build, and a security allowlist. The components are ~40% of the work; the machinery is the other ~60%. This spec enumerates all of it as a checklist with acceptance tests.

---

## 0. The pipeline silicaui drops into

```
builder catalog  (data-as-code class trees)     ← authored against EXACT class strings; tenant pages persist as these trees
        │
        ▼
site-themes v2   (tenant hex → --st-* tokens)    ← WCAG auto-contrast -content + color-mix derivations
        │
        ▼
surface-compile  (token wiring + allowlist)       ← author utilities resolve to --st-*; security choke point
        │
        ▼
@sparx/site-ui   (recipe + ~90 components)        ← .st-c-* × .st-v-* × size; a small Radix subset for interactivity
        │
        ├──►  dist/styles.css           (live site — apps/site)
        └──►  dist/styles.canvas.css    (@scope (.bx-canvas){…} — the Builder editor canvas)
```

Three surfaces consume the output, and silicaui must serve **all three**: (1) the **live published site**, (2) the **Builder renderer**, (3) the **editor canvas** (a preview embedded inside the dashboard, which runs its _own_ Tailwind for chrome).

**Source-of-truth files in the sparx repo (for cross-reference while building silicaui):**

| Concern                                   | File                                                   |
| ----------------------------------------- | ------------------------------------------------------ |
| Tenant color math                         | `packages/site-themes/src/v2/color.ts`                 |
| `@theme` token remap                      | `packages/surface-compile/src/theme.ts`                |
| Security allowlist                        | `packages/surface-compile/src/allowlist.ts`            |
| Component recipe (color × variant × size) | `packages/site-ui/src/components/_recipes/variants.ts` |
| Canvas-scoped build step                  | `packages/site-ui/scripts/scope-canvas.mjs`            |
| Catalog authoring contract                | `packages/builder-schemas/src/catalog/CONTRACT.md`     |
| Theme presets                             | `packages/site-themes/src/presets/*`                   |

---

## 1. Runtime tenant theming (the "change brand → write the CSS" core)

This is the headline capability and it is subtler than "N named colors." A tenant stores base colors as **hex**; the platform must turn that into a complete, legible, light+dark theme at compile time, referenced by every authored utility.

**Requirements**

- [ ] **N first-class named theme colors.** Arbitrary named colors (not a fixed 8-slot set). This is silicaui's key advantage and it directly retires sparx's `ModuleProvider` / `--module-active` indirection: module hues (`commerce`, `crm`, `builder`, …) become _native_ theme colors.
- [ ] **The utility → token contract** — every `bg-primary` / `text-base-content` / `border-base-200` / `rounded-box` / `gap-6` / `shadow-md` resolves to a per-tenant `--st-*`-style CSS variable, so **no baked color literal reaches the compiled output** and one sheet re-themes at runtime by swapping `:root` vars (the same model as a daisyUI `data-theme` switch). **The delivery mechanism is silicaui's choice, not part of the contract.** sparx hand-authors this as a Tailwind `@theme` block (`packages/surface-compile/src/theme.ts`); silicaui delivers the _same output_ via `@plugin "silicaui/theme"` (the model daisyUI v5 itself uses) — that is fully equivalent and preferred. What must hold either way: the §4 utility vocabulary still compiles, the output references vars (never hex), and it can be imported **selectively** (see isolation, next).
- [ ] **Isolation + canvas-scopeability** — whichever mechanism, the token wiring must apply **only where imported** (the tenant-site + canvas entrypoints, **never** the dashboard's own Tailwind), so `bg-primary` maps to `--st-*` on sites while the dashboard keeps its own `--color-*` palette — no cross-contamination. And the emitted `:root` / `:host` theme-var block must stay **retargetable to `:scope`** for the canvas build (§5), with any `@property` / `@layer` nesting cleanly under `@scope`.
- [ ] **`-content` is a consumed var — silicaui does NOT compute contrast.** Two color populations, different sources:
  - **Platform-fixed colors** (module hues like `module-cms`; semantics like `success` / `danger`) are known at build time and never tenant-overridden → silicaui ships `-content` with a hand-picked readable default. No runtime math.
  - **Tenant-runtime brand colors** (`primary` / `secondary` / `accent` / `base-*` on sites) are arbitrary hex. Their AA-legible `-content` is derived **dashboard-side** — the brand UI + `@sparx/site-themes` already do the WCAG contrast pick — and injected as a `:root` token. **silicaui only consumes it:** every foreground resolves `var(--st-<name>-content, <readable-default>)`, so the injected value wins for tenant brand and the default covers the fixed / unthemed case. silicaui must **never hardcode a foreground** — that var indirection is exactly what lets the derivation be controlled from the UI. (WCAG contrast can't be done reliably in pure CSS, so _someone_ must compute it; the point is that someone is the sparx side, not silicaui.) Everything else (hover, active, tint) is `color-mix(in oklab …)` off the base var.
- [ ] **Every color exposes its `-content` as a settable, default-backed var** (per above), plus a `base-100 / base-200 / base-300` surface scale + `base-content` ink.
- [ ] **All non-color design axes tokenized too:** radius (`box` / `field` / `selector`), shadow scale (`sm` / `md` / `lg`), fonts (`heading` / `body`), a spacing base unit that reflows the whole numeric scale, and a container width.
- [ ] **Light + dark derivation** for every token.
- [ ] **Per-slot override escape hatch** — a tenant may override any derived `-content` (or any token) explicitly (full-parity requirement; the derivation is a smart default, not a cage).

**Acceptance test.** A tenant sets `primary = #7c3aed` in the dashboard (which derives the AA `-content` and injects both as `:root` tokens) and publishes. Across the live site, the editor canvas, **and** email: every `bg-primary`, soft/hover treatment, and `text-primary-content` updates and stays **AA-legible in both light and dark**, with silicaui's component sheet referencing only `var(--st-*)` + `color-mix()` — the sole resolved hex lives in the UI-injected `:root` block, never in silicaui's output.

---

## 2. The orthogonal recipe (color × variant × size)

The friendly flat naming (`st-btn-secondary st-btn-soft st-btn-md`) is **endorsed** and is better than the current axis-coded spelling (`st-c-secondary st-v-soft st-btn--sz-md`) — _provided the mechanism stays orthogonal underneath._

Today: a `st-c-*` class **sets** role vars (`--c-bg` / `--c-fg` / `--c-ink` / `--c-hover` / `--c-tint`); a `st-v-*` treatment class **reads** them. So any color × any treatment is **N + M classes, not N × M** — no cartesian product, no codegen.

**Requirements**

- [ ] **Keep flat names mapping to var composition.** Rename the _spelling_ freely; keep the _mechanism_. Do **not** emit combinatorial classes (`btn-secondary-soft`) — that is the daisyUI CSS-bloat trap and it breaks runtime-custom colors.
- [ ] **Three treatment vocabularies** (all already in use, all required):
  - **Full** (buttons): `solid` · `soft` · `outline` · `dashed` · `ghost` · `link` · `glass` (glass = low-alpha bg + backdrop-blur, the legibility scrim over photos).
  - **Chip** (badges): `solid` · `soft` · `outline` · `dashed`.
  - **Field** (inputs/textarea/select/file): `outline` · `filled` · `ghost` — authored so the fill/border is the _sole_ source on the field element and color × treatment composes like buttons.
- [ ] **Runtime-custom color works** — a brand-new color name resolves the moment its role-var rule exists (no rebuild of the component).
- [ ] **Size scale `xs … xl`**, with each step's dimensional meaning defined per-component (a button's padding ≠ a card's).

⚠️ **Naming landmine: it is `danger`, NOT `error`.** daisyUI uses `error`; sparx deliberately uses `danger` and the _entire builder catalog is authored against `danger`_. silicaui must adopt `danger` (or provide an `error → danger` alias), or the catalog and every persisted tenant page break.

**Acceptance test.** Any of N colors × any of M treatments renders correctly with **no** cartesian CSS. Introducing a runtime color name (`brand-mint`) with only its role-var rule makes `st-btn-brand-mint st-btn-soft` work immediately.

---

## 3. Component coverage (~90 components, with named parts)

silicaui must reach **1:1 parity** with site-ui's exported component surface — the daisyUI-shaped set, including but not limited to: navbar (with `start` / `center` / `end` zones), hero, card (with `body` / `title` / `actions` parts), section, container, grid, stack, dock, join, mask, diff, chat-bubble, countdown, rating, radial-progress, progress, phone/browser mockups, carousel, faq, footer, menu, nav-menu, collapsible-nav, breadcrumb, pagination, alert, callout, badge, avatar, indicator, kbd, price-tag, rating, list, table, code, image, video, map, signup, field/input/textarea/select/file-input/checkbox/radio/range/label.

**Requirements**

- [ ] **Server-first.** Components are server components by default; `'use client'` **only** where interactivity requires it.
- [ ] **Compound components expose named PARTS** the catalog composes into (e.g. card body/title/actions; navbar start/center/end).
- [ ] **"BASIC" structural components** expose slots but compose nothing themselves — the author fills them (navbar is the canonical example: a bar shell + three empty zones).
- [ ] **The interactive subset on Base UI.** The genuinely-interactive components (accordion, collapsible, dialog/drawer, dropdown-menu, popover, tabs, tooltip — the seven Radix packages site-ui uses today) move to Base UI. They must be **RSC/SSR-safe** and keyboard/focus/ARIA-correct. _This is the cleanest-scoped part of the whole migration — Base UI replaces Radix directly under the styling layer, no token/recipe changes needed._

**Acceptance test.** Every component and part currently exported by `@sparx/site-ui` has a silicaui equivalent with the same composition shape; the Builder renderer and canvas mount them unchanged.

---

## 4. The class-name vocabulary is a hard DATA contract (the sharp edge)

The Builder catalog is **data-as-code authored against exact class strings**, and — critically — **tenant pages are persisted in the database as class trees.** So the class vocabulary silicaui emits is not cosmetic; it is a **data schema** with stored instances.

**The utility surface the catalog depends on (must all compile under silicaui):**

- Surfaces/ink: `bg-base-100|200|300`, `text-base-content` (+ opacity `text-base-content/60`), `border-base-200|300`.
- Brand/semantic (each with a `-content` foreground): `primary`, `secondary`, `accent`, `neutral`, `info`, `success`, `warning`, **`danger`** (not `error`), `highlight` — e.g. `bg-primary text-primary-content`, `bg-success/10 text-success`, `border-danger text-danger`. Plus `surface` (the neutral chrome slot: base-100 fill / base-content ink).
- Radius: `rounded-box` (cards/panels) · `rounded-field` (inputs/buttons) · `rounded-selector` (chips) + standard `rounded-full` / `rounded-lg`.
- Shadow: `shadow-sm|md|lg`. Motion: `animate-fade-in|fade-up|scale-in|…` + the continuous-motion library (`animate-marquee`, `float`, `ken-burns`, `shimmer`, …).
- The full standard Tailwind spacing/layout scale (`p-*`, `gap-*`, `flex`, `grid`, `grid-cols-*`, `w-*`, `max-w-*`, `items-*`, `justify-*`).
- **Container queries (`@3xl:flex`, `@2xl:grid-cols-2`) — NOT viewport (`md:` / `lg:`).** The canvas keys off each node's **own** width, not the viewport. Multi-column layouts must collapse to one column on narrow containers.

**Requirement**

- [ ] silicaui must honor this exact vocabulary **or** ship an alias/codemod (see §11). Because the classes are _stored tenant data_, a rename is a **data migration**, not a find-and-replace.

**Acceptance test.** Every class string emitted by the catalog, by the built-in blueprints, **and** by a sample of persisted production tenant pages compiles under silicaui and renders identically.

---

## 5. Dual build output (global + canvas-scoped)

silicaui must emit **two** stylesheets from one source:

- [ ] **`styles.css`** — loaded globally by the live site (the whole document is the tenant "world").
- [ ] **`styles.canvas.css`** — the **entire sheet wrapped in `@scope (.bx-canvas) { … }`**, with `:root, :host` retargeted to `:scope` (the canvas element itself, since the document root sits _outside_ the scope). This is because the sheet also carries generic Tailwind utilities (`.container`, `gap-*`), a `:root` token block, and `*` property defaults that would **collide with the dashboard's own Tailwind chrome** if loaded globally in the editor. `@property` and `@layer` must nest cleanly inside `@scope`.

**Acceptance test.** The Builder editor canvas renders tenant styles fully themed **and** fully isolated — no tenant utility, `:root` token, or reset leaks into the surrounding dashboard UI.

---

## 6. The security allowlist (non-negotiable, never relaxable)

Author-typed **and** AI-generated class strings pass through a single compile choke point before becoming CSS. silicaui's utility surface must route through the **same** gate — "just extending Tailwind" reintroduces the exact utilities this denylist exists to stop.

**Platform base denylist (hardcoded, a tenant may only _tighten_, never unblock):**

- [ ] `fixed` — `position: fixed` (clickjacking overlay).
- [ ] arbitrary `z-[…]` — z-index escalation (`z-[9999]`); the bounded `z-0 … z-50` scale (+ named `z-60/70/80`) stays available.
- [ ] `content-[…]` — CSS content-injection vector.
- [ ] any `url(…)` anywhere in a token (e.g. `bg-[url(…)]`) — external load / exfiltration. Backgrounds go through the image picker.

**Related invariants:**

- [ ] **Guarded `.st-fixed-*` classes are the ONLY sanctioned `position: fixed`** — each pins to one edge/corner with a capped cross-axis (`max-height: 50vh` / `max-width: 33vw`, corners size-capped), so **none** can become a full-viewport `inset: 0` overlay.
- [ ] **Bounded named z-scale** — no arbitrary z-index; named rungs only.
- [ ] **Tenant governance can add MORE blocks** (prefix/exact/substring rules) but the insecure state is un-representable — there is no "unblock."

**Acceptance test.** Nothing silicaui adds to the utility surface allows a full-viewport fixed overlay, an arbitrary `url()` load, or `content-[…]` injection; the existing `validateClasses` partition (allowed / blocked) behaves identically on silicaui's output.

---

## 7. Behavior-runtime integration

A small, closed, platform-authored runtime drives the interactive composites (autoplay carousel, continuous marquee, single-open accordion/disclosure, JS-wired tabs, click-open menu/mega-menu, scroll-adaptive nav). silicaui components must expose the hooks this runtime drives.

**Requirements**

- [ ] Behaviors are authored via sanctioned `behave(node, {type,…})` / `part(node, role)` markers — **never raw `data-*`** (the element whitelist strips those). Types: `carousel` · `marquee` · `disclosure` · `tabs` · `menu` · `scrollspy`. Roles: `track` · `slide` · `prev` · `next` · `dot` · `trigger` · `panel` · `item` · `tab`.
- [ ] The runtime runs in **both** surfaces: the live site gets full behavior; the canvas suppresses autoplay and reveals collapsed panels for editing.
- [ ] **Closed panels ship `hidden`** (a sanctioned attribute) so they don't flash open before hydration.
- [ ] `common` blocks prefer **CSS-only** interactivity (native `details`/`summary`, `peer` checkbox toggles, `overflow-x-auto snap-x` scrollers) — no runtime needed.

**Acceptance test.** silicaui's interactive components mount under the existing behavior runtime with no dependence on a client framework the runtime can't see; carousels/marquees/menus/tabs behave on the live site and preview correctly (autoplay off) in the canvas.

---

## 8. Email is a different medium

Email is rendered by mail clients from **inline styles**, not the tenant stylesheet. silicaui's email-eligible components must degrade to that reality.

**Requirements**

- [ ] **Named nodes only** — no raw HTML elements on the email surface; compose from `Section` / `Stack` / `Grid` / `Card` containers and `Heading` / `Text` / `Button` / `Divider` / `ImageDisplay` / `line_item_table` / `unsubscribe_link` / `physical_address` leaves.
- [ ] **Base classes only** — no variants (`@3xl:` / `md:` / `hover:` / `dark:`), no arbitrary `[…]`. The email compiler drops anything prefixed or bracketed.
- [ ] **Honored subset only** — containers: `flex flex-col|flex-row` / `grid grid-cols-N` / `gap-N` / `p-N` / `bg-*`; leaves: text size/weight/leading/tracking, `text-*`/`bg-*`/`border-*` color, alignment, padding/margin, border, radius. Shadows/filters/transforms/sizing/position **no-op** in mail.
- [ ] The wordmark header is **pinned and auto-injected** — a second one is de-duped.

**Acceptance test.** Every silicaui component tagged email-eligible compiles to inline styles under the honored subset and renders in a real mail client.

---

## 9. Accessibility & motion baseline

- [ ] **Reduced-motion neutralization by default** — under the OS "reduce motion" setting, every entrance and continuous animation is neutralized (accessible-by-default).
- [ ] **AA contrast guaranteed** by the `-content` derivation (§1) on arbitrary tenant colors.
- [ ] **Focus-visible rings + full keyboard nav** on the interactive set (Base UI provides this; verify it survives the styling layer).

**Acceptance test.** Toggling OS reduce-motion stops all animation; AA holds on a spread of hand-picked adversarial tenant hex values.

---

## 10. Presets & saved themes round-trip

- [ ] The preset packs (currently: `apex`, `industrial`, `drift`, `market`, `fleet`, `drop`) express as silicaui theme configs.
- [ ] Tenant **saved themes** (create / apply) and **per-mode brand-identity overrides** (theme overlay v2 — a tenant can override brand identity per light/dark mode) round-trip losslessly.

**Acceptance test.** Every existing preset and a sample of tenant saved themes import into silicaui and produce a visually identical site.

---

## 11. Migration strategy (this determines feasibility)

Two invariants — **the class vocabulary (§4)** and **the token names (§1)** — are the _entire_ migration surface, because **tenant pages are stored data, not just code.** Two paths:

### Path A — silicaui speaks sparx's contract (do this first)

silicaui adopts sparx's exact class + token vocabulary (`st-*` classes, `--st-*` tokens, `danger` not `error`). **Drop-in:** no catalog migration, no DB data migration. silicaui carries sparx's naming, but you can pilot it on the **live site layer tomorrow** and prove parity end-to-end. This is the deploy-early / deploy-small path.

### Path B — silicaui uses its own nicer vocabulary (later, deliberate)

silicaui uses friendlier names (e.g. the `st-btn-soft` rename). This requires a codemod that **atomically** migrates:

1. the Builder catalog + all built-in blueprints (code),
2. **every persisted tenant page JSON** (a DB data migration through the sparx pipeline),
3. all saved themes + presets.

Real, but expensive and risky. Run it **after** Path A proves parity, as a standalone rename pass — never as the entry point.

**Recommended sequence:** Path A pilot on one low-risk surface → parity acceptance across all 3 consumer surfaces → (optional) Path B rename as a separate, reversible codemod.

---

## 12. The payoff (why this is worth doing)

Done right, silicaui doesn't just replace `@sparx/site-ui` — it becomes the **single substrate under both `@sparx/site-ui` and `@sparx/ui`** (the platform/dashboard library), which today maintain **two hand-synced copies** of the same variant algebra (`.st-c-*` and `.sx-c-*`). Consolidating them, plus retiring the `ModuleProvider` module-color indirection in favor of native named theme colors, is the real maintainability win.

**The win is consolidation + dogfooding your own product — not "fewer, simpler components."** The component count and the essential complexity (multi-tenant theming, dark mode, the builder, the security boundary) don't shrink; they move into one owned library instead of two. Judge silicaui's readiness against the acceptance tests above, not against a vibe of "it's cleaner."

---

## Definition of done (the one-screen checklist)

- [ ] §1 Runtime theming: utilities → vars (no baked hex), N named colors, all axes tokenized, light+dark, per-slot override; `-content` consumed as a settable default-backed var — **sparx UI + site-themes own the WCAG derivation, not silicaui**; hover/tint via `color-mix`.
- [ ] §2 Orthogonal recipe: flat names over var composition, 3 treatment sets, runtime-custom color, `xs…xl`, `danger` not `error`.
- [ ] §3 Components: ~90 at parity, server-first, named parts, interactive subset on Base UI (RSC-safe, a11y-correct).
- [ ] §4 Class vocabulary honored (or codemod) — it is stored tenant data.
- [ ] §5 Dual build: global + `@scope(.bx-canvas)` canvas sheet.
- [ ] §6 Allowlist: `fixed` / `z-[…]` / `content-[…]` / `url()` denied; guarded `.st-fixed-*` only fixed; tenant tighten-only.
- [ ] §7 Behavior runtime: `behave`/`part` hooks, both surfaces, `hidden` panels, CSS-only for `common`.
- [ ] §8 Email: named-nodes + base-classes + honored subset, inline-style compile.
- [ ] §9 A11y/motion: reduced-motion baseline, AA on arbitrary hex, keyboard/focus.
- [ ] §10 Presets + saved themes + per-mode overrides round-trip.
- [ ] §11 Migration path chosen (A first), §12 consolidation payoff understood.
