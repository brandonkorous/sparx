# packages/ui — @sparx/ui design system

Scoped guidance for the platform component library. Loads when working in `@sparx/ui`. See root [CLAUDE.md](../../CLAUDE.md) "Brand & design" for the binding rules that apply everywhere; this file is the build mechanics. Sibling: `@sparx/site-ui` (tenant-themed `--st-*` storefront components).

## CVA + token mechanics

- Components are built with the **CVA pattern** ([docs/23](../../docs/23-frontend-component-architecture.md) §6) on top of Shadcn/ui shells and Radix primitives.
- Every variant references a CSS custom property from [tokens.css](./src/tokens.css) — **never** a hardcoded color.
- Module color shifting is automatic via `<ModuleProvider module="…">`. Any component referencing `--module-active` adopts the wrapping module's color — no props, no conditional classes.

## Four-axis variant system (color × variant × size)

Every color-bearing component uses **four-axis** `color × variant × size` via a **shared role-var recipe** (`.sx-c-*` in `@sparx/ui`, `.st-c-*` in `@sparx/site-ui`) — never a flat enum. This is not just `<Button>`; it's the rule for elements in general (Badge, etc.). See [docs/35](../../docs/35-ui-variant-system.md).

- `primary` / `success` are **colors** (`color=`), not variants.
- Variants are `solid | soft | outline | dashed | ghost | link`.

## Non-obvious house decisions

- Radix wrappers are **hand-authored** (not `npx shadcn add` verbatim).
- `'use client'` is applied **selectively**, only where interactivity needs it.
- `declaration: false` in tsconfig — no `.d.ts` emit; consumers read source types via project references.
- The ESLint rule flags the **fill + foreground fingerprint** (a background fill paired with a foreground text color, or hand-built `hover:`/`focus:`/`disabled:` states) — that's re-skinning a control. It does **not** flag raw layout/spacing utilities.
- **`<Card variant="module">` tints its whole background with the active module's subtle tint — there is no top stripe anymore.** The background is `color-mix(in oklab, var(--module-active) 12%, var(--color-bg-surface))`, reading `--module-active` **DIRECTLY** (not the shared, inheriting `--c-bg`/`--c-tint` role vars — an ancestor's `.sx-c-*` recipe would otherwise leak its color into a nested card and override the active module, the historical bug). Mixing into `--color-bg-surface` (not a fixed light hex) keeps it a clean tinted-white card in light mode and a tinted-dark card in dark mode. So: **to color a card, wrap the panel in its `<ModuleProvider module="…">`** — the tint follows automatically (this also colors the panel's buttons/badges). The `accent` prop (`<Card accent="inventory">`) is an **escape hatch** for a one-off color with no surrounding provider — it sets `--c-bg`, so the bg becomes `color-mix(… var(--c-bg) …)`. Don't reach for `accent` when a provider already wraps the panel.
- **On a dense cross-module page, tint ONE card per module hue — the section's "primary" card — and leave the rest plain.** A whole page of tinted cards is competing washes; one tinted card per module turns the tint into wayfinding (e.g. `/commerce`: orange Revenue, cyan Top customers via a nested CRM provider, amber Inventory — every other card plain). `OverviewCard` exposes a `plain` prop that drops the non-primary cards to a neutral `variant="default"` surface.
- **Single-module working surfaces use neutral `variant="default"` cards — NOT the module tint.** Create/edit forms, wizard steps, and editable detail panels are one module by definition, so the tint differentiates nothing there (it's decoration, not wayfinding); identity comes from the frame chrome, the `color="module"` Save button, and the faint module-tinted `SurfaceFrame` summary rail (the rail uses the same 12% as a module card so the lone cue reads consistently). The tint is reserved for cross-module overview/dashboard surfaces. **Exception:** a read-only detail/transaction view (order, quote, invoice, b2b account) may keep ONE tinted KPI/accent card as its lone module cue — that's the "one primary tinted card" discipline, not an editable form.
- **`--module-active-tint` / `--module-active-text` are theme-aware.** `ModuleProvider` emits the hand-picked LIGHT values (`*-light`) plus a derived DARK variant (`*-dark`, mixed into `--color-bg-surface` / lifted toward `--color-text-primary`), and `tokens.css` selects between them by theme via `[data-module]` / `[data-theme='dark'] [data-module]`. Never use a per-module light hex (or any fixed light color) as a raw background/text — it won't adapt to dark mode (the bug that broke the nav active state, order numbers, and stat chips). Consume the resolved token.

## The wordmark

The sparx wordmark renders with the **"x" always in sparx Indigo `#6366F1`** — never one solid color. Geist 500, tracking `-0.03em`.
