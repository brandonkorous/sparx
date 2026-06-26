---
name: Sparx Operator Console
description: One neutral, instrument-grade chassis where color follows functionality — each module's hue marks its own functionality wherever it appears, over a semantic status set.
colors:
  sparx-indigo: '#6366f1'
  indigo-hover: '#4f46e5'
  indigo-subtle: '#818cf8'
  module-commerce: '#f97316'
  module-cms: '#14b8a6'
  module-crm: '#06b6d4'
  module-email: '#0ea5e9'
  module-b2b: '#475569'
  module-invoicing: '#65a30d'
  module-ai: '#ec4899'
  module-dropship: '#10b981'
  module-inventory: '#f59e0b'
  module-chat: '#8b5cf6'
  module-scheduling: '#f43f5e'
  module-automations: '#d946ef'
  module-seo: '#eab308'
  accent: '#8b5cf6'
  secondary: '#64748b'
  neutral-ink: '#1f2937'
  success: '#10b981'
  warning: '#f59e0b'
  warning-content: '#422006'
  danger: '#ef4444'
  info: '#0ea5e9'
  bg-page: '#fafafa'
  bg-surface: '#ffffff'
  bg-subtle: '#f4f4f5'
  bg-muted: '#e4e4e7'
  border-default: '#e5e5e5'
  border-strong: '#d4d4d8'
  text-primary: '#0a0a0a'
  text-secondary: '#52525b'
  text-tertiary: '#a1a1aa'
  text-muted: '#71717a'
typography:
  display:
    fontFamily: 'Geist, Inter, system-ui, sans-serif'
    fontSize: '2.25rem'
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: '-0.025em'
  headline:
    fontFamily: 'Geist, Inter, system-ui, sans-serif'
    fontSize: '1.875rem'
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: '-0.025em'
  title:
    fontFamily: 'Geist, Inter, system-ui, sans-serif'
    fontSize: '1.25rem'
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: 'normal'
  body:
    fontFamily: 'Geist, Inter, system-ui, sans-serif'
    fontSize: '0.9375rem'
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 'normal'
  label:
    fontFamily: 'Geist, Inter, system-ui, sans-serif'
    fontSize: '0.6875rem'
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: '0.05em'
  mono:
    fontFamily: 'Geist Mono, JetBrains Mono, monospace'
    fontSize: '0.8125rem'
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 'normal'
rounded:
  sm: '4px'
  md: '6px'
  lg: '8px'
  xl: '12px'
  full: '9999px'
spacing:
  '1': '4px'
  '2': '8px'
  '3': '12px'
  '4': '16px'
  '5': '20px'
  '6': '24px'
  '8': '32px'
  '12': '48px'
components:
  button-primary:
    backgroundColor: '{colors.sparx-indigo}'
    textColor: '#ffffff'
    rounded: '{rounded.md}'
    height: '36px'
    padding: '0 16px'
  button-primary-hover:
    backgroundColor: '{colors.indigo-hover}'
    textColor: '#ffffff'
  button-soft:
    textColor: '{colors.sparx-indigo}'
    rounded: '{rounded.md}'
    height: '36px'
    padding: '0 16px'
  button-outline:
    textColor: '{colors.text-primary}'
    rounded: '{rounded.md}'
    height: '36px'
    padding: '0 16px'
  card:
    backgroundColor: '{colors.bg-surface}'
    rounded: '{rounded.lg}'
    padding: '16px'
  input:
    backgroundColor: '{colors.bg-surface}'
    textColor: '{colors.text-primary}'
    rounded: '{rounded.md}'
    height: '36px'
    padding: '0 12px'
  badge:
    rounded: '{rounded.full}'
    padding: '2px 8px'
---

# Design System: Sparx Operator Console

## 1. Overview

**Creative North Star: "The Spectrum Operator"**

The dashboard is one neutral, instrument-grade chassis that holds the entire module spectrum — Commerce
orange, CMS teal, CRM cyan, Builder indigo, AI rose, and ten more. The chrome (sidebar, surfaces, type,
borders) is a calm, near-monochrome instrument; **color is the live signal, and it follows the
functionality.** The active route tints the chrome and its native content, but any panel that surfaces
_another_ module's functionality wears _that_ module's hue — a product page's inventory panel is amber,
its SEO panel yellow, a linked customer cyan. One screen therefore carries several module hues at once,
each scoped to the block it represents: color is wayfinding, never decoration. Switch modules and the
same console re-composes in place — the layout, the affordances, the component vocabulary never change.
That is the product thesis made visual: _one product, many modules._

The personality is **confident, modular, and modern**: plain-spoken and exact, never decorative for its
own sake, but **tactile** where it counts — surfaces respond crisply, hover and focus are felt, state is
immediate (175ms). It is built for tenant operators of any vertical — a publisher, a CRM team, a B2B
distributor, a merchant — so nothing about it reads as built for one industry. It explicitly **rejects
generic AI-slop SaaS**: no cream/sand/parchment backgrounds, no tiny uppercase tracked eyebrows over every
section, no endless identical icon-card grids, no big-number hero-metric template, no gradient text. If a
screen could be guessed from the word "dashboard" alone, it is wrong.

**Key Characteristics:**

- **Neutral chassis, colored signal.** The interface is near-monochrome; color is the _signal_ and it
  follows meaning — each module's functionality wears its own hue wherever it appears (nestable
  `<ModuleProvider>`), over a semantic status set (success/warning/danger/info). The chassis stays
  neutral; the multiplicity lives in the signals, never in fills.
- **Module color as identity** (14 fixed hues), driven automatically by `<ModuleProvider>` — no per-screen
  conditional styling.
- **Four-axis components** (`color × variant × size`) from `@sparx/ui`; feature code never re-skins a control.
- **Flat by default.** Depth is tonal layering, not shadow. Shadows appear only for true elevation.
- **Geist, two weights** (400 / 500). A fixed rem scale, not fluid type — this is product, not marketing.
- **WCAG 2.1 AA**, visible focus rings, `prefers-reduced-motion` honored, structural responsive collapse.

## 2. Colors

A near-monochrome neutral system carrying a 14-color module spectrum and a strict semantic-status set;
warmth is never decorative.

### Primary

- **Sparx Indigo** (`#6366f1`): The brand. The Builder/Storefront module color and the default active
  module. Primary actions, focus rings (`#6366f1` at 25% as a 3px ring), current selection, links. Hover
  deepens to **Indigo Hover** (`#4f46e5`).

### The Module Spectrum

Each module owns exactly one hue, and that hue surfaces **wherever the module's functionality appears** —
its marketing domain, its sidebar nav item, the 3px top stripe on its cards, and any panel / badge /
action representing that module _even when embedded in another module's screen_ (a product page's
inventory panel wears inventory amber). `--module-active` is set at runtime by the **nearest**
`<ModuleProvider>`, which is nestable — wrap a cross-module panel in its own `<ModuleProvider module="…">`
and everything beneath it re-tints with no props. Any component on the `module` color slot adopts the
nearest provider's hue.

- **Commerce** Orange (`#f97316`) · **CMS** Teal (`#14b8a6`) · **CRM** Cyan (`#06b6d4`) · **Email** Sky
  (`#0ea5e9`) · **B2B** Slate (`#475569`) · **Invoicing** Lime (`#65a30d`) · **AI/MCP** Rose (`#ec4899`,
  deliberately outside the cool system — different in kind) · **Dropship** Emerald (`#10b981`) ·
  **Inventory** Amber (`#f59e0b`) · **Live Chat** Violet (`#8b5cf6`) · **Scheduling** Rose-Red (`#f43f5e`)
  · **Automations** Fuchsia (`#d946ef`) · **SEO** Yellow (`#eab308`) · **Builder/Storefront** Indigo
  (`#6366f1`, inherits primary).

Every color slot derives its full treatment set from one base via `color-mix` in OKLCH (in the `.sx-c-*`
role classes): `--c-ink` (base → 60% toward text), `--c-hover` (86% toward text), `--c-tint` (14% over
transparent). One base hex yields a coherent solid / soft / outline / ghost set in **both** light and dark
mode, because the mix targets `--color-text-primary`, which flips per mode.

### Semantic (status only)

- **Success** Emerald (`#10b981`) · **Warning** Amber (`#f59e0b`) · **Danger** Red (`#ef4444`) · **Info**
  Sky (`#0ea5e9`) · **Accent** Violet (`#8b5cf6`) · **Secondary** Slate (`#64748b`) · **Neutral Ink**
  (`#1f2937`, inverts to a light fill in dark mode so a neutral solid stays high-contrast).

### Neutral

- **Page** (`#fafafa`, never pure white) → **Surface** (`#ffffff`) → **Subtle** (`#f4f4f5`) →
  **Muted** (`#e4e4e7`): the tonal-layering ladder that conveys depth instead of shadow.
- **Borders:** Default (`#e5e5e5`), Strong (`#d4d4d8`), Focus (`#6366f1`).
- **Text:** Primary (`#0a0a0a`), Secondary (`#52525b`), Tertiary/placeholder (`#a1a1aa`), Muted (`#71717a`).
  Dark mode inverts the whole neutral ramp (`#0f0f0f` page, `#f0f0f0` text).

### Named Rules

**The Color-Follows-Functionality Rule.** Color marks _what a thing is_, not _which page you're on_. The
chrome stays neutral; the active route tints the chrome, its native content, and the page-level primary
action. But any panel, badge, or action that represents **another module's functionality wears that
module's hue** — wrap it in its own `<ModuleProvider module="…">` (a product page's inventory panel →
inventory amber, its SEO panel → SEO yellow, a linked customer → CRM cyan). One screen can legibly carry
several module hues; the multiplicity lives in the **signals** (stripes, primaries, key badges/icons),
never in background fills, so the surface stays neutral. There is **no "one hue per screen" cap** — the
only ban is color with no meaning attached (decoration) and module color used as a decorative wash. ("Active
module" still means something: the route owns the chrome + page-primary and is the default hue for ambiguous
emphasis — it's the most _frequent_ hue, not the _only_ one.)

**The Semantic-Status Rule.** State is its own color axis, orthogonal to module hue and always available:
**success** (live/settled), **warning** (draft/pending/not-yet-live), **danger** (failed/terminal-bad),
**info** (in-motion), **neutral** (inert/archived). Resolve a raw status with `statusTone()` and render
`<Badge color={statusTone(s)} variant="soft">{statusLabel(s)}</Badge>` so "active" is green and "failed"
red _everywhere_ (docs/35 §9). And reach for soft semantic callouts deliberately — an info note, a success
confirmation, a warning band — to break a wall of black-on-white into something scannable. A neutral/outline
pill where a real tone applies is a miss.

**The Warm-Hue Reservation Rule.** Warm hues (amber, red, orange) are reserved for semantic status — except
where a module legitimately owns one (Commerce orange, Inventory amber, SEO yellow). Where a module's warm
hue and a warm status tone meet (a `warning`-amber "Draft" pill inside Commerce orange), the status pill's
own label/icon is what keeps it distinct — module color must never carry meaning by hue alone. Use
**danger red** for true alerts so they read against any warm chrome.

**The Dark-Ink-On-Warm Rule.** Amber, SEO yellow, and warning fills use dark ink (`#422006`), never white —
white text fails AA on those hues.

## 3. Typography

**Display / Body / Label Font:** Geist (with Inter, then `system-ui` fallback)
**Mono Font:** Geist Mono (with JetBrains Mono fallback) — code, IDs, metrics, keyboard hints

**Character:** One humanist-geometric sans carries the entire UI — headings, labels, body, buttons, and
data. No display/body pairing; product UI doesn't need it. Precision comes from a tight, fixed scale and a
disciplined two-weight range, not from contrast of families.

### Hierarchy

- **Display** (500, 2.25rem/36px, 1.2, -0.025em): Rare — the largest page title or an empty-state headline.
- **Headline** (500, 1.875rem/30px, 1.2, -0.025em): Page headers.
- **Title** (500, 1.25rem/20px, 1.2): Section and card titles (`CardTitle` runs lighter at 15px/500).
- **Body** (400, 0.9375rem/15px, 1.5): Default text and form values. Prose caps at 65–75ch; dense tables may run wider.
- **Label** (500, 0.6875rem/11px, 0.05em): Field labels, badges, table column heads. Uppercase only when it earns it — never as a decorative eyebrow.

### Named Rules

**The Two-Weight Rule.** Only 400 (regular) and 500 (medium) ship. 600 and 700 are forbidden — they read too
heavy against the host UI. Hierarchy comes from size, color, and space, not from bold.

**The Fixed-Scale Rule.** The dashboard uses a fixed rem scale, never `clamp()` fluid type. (The fluid
`--display-*` tokens exist for the marketing surfaces, not here — a fluid h1 that shrinks inside a sidebar
looks worse, not better.)

## 4. Elevation

The system is **flat by default.** Depth is conveyed primarily through **tonal layering** —
`page (#fafafa)` → `surface (#fff)` → `elevated (#fff)` against subtle borders — not through shadow. Shadow
is a response to genuine elevation (overlays, the rare lifted card), never ambient decoration.

### Shadow Vocabulary

- **sm** (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)`): Barely-there separation; resting cards that need a hair of lift.
- **md** (`box-shadow: 0 2px 8px 0 rgb(0 0 0 / 0.08)`): The `elevated` card variant; popovers.
- **lg** (`box-shadow: 0 10px 24px -6px rgb(0 0 0 / 0.12)`): Modals, drawers, command palette.
- **focus** (`box-shadow: 0 0 0 3px rgb(99 102 241 / 0.25)`): The indigo focus ring — the one shadow that is never optional.

Layering is ordered by a semantic z-index scale: `base 0 → raised 10 → dropdown 100 → sticky 200 →
overlay 300 → modal 400 → toast 500`. Never use arbitrary z-index values.

### Named Rules

**The Flat-By-Default Rule.** Surfaces are flat at rest. If you reach for a shadow to separate two resting
elements, use a border or the next tonal layer instead. Shadow means "this floats above the page" — modal,
drawer, popover, focus — and nothing else.

## 5. Components

Every interactive component is built on the **four-axis API** — `color` (semantic or module slot, applied
as a `.sx-c-*` role-var class), `variant` (treatment), `size`, and `shape` — so `color × variant` composes
with no cartesian explosion. The feel across all of them is **tactile and modern**: crisp surfaces, hover
that shifts toward `--c-hover`, a prominent focus ring, immediate 175ms state.

### Buttons

- **Shape:** Gently rounded (`rounded-md`, 6px). Icon-only buttons use `square` (field radius) or `circle` (full).
- **Variants** (treatment): `solid` (default) · `soft` (tinted `--c-tint` bg + `--c-ink` text) · `outline` · `dashed` · `ghost` · `link`.
- **Primary:** Indigo solid, white text, `h-9` (36px), `px-4`, medium weight.
- **Hover / Focus:** Background shifts toward `--c-hover`; focus shows a 2px `--color-border-focus` ring with a 2px offset. Disabled drops to 40% opacity, pointer-events off.
- **Sizes:** `xs` (28px) → `sm` (32px) → `md` (36px) → `lg` (40px) → `xl` (44px). Loading swaps content for an inline spinner and sets `aria-busy`.

### Cards / Containers

- **Corner Style:** `rounded-lg` (8px).
- **Background / Border:** `surface (#fff)` on a `1px default border (#e5e5e5)`.
- **Variants:** `default` · `module` (a **3px top stripe** in the active-module color, top corners squared) · `elevated` (`shadow-md`) · `ghost` (borderless, transparent) · `subtle` (borderless on `#f4f4f5`).
- **Padding:** `none` · `sm` (12px) · `md` (16px, default) · `lg` (24px). Footers right-align actions above a top border. **Never nest cards.**
- **The `module` stripe follows the nearest `<ModuleProvider>`.** A commerce page's cards are orange; a panel that surfaces another module's job is wrapped in **its** provider (`<ModuleProvider module="inventory">`), and its `module` cards turn amber automatically — same mechanism that colors the panel's buttons/badges. This is the cross-module wayfinding cue (Color-Follows-Functionality, below). **Don't** pass `accent` to recolor a card when a provider already wraps it — `accent="…"` is only for a one-off color with no surrounding provider. (The stripe reads `--module-active` directly, so it never picks up a leaked role color — wrap the panel and it just works.)

### Inputs / Fields

- **Style:** `surface` bg, `1px default border`, `rounded-md`, 15px text, tertiary-gray placeholder (held to AA, not a light wash).
- **Focus:** 2px `--color-border-focus` ring, no outline. **Hover** strengthens the border to `--color-border-strong`.
- **Variants / States:** `default` · `error` (danger border + ring) · `success` (success border + ring); disabled at 50% opacity. Sizes `sm` (32px) / `md` (36px) / `lg` (40px).

### Badges / Chips

- **Style:** `rounded-full` pill, default `neutral / soft`, medium weight. Same `color × variant × size`
  axes as buttons — `<Badge color="commerce">` tints to that module independent of the active provider.
- **Sizes:** `sm` (10px text) / `md` (12px) / `lg` (13px).

### Navigation (Sidebar)

- Module nav items carry their module's hue; the active item shows the module tint plus the module color as
  an indicator. The sidebar is a second neutral layer against the content surface. Responsive is structural:
  the sidebar collapses (sidebar → compact → stacked) across the three breakpoints, never via fluid type.

### Signature Components

- **`<ModuleProvider module="…">`** — sets `--module-active`; everything beneath re-tints with no props. The whole "one console, many colors" effect lives here.
- **`TopProgress`** — the page-top loading bar. Per module it sweeps a light→base→deep ramp of the active hue; at platform scope it reveals the **full module spectrum** as one gradient. The system's signature flourish.
- **The Wordmark** — "sparx" in Geist 500, tracking -0.03em, with the **"x" always in Sparx Indigo `#6366f1`** — never one solid color.

## 6. Do's and Don'ts

### Do:

- **Do** keep the chrome neutral and let color follow functionality — the active route tints chrome + page-primary; an embedded panel that belongs to another module wears _its_ hue via a nested `<ModuleProvider>` (a commerce-orange inventory panel is a missed wayfinding cue) (**The Color-Follows-Functionality Rule**).
- **Do** color status by meaning with `<Badge color={statusTone(s)} variant="soft">`, and use soft semantic callouts (info/success/warning) to break up dense text instead of a wall of black-on-white (**The Semantic-Status Rule**).
- **Do** show an entity's identity ONCE — its name/slug is the editable form field, never _also_ a read-only heading atop the body. The drawer chrome's type label + the full-page back-link carry context; the field carries the value. (Read-only / transaction details — orders, quotes, inventory ops — have no editable name field, so their identity heading stays.)
- **Do** put a detail surface's status badge + lifecycle actions (Publish/Archive, Preview/Revisions/…) in the **frame header** via the `DetailHeaderSlot` teleport (docs/86 §5.1), never a bespoke in-body "Status" card. The status badge + primary action keep text; secondary actions go **icon-only with a tooltip** so the header fits one row.
- **Do** build every control from `@sparx/ui` on the `color × variant × size` axes; let `<ModuleProvider>` drive color.
- **Do** stay flat by default — separate resting elements with a border or the next tonal layer, not a shadow.
- **Do** hold to Geist at two weights (400 / 500) and the fixed 15px-body rem scale.
- **Do** hit WCAG 2.1 AA: body ≥4.5:1, placeholders at 4.5:1 (no light-gray wash), a visible focus ring on every interactive element, and a `prefers-reduced-motion` fallback for every animation.
- **Do** use dark ink (`#422006`) on amber / SEO-yellow / warning fills.
- **Do** keep module identity legible without relying on hue alone — pair color with the label/icon for color-blind operators.

### Don't:

- **Don't** ship generic AI-slop SaaS: no cream/sand/parchment backgrounds, no tiny uppercase tracked eyebrows over every section, no identical icon + heading + text card grids, no big-number hero-metric template, no gradient text.
- **Don't** let anything read as built for one vertical (no diesel/auto-parts or any single trade as the running example). A publisher and a parts distributor must feel equally at home.
- **Don't** re-skin a control in feature code — a background fill paired with a foreground text color, or hand-built `hover:` / `focus:` / `disabled:` states, means you've rebuilt a `<Button>` / `<Input>` / `<Badge>`. Use the variant, or add one to `@sparx/ui`.
- **Don't** use a colored `border-left` / `border-right` greater than 1px as an accent stripe. The **only** sanctioned colored stripe is the card's 3px **top** module stripe — side-stripes stay banned.
- **Don't** hardcode a color in a component; every value references a token in `tokens.css`.
- **Don't** use font weights 600 or 700, and don't use `clamp()` fluid type in the dashboard.
- **Don't** put white text on warm fills (amber, SEO yellow, warning) — it fails AA.
- **Don't** nest cards, and don't reach for a modal as the first thought — exhaust inline / progressive alternatives first.
