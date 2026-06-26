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
- **`<Card variant="module">`'s top stripe reads `--module-active` DIRECTLY, not the shared `--c-bg` role var.** This is deliberate: `--c-bg` is set by any `.sx-c-*` color recipe and **inherits**, so an ancestor's module/role color silently leaks into a nested card and overrode the active module (the historical bug). So: **to color a card's stripe, wrap the panel in its `<ModuleProvider module="…">`** — the stripe follows automatically (this is also what colors the panel's buttons/badges). The `accent` prop (`<Card accent="inventory">`) is an **escape hatch** for a one-off color that doesn't match the surrounding module — it sets `--c-bg` on that card only. Don't reach for `accent` when a provider already wraps the panel.

## The wordmark

The sparx wordmark renders with the **"x" always in sparx Indigo `#6366F1`** — never one solid color. Geist 500, tracking `-0.03em`.
