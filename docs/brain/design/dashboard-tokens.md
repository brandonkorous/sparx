---
title: Dashboard design tokens (the values)
node: design
type: reference
status: active
applies-to: [dashboard]
sources:
  - packages/brand/src/theme.css
  - packages/ui/src/tokens.css
---

> ⚠️ **This is a materialized mirror of the live token files.** Colors come from `packages/brand/src/theme.css` (`@sparx/brand`, the silicaui theme); non-color tokens (type/space/radius/shadow/motion + chart palette) come from `packages/ui/src/tokens.css`. The values are written out on purpose — code is referenced last, so the brain must carry the numbers you build with. **The code is the source of truth: if this sheet and a token file disagree, the code wins and the mismatch is a bug to fix now.** Re-sync this note in the same change that edits the tokens ([[CONTRACT]] → "design constants are materialized"). In components you reference the **token var** or a **silicaui class**, never the raw hex — these values are for *knowing what's right*, not for pasting.

This is the **dashboard** system (silicaui + `@sparx/brand`, consumed via `@wizeworks/silicaui-react` + `@sparx/ui` compositions). The **site** system is themeable — see [[site-tokens]] and [[two-design-systems]].

## Brand

| token | light | dark | notes |
|---|---|---|---|
| `--color-primary` | `#6366f1` | `#818cf8` | the indigo. The wordmark **"x" is always `#6366F1`** (Geist 500, tracking `-0.03em`) |
| `--color-primary-content` | `#eef2ff` | `#14122e` | ink on a primary fill |
| `--color-secondary` | `#db2777` | `#f472b6` | deep-pink **brand** accent (marketing sparks) |
| `--color-accent` | `#8b5cf6` | `#a78bfa` | violet |

The dark `--color-primary` (`#818cf8`) is defined **once** here — no app-level `:root` redefinition overrides it anymore (the historical bug where dark buttons rendered the light indigo is dead).

## Type scale — 16px floor, **two weights only** (`packages/ui/src/tokens.css`)

`xs 12px` (0.75rem) · `sm 14px` captions (0.875) · **`base 16px` body floor** (1rem, never below) · `lg 18px` reading (1.125) · `xl 20px` (1.25) · `2xl 24px` (1.5) · `3xl 30px` (1.875) · `4xl 36px` (2.25).

- **Weights:** `400` regular, `500` medium — **only** (never 600/700 in body UI; wordmark mark is the exception at 700). See [[typography]].
- **Leading:** tight `1.2` · normal `1.5` · relaxed `1.625`. **Tracking:** tight `-0.025em` · wide `0.05em` · wider `0.08em`.
- **Fonts:** `Geist, Inter, system-ui` (`--font-sans`) · `Geist Mono, JetBrains Mono` (`--font-mono`).

## Spacing (4px base) · Radius · Shadow · Motion

- **Spacing** (px): `1`=4 · `2`=8 · `3`=12 · `4`=16 · `5`=20 · `6`=24 · `8`=32 · `10`=40 · `12`=48 · `16`=64.
- **Radius** — silica shape tokens (from `@sparx/brand`): `--radius-field 6px` (inputs, buttons → `rounded-field`) · `--radius-box 8px` (cards, alerts → `rounded-box`) · `--radius-selector 9999px` (pills, toggles, badges → `rounded-selector`). Legacy `--radius-sm..xl` (4/6/8/12) live in `tokens.css` for non-component use.
- **Shadow** (true elevation only — [[flat-by-default]]): `sm` `0 1px 2px /.05` · `md` `0 2px 8px /.08` · `lg` `0 10px 24px -6px /.12` · `focus` `0 0 0 3px indigo/.25`.
- **Motion:** `fast 100ms` · `base 175ms` · `slow 250ms cubic-bezier(.4,0,.2,1)`. Always honor `prefers-reduced-motion`.
- **Breakpoints:** mobile ≤640 · tablet 641–1024 · desktop >1024. `container-max 1280px`.

## Neutrals & surfaces (light / dark) — the silica base ramp

`base-100` is the topmost reading surface (card white), stepping darker with depth. sparx's page canvas is `base-200`, distinct from the card surface.

| token | light | dark | role |
|---|---|---|---|
| `--color-base-100` | `#ffffff` | `#1a1a1a` | **topmost** reading surface / cards |
| `--color-base-200` | `#f4f4f5` | `#1f1f1f` | page canvas / ground |
| `--color-base-300` | `#e4e4e7` | `#2a2a2a` | deepest step / default borders (`border-base-300`) |
| `--color-base-content` | `#0a0a0a` | `#f0f0f0` | primary text/ink |
| `--color-neutral` | `#1f2937` | `#e5e7eb` | high-contrast **inverse** accent panel (flips) |

**Text inks are opacity on the base ink** (no invented `muted`/`faint` colors): secondary `text-base-content/70` · tertiary `text-base-content/50` · muted `text-base-content/60` · disabled `text-base-content/40`. Emphasis border `border-base-content/30`. Depth is the base ramp (`200` ground → `100` reading surface → content/module/semantic → media), corner-wrap cascade; **color carries the depth** (a hairline `border-base-300` only where a step is too subtle). Detail in `packages/ui/CLAUDE.md`.

## Semantic palette — state, its own axis ([[status-is-its-own-axis]])

Each is `--color-<name>` + `--color-<name>-content` (ink on the solid fill), from `@sparx/brand/theme.css`. The silica plugin emits `bg-<name>` / `text-<name>` / `btn-<name>` / `badge-<name>`; a tint is `bg-<name> bg-soft` (theme-aware, never a baked value).

| color | light | dark | content (on fill) |
|---|---|---|---|
| `primary` | `#6366f1` | `#818cf8` | `#eef2ff` / `#14122e` |
| `secondary` | `#db2777` | `#f472b6` | `#ffffff` / `#2a0a1a` |
| `accent` | `#8b5cf6` | `#a78bfa` | `#ffffff` / `#17102e` |
| `neutral` | `#1f2937` | `#e5e7eb` | `#ffffff` / `#1f2937` |
| `info` | `#0ea5e9` | `#38bdf8` | `#ffffff` / `#082438` |
| `success` | `#10b981` | `#34d399` | `#ffffff` / `#052e22` |
| `warning` | `#f59e0b` | `#fbbf24` | **`#422006`** ⚠️ dark ink (white fails AA) |
| `error` | `#ef4444` | `#f87171` | `#ffffff` / `#2a0a0a` |
| `danger` | `#ef4444` | `#f87171` | `#ffffff` / `#2a0a0a` |

**`danger` vs `error`:** same hue, kept as its own registered name so sparx's `statusTone()` vocabulary (which emits `danger`, not silica's `error`) maps 1:1. Both are in the plugin `colors:` list. **Dark-ink-on-warm:** amber/yellow fills use `#422006`, never white.

## Module hues — color = functionality ([[color-follows-functionality]])

Each is `--color-module-<name>` (+ `-content`) in `@sparx/brand/theme.css`. Consumed via `<ModuleProvider module="…">` (which sets `--color-module` to the matching pair) — not registered as named plugin colors, so you color a module region by wrapping it, then using `color="module"` / `bg-module bg-soft` / `text-module`. Solid + content are theme-independent (a saturated fill reads on either surface).

| module | hue | | module | hue |
|---|---|---|---|---|
| builder | `#6366f1` indigo | | dropship | `#10b981` emerald |
| commerce | `#f97316` orange | | inventory | `#f59e0b` amber ⚠️ dark ink |
| cms | `#14b8a6` teal | | chat | `#8b5cf6` violet |
| crm | `#06b6d4` cyan | | scheduling | `#f43f5e` rose |
| email | `#0ea5e9` sky | | ai | `#ec4899` pink |
| b2b | `#475569` slate | | invoicing | `#65a30d` lime |

**Platform/program hues** (own a hue but not billable modules — [[taxonomy]]): `automations #d946ef` fuchsia · `seo #eab308` yellow ⚠️ dark ink · `finance #16a34a` money-green · `partner #7c3aed` violet-600 · `platform #6366f1` indigo. `inventory` + `seo` use dark on-fill ink `#422006`. (All of these now live in `theme.css` — `partner` is no longer a TS-only value.)

## How variant treatments derive (the four-axis engine — [[four-axis-variants]])

silicaui's Tailwind plugin emits every `color × variant` class from the palette above — `<Button color variant size>` → `btn btn-<color> btn-<variant> btn-<size>` (silica spells `dashed` as `btn-dash`). No `.sx-c-*` role vars, no codegen:

- **solid** = `bg-<color>` + `text-<color>-content` · **soft** = `bg-<color> bg-soft` (tint) + `text-<color>` (ink) · **outline** = `border-<color>` + `text-<color>` · **ghost/link** = `text-<color>`, transparent.
- **`bg-soft`** paints `color-mix(in oklab, <accent> 15%, base)` — theme-aware, computed once. A tint is ALWAYS `<color> + soft`; never hand-pick a per-module light hex.
- **Radix-based controls** (Checkbox/Radio/Switch/Slider) can't take a plugin color class, so `@sparx/ui` sets a per-instance `--sx-sel` / `--sx-sel-fg` from `colorVars(color)` and consumes it via `data-[state=checked]:bg-[var(--sx-sel)]`.

**Module *card* tint:** `<Card variant="module">` = `bg-module bg-soft` inside a `<ModuleProvider>` (theme-aware ~15% `color-mix` into `--color-base-100`, text/border untouched). Wrap a panel in `<ModuleProvider module="…">` to tint it. Detail: `packages/ui/CLAUDE.md`.

## Chart palette (`packages/ui/src/tokens.css`)

light: `1 #6366f1 · 2 #14b8a6 · 3 #f97316 · 4 #06b6d4 · 5 #ec4899 · 6 #10b981` (dark: lifted). A single hero series uses `--color-module`.

Related: [[tokens-are-truth]], [[typography]], [[color-follows-functionality]], [[status-is-its-own-axis]], [[flat-by-default]], [[two-design-systems]]
