# sparx Brand Guide

**Version:** 1.7.2
**Author:** Brandon Korous / WizeWorks
**Last Updated:** 2026-07-08

---

## 1. Brand Identity

**Platform:** sparx
**Company:** WizeWorks
**Primary domain:** sparx.works
**Tagline:** _[Offering]_, ignited. — the hero rotates the leading noun through the offerings (Commerce · Content · Customers · Email · Wholesale · AI · Everything), each landing on **ignited.** with the indigo spark. Static form for page titles, OG, and social: **Everything, ignited.**

sparx is a modular content and commerce operating system. The brand communicates precision, intelligence, and simplicity — not corporate friendliness or startup energy. The name contains a spark: the moment something ignites, the instant a business goes live.

---

## 2. The Wordmark

```
spar x
    ↑
    The "x" renders in sparx Indigo (#6366F1)
    Everything else renders in primary text color
```

- **The name is all-lowercase — `sparx`, never `Sparx`.** The leading "s" is not
  capitalized: lowercase in the wordmark, and lowercase in running prose, titles,
  metadata, and UI copy too. (Code identifiers keep their casing — `SparxSession`,
  `SparxMark`, the `@sparx/*` packages — those are not brand text.)
- Set in **Inter, weight 700 (bold)**, tracking -0.03em — the bold weight aligns
  the letterforms with the monogram mark (§2.1)
- The "x" is the brand moment — on color surfaces it is always sparx Indigo, never neutral
- The canonical lockup ships as outlined vector artwork (`images/SVG/logo.svg`); the live UI
  renders the same wordmark in the interface font
- **One-color contexts** (print, photography, single-ink): use the black or white variant
  (`logo-black.svg` / `logo-white.svg`). The "x" stays distinct by dropping to **50% opacity**,
  not by changing hue — so the wordmark is never a truly flat single tone
- Never use the wordmark at sizes below 16px
- Minimum clear space: equal to the height of the "x" on all sides

### 2.1 The Monogram Mark

When a compact mark is needed (favicons, app icons, the icon + wordmark lockup),
use the lowercase **"sx" monogram** from `images/SVG/icon.svg`:

- The "s" uses the current text color (`currentColor`) so it adapts to light and
  dark surfaces; the "x" is always sparx Indigo (`#6366F1`), matching the wordmark
- One-color variants ship alongside it (`icon-black.svg` / `icon-white.svg`, "x" at
  50% opacity) plus a reversed `icon-light.svg` (white "s" + indigo "x") for dark fills
- In product UI, render it via `<SparxMark>` from `@sparx/ui` (s = `currentColor`,
  x = `--color-primary`). For the icon + wordmark lockup, use `<Wordmark icon />`
- As a browser favicon (where CSS variables can't resolve), each app ships a
  static `app/icon.svg` that inlines the hex plus a `prefers-color-scheme` rule

---

## 3. Color System

### Primary Brand Color

These are silicaui tokens defined in `@sparx/brand/theme.css` (dark values in parentheses); the silica plugin turns them into `bg-primary` / `text-primary` / `btn-primary`, and hover states are computed by silica (no separate hover token).

| Token                     | Hex (light / dark)    | Use                                                |
| ------------------------- | --------------------- | -------------------------------------------------- |
| `--color-primary`         | `#6366F1` / `#818CF8` | Buttons, links, active states, the "x" in wordmark |
| `--color-primary-content` | `#EEF2FF` / `#14122E` | Legible ink on a primary fill                      |

A background tint is `bg-primary bg-soft` (silica's theme-aware `soft` treatment), never a baked tint hex.

### Module Color System

Each module owns one color. This color appears identically across three touchpoints:

1. The module's marketing domain (sparxcms.com, sparxcrm.com, etc.)
2. The module's nav item in the sparx dashboard sidebar
3. The subtle module-tint background on cards within that module

| Module        | Color Name | Hex       | Why                                                                            |
| ------------- | ---------- | --------- | ------------------------------------------------------------------------------ |
| Builder       | Indigo     | `#6366F1` | The platform color — Builder builds the site, the foundation it all renders on |
| Commerce      | Orange     | `#F97316` | Action, conversion, energy — every "Buy Now" button ever                       |
| CMS           | Teal       | `#14B8A6` | Editorial, calm, focused — content creation energy                             |
| CRM           | Cyan       | `#06B6D4` | Connective, relational, people-centric                                         |
| Email         | Sky        | `#0EA5E9` | Communication, reach, delivery                                                 |
| B2B/Wholesale | Slate      | `#475569` | Serious, industrial, business-grade                                            |
| AI/MCP        | Rose       | `#EC4899` | Premium, intelligent, unexpected — different in kind                           |
| Dropship      | Emerald    | `#10B981` | Growth, supply chain, organic                                                  |
| Invoicing     | Lime       | `#65A30D` | Getting paid — cashflow, money in                                              |
| Inventory     | Amber      | `#F59E0B` | Stock, supply, the warehouse                                                   |
| Live Chat     | Violet     | `#8B5CF6` | Conversational, responsive, human                                              |
| Automations   | Fuchsia    | `#D946EF` | Workflows firing — work happening on its own                                   |
| SEO           | Yellow     | `#EAB308` | Visibility, getting found, daylight                                            |

### The AI/MCP Exception

AI/MCP was the first module to reach outside the original cool/blue/green spectrum, and Rose (`#EC4899`) stays reserved for it even as the palette has since grown to cover the full spectrum (Commerce orange, Invoicing lime, Inventory amber, Automations fuchsia, SEO yellow). Rose was chosen deliberately:

- Every other AI product in 2023–24 reached for purple, teal, or blue
- Rose is completely unused in B2B SaaS AI branding
- It signals "this is different in kind" — the module that thinks, not just functions
- The sparx Indigo + Rose pairing is near-complementary, creating natural hierarchy

### Color Rules

The module palette spans the full spectrum — twelve modules need twelve distinct hues, so warm colors (orange, lime, amber, fuchsia, yellow, rose) are first-class module identities, not off-limits. What stays reserved is the **semantic** layer:

**Reserved semantic tokens — never repurposed as decoration:**

- `--color-warning` (#F59E0B) — caution alerts, approaching limits
- `--color-danger` (#EF4444) — errors, destructive actions
- `--color-success` (#10B981) — confirmations, healthy states

**When a module color collides with a semantic hue:**

- Inventory (Amber `#F59E0B`) **is** the warning hue. Inside Inventory, status signals must stay distinguishable from the module chrome — use danger/red for stock alerts so "warning" still reads.
- On a **solid** Amber or Yellow fill (Inventory, SEO), text/icons use dark ink — white fails AA. Other module fills use white.
- Semantic warning/danger/success keep their meaning on every surface, in every module, regardless of the module's own accent.

---

## 4. Typography

### Typeface: Geist

Geist is Vercel's open-source typeface, designed specifically for interfaces. It combines geometric precision with editorial warmth — exactly the balance sparx needs between technical capability and tenant accessibility.

- **Display:** Geist 500, -0.025em tracking — page titles, hero headings
- **Heading:** Geist 500, 0 tracking — section headers, card titles
- **Body:** Geist 400, 1.6 line-height — descriptive copy, supporting text
- **Label:** Geist 500, 0.08em tracking, uppercase — section labels, badges, metadata

**Fallback stack:** `'Geist', 'Inter', system-ui, -apple-system, sans-serif`

### Two weights only

400 (regular) and 500 (medium). Never 600 or 700 — they feel heavy against the clean sparx UI. The typographic hierarchy comes from size and spacing, not weight contrast.

### The Notion/Framer influence

Like Notion and Framer, sparx lets typography do the heavy lifting. No decorative elements, no gradients, no illustrations in the UI. White space is intentional. Every element has a reason to exist.

---

## 5. Platform Palette

The platform runs on silicaui's base ramp (`@sparx/brand/theme.css`). `base-100` is the topmost reading surface (card white); the page canvas sits one step below on `base-200`. Text inks are **opacity on the base ink**, not separate colors.

### Light Mode

| Purpose          | Token                        | Value     |
| ---------------- | ---------------------------- | --------- |
| Page canvas      | `--color-base-200`           | `#F4F4F5` |
| Surface (cards)  | `--color-base-100`           | `#FFFFFF` |
| Border           | `--color-base-300`           | `#E4E4E7` |
| Body text        | `--color-base-content`       | `#0A0A0A` |
| Supporting text  | `text-base-content/70`       | derived   |
| Hint/placeholder | `text-base-content/50`       | derived   |

### Dark Mode

| Purpose          | Token                        | Value     |
| ---------------- | ---------------------------- | --------- |
| Page canvas      | `--color-base-200`           | `#1F1F1F` |
| Surface (cards)  | `--color-base-100`           | `#1A1A1A` |
| Border           | `--color-base-300`           | `#2A2A2A` |
| Body text        | `--color-base-content`       | `#F0F0F0` |
| Supporting text  | `text-base-content/70`       | derived   |
| Hint/placeholder | `text-base-content/50`       | derived   |

Neither pure white nor pure black — this is the Notion trick. Near-white/near-black backgrounds feel intentional in both modes, never like an inverted screenshot.

---

## 6. Design Principles

### Flat by default

No gradients, drop shadows (except functional focus rings), or blur effects. Every surface is flat. Depth comes from border contrast, not shadows.

### Minimal chrome

The UI gets out of the way of the tenant's work. Navigation is always visible but never dominant. Empty states are helpful, not decorative.

### The module-tint rule

The single most important UI pattern in the sparx dashboard: a `<Card variant="module">` carries **its functionality's** module color as a subtle background tint — a theme-aware `color-mix` of the module color into the surface (formerly a 3px top stripe). Usually that's the module you're in — but a panel that surfaces _another_ module's functionality (an inventory panel on a product page, an SEO panel on a content entry) wears _that_ module's color, set by wrapping it in its own `<ModuleProvider>`. The tint tells the tenant exactly what they're looking at, not just where they navigated, without any additional labeling. On a dense cross-module page, tint only the **one "primary" card per module hue** and leave the rest plain, so the tints read as wayfinding rather than competing washes.

### Module isolation — color follows functionality

When a tenant is working inside the CMS module, the chrome and that module's own content shift subtly to teal accents; switch to AI/MCP and it's rose. The color transition reinforces the active context. But isolation is about the _chrome_, not the whole screen: **color follows functionality**, so a single screen can legibly carry several module hues at once — each panel, badge, or action wearing the color of the functionality it represents — while the chassis stays neutral and the colored signals stay sparse. It's wayfinding by capability, not a single per-page wash. Layered over this is the **semantic status axis** (success/warning/danger/info), used both on status pills and as soft callouts that break dense forms into something scannable.

### Progressive disclosure

The onboarding path hides complexity. Advanced features (API keys, custom webhooks, MCP configuration, B2B pricing rules) exist but are never shown to a new tenant. The 5-minute path to a live site is always clear.

### Mobile-first, always

Every sparx surface — marketing pages, the tenant dashboard, customer-facing sites — must work and look intentional from a 320px phone to a 2560px monitor. Marketing pages in particular are read on phones far more than on desktops; a layout that "doesn't look great on mobile" is a broken layout. Display type uses fluid `clamp()` scaling rather than fixed pixel sizes; layouts reflow, never just shrink. See [docs/23 §13](23-frontend-component-architecture.md) for the implementation rules.

---

## 7. Voice & Tone

**sparx speaks directly.** No hedging, no corporate softness, no "revolutionary" or "game-changing."

| Instead of                                                   | sparx says                                  |
| ------------------------------------------------------------ | ------------------------------------------- |
| "Start your free trial today"                                | "Live in 5 minutes."                        |
| "Powerful features for growing businesses"                   | "Pay for what you use. Own everything."     |
| "Our AI-powered insights help you understand your customers" | "Ask your AI anything about your business." |
| "Flexible pricing for every stage"                           | "Add B2B for $99/mo. No upgrade required."  |
| "Build a website with AI in seconds"                         | "AI builds it. sparx keeps it."             |

**Short sentences.** Subject, verb, done. sparx doesn't explain itself — it demonstrates.

**Second person, present tense.** "Your site is live" not "Tenants can launch their sites."

### 7.1 Positioning: permanence

A second message sits beneath the _"[Offering], ignited."_ tagline system — the durability story, written for the era of disposable, AI-generated sites. The lead line:

> **AI builds it. sparx keeps it.**

Supporting lines (use one at a time, never stacked):

- _Generated in a moment. Built to last._
- _Coding optional. Permanence included._
- _Your AI can start it. sparx is where it lives._

**Rules for this message:**

- **Never anti-AI.** sparx is MCP-native — the message is _AI + permanence_, not _AI vs. AI_. We are where AI output grows up, not a rejection of it.
- **"Coding optional" = the escape ladder** (no-code by default, full code when you want it; [docs/47](47-class-first-authoring-model.md)). Never reduce it to a flat "no-code only" claim.
- **Stay on the day-2 wedge.** Easy to _create_ is table stakes now; easy to _keep_ — maintain, enhance, own — is ours. Pair it with "Live in 5 minutes," never against it: fast to start, permanent to keep.

### 7.2 Homepage hero concept (sparx.works)

The current hero — the rotating _"[Offering], ignited."_ wordline plus the 5-minute / one-bill / MCP metric row ([apps/web/components/marketing/hero.tsx](../apps/web/components/marketing/hero.tsx)) — **stays as the primary.** Add permanence as the **section immediately below it**, not as a replacement:

- **Eyebrow:** AI builds it. sparx keeps it.
- **Headline:** The website that's still yours next year.
- **Subhead:** Generate it with AI if you want. Then maintain and enhance it yourself — no-code by default, full code when you want it — for years. You own the data. You own the site.
- **Proof row (four chips):** No-code editor · Own your data · Headless API · MCP-native
- **CTA:** Launch your site / See how it lasts

Implementation note: this is a **new content section** in `apps/web` (a sibling of `hero.tsx`), not an edit to the indigo hero. Same voice — short sentences, second person, no "revolutionary."

---

## 8. Module Marketing Domains

Each module marketing domain uses its module color as the primary accent, with sparx.works' neutral palette as the base:

| Domain         | Module             | Accent    |
| -------------- | ------------------ | --------- |
| sparx.works    | Platform / Builder | `#6366F1` |
| sparxcms.com   | CMS                | `#14B8A6` |
| sparxcrm.com   | CRM                | `#06B6D4` |
| sparxemail.com | Email              | `#0EA5E9` |
| sparxb2b.com   | B2B/Wholesale      | `#475569` |

Each site is conversion-optimized for a specific search intent. All CTAs point to `sparx.works/signup?module={module}` — the module query param pre-selects the relevant module during onboarding.

---

## 9. What sparx Is Not

- Not corporate blue (we left that on the table deliberately)
- Not startup teal (overused, and we're past that era)
- Not "AI purple" (the 2023-24 default that means nothing anymore)
- Not rounded and bubbly (we're precise, not friendly)
- Not gradient-heavy (flat is the point)
- Not dark-mode-only (both modes are first-class)

sparx is the brand that would have designed the tool a senior developer wishes existed. Technical enough to be trusted. Simple enough for anyone to use.
