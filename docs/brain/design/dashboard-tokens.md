---
title: Dashboard design tokens (the values)
node: design
type: reference
status: active
applies-to: [dashboard]
sources:
  - packages/ui/src/tokens.css
---

> ⚠️ **This is a materialized mirror of `packages/ui/src/tokens.css`.** The values are written out on purpose — code is referenced last, so the brain must carry the numbers you build with. **`tokens.css` is the source of truth: if this sheet and the token file disagree, the code wins and the mismatch is a bug to fix now.** Re-sync this note in the same change that edits the tokens ([[CONTRACT]] → "design constants are materialized"). In components you reference the **token var**, never the raw hex — these values are for *knowing what's right*, not for pasting.

This is the **dashboard** system (`@sparx/ui`). The **site** system is themeable — see [[site-tokens]] and [[two-design-systems]].

## Brand

| token | value | notes |
|---|---|---|
| `--sparx-primary` | `#6366f1` | the indigo. The wordmark **"x" is always this** (Geist 500, tracking `-0.03em`) |
| `--sparx-primary-hover` | `#4f46e5` | |
| `--sparx-primary-subtle` | `#818cf8` | |
| `--sparx-primary-tint` | `#eef2ff` (dark `#1e1b4b`) | |
| `--sparx-secondary` | `#db2777` | deep-pink **brand** accent (marketing sparks). NOT the AI pink `#ec4899`, NOT the slate UI `--color-secondary` |

## Type scale — 16px floor, **two weights only**

`xs 12px` (0.75rem) · `sm 14px` captions (0.875) · **`base 16px` body floor** (1rem, never below) · `lg 18px` reading (1.125) · `xl 20px` (1.25) · `2xl 24px` (1.5) · `3xl 30px` (1.875) · `4xl 36px` (2.25).

- **Weights:** `400` regular, `500` medium — **only** (never 600/700 in body UI; wordmark mark is the exception at 700). See [[typography]].
- **Leading:** tight `1.2` · normal `1.5` · relaxed `1.625`. **Tracking:** tight `-0.025em` · wide `0.05em` · wider `0.08em`.
- **Fonts:** `Geist, Inter, system-ui` (sans) · `Geist Mono, JetBrains Mono` (mono).

## Spacing (4px base) · Radius · Shadow · Motion

- **Spacing** (px): `1`=4 · `2`=8 · `3`=12 · `4`=16 · `5`=20 · `6`=24 · `8`=32 · `10`=40 · `12`=48 · `16`=64.
- **Radius** (px): `sm`=4 · `md`=6 · `lg`=8 · `xl`=12 · `full`=9999.
- **Shadow** (true elevation only — [[flat-by-default]]): `sm` `0 1px 2px /.05` · `md` `0 2px 8px /.08` · `lg` `0 10px 24px -6px /.12` · `focus` `0 0 0 3px indigo/.25`.
- **Motion:** `fast 100ms` · `base 175ms` · `slow 250ms cubic-bezier(.4,0,.2,1)`. Always honor `prefers-reduced-motion`.
- **Breakpoints:** mobile ≤640 · tablet 641–1024 · desktop >1024. `container-max 1280px`.

## Neutrals & surfaces (light / dark)

| token | light | dark | role |
|---|---|---|---|
| `--color-bg-page` | `#fafafa` | `#0f0f0f` | page ground (legacy) |
| `--color-surface-100` | `#fbfbfd` | `#24252c` | **topmost** reading surface |
| `--color-surface-200` | `#f4f5f8` | `#17181d` | the stage |
| `--color-surface-300` | `#eaecf1` | `#0d0d10` | **page base** (deepest) |
| `--color-surface-opposite` | `#0d0d10` | `#eaecf1` | inverse accent panel (flips) |
| `--color-border-default` | `#e5e5e5` | `#2a2a2a` | |
| `--color-border-strong` | `#d4d4d8` | `#3f3f46` | |
| `--color-border-focus` | `#6366f1` | `#818cf8` | |
| `--color-text-primary` | `#0a0a0a` | `#f0f0f0` | |
| `--color-text-secondary` | `#52525b` | `#a1a1aa` | |
| `--color-text-tertiary` | `#a1a1aa` | `#71717a` | |
| `--color-text-muted` | `#71717a` | `#8a8a93` | |
| `--color-text-disabled` | `#d4d4d8` | `#3f3f46` | |

Depth is the **4-level elevation stack** (`300` ground → `200` stage → content `100`/module/semantic → media), corner-wrap cascade; this supersedes the loose `--color-bg-*` neutrals. Detail in `packages/ui/CLAUDE.md`.

## Semantic palette — state, its own axis ([[status-is-its-own-axis]])

Each is `base` + `-content` (text/icon on the solid fill). Bases are theme-constant except where noted.

| color | base | content (on fill) | tint / ink |
|---|---|---|---|
| `primary` | `#6366f1` | `#eef2ff` | — |
| `secondary` | `#db2777` | `#ffffff` | — |
| `accent` | `#8b5cf6` | `#ffffff` | — |
| `neutral` | `#1f2937` (dark `#e5e7eb`) | `#ffffff` (dark `#1f2937`) | — |
| `info` | `#0ea5e9` | `#ffffff` | — |
| `success` | `#10b981` | `#ffffff` | tint `#ecfdf5`, ink `#065f46` |
| `warning` | `#f59e0b` | **`#422006`** ⚠️ dark ink (white fails AA) | tint `#fffbeb`, ink `#92400e` |
| `danger` | `#ef4444` | `#ffffff` | tint `#fef2f2`, ink `#991b1b` |

**Dark-ink-on-warm:** amber/yellow fills use `#422006`, never white. Warm hues are reserved for status (except modules that own one).

## Module hues — color = functionality ([[color-follows-functionality]])

Each is addressable as a color slot directly (e.g. `<Badge color="commerce">`). The **12 billable modules**:

| module | hue | | module | hue |
|---|---|---|---|---|
| builder | `#6366f1` indigo | | dropship | `#10b981` emerald |
| commerce | `#f97316` orange | | inventory | `#f59e0b` amber ⚠️ dark ink |
| cms | `#14b8a6` teal | | chat | `#8b5cf6` violet |
| crm | `#06b6d4` cyan | | scheduling | `#f43f5e` rose |
| email | `#0ea5e9` sky | | ai | `#ec4899` pink |
| b2b | `#475569` slate | | invoicing | `#65a30d` lime |

**Platform/program hues** (own a hue but not billable modules — [[taxonomy]]): `automations #d946ef` fuchsia · `seo #eab308` yellow ⚠️ dark ink · `finance #16a34a` money-green. **`partner #7c3ade`**-ish (`#7C3AED` violet-600) lives in `module-provider.tsx`, not `tokens.css`.

`inventory` + `seo` use dark on-fill ink `#422006` (warm, like `warning`).

## How variant treatments derive (the four-axis engine — [[four-axis-variants]])

Each `.sx-c-<color>` maps four role vars off the base (color-mix in OKLCH), so `color × variant` composes with no codegen:

- `--c-bg` = base · `--c-fg` = `-content`
- `--c-ink` = base **60%** → `text-primary` (soft/ghost/outline text; flips with theme)
- `--c-hover` = base **86%** → `text-primary`
- `--c-tint` = base **14%** over transparent (**16%** for warning/inventory/seo)

**Module *card* tint is separate:** `color-mix(oklab, --module-active 12%, surface)`, read **directly** (not via role vars, to stay leak-safe). Wrap a panel in `<ModuleProvider module="…">` to tint it. Detail: `packages/ui/CLAUDE.md`.

## Chart palette

light: `1 #6366f1 · 2 #14b8a6 · 3 #f97316 · 4 #06b6d4 · 5 #ec4899 · 6 #10b981` (dark: lifted). A single hero series uses `--module-active`.

Related: [[tokens-are-truth]], [[typography]], [[color-follows-functionality]], [[status-is-its-own-axis]], [[flat-by-default]], [[two-design-systems]]
