# packages/ui — @sparx/ui composition library

Scoped guidance for the platform component library. Loads when working in `@sparx/ui`. See root [CLAUDE.md](../../CLAUDE.md) "Brand & design" for the binding rules that apply everywhere; this file is the build mechanics. Sibling: `@sparx/site-ui` (tenant-themed `--st-*` site components).

## What `@sparx/ui` is now (post-silicaui migration)

The dashboard design system runs on **silicaui** (`@wizeworks/silicaui*`). The old hand-rolled styling layer (the `.sx-c-*` role-var recipe + the `--sparx-*` / `--color-bg-*` / `--color-surface-*` tokens) is **gone**.

- **Styled primitives come from `@wizeworks/silicaui-react`.** Feature code in `apps/*` imports `Button`/`Badge`/`Card`/`Input`/`Select`/`Table`/`Tabs`/`Dialog`/`Alert`/… directly from there. The `@wizeworks/silicaui` Tailwind plugin (wired in each app's `globals.css` via `@plugin '@wizeworks/silicaui' { colors: … }`) statically emits every color + component utility (`.btn-*`, `.badge-*`, `.alert-*`, `bg-primary`, `text-base-content/70`, `bg-soft`, `status-*`, `checkbox-*`, …).
- **`@sparx/ui` survives ONLY as the home of the ~25 sparx compositions** — `ModuleProvider`, `SurfaceFrame`/`SurfaceStep`/`SurfaceSummary`, the shell (`SidebarAppShell`/`BrandRail`), `ListToolbar`/`FilterBar`/`BulkActionBar`/`SelectionList`, `ConfirmProvider`, `Wordmark`, `toast`/`Toaster`, `PageHeader`, `Stat`, the chart wrappers, `ActionTile`, `statusTone`/`statusLabel`, `cn` — all rebuilt on silicaui primitives + silica tokens. A handful of primitives (Button/Badge/Alert/Checkbox/Radio/Switch/Slider/Progress/StatusDot/Tag/Card/ActionTile) stayed in `@sparx/ui` for API-stability reasons but were **rewritten to emit silicaui classes** with zero call-site churn.
- **Color source of truth is `@sparx/brand/theme.css`** — `--color-base-100/200/300`, `--color-base-content`, the semantic palette (`--color-primary/secondary/accent/neutral/info/success/warning/error/danger` + each `-content`), and the 18-module palette `--color-module-<name>` (+ `-content`). `packages/ui/src/tokens.css` now holds **only non-color tokens** (type / space / radius / shadow / motion) + the `--chart-*` palette + a little component CSS.

## Emitting silica classes from a kept primitive

The rewritten primitives map the sparx four-axis props onto silica classes rather than building CSS:

- **Plugin-color controls** (Button/Badge/Alert/Tag/StatusDot/Progress): `<Button color variant size>` → `btn btn-<color> btn-<variant> btn-<size>`. Variant vocabulary: `solid` (bare), `soft` (`btn-soft`), `outline` (`btn-outline`), **`dashed` → `btn-dash`** (silica spells it `dash`), `ghost` (`btn-ghost`), `link` (`btn-link`). `buttonClasses({ color, variant, size })` is the exported helper (replaced the old `buttonVariants`).
- **Radix-based controls** (Checkbox/Radio/Switch/Slider) can't take a plugin color class, so they set a **per-instance `--sx-sel` / `--sx-sel-fg`** custom property from the `colorVars(color)` helper and consume it via `data-[state=checked]:bg-[var(--sx-sel)]`-style classes. `colorVars('commerce')` → `{ sel: 'var(--color-module-commerce)', selFg: 'var(--color-module-content)' }` for module colors, `{ sel: 'var(--color-<c>)', selFg: 'var(--color-<c>-content)' }` for semantic.
- `_recipes/variants.ts` is now pure vocabulary — `COLOR_KEYS`, `MODULE_COLOR_KEYS`, `TREATMENT_KEYS`, the `ColorKey` type, and `colorVars()`. The old `colorClass` / `treatmentVariants` / `chipTreatmentVariants` are deleted.

### The `cn()` tailwind-merge footgun

`@sparx/ui`'s `cn` uses `extendTailwindMerge` to register `soft` / `bg-soft` / `text-soft` / `border-soft` as their own class groups. Default tailwind-merge classifies them as color utilities and would **strip the preceding `bg-<color>`** from `bg-module bg-soft`, silently dropping the hue. Never swap `cn` back to a bare `twMerge`.

## Tints = the universal `soft` treatment (never a baked value)

A tint is ALWAYS `<color> + soft`, never a hardcoded color. silicaui's `bg-soft` paints `color-mix(in oklab, <current accent> 15%, base)` — theme-aware, computed once, can't drift. Layer it on any color: `bg-module bg-soft`, `bg-success bg-soft`. There are **no baked `-tint` / `-text` tokens** anymore.

## Module color shifting

`<ModuleProvider module="…">` sets **`--color-module` + `--color-module-content`** on its subtree (to the module's hue from `@sparx/brand/theme.css`) — nothing else. Everything beneath re-tints with no props: `color="module"`, `bg-module bg-soft`, `text-module`, `hover:border-module`. Brand provides a `:root` default `--color-module: var(--color-primary)` so those degrade to indigo outside any provider. Per-module hues are **not** registered as named silica colors (only `module` + `danger` are the sparx extras in the plugin `colors` list, by design) — to color for a specific module you wrap in its provider, you don't reach for a `bg-module-<name>` class.

## Surface elevation model

Depth is a **3-level base ramp** plus content: `--color-base-200` (page ground) → `--color-base-100` (the lifted reading surface / cards) → content (module-tinted card, semantic callout, `--color-neutral` inverse panel), with media forward-most. The corner-wrap cascade still applies — each level's rounded corners reveal exactly one level beneath, so stacking reads as physical depth.

Rules:

- **Elevation ≠ intensity.** Inside the content layer, color runs neutral → soft tint (`bg-<color> bg-soft`) → full solid. That saturation axis is **orthogonal** to elevation.
- **Color carries the depth**; reach for a hairline (`border-base-300`) or soft shadow only where a step is too subtle to read.
- Light values get **darker with depth**; dark theme inverts. `--color-base-100` is always the topmost reading surface in both themes.
- The high-contrast inverse accent panel is `--color-neutral` (theme-aware; flips light↔dark).

## Four-axis variant system (color × variant × size × shape)

Every color-bearing component is **four orthogonal axes** — never a flat enum. `primary` / `success` are **colors** (`color=`), not variants; variants are `solid | soft | outline | dashed | ghost | link`. `<Badge color="commerce" variant="soft">` is legal precisely because the axes are independent. Resolution is now silicaui's plugin-emitted classes (see "Emitting silica classes" above), not the old `.sx-c-*` role vars. See [docs/35](../../docs/35-ui-variant-system.md).

## Non-obvious house decisions

- Sparx primitive APIs are unchanged across the migration — this is a mechanism swap, not an API break. `asChild` → Base UI's `render={<a … />}` in the silica primitives.
- `'use client'` is applied **selectively**, only where interactivity needs it.
- `declaration: false` in tsconfig — no `.d.ts` emit; consumers read source types via project references.
- The ESLint rule flags the **fill + foreground fingerprint** (a background fill paired with a foreground text color, or hand-built `hover:`/`focus:`/`disabled:` states) — that's re-skinning a control. It does **not** flag raw layout/spacing utilities. Fix: use the `@wizeworks/silicaui-react` primitive / its variant; add to `@sparx/ui` only for a genuine composition.
- **`<Card variant="module">` = `bg-module bg-soft` inside a `<ModuleProvider>`** — its whole background is the active module's theme-aware soft tint (silica `bg-soft`, ~15% `color-mix` into `--color-base-100`), text/border untouched. There is no top stripe. To color a card, wrap the panel in its `<ModuleProvider module="…">` — the tint follows automatically (and colors the panel's buttons/badges too). The `accent` prop is the **escape hatch** for a one-off color with no surrounding provider (it sets `--sx-sel`).
- **On a dense cross-module page, tint ONE card per module hue** — the section's "primary" card — and leave the rest plain. A whole page of tinted cards is competing washes, not wayfinding. `OverviewCard` exposes a `plain` prop for the neutral opt-out.
- **Single-module working surfaces use neutral cards — NOT the module tint.** Create/edit forms, wizard steps, and editable detail panels are one module by definition, so the tint differentiates nothing there; identity comes from the frame chrome, the `color="module"` Save button, and the faint module-tinted `SurfaceFrame` summary rail. **Exception:** a read-only detail/transaction view (order, quote, invoice, b2b account) may keep ONE tinted KPI/accent card as its lone module cue.
- **Tints are theme-aware because `bg-soft` computes them at render** — never hand-pick a per-module light hex as a raw background/text (it won't adapt to dark mode, the historical bug that broke nav active states and stat chips). Use `bg-module bg-soft` / `text-module`.

## The wordmark

The sparx wordmark renders with the **"x" always in sparx Indigo `#6366F1`** — never one solid color. Geist 500, tracking `-0.03em`.
