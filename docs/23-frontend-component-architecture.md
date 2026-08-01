# sparx Platform — Frontend Component Architecture

**Version:** 1.9.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-01

---

## 1. The Core Rule

**A component's _appearance_ is owned by `packages/ui/`. Feature code never re-skins a
control — but it may compose layout with utilities.**

The themed styling system — color/surface fills, borders, radii, shadows, and interactive
states — is emitted by **silicaui's Tailwind plugin** (`@wizeworks/silicaui`) as component
classes (`btn-*`, `badge-*`, `alert-*`, `bg-<color>`, `bg-soft`, …) and consumed through the
`@wizeworks/silicaui-react` primitives (Button/Badge/Card/Input/…). Feature code imports those
primitives directly; `@sparx/ui` survives as the home of the ~25 sparx **compositions**
(`ModuleProvider`, `SurfaceFrame`, the shell, `ListToolbar`, `statusTone`, `cn`, …), rebuilt on
silica primitives. Either way feature code consumes semantic component APIs, never raw fills.
That is how drift is prevented.

Tailwind utilities are **not** banned from feature code, though. Layout, positioning,
spacing, sizing, and one-off chrome (an absolutely-positioned indicator, a flex row, a
responsive grid) are composition — they belong in `apps/*`. The line is **re-skinning a
control**: the moment you pair a background fill with a foreground text color (or rebuild
hover/focus/disabled states), you are recreating a `<Button>` / `<Input>` / `<Badge>` and
must use the component instead. See §15 for the exact rule the linter enforces.

```tsx
// ✅ Correct — feature code: semantic components + layout utilities
<Button color="primary" size="md">Save changes</Button>
<Card variant="module">CMS content here</Card>
<Badge color="success">Active</Badge>
<span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-primary" /> {/* layout/indicator — fine */}

// ❌ Wrong — re-skinning a control in feature code (fill + foreground = use <Button>)
<button className="rounded-md bg-primary px-4 py-2 text-primary-content hover:brightness-95">
  Save changes
</button>
```

---

## 2. Stack

| Layer                   | Technology                                 | Role                                                                                              |
| ----------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Color token authority   | `@sparx/brand/theme.css` (CSS vars)        | Sole source of truth for all colors — semantic palette + `--color-base-*` + modules               |
| Non-color tokens        | `packages/ui/src/tokens.css`               | Type / space / radius / shadow / motion + the `--chart-*` palette                                 |
| Component classes       | `@wizeworks/silicaui` (Tailwind v4 plugin) | Statically emits every color + component utility (`btn-*`, `badge-*`, `bg-<color>`, `bg-soft`, …) |
| React primitives        | `@wizeworks/silicaui-react`                | Button/Badge/Card/Input/Select/Table/Tabs/Dialog/Alert/… imported directly by feature code        |
| Compositions            | `@sparx/ui`                                | The ~25 sparx compositions (shell, SurfaceFrame, ModuleProvider, toolbars) on silica primitives   |
| Primitive accessibility | Radix UI                                   | ARIA, keyboard nav, focus — still underlies the few interactive controls `@sparx/ui` keeps        |
| Style composition       | `cn()` (clsx + tailwind-merge)             | Class dedup + conditional logic; `extendTailwindMerge` keeps `bg-<color> bg-soft` intact          |
| Module theming          | `ModuleProvider`                           | Sets `--color-module` on its subtree per active module                                            |
| Icons                   | Lucide React                               | Consistent, tree-shakeable, outline style                                                         |

---

## 3. Package Structure

Styled primitives no longer live in `@sparx/ui` — they are imported from
`@wizeworks/silicaui-react`. `@sparx/ui` keeps only the sparx **compositions** (the ~25 things
silica does not provide), the non-color token file, and the shared helpers.

```
packages/
├── brand/                     # name: "@sparx/brand" — the color authority (CSS-first)
│   └── src/theme.css          # --color-base-*, semantic palette (--color-primary/…),
│                              # 18-module palette --color-module-<name> (+ -content). Defined ONCE.
│
└── ui/
    ├── package.json           # name: "@sparx/ui"
    ├── index.ts               # barrel export — compositions + re-exports
    ├── tokens.css             # NON-color tokens only: type / space / radius / shadow / motion
    │                          #   + the --chart-* palette + a little component CSS
    │
    ├── compositions/          # ModuleProvider, SurfaceFrame/SurfaceStep/SurfaceSummary,
    │                          #   SidebarAppShell/BrandRail, ListToolbar/FilterBar/BulkActionBar,
    │                          #   SelectionList, ConfirmProvider, Wordmark, toast/Toaster,
    │                          #   PageHeader, Stat, ActionTile, chart wrappers
    │
    ├── hooks/
    │   ├── use-module.ts      # reads current module context
    │   ├── use-debounce.ts
    │   ├── use-clipboard.ts
    │   └── use-media-query.ts
    │
    ├── providers/
    │   └── module-provider.tsx  # ModuleProvider + useModule (sets --color-module)
    │
    └── utils/
        ├── cn.ts              # clsx + extendTailwindMerge (registers the `soft` class family)
        ├── pluginColor.ts     # slot name -> silicaui plugin color name (commerce -> module-commerce)
        ├── statusTone.ts      # statusTone / statusLabel resolvers
        └── format.ts          # formatCurrency, formatDate, formatRelative
```

> A dozen primitives kept their `@sparx/ui` import path for API reasons — those were rewritten to
> emit silicaui classes with zero call-site churn. The other ~60 styled primitives were deleted;
> import Button/Badge/Card/Input/… from `@wizeworks/silicaui-react`.

---

## 4. CSS Token Foundation

Colors and non-color tokens now live in **two files** with a clean split:

- **`@sparx/brand/theme.css`** (`packages/brand`) — the sole color authority. Defines the
  semantic palette (`--color-primary/secondary/accent/neutral/info/success/warning/error/danger`
  each with a `-content` pair), the reading surfaces (`--color-base-100/200/300` +
  `--color-base-content`), and the 18-module palette (`--color-module-<name>` + `-content`).
  Each color is defined **once**, so dark mode resolves correctly (the old duplicate `:root`
  overrides that clobbered brand's dark `--color-primary` are gone — that was a real bug).
- **`packages/ui/src/tokens.css`** — everything that is _not_ a color: type, space, radius,
  shadow, motion, plus the `--chart-*` palette and a little component CSS.

Both are imported once in each app's root layout. Silicaui's Tailwind plugin turns the brand
color vars into utilities (`bg-<color>`, `text-base-content/70`, `bg-soft`, `btn-<color>`, …);
components reference those, never hardcoded values.

> **Source of truth.** `@sparx/brand/theme.css` is the binding color contract; `tokens.css` the
> non-color one. When this doc changes, the matching file must be updated in the same change.

```css
/* ── @sparx/brand/theme.css — SEMANTIC PALETTE (light) ──────── */
:root {
  --color-primary: #6366f1; /* dark: #818cf8 */
  --color-primary-content: #ffffff;
  --color-secondary: #db2777; /* dark: #f472b6 */
  --color-secondary-content: #ffffff;
  --color-accent: #14b8a6;
  --color-accent-content: #ffffff;
  --color-neutral: #1f2937; /* dark: #e5e7eb — the "no color specified" ink surface */
  --color-neutral-content: #ffffff;

  --color-info: #0ea5e9;
  --color-info-content: #ffffff;
  --color-success: #10b981;
  --color-success-content: #ffffff;
  --color-warning: #f59e0b;
  --color-warning-content: #422006; /* dark amber ink */
  --color-error: #ef4444;
  --color-error-content: #ffffff;
  --color-danger: #ef4444; /* sparx extra, registered in the plugin colors list */
  --color-danger-content: #ffffff;

  /* ── READING SURFACES ──────────────────────────────────── */
  --color-base-100: #ffffff; /* topmost reading surface (cards, panels) */
  --color-base-200: #fafafa; /* page ground */
  --color-base-300: #e5e5e5; /* deepest / borders (border-base-300) */
  --color-base-content: #0a0a0a; /* primary text; opacity modifiers give the rest */

  /* ── MODULE PALETTE (18 modules; -content pairs omitted) ── */
  --color-module-site: #6366f1;
  --color-module-commerce: #f97316;
  --color-module-cms: #14b8a6;
  --color-module-crm: #06b6d4;
  --color-module-email: #0ea5e9;
  --color-module-b2b: #475569;
  --color-module-ai: #ec4899;
  --color-module-dropship: #10b981;

  /* Active module — set by ModuleProvider, defaults to primary at :root */
  --color-module: var(--color-primary);
  --color-module-content: var(--color-primary-content);
}

/* ── packages/ui/src/tokens.css — NON-COLOR TOKENS ─────────── */
:root {
  /* ── TYPOGRAPHY ─────────────────────────────────────────── */
  --font-sans: 'Geist', 'Inter', system-ui, sans-serif;
  --font-mono: 'Geist Mono', 'JetBrains Mono', monospace;

  --text-xs: 0.75rem; /* 12px */
  --text-sm: 0.875rem; /* 14px — secondary / captions */
  --text-base: 1rem; /* 16px — body floor (never below; mirrors packages/ui/src/tokens.css) */
  --text-lg: 1.125rem; /* 18px — long-form / reading */
  --text-xl: 1.25rem; /* 20px */
  --text-2xl: 1.5rem; /* 24px */
  --text-3xl: 1.875rem; /* 30px */
  --text-4xl: 2.25rem; /* 36px */

  --weight-regular: 400;
  --weight-medium: 500;

  --leading-tight: 1.2;
  --leading-normal: 1.5;
  --leading-relaxed: 1.625;

  --tracking-tight: -0.025em;
  --tracking-wide: 0.05em;
  --tracking-wider: 0.08em;

  /* ── SPACING ─────────────────────────────────────────────── */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.25rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-10: 2.5rem;
  --space-12: 3rem;
  --space-16: 4rem;

  /* ── RADIUS ──────────────────────────────────────────────── */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-full: 9999px;

  /* ── SHADOWS ─────────────────────────────────────────────── */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 2px 8px 0 rgb(0 0 0 / 0.08);
  --shadow-lg: 0 10px 24px -6px rgb(0 0 0 / 0.12);
  --shadow-focus: 0 0 0 3px rgb(99 102 241 / 0.25);

  /* ── TRANSITIONS ─────────────────────────────────────────── */
  --transition-fast: 100ms ease;
  --transition-base: 175ms ease;
  --transition-slow: 250ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

**Dark mode.** Color dark values live in `@sparx/brand/theme.css` — the same `--color-*` vars
are redefined once under the dark selector (`--color-primary: #818cf8`, `--color-base-100`
darkens, `--color-base-content` lightens, etc.). Because each color is defined in exactly one
place, `bg-<color>` / `text-base-content/70` / `bg-soft` all resolve correctly in both themes
with no per-component work. `tokens.css` carries no color, so it has no dark-mode block.

---

## 5. Tailwind Setup (the silicaui plugin)

Tailwind v4 is CSS-first. Each app's `globals.css` imports the two token files and registers the
silicaui plugin, naming the palette slots it should emit. From the brand `--color-*` vars the
plugin **statically emits** every color + component utility — `bg-<color>`, `text-base-content/70`
(with opacity modifiers), `bg-soft`, and the component classes `btn-*`, `badge-*`, `alert-*`,
`checkbox-*`, `radio-*`, `progress-*`, `status-*`, … — so a Tailwind class exists for every color
that will ever exist, without a per-color config entry.

```css
/* apps/dashboard/app/globals.css */
@import 'tailwindcss';
@import '@sparx/brand/theme.css'; /* the --color-* authority */
@import '@sparx/ui/tokens.css'; /* type / space / radius / shadow / motion + --chart-* */

/* Emit the palette. `danger` and `module` are sparx's two registered extras. */
@plugin '@wizeworks/silicaui' {
  colors: primary, secondary, accent, neutral, info, success, warning, error, danger, module;
}
```

Per-module names (`site`, `commerce`, …) are **not** registered here — only `module` (the active
one, set by `ModuleProvider`) and `danger`. A per-module tint is `<ModuleProvider>` + `bg-module
bg-soft`, never `bg-module-<name>`. The non-color scales (font family, radius, shadow, spacing)
remain plain `var(--…)` reads from `tokens.css`.

---

## 6. The four-axis API on silica classes

Every color-bearing control is **`color × variant × size × shape`** — four orthogonal axes, never
a flat enum (full treatment in doc 35). `sparx` and `silica` are the _same_ design language, so
the primitive is imported straight from `@wizeworks/silicaui-react`; its props map to the classes
silicaui's plugin already emitted. No CVA config, no per-component Tailwind authoring — the plugin
is where the treatments live.

```tsx
// Feature code — import the primitive directly.
import { Button, Badge } from '@wizeworks/silicaui-react';

<Button color="danger" variant="soft" size="lg" shape="wide">
  Delete
</Button>;
// → class="btn btn-danger btn-soft btn-lg btn-wide"

<Button color="module" variant="outline">
  Publish
</Button>; // module hue from ModuleProvider
<Badge color={statusTone(s)} variant="soft" size="sm">
  {statusLabel(s)}
</Badge>;
```

**How the axes resolve to classes:**

- **`color`** → `btn-<color>` / `badge-<color>` / `bg-<color>`. Slots: `primary secondary accent
neutral info success warning error danger module`.
- **`variant`** → `solid` (bare `btn`), `soft` (`btn-soft`), `outline` (`btn-outline`), `dashed`
  → **`btn-dash`** (silica spells it `dash`), `ghost` (`btn-ghost`), `link` (`btn-link`).
- **`size`** → `btn-xs … btn-xl`.
- **`shape`** → `btn-square` / `btn-circle` / `btn-block` / `btn-wide`.

**Selection controls follow the same rule, from silicaui directly.** `Checkbox` / `Switch` /
`RadioGroup` / `Slider` / `Progress` are imported from `@wizeworks/silicaui-react` and take
`checkbox-<color>`, `switch-<color>`, `progress-<color>`. `@sparx/ui` once hand-rolled them on
Radix — where a plugin color class can't attach — and drove each accent off a per-instance
`--sx-sel` / `--sx-sel-fg` custom property from a `colorVars(color)` helper. That was the last
parallel token vocabulary in the repo; the components and the helper were **deleted 2026-07-31**.
See [implementation/st-token-retirement.md](implementation/st-token-retirement.md) §7.

**Tints** are the universal `soft` treatment: `bg-<color> bg-soft` paints
`color-mix(in oklab, <accent> 15%, base)` — theme-aware, computed once, never a baked value. A
per-module tint is `<ModuleProvider module="…">` + `bg-module bg-soft`. Because default
tailwind-merge would classify `bg-soft` as a color utility and strip the preceding `bg-<color>`,
`@sparx/ui`'s `cn` uses `extendTailwindMerge` to register the `soft` family as its own class group
so `bg-<color> bg-soft` survives.

---

## 7. ModuleProvider — The Color Context System

The `ModuleProvider` sets **only** `--color-module` (+ `--color-module-content`) on its subtree, to
the active module's hue read from `@sparx/brand/theme.css`. Anything beneath that uses
`color="module"`, `bg-module bg-soft`, or `text-module` re-tints automatically — no props, no
conditional classes. Brand provides a `:root` default `--color-module: var(--color-primary)` so
those utilities degrade to indigo outside any provider. (The old `--module-active*` family is gone.)

```typescript
// packages/ui/providers/module-provider.tsx
import React, { createContext, useContext, useMemo } from 'react'

export type SparxModule =
  | 'site' | 'commerce' | 'cms' | 'crm' | 'email' | 'b2b' | 'ai' | 'dropship'
  | 'platform'  // default — uses sparx primary
  // …the full 18-module palette lives in @sparx/brand/theme.css as --color-module-<name>

const ModuleContext = createContext<SparxModule>('platform')

interface ModuleProviderProps {
  module: SparxModule
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export function ModuleProvider({ module, children, className, style }: ModuleProviderProps) {
  // Point --color-module at the module's brand hue; no per-module hex tables here.
  const cssVars = useMemo(() => ({
    '--color-module':        `var(--color-module-${module})`,
    '--color-module-content': `var(--color-module-${module}-content)`,
  } as React.CSSProperties), [module])

  return (
    <ModuleContext.Provider value={module}>
      <div style={{ ...cssVars, ...style }} className={className} data-module={module}>
        {children}
      </div>
    </ModuleContext.Provider>
  )
}

export function useModule(): SparxModule {
  return useContext(ModuleContext)
}
```

### Usage in the Dashboard

```tsx
// apps/dashboard/app/(dashboard)/cms/layout.tsx
import { ModuleProvider } from '@sparx/ui';

export default function CmsLayout({ children }: { children: React.ReactNode }) {
  return <ModuleProvider module="cms">{children}</ModuleProvider>;
}

// Now everything inside cms/ automatically uses teal:
// - Sidebar nav item highlight → teal (text-module)
// - Card variant="module" tint background → teal (bg-module bg-soft)
// - Active tab underline → teal
// - Module badge → teal
// - Button color="module" → teal fill
// Zero additional work.
```

---

## 8. Core Component Specs

Button/Badge/Input/Card/Select/… are the silicaui primitives — their styling is the plugin's
`btn-*`/`badge-*`/`input-*`/`card`/`bg-<color>`/`bg-soft` classes, not a CVA config in this repo.
The specs below cover the sparx-specific behaviour worth pinning down.

### Card (`variant="module"` tint)

`<Card>` renders silica's `card` surface (`bg-base-100 border-base-300`). `variant="module"` inside
a `<ModuleProvider>` layers `bg-module bg-soft` — the universal `soft` treatment paints
`color-mix(in oklab, var(--color-module) 15%, var(--color-base-100))`, theme-aware and computed
once. It follows the nearest `<ModuleProvider>` (which sets `--color-module`), so wrapping a
cross-module panel in its provider re-tints its `module` cards with no props. The `accent` prop is
the escape hatch for a one-off color with no surrounding provider — it names a different plugin
color (`bg-module-commerce bg-soft`), so it resolves only where that app registered the full module
palette. Same wayfinding discipline as before: tint ONE "primary" card per module hue on a
cross-module page; single-module working surfaces (forms/wizards/editors) keep neutral cards.

### Badge

`<Badge color variant size>` → `badge badge-<color> badge-<variant> badge-<size>`. Default is
`neutral / soft / md`. Status pills are just a `<Badge color={statusTone(s)} variant="soft">` — see
doc 35 §9. A soft badge is `bg-<color> bg-soft text-<color>`; there are no baked `-tint` tokens.

### Input, and the rest of the form tier

**`Input` is silicaui's — `@sparx/ui` no longer exports one.** Nor `Textarea`, `NativeSelect`,
`Select`, `PasswordInput`, `Combobox`, `Calendar`, `DatePicker`, `ColorPicker`, `FileUpload`, or
`Label`. Each once had a hand-rolled twin here; all are deleted.

`<Input color size>` → `input input-<color> input-<size>`. Note the axis: it's **`color`**, not a
`variant` state enum — `color="error"` sets `--input-accent`, and that single variable drives the
focused border AND the focus ring together, so the two can't disagree. Placeholder, hover, disabled
and the ring all come from the plugin's `.input`; never add `focus-ring` on top (§1 — every silica
control already rings itself).

**Validation is `Field`, not a hand-built error row:**

```tsx
<Field status="error" statusMessage="Enter a valid email address.">
  <FieldLabel required>Work email</FieldLabel>
  <FieldControl type="email" />
  <FieldDescription>We&apos;ll send a magic link.</FieldDescription>
</Field>
```

`status` resolves the control's accent, its trailing icon, and the message panel at once; Base UI
wires the ids and `aria-describedby` between the parts. Use `<FieldControl render={<Textarea />} />`
for a non-input control, `<FieldStatus attached={false}>` for checkbox/switch/radio rows (no
bordered control for a flush panel to sit under), and `floating` when the message must not push
sibling fields as it appears. `SchemaFieldRenderer` in `@sparx/ui` is the worked example.

### Stat (metric card)

The Stat component is the canonical metric tile for dashboards (revenue, order count, MRR, active customers, etc.). Two required content slots — `value` and `label` — plus an optional `delta` for period-over-period change and an optional `icon` chip. There is no CVA variant axis; trend color is data-driven from `delta.trend`, and the icon chip adopts the active module color automatically.

```typescript
// packages/ui/components/data/stat.tsx
import * as React from 'react'
import { cn } from '../../utils/cn'

export interface StatDelta {
  /** Display string (e.g. "+12.4%", "-3 vs last week") */
  value: string
  /** Drives the color: success / danger / muted */
  trend: 'up' | 'down' | 'neutral'
}

export interface StatProps {
  /** Primary metric — the big number */
  value: string | number
  /** Caption above the value (uppercase, tracking-wider) */
  label: string
  /** Optional period-over-period change */
  delta?: StatDelta
  /** Optional icon chip; renders in active module color */
  icon?: React.ReactNode
  className?: string
}

// Trend → class mapping. Reads bare semantic color utilities,
// so the same component works on tinted and untinted backgrounds.
const TREND_COLOR: Record<StatDelta['trend'], string> = {
  up:      'text-success',
  down:    'text-danger',
  neutral: 'text-base-content/60',
}

export function Stat({ value, label, delta, icon, className }: StatProps) {
  return (
    <div className={cn(
      'rounded-lg bg-base-200 p-4',
      className,
    )}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-[var(--tracking-wider)] text-base-content/50">
          {label}
        </p>
        {icon && (
          <div className="rounded-md bg-module bg-soft p-1.5 text-module">
            {icon}
          </div>
        )}
      </div>
      <p className="text-2xl font-medium text-base-content">
        {value}
      </p>
      {delta && (
        <p className={cn('mt-1 text-xs', TREND_COLOR[delta.trend])}>
          {delta.value}
        </p>
      )}
    </div>
  )
}
```

Trend colors use the bare semantic color utilities (`text-success`, `text-danger`,
`text-base-content/60`) so the saturation reads correctly whether Stat sits on a tinted or plain
surface. The icon chip adopts the active module hue via `bg-module bg-soft` + `text-module` — no
module color prop, it follows the nearest `<ModuleProvider>`.

---

## 9. Component Inventory

The styled primitives below are imported from `@wizeworks/silicaui-react` (their appearance is the
plugin's `btn-*`/`badge-*`/… classes); `@sparx/ui` re-exports a few for API stability and adds the
compositions. The four-axis `color × variant × size × shape` API (doc 35) applies to the
action/status primitives.

### Primitives

| Component     | Key variants                                         | Notes                                                                                       |
| ------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `Button`      | color × variant (solid soft outline dash ghost link) | Sizes xs–xl; shapes square / circle / block / wide                                          |
| `Badge`       | color × variant (solid soft outline dash)            | Default `neutral / soft`; status pills via `statusTone()`                                   |
| `Input`       | silicaui — `color` × `size`                          | Not in `@sparx/ui`. `color` drives border + ring off one `--input-accent`                   |
| `Textarea`    | silicaui — `color` × `size`                          | Not in `@sparx/ui`                                                                          |
| `Select`      | silicaui — `color` × `size`                          | Not in `@sparx/ui`. Base UI listbox; `NativeSelect` for a bare platform `<select>`          |
| `Checkbox`    | silicaui — `color`                                   | Not in `@sparx/ui`                                                                          |
| `RadioGroup`  | silicaui — `color`                                   | Not in `@sparx/ui`                                                                          |
| `Switch`      | silicaui — `color`                                   | Not in `@sparx/ui`; module-aware via `color="module"`                                       |
| `Slider`      | silicaui — `color`                                   | Not in `@sparx/ui`                                                                          |
| `Avatar`      | silicaui — `color` × `shape` × `size`                | Not in `@sparx/ui`. `AvatarGroup` for stacks; `status` for a presence dot                   |
| `Skeleton`    | silicaui — `shape`                                   | Not in `@sparx/ui`                                                                          |
| `ButtonGroup` | silicaui `Join`                                      | Not in `@sparx/ui`. Segments a row of controls into one welded shape                        |
| `Spinner`     | —                                                    | Sizes: sm, md, lg; inherits current color. silica's equivalent is `Loading`                 |
| `Heading`     | levels 1–6                                           | Visual size via `level`; semantic tag via `as` override (e.g. visually H1, semantically H2) |
| `Text`        | default, muted, subtle, inverse, danger, success     | Sizes: xs, sm, md, lg; `as` polymorphism for `p` / `span` / `div` / `label`                 |

### Layout

| Component     | Key variants                             | Notes                                  |
| ------------- | ---------------------------------------- | -------------------------------------- |
| `Card`        | default, module, elevated, ghost, subtle | module = subtle module-tint background |
| `CardHeader`  | —                                        | Consistent header within Card          |
| `CardContent` | —                                        |                                        |
| `CardFooter`  | —                                        | Border-top, action area                |
| `Stack`       | —                                        | Vertical flex with gap prop            |
| `Grid`        | —                                        | CSS grid with cols + gap props         |
| `Divider`     | silicaui — `orientation`                 | Not in `@sparx/ui`                     |
| `Container`   | sm, md, lg, xl, full                     | Max-width containers                   |
| `ScrollArea`  | silicaui — `orientation`                 | Not in `@sparx/ui`                     |
| `Accordion`   | silicaui                                 | Not in `@sparx/ui`. Also `Collapsible` |

### Overlay

| Component         | Key variants                   | Notes                                           |
| ----------------- | ------------------------------ | ----------------------------------------------- |
| `Modal`           | sm, md, lg, xl                 | Wraps silicaui `Dialog`; adds `mobileSheet`     |
| `Drawer`          | silicaui — `side`              | Not in `@sparx/ui`                              |
| `Popover`         | silicaui — `side` × `align`    | Not in `@sparx/ui`                              |
| `Tooltip`         | —                              | Wraps Radix Tooltip                             |
| `Toast`           | success, warning, danger, info | Via sonner                                      |
| `AlertDialog`     | silicaui                       | Not in `@sparx/ui` — use `useConfirm` below     |
| `ConfirmProvider` | —                              | Mounts silica's imperative alert dialog         |
| `useConfirm`      | `color` (any silica color)     | Async confirm; defaults `danger`, defers a tick |
| `DropdownMenu`    | —                              | Wraps Radix DropdownMenu                        |
| `ContextMenu`     | silicaui                       | Not in `@sparx/ui`                              |
| `CommandPalette`  | silicaui                       | Not in `@sparx/ui`. ⌘K global search            |

### Navigation

| Component         | Key variants                   | Notes                                                                               |
| ----------------- | ------------------------------ | ----------------------------------------------------------------------------------- |
| `SidebarAppShell` | —                              | The sparx app chassis — rail + header + detail pane                                 |
| `Sidebar`         | silicaui                       | Not in `@sparx/ui`. `SidebarProvider` / `useSidebar`                                |
| `Tabs`            | silicaui — `variant` × `color` | Not in `@sparx/ui`. `variant="pills"` is the filled selection DESIGN.md §5 requires |
| `Breadcrumb`      | silicaui                       | Not in `@sparx/ui`                                                                  |
| `Pagination`      | silicaui — `color` × `size`    | Not in `@sparx/ui`                                                                  |
| `Stepper`         | silicaui `Steps`               | Not in `@sparx/ui`. Note the name change                                            |
| `NavigationMenu`  | silicaui                       | Not in `@sparx/ui`                                                                  |

### Data Display

| Component    | Key variants                                                                | Notes                                              |
| ------------ | --------------------------------------------------------------------------- | -------------------------------------------------- |
| `Table`      | —                                                                           | Wraps TanStack Table                               |
| `Stat`       | silicaui — `Stat`/`Stats` + `StatTitle`/`StatValue`/`StatDesc`/`StatFigure` | Not in `@sparx/ui`                                 |
| `Timeline`   | silicaui — `orientation`                                                    | Not in `@sparx/ui`. `TimelineStart`/`Middle`/`End` |
| `Alert`      | silicaui — `color` × `variant` × `size`                                     | Not in `@sparx/ui`                                 |
| `Kbd`        | silicaui — `size`                                                           | Not in `@sparx/ui`                                 |
| `EmptyState` | —                                                                           | Consistent zero-state UI                           |
| `Code`       | —                                                                           | Inline and block code                              |
| `Tag`        | —                                                                           | Removable chip/tag for filters                     |

### Form

Almost nothing here is ours. `Field` / `FieldLabel` / `FieldControl` / `FieldDescription` /
`FieldStatus` / `FieldError` are silicaui's and carry the whole label ↔ control ↔ description ↔
error contract (§8 above); so are `DatePicker`, `Calendar`, `FileUpload`, `Dropzone` and
`ColorPicker`. The shadcn-shaped react-hook-form adapter that used to live in `@sparx/ui`
(`Form`/`FormField`/`FormItem`/`FormLabel`/`FormControl`/`FormDescription`/`FormMessage`/
`useFormField`) reimplemented that same wiring and is **deleted** — pair RHF's own `<Controller>`
with `<Field>`.

What `@sparx/ui` still owns:

| Component             | Notes                                                                      |
| --------------------- | -------------------------------------------------------------------------- |
| `FormActionBar`       | The sparx save/cancel bar — dirty state, pending state, leave-guard        |
| `RichTextEditor`      | TipTap wrapper; silica ships no equivalent                                 |
| `SchemaFieldRenderer` | Renders a `SimpleField[]` as silica `Field` rows — the reference call site |

---

## 10. The `cn()` Utility

```typescript
// packages/ui/utils/cn.ts
import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Register the silica `soft` family as its own class groups. Default tailwind-merge
// classifies bg-soft/text-soft/border-soft as color utilities and would strip the
// preceding bg-<color> — so `bg-primary bg-soft` would collapse to just `bg-soft`.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'bg-soft': ['bg-soft'],
      'text-soft': ['text-soft'],
      'border-soft': ['border-soft'],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

This is the only place class manipulation happens. It handles:

- Conditional classes (`cn('base', isActive && 'active')`)
- Tailwind class deduplication (`cn('px-4', 'px-6')` → `'px-6'`)
- Keeping `bg-<color> bg-soft` intact (the `soft`-family registration above)
- Array and object class syntax

Feature code rarely calls `cn()`; component internals and layout composition use it.

---

## 11. Wiring silicaui into an app

There is no shadcn bootstrap step — the primitives ship in `@wizeworks/silicaui-react` and their
styling is emitted by the `@wizeworks/silicaui` Tailwind plugin. To wire a new dashboard-family app:

1. Add the workspace deps: `@wizeworks/silicaui`, `@wizeworks/silicaui-react`, `@sparx/brand`,
   `@sparx/ui`.
2. In `app/globals.css`, `@import 'tailwindcss'`, then `@import '@sparx/brand/theme.css'` (colors)
   and `@import '@sparx/ui/tokens.css'` (non-color), then register the plugin naming the palette
   (§5): `@plugin '@wizeworks/silicaui' { colors: primary, secondary, accent, neutral, info,
success, warning, error, danger, module }`.
3. Import primitives from `@wizeworks/silicaui-react`; import compositions
   (`ModuleProvider`, shell, `SurfaceFrame`, `statusTone`, `cn`, …) from `@sparx/ui`.
4. Wrap each module layout in `<ModuleProvider module="{module}">` so `--color-module` tracks the
   route.

---

## 12. Naming Conventions

### Variants

- **Semantic, not descriptive.** `color="danger"` not `color="red"`. `color="module"` not `color="teal"`.
- **Color vs treatment are separate axes:** `color` (primary / danger / module / …) picks the hue; `variant` (solid / soft / outline / ghost / link) picks the treatment.
- **Module-aware:** Components that can adopt the active module color accept `color="module"`.
- **Status:** `success`, `warning`, `danger`, `info` for state communication.

### Sizes

- Standard: `xs`, `sm`, `md`, `lg`, `xl`
- Icon-only is a `shape`, not a size: `shape="square" size="md"` (geometry × size, orthogonal).
- `md` is always the default.

### Props

- Boolean props: `loading`, `disabled`, `readOnly`, `required` — never `isLoading`, `isDisabled`
- Content props: `children`, `label`, `description`, `placeholder`
- Icon props: `leftIcon`, `rightIcon`, `icon` (for icon-only)
- Callback props: `onChange`, `onSubmit`, `onClose` — standard React conventions

---

## 13. Responsive Design

**Every sparx UI is mobile-first. A surface that doesn't work on a phone is a bug, not a "later" item.** The marketing site, the tenant dashboard, and the sites all have to render and remain usable from 320px up to 2560px wide. This is binding for any new feature or page.

### Breakpoints

Three named breakpoints. They're declared in [tokens.css](../packages/ui/src/tokens.css) and reused everywhere — never hardcode pixel widths in `@media` queries inside feature components.

| Name      | Range          | Typical device         |
| --------- | -------------- | ---------------------- |
| `mobile`  | ≤ 640px        | phones (portrait)      |
| `tablet`  | 641px – 1024px | tablets, small laptops |
| `desktop` | > 1024px       | laptops, monitors      |

### Mechanism — two tools, in this order

**1. `clamp()`-based responsive tokens (first choice).** Gutters, type scale, vertical section padding, and any value that should scale fluidly with viewport live in [tokens.css](../packages/ui/src/tokens.css) as `clamp(min, preferred, max)` expressions. Components reference the token; they don't see the breakpoint logic. Example:

```css
:root {
  --gutter-page: clamp(20px, 5vw, 80px);
  --section-py-lg: clamp(80px, 12vw, 140px);
  --display-hero: clamp(48px, 10vw, 120px);
}
```

This handles roughly half of all responsive concerns with zero per-component code.

**2. Named layout classes in `marketing.css` / `app.css` (for structural changes).** Things `clamp()` can't fix — collapsing a 4-column grid to 1 column, hiding the desktop nav, stacking a side-by-side layout — get semantic class names in a small per-app stylesheet. Apply via `className`. The §1 rule bans raw _Tailwind utilities_ in feature code; named layout primitives are fine.

```css
/* apps/web/app/marketing.css */
.grid-4-2-1 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}
@media (max-width: 1024px) {
  .grid-4-2-1 {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 640px) {
  .grid-4-2-1 {
    grid-template-columns: 1fr;
  }
}

.stack-on-mobile {
  display: flex;
  gap: 32px;
}
@media (max-width: 768px) {
  .stack-on-mobile {
    flex-direction: column;
  }
}

.hide-on-mobile {
  display: initial;
}
@media (max-width: 640px) {
  .hide-on-mobile {
    display: none;
  }
}
```

### Anti-patterns

- ❌ **Inline `@media` queries.** Inline `style={}` can't express media queries — don't try to fake it with `window.innerWidth` reads.
- ❌ **Hardcoded breakpoint pixels in components.** `if (width < 768)` belongs in the stylesheet, not the JSX.
- ❌ **Desktop-first thinking.** Don't author at 1440px and bolt on mobile fixes — the smaller layout is the base case.
- ❌ **Hidden content on mobile.** Hiding marketing copy or pricing on mobile is a content decision, not a layout one. Reflow it; don't drop it.

### Verification

Every new page or feature must be visually verified at **three viewports** before being marked done: 375px (mobile), 768px (tablet), 1440px (desktop). For marketing pages, also check 2560px to confirm the `Container` max-width holds.

---

## 14. Dark Mode

Dark mode is toggled by setting `data-theme="dark"` on the `<html>` element. All colors shift automatically via the dark `--color-*` overrides in `@sparx/brand/theme.css` (each color defined once, so there is no duplicate `:root` set to clobber the dark values). Components never implement their own dark mode logic — it's handled entirely at the token level.

```typescript
// apps/dashboard/app/providers.tsx
function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Reads from localStorage or system preference
  const { theme } = useTheme()

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  return <>{children}</>
}
```

---

## 15. Usage Rules for Feature Developers

**Tailwind is not banned from feature code — _reimplementing a component_ is.** There is
purpose in utilities throughout the apps: layout, positioning, spacing, sizing, and
one-off chrome (an absolutely-positioned indicator dot, a flex row, a responsive grid)
are composition, not design decisions, and belong in feature code. What does **not**
belong in feature code is rebuilding a styled, themed control out of utilities when a
`@wizeworks/silicaui-react` primitive (or a `@sparx/ui` composition) already exists.

The dividing line the linter enforces: **a background fill paired with a foreground text
color.** That pairing is the fingerprint of a re-skinned control (Button / Input / Badge /
Alert) — a colored surface carrying contrasting text. A lone background (the indicator dot)
or lone text-coloring is fine; the _pair_ is the tell.

```
✅ Layout / positioning / spacing / sizing utilities — flex, grid, gap-*, absolute,
   top-*, inset-*, w-*, h-*, p-*, m-*, col-span-*, z-*, overflow-*, truncate
✅ A single-purpose visual utility — one bg- on an indicator, one text-[var(--…)] to
   color a label, a lone rounded-full
✅ Named component variants — <Button color="danger" variant="soft" />, <Badge … />
✅ style={{ … }} referencing CSS vars from the token files for a truly one-off value

❌ A background FILL + a foreground TEXT COLOR together → you are re-skinning a control;
   use the silicaui-react primitive / its variant instead (this is what the lint rule flags)
❌ Interactive control states (hover:/focus:/disabled: on bg/border) rebuilt by hand
❌ Inline styles with hardcoded hex colors
❌ Importing CSS variables / raw Tailwind color classes to recreate an existing primitive
```

If no primitive fits, that is a signal to **reach for the right silica variant, or add a genuine
composition to `@sparx/ui`** — not to hand-style it in the app.

### ESLint Enforcement

The `no-restricted-syntax` rule lives in each app's `eslint.config.js` (applied to
`apps/**`, never `packages/ui/**`). It deliberately targets the re-skinning fingerprint —
fill + foreground color — and lets layout/positioning/lone-color utilities pass, so the
warnings that surface are the ~few that genuinely should be components, not hundreds of
layout false-positives.

```javascript
// apps/*/eslint.config.js — applied to apps/** but not packages/ui/**
{
  rules: {
    'no-restricted-syntax': [
      'warn',
      {
        // Flag a background FILL co-occurring with a foreground TEXT COLOR — the
        // fingerprint of reimplementing a styled control. Layout/positioning/
        // spacing, a lone bg, or lone text-color all pass through.
        selector:
          'JSXAttribute[name.name="className"][value.type="Literal"][value.value=/(?=.*(?:bg-\\[(?:var\\(|#|rgb|hsl|oklch)|bg-white|bg-black))(?=.*(?:text-\\[(?:var\\(|#|rgb|hsl|oklch)|text-white|text-black))/]',
        message:
          'This className pairs a background fill with a foreground text color — that reimplements a styled control (Button/Input/Badge/Alert). Use the @sparx/ui component or variant. Layout, spacing, and positioning utilities are fine.',
      },
    ],
  },
}
```

> Note: the rule is a **heuristic, not a judge.** It catches the common re-skinning shape;
> code review remains the backstop for subtler cases (e.g. a heavy selectable-card built
> from utilities that should become a component). When in doubt, prefer extracting a
> component/variant.

---

## 16. Scaffold checklist

When wiring the dashboard component stack, the moving parts are:

1. `@sparx/brand` owns `theme.css` — the `--color-*` authority (semantic palette + `--color-base-*`
   - the 18-module palette). Colors live here and nowhere else.
2. `@sparx/ui` keeps the compositions (§3), the non-color `tokens.css`, and the helpers
   (`cn` with the `soft`-family `extendTailwindMerge`, `pluginColor`, `statusTone`).
3. Styled primitives come from `@wizeworks/silicaui-react`; their classes from the
   `@wizeworks/silicaui` plugin.
4. Each app's `globals.css` imports both token files and registers the plugin naming the palette
   (§5).
5. `ModuleProvider` (§7) sets `--color-module` per route; module layouts wrap their subtree in it.
6. Add workspace references and import the token CSS in each app's root layout.

The goal: feature code in apps/ reaches for silica primitives + layout utilities, never a
hand-skinned control. If a `bg-fill + text-color` pair appears, something went wrong (§15).

---

## 17. Composition: basic vs composite

Every component carries a **composition class** — `basic` or `composite` — alongside
its other facets. It answers one question the existing axes don't: _is this thing
built out of other named components?_ It applies across `@sparx/ui`,
`@sparx/site-ui`, and the Builder component registry.

- **basic** — self-contained; composes no other named component. Atoms of the
  system: `Button`, `Heading`, `Text`, `Badge`, `Icon`, `Divider`, `NavMenu`,
  `Logo`, `Drawer`, `Navbar` (a structural slot shell — it _exposes_ slots but
  composes nothing itself).
- **composite** — assembles two or more other components into a higher-order
  pattern: `CollapsibleNav` (= `NavMenu` + `Drawer`), `EditorialSection`
  (= `Heading` + `Text` + `Button`), `BuyBox` (= `PriceTag` + `VariantPicker` +
  `Quantity` + `AddToCart`), `FeatureGrid`, `FAQ`, `Carousel`, `Signup`.

### Why it's its own axis

It is **orthogonal** to the facets we already track — it is not a synonym for any
of them, which is exactly why it earns a place:

| Axis                                 | Answers                                 |
| ------------------------------------ | --------------------------------------- |
| `kind`: container / leaf             | Does it nest arbitrary author children? |
| `group`: layout / content / data     | What is it _for_ (purpose)?             |
| `bindable` (Tier-1 / Tier-2)         | Is it data-aware?                       |
| **`composition`: basic / composite** | **Is it built from other components?**  |

`CollapsibleNav` proves the independence: it is a _leaf_ (no arbitrary children),
its purpose is _navigation_, it is _not bindable_ — yet it is _composite_. None of
the other axes capture that.

### What it drives

1. **Palette signal.** The Builder Add palette marks composite tiles with a small
   corner glyph (`bx-tile__kind`), so an author sees at a glance that a tile drops
   a higher-order pattern (which expands into sub-parts) rather than an atom.
2. **Machine-readable metadata.** The Builder registry sets `composition` on every
   `ComponentDef` from a single taxonomy list (`COMPOSITE_TYPES`) — read it via
   `getDef(type)` or `compositionOf(type)`. One list, legible to people and agents;
   never hand-set on a def literal.
3. **Library catalog.** `@sparx/site-ui` components declare their class in a
   `Composition: BASIC | COMPOSITE` header line (the convention seed lives on the
   nav family — `NavMenu`, `Navbar`, `Drawer`, `CollapsibleNav`). Remaining
   components adopt the line as they're touched (a full sweep is a follow-up).

### Maintenance signal

Composites are where **canvas↔live render drift concentrates** (docs/62): a
component that assembles sub-elements with layout is exactly where the editor
canvas's approximation diverges from the published render. So the `composite` flag
doubles as a prioritized audit target — when reconciling the two renderers, fix
composites first.
