# @sparx/ui Variant System (multi-axis)

**Version:** 1.2.2
**Author:** Brandon Korous
**Last Updated:** 2026-07-08

---

## 1. Purpose & scope

`@sparx/ui` is mature (~50 components) but most color-bearing components conflate
**color and style into a single `variant` axis**. Button's `variant` mixes
`primary | secondary | outline | soft | ghost | link | danger | warning | module |
module-outline` — you cannot ask for a "soft danger" or an "outline success" because
those cells don't exist. Badge and Tag have the same problem with different ad-hoc sets.

This doc defines a **DaisyUI-style multi-axis API** for color-bearing components:

```
color   ×   variant   ×   size   ×   shape
```

so `<Button color="danger" variant="soft" size="lg" shape="wide" />` is expressible
without enumerating the cartesian product by hand.

> **Status: shipped on silicaui.** The four axes below are exactly what shipped, but the
> _resolution mechanism_ is no longer the hand-rolled `.sx-c-*` role-var recipe this doc
> originally proposed. The dashboard migrated 100% onto **silicaui** (`@wizeworks/silicaui`, a
> Tailwind v4 plugin) — it emits the `color × variant × size × shape` classes
> (`btn-<color> btn-<variant> btn-<size> btn-<shape>`) directly, and the semantic palette lives
> in **`@sparx/brand/theme.css`** (`--color-primary/secondary/accent/neutral/info/success/warning/
error/danger` + `-content`) rather than `@sparx/ui`'s `tokens.css`. `sparx` and `silica` are the
> same design language, so the API here is API-identical to what silica ships. §3–§4 below are
> updated to the silica mechanism; the axis semantics (§2) are unchanged.

### Decisions locked (2026-05-31)

| #   | Decision            | Choice                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **API shape**       | **Orthogonal axes.** `color × variant × size × shape`. Breaking — call sites are migrated in the same pass (codemod, §7).                                                                                                                                                                                                                                                                                         |
| 2   | **Token layer**     | **Bring v2 palette into @sparx/ui.** Add `accent/info/neutral` + `-content` pairs + `color-mix` hover/tint to `tokens.css`. Deviates from doc 33 §6 — see §3.4.                                                                                                                                                                                                                                                   |
| 3   | **Scope**           | **Comprehensive.** A pass over the whole inventory: full `color × variant` on Tier-A action/status components, state-color + size on Tier-B controls, structural variants on Tier-C, plus net-new staples (Alert, Progress, Kbd, StatusDot, ButtonGroup, Collapse/Accordion). See §5.                                                                                                                             |
| 4   | **Color mechanism** | **Superseded → silicaui plugin classes.** Originally role-variable indirection (`.sx-c-*` remapping `--c-bg`/`--c-content`/…). As shipped, silicaui's Tailwind plugin statically emits `btn-<color>`/`bg-<color>`/`bg-soft`/… for every registered slot, so `color × variant` composes at the class level (§4). The Radix controls that can't take a color class use a per-instance `--sx-sel` via `colorVars()`. |

> **Relationship to Token Model v2 (doc 33).** Doc 33 §6 deliberately scoped `@sparx/ui`
> _out_ of the v2 token refactor ("the dashboard depends on them and that's out of scope").
> Decision #2 here **reverses that for the palette only**: we adopt v2's _color vocabulary_
> (semantic slots + `-content` pairs + OKLCH derivation) in the dashboard token layer so the
> `color` axis has something coherent to bind to. We do **not** adopt v2's storage model,
> compile pipeline, or `--st-*` layer — those stay site-only. Doc 33 §6 is amended by
> this doc; the site and dashboard now share a token _shape_ but keep separate _layers_
> (`--st-*` vs `--color-*`).

---

## 2. The four axes

### 2.1 `color` — semantic palette

| Token       | Meaning                           | Notes                                   |
| ----------- | --------------------------------- | --------------------------------------- |
| `primary`   | Brand action                      | = `--color-primary` (`#6366F1`)         |
| `secondary` | Brand-adjacent secondary identity | new; defaults to a slate/indigo-muted   |
| `accent`    | Pop / highlight                   | new                                     |
| `neutral`   | Default, low-chroma UI            | new; the "no color specified" default   |
| `info`      | Informational status              | new themeable                           |
| `success`   | Positive status                   | normalizes existing `--color-success*`  |
| `warning`   | Caution status                    | normalizes existing `--color-warning*`  |
| `danger`    | Destructive / error status        | normalizes existing `--color-danger*`   |
| `module`    | The active module's color         | reads `--color-module` (ModuleProvider) |

`module` is special: it tracks `--color-module` so a `<Button color="module">` inside a
`<ModuleProvider module="cms">` is teal automatically (existing behaviour, kept). `ModuleProvider`
now sets **only** `--color-module` (+ `-content`) on its subtree; the old `--module-active*` family
is gone.

`<Card variant="module">`'s tint background is the universal `soft` treatment — `bg-module bg-soft`,
which paints `color-mix(in oklab, var(--color-module) 15%, var(--color-base-100))`, theme-aware and
computed once. It follows the nearest `<ModuleProvider>`: wrap a cross-module panel in its provider
and its `module` cards re-tint with no props. The Card `accent` prop is an **escape hatch** for a
one-off color with no surrounding provider (it sets `--sx-sel`) — not the normal way to color a card.

### 2.2 `variant` — style / treatment

| Token     | Treatment                                                   | silica class                             |
| --------- | ----------------------------------------------------------- | ---------------------------------------- |
| `solid`   | Filled: `bg-<color>`, `text-<color>-content`                | bare `btn`                               |
| `soft`    | Tinted: `bg-<color> bg-soft`, `text-<color>` (low-emphasis) | `btn-soft`                               |
| `outline` | Bordered transparent: `border-<color>`, `text-<color>`      | `btn-outline`                            |
| `dashed`  | `outline` + dashed border                                   | **`btn-dash`** (silica spells it `dash`) |
| `ghost`   | No border/bg, `text-<color>`, hover → tint                  | `btn-ghost`                              |
| `link`    | Inline text link, underline-on-hover, no padding/height     | `btn-link`                               |

`solid` is the default treatment for Button; `soft` for Badge/Tag; `soft` for Alert. A `soft` fill
is `bg-<color> bg-soft` — there are no baked `-tint` tokens; `bg-soft` mixes the current accent into
the base surface, so it is theme-aware and can't drift.

### 2.3 `size`

`xs | sm | md | lg | xl`. Unchanged set; applies to height + padding + text size.
(Badge/Tag use a reduced subset — `sm | md | lg`.)

### 2.4 `shape` — geometry modifier (Button-centric)

| Token     | Effect                                              |
| --------- | --------------------------------------------------- |
| (default) | Auto width, normal horizontal padding               |
| `wide`    | Extra horizontal padding / `min-width` for emphasis |
| `block`   | `w-full` — fills its container                      |
| `square`  | 1:1, icon-only, field radius                        |
| `circle`  | 1:1, icon-only, fully rounded                       |

`square`/`circle` **replace** Button's current `icon-sm/icon-md/icon-lg` sizes —
icon buttons become `shape="square" size="md"` (geometry × size, orthogonal).

---

## 3. Color tokens (`@sparx/brand/theme.css`) + silica derivation

### 3.1 Per-color pair (stored)

Every semantic color is stored as a **base + content pair** in `@sparx/brand/theme.css` — no
stored hover/tint quartet; those are derived at the class level by silicaui:

```css
--color-{c}:          /* base fill (hex, stored)     */
--color-{c}-content:  /* text/icon on the base fill  */
```

The registered slots are `primary secondary accent neutral info success warning error danger`
(+ `module`, set by `ModuleProvider`). Light `--color-primary: #6366f1` / dark `#818cf8`;
`--color-secondary: #db2777` / `#f472b6`; warning keeps its dark amber ink `--color-warning-content:
#422006`. Each color is defined **once** (light + dark selectors), so there is no duplicate `:root`
set to clobber the dark values — the old duplication was a real bug, now dead.

### 3.2 Derivation is done by silica, not stored tokens

There are **no** `--color-{c}-hover` / `--color-{c}-tint` tokens. The `soft` treatment is the
plugin's `bg-soft` utility: `bg-<color> bg-soft` paints `color-mix(in oklab, var(--color-<color>)
15%, base)`, theme-aware and computed once. Solid hover comes from silica's own state classes. So a
single base hex yields a coherent set and dark mode adapts for free, with nothing to keep in sync.

### 3.3 Reading surfaces + text opacity

Surfaces are `--color-base-100` (topmost reading surface) / `--color-base-200` (page ground) /
`--color-base-300` (deepest / borders); text is `--color-base-content` with opacity modifiers for
the rest (`text-base-content/70` secondary, `/60` muted, `/50` tertiary, `/40` disabled). Borders
are `border-base-300` (default) / `border-base-content/30` (strong). The old `--color-bg-*` /
`--color-surface-*` / `--color-text-*` / `--color-border-*` names are gone.

### 3.4 What lives elsewhere / is unchanged

- Non-color tokens (`--space-*`, `--radius-*`, `--shadow-*`, type, motion, `--chart-*`) stay in
  `packages/ui/src/tokens.css`. Shape/rhythm is unchanged in the dashboard.
- No change to the `--st-*` layer or `@sparx/site-themes` (the site system is untouched — its
  `--st-*` bridge now simply targets silica base tokens: `colorBackground → --color-base-200`,
  `colorForeground → --color-base-content`, `colorPrimary → --color-primary`).

---

## 4. Color via silicaui plugin classes

### 4.1 The mechanism

silicaui's Tailwind v4 plugin **statically emits a component class per axis value** from the
registered palette (§5 of doc 23). A `<Button color variant size shape>` maps to a class string:

```
btn  btn-<color>  btn-<variant>  btn-<size>  btn-<shape>
```

- **color** → `btn-primary / btn-secondary / btn-accent / btn-neutral / btn-info / btn-success /
btn-warning / btn-error / btn-danger / btn-module`
- **variant** → bare `btn` (solid), `btn-soft`, `btn-outline`, `btn-dash` (dashed), `btn-ghost`,
  `btn-link`
- **size** → `btn-xs … btn-xl`
- **shape** → `btn-square / btn-circle / btn-block / btn-wide`

`color × variant` **composes automatically** at the class level — the plugin already emitted every
`btn-<color>` and every `btn-<variant>`, so there is no cartesian product, no `compoundVariants`, no
codegen, and no per-component Tailwind authoring. The same holds for `badge-*`, `alert-*`,
`bg-<color>` + `bg-soft`, etc. `module` tracks `--color-module` (set by `ModuleProvider`), so
`<Button color="module">` inside `<ModuleProvider>` stays automatic.

For the few **Radix-based controls** (Checkbox/Radio/Switch/Slider) that can't take a plugin color
class, `@sparx/ui` sets a per-instance `--sx-sel` / `--sx-sel-fg` via the `colorVars(color)` helper,
consumed by `data-[state=checked]:bg-[var(--sx-sel)]`-style classes.

### 4.2 Why plugin emission wins — custom theme colors

Because the plugin emits static classes for every registered slot, a tenant/theme color change does
**not** require rebuilding the component package:

- **Re-skinning an existing slot** (the common case): the theme overrides the _value_ —
  `--color-primary: <their hex>` in the theme layer — and every `bg-primary` / `btn-primary` /
  `bg-primary bg-soft` element updates live (the `soft` mix recomputes). Zero component change.
- The plugin's build-time emission is satisfied **once, for every registered color that will ever
  exist** — the property a per-component codegen approach could not provide.

### 4.3 Component usage

```tsx
// Feature code — the primitive from @wizeworks/silicaui-react; the classes are the plugin's.
import { Button } from '@wizeworks/silicaui-react';

<Button color="danger" variant="soft" size="lg" shape="wide">
  Delete
</Button>;
// → class="btn btn-danger btn-soft btn-lg btn-wide"

<Button>Save</Button>; // defaults: primary / solid / md
<Button color="module" variant="outline" />; // module hue from the nearest ModuleProvider
```

Defaults stay `color="primary" variant="solid" size="md"` so a bare `<Button>` is visually
unchanged from the old sparx four-axis — the primitive swap was mechanical because the two systems
share the API.

---

## 5. Components

**Framing.** The styled primitives are silicaui's (`@wizeworks/silicaui-react`), their appearance
emitted by the silica plugin; the few interactive controls `@sparx/ui` keeps are Radix-backed
shells that emit silica classes. Each component carries the axes that fit its semantics, backed by
the `@sparx/brand` palette and the plugin classes (§4). Not every component takes a full color
palette: action/status components do; structural ones take a relevant subset (size, a
validation/state color, an accent). Axis treatments (`solid/soft/outline/…`) are silica utilities
shared across Button/Badge/Tag/Alert, so the four-axis surface is uniform.

### 5.1 Tier A — full color axis (`color × variant` via role vars)

| Component             | variant set                          | size  | shape / extra                  | default                |
| --------------------- | ------------------------------------ | ----- | ------------------------------ | ---------------------- |
| Button                | solid soft outline dashed ghost link | xs–xl | wide / block / square / circle | `primary / solid / md` |
| Badge                 | solid soft outline dashed            | sm–lg | —                              | `neutral / soft / md`  |
| Tag                   | solid soft outline                   | sm–lg | removable                      | `neutral / soft / md`  |
| **Alert** _(new)_     | soft solid outline                   | sm–lg | title/desc/icon/dismiss        | `info / soft / md`     |
| **Progress** _(new)_  | solid soft                           | sm–lg | determinate + indeterminate    | `primary / solid / md` |
| **StatusDot** _(new)_ | solid soft                           | sm–lg | optional pulse                 | `neutral / solid / md` |

Default Button color stays **`primary`** (keeps today's bare-`<Button>` behaviour;
decision 2026-05-31).

### 5.2 Tier B — color on a state, not full palette

Color applies to the **active/checked/validation** part only; sensible default color so
existing call sites are unaffected.

| Component              | color usage                                                                                      | other axes      |
| ---------------------- | ------------------------------------------------------------------------------------------------ | --------------- |
| Checkbox               | checked fill (`primary` default)                                                                 | size sm/md/lg   |
| Switch                 | on-state track (`primary` default)                                                               | size sm/md/lg   |
| RadioGroup / RadioItem | selected dot (`primary` default)                                                                 | size sm/md/lg   |
| Slider                 | range/thumb (`primary` default)                                                                  | size sm/md/lg   |
| Input / Textarea       | keep `variant` **state** (default/error/**success**); state maps to a color (`danger`/`success`) | size sm/md/lg   |
| Select (trigger)       | same state model as Input                                                                        | size sm/md/lg   |
| Spinner                | optional `color` (default `neutral` → `currentColor`)                                            | size (existing) |

### 5.3 Tier C — structural variants (token-driven, no color palette)

| Component                        | change                                                                                                                                                            |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Card                             | keep `variant` (default/elevated/module/outline); `module` tint follows the nearest `<ModuleProvider>` (`accent` is a one-off escape hatch, §2.1); `padding` size |
| Tabs                             | keep `variant` (underline/pills); add `size`                                                                                                                      |
| Avatar                           | already size × shape — align `shape` naming (circle/square) with Button                                                                                           |
| **ButtonGroup** _(new)_          | segmented/joined buttons (DaisyUI `join`); orientation + shared size/color passthrough                                                                            |
| **Collapse / Accordion** _(new)_ | Radix Accordion shell; `variant` (bordered/ghost/separated)                                                                                                       |
| **Kbd** _(new)_                  | keyboard-key chip; `size` only                                                                                                                                    |

### 5.4 Unchanged (single-axis where `variant` is genuinely not a color)

`Text` (`muted`…), `Heading`, `Code`, `Stack`/`Grid`/`Container`/`Divider`,
`Skeleton`, `Stat`, `Timeline`, `EmptyState`, `Breadcrumb`, `Pagination`, `Stepper`,
overlays (`Modal`/`Drawer`/`Popover`/`Tooltip`/menus) keep their current APIs. The
`color × variant` split applies only to Tier A; we do **not** touch the ~750 non-color
`variant=` usages.

---

## 6. Migration mapping (old → new)

### 6.1 Button

| Old `variant`    | New props                               |
| ---------------- | --------------------------------------- |
| _(none / bare)_  | _(unchanged — default stays `primary`)_ |
| `primary`        | _(drop — it's the default)_             |
| `secondary`      | `variant="outline"` (neutral)           |
| `outline`        | `variant="outline"` (neutral)           |
| `soft`           | `color="primary" variant="soft"`        |
| `ghost`          | `variant="ghost"` (neutral)             |
| `link`           | `color="primary" variant="link"`        |
| `danger`         | `color="danger"`                        |
| `warning`        | `color="warning"`                       |
| `module`         | `color="module"`                        |
| `module-outline` | `color="module" variant="outline"`      |
| `size="icon-sm"` | `shape="square" size="sm"`              |
| `size="icon-md"` | `shape="square" size="md"`              |
| `size="icon-lg"` | `shape="square" size="lg"`              |

### 6.2 Badge / Tag

| Old `variant` | New props                        |
| ------------- | -------------------------------- |
| `default`     | _(none)_ → `neutral / soft`      |
| `secondary`   | `variant="outline"`              |
| `primary`     | `color="primary"` (soft default) |
| `success`     | `color="success"`                |
| `warning`     | `color="warning"`                |
| `danger`      | `color="danger"`                 |
| `module`      | `color="module"`                 |
| `soft`        | `color="primary"`                |
| `outline`     | `variant="outline"`              |

### 6.3 Codemod

`scripts/migrate-variants.mjs` (ts-morph or jscodeshift) walks `apps/**/*.tsx`, and for
JSX elements named `Button`/`Badge`/`Tag` only, rewrites the `variant`/`size` attributes
per the tables above. Non-color components and any `variant` value not in the tables are
left untouched. The script prints a per-file diff summary; we review before committing.
Anything the codemod can't safely resolve (spread props, computed variant) is reported,
not guessed, and fixed by hand.

---

## 7. Build order

> **Superseded by the silicaui migration.** Steps 1–2 below (the `--c-*` role-var recipe + the
> `.sx-c-{color}` mapping classes + per-color quartets in `tokens.css`) describe the original
> hand-rolled plan. As shipped, the palette lives in `@sparx/brand/theme.css` (base + content pairs
> only) and the axis classes are emitted by silicaui's plugin (§4) — no quartets, no `.sx-c-*`. The
> codemod / showcase / verify steps (3–6) still describe the sparx-internal migration accurately.

1. **Tokens** — add the per-color quartets (`--color-{c}` / `-content` / `-hover` / `-tint`)
   with `color-mix` derivation + legacy aliases to `tokens.css`; add the `.sx-c-{color}`
   role-var mapping classes (§4.1); add `neutral`/`secondary`/`accent`/`info` dark-mode
   bases. _No component change yet; nothing breaks._ _(As shipped: replaced by `@sparx/brand`
   base+content pairs + the silica plugin.)_
2. **Refactor color-bearing components** — Button, Badge, Tag onto the four axes. Variant
   treatments authored once against `--c-*` role vars (§4.1); `color` maps to `sx-c-${color}`
   with a `string` escape hatch for runtime custom colors. Clean break on the old `variant`
   values — the codemod handles call sites (decision #1). _(As shipped: the primitives are
   silicaui's; `color`/`variant` map to `btn-<color>`/`btn-<variant>`.)_
3. **Codemod the apps** — run `migrate-variants.mjs`, review diffs, fix reported edge cases.
4. **Net-new components** — Alert, Progress, Kbd, StatusDot, ButtonGroup; export from barrel.
5. **Showcase** — rebuild `apps/dashboard/app/showcase/page.tsx` to render the **full
   matrix**: every color × every variant for Button/Badge/Tag/Alert, all sizes, all shapes,
   and each net-new component. The showcase is the acceptance surface — if a cell is missing
   it's a gap.
6. **Verify** — `pnpm --filter @sparx/ui typecheck && pnpm --filter dashboard typecheck`,
   lint (ESLint Tailwind rule still green — raw classes only inside `@sparx/ui`), and a
   visual pass of `/showcase` in light + dark.

Mobile: the showcase and every new component follow the existing responsive rule — the
matrix grids collapse to fewer columns on small screens (no fixed desktop-only layout).

---

## 8. Risks & open items

- **Default color.** Button default stays `primary` (decision 2026-05-31), so bare
  `<Button>` is visually unchanged and the codemod leaves bare buttons alone — it only
  rewrites explicit old `variant`/`size` values. Badge/Tag default to `neutral` (matches
  today's `default` variant).
- **`color-mix(in oklch …)` support.** Evergreen browsers only — fine for the dashboard
  (authenticated app, modern browsers). Unlike the site we do not SSR-derive to hex;
  if a legacy browser matters later we precompute. Noted, not blocking.
- **Runtime custom colors.** The registered slots are fixed at the plugin's `colors:` list (§5,
  doc 23). A one-off color with no registered slot uses the `accent` escape hatch (a per-instance
  `--sx-sel` via `colorVars()`), not a new `btn-<name>` class. Introducing a genuinely new named
  slot means adding it to the plugin's `colors:` list and rebuilding — a deliberate, not runtime,
  act (the dashboard is a fixed house palette, unlike per-tenant site themes).
- **AA contrast on arbitrary `-content`.** Our palette is fixed (not tenant-set), so
  `-content` pairs are authored to clear AA once; no runtime contrast concern here (that's
  the site's problem, doc 33 §8).
- **Scope creep toward full DaisyUI.** Accordion, radial progress, indicator-badge are
  deferred (§5.2); don't pull them in without a trigger.

---

## 9. Status pills — color IS the signal (`statusTone`)

**A status pill is just a `<Badge>` with a semantic color — there is NO separate
`StatusBadge` component.** A pill that renders every status in the same `neutral`
tone (or worse, `variant="outline"` with no color) carries zero information at a
glance — "active" and "draft" look identical and the surface reads bland. The
binding rule, platform-wide (lists, detail headers, tables, pickers — everywhere a
status appears):

1. **Every status pill carries a semantic color.** Map the status to one of
   `success` (live / good / settled), `warning` (needs attention / not-yet-live /
   partial), `info` (in motion), `danger` (failure / terminal-bad), or `neutral`
   (inert / retired). Green = good, amber = attention, red = problem, grey = inert.
2. **Use the canonical resolver.** `statusTone(status)` and `statusLabel(status)`
   are exported from `@sparx/ui` (`utils/statusTone.ts`); `Badge` is the silica primitive.
   The dictionary covers the universal business-status vocabulary, so the default is one line:
   ```tsx
   import { Badge } from '@wizeworks/silicaui-react';
   import { statusTone, statusLabel } from '@sparx/ui';
   <Badge color={statusTone(s)} variant="soft" size="sm">
     {statusLabel(s)}
   </Badge>;
   ```
   When a domain reads a word differently than the default (e.g. a _completed_
   booking is inert, not a win), pass `color` explicitly or keep a small curated
   map (scheduling, automations already do) — but never hand-pick ad-hoc colors
   per call site.
3. **It's a real `<Badge>`, sized by prop.** Never hand-roll a `<span>` pill, and
   never resize with `className="text-xs"` — use `size="sm"`. A background fill +
   foreground text color built by hand is the re-skin the ESLint rule flags
   (§docs/23 §1/§15).

This is a `surface-review` rubric check (System fidelity): a neutral/outline status
pill where a tone applies is a deduction.
