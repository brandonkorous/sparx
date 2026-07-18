# Marketing authoring contract — silicaui only

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-07-18

The marketing site composes **silicaui components**. It does not invent typography,
cards, pills, stat blocks, code panels, or ink colors. If a page needs a thing,
the thing already exists — find it before building it.

Why this exists: before it, 147 marketing files hand-rolled everything, producing
**30 distinct font sizes** (including 10.5/11.5/12.5/13.5/14.5/15.5px), **27 gap
values**, **124 padding values**, and **12 border radii**. Nothing lined up
because no value was ever snapped to anything. That is what "looks thrown
together" actually is — a systems failure, not a taste failure.

## Typography — the whole scale

Silica's type system is **semantic, and has no px anywhere**. There are exactly
these steps. Never write `fontSize`.

| Use                                                              | Component                                                |
| ---------------------------------------------------------------- | -------------------------------------------------------- |
| Hero headline                                                    | `<Display>`                                              |
| Section headline                                                 | `<Heading level={2}>`                                    |
| Card / panel title                                               | `<Heading level={3}>` — or `<CardTitle>` inside a `Card` |
| Sub-heading                                                      | `<Heading level={4}>`                                    |
| Small label / field name / spec key **that is meant to be read** | `<Heading level={5}>` or `<Heading level={6}>`           |
| Intro / lede paragraph                                           | `<Text variant="lead">`                                  |
| Body copy, list items, values, table cells, chips                | `<Text>`                                                 |
| Text NOT meant to be read                                        | `<Text variant="caption">`                               |

`<Heading>` takes `level` (semantics → `<h1>`…`<h6>`) and an optional `size`
(`1`–`6` or `"display"`) when the visual size must differ from the outline level.

## Ink — read this before using `caption`

**Muted text is only for text that isn't intended to be read.** This is a hard
project rule and it outranks convenience.

Silica's `caption` variant is small **and** quieter, so it is NOT the generic
"small text" slot. Reserve it for content a reader is meant to skip: a decorative
figure label, a legal footnote, a timestamp nobody scans, a watermark.

Everything a visitor is supposed to actually read — labels, spec keys, values,
list items, badge text, card copy, metadata that carries meaning — is **`<Text>`
at full ink**, regardless of how small it looks in the old design. If it seemed
to need shrinking or dimming to fit the layout, the layout is wrong, not the ink.

Do **not** reach for `opacity-70` either — silica's own demos use it, but this
project bans fading readable text. There is no third option: full ink, or the
content shouldn't be there.

Corollary: the old pages leaned on 11–13px muted text for labels (247 instances).
Those are not captions. They are readable content that was shrunk and dimmed to
fit — they become `<Text>` or a small `<Heading>`, and the layout absorbs it.

Color utilities that DO exist: `text-base-content`, `text-primary`, `text-success`
/`-warning`/`-error`/`-info`, `text-soft`, and every `--color-*` registered with
the plugin (including `text-module-<name>`). Nothing else.

## Components — reach for these, never rebuild them

| Need                   | Use                                                                             | Not                                  |
| ---------------------- | ------------------------------------------------------------------------------- | ------------------------------------ |
| Surface / panel        | `Card` + `CardBody` + `CardTitle`                                               | a `<div>` with border+radius+padding |
| Clickable surface      | `ClickableCard` (or `clickableCardClasses`)                                     | a wrapping `<a>`                     |
| Pill / status chip     | `Badge color variant="soft" size`                                               | a `<span>` with a fill + radius      |
| Metric block           | `Stats` + `Stat` + `StatValue` + `StatTitle` + `StatDesc`                       | a hand-built numeral + label rail    |
| Terminal / code panel  | `MockupCode` + `MockupCodeLine prefix`                                          | a dark `<div>` around a `<pre>`      |
| Browser / device frame | `MockupBrowser` (`url`), `MockupWindow`, `MockupPhone`                          | a hand-drawn chrome                  |
| Dated sequence         | `Timeline` + `TimelineItem` + `TimelineStart`/`Middle`/`End box`                | a hand-built rail                    |
| Ordered process        | `Steps` + `Step color data-content`                                             | numbered divs                        |
| Notice / callout       | `Alert color variant="soft"` (+ `AlertContent`/`AlertTitle`/`AlertDescription`) | a tinted div                         |
| Row list               | `List` + `ListRow` + `ListColGrow` + `ListTitle`                                | a `<ul>` with flex rows              |
| Rule / separator       | `Divider`                                                                       | a bordered div                       |
| Accordion / FAQ        | `Accordion` + `AccordionItem`/`Trigger`/`Panel`                                 | `<details>`                          |
| Inline link            | `Link`                                                                          | a styled `<a>`                       |

`MockupCode` is already a dark terminal — it needs no `data-theme` island and no
dark hexes.

## Monospace

Silica has no mono type variant — `.kbd` inherits the ambient family and
`.mockup-code` sets its own stack internally. For a mono chip or a spec value,
add the **`font-mono` utility** (Tailwind, bound to `--font-mono`) alongside the
silica component:

```tsx
<Text className="font-mono">bkg_8f2a1c</Text>
```

That is a utility on a real component, not a re-skin. Do not set `fontFamily`
inline and do not introduce a mono "variant" of your own.

## Component gotchas found in practice

- **`List` paints its own surface.** `.list` sets `background-color:
var(--color-base-100)` and `border-radius: var(--radius-box)`. Inside a `Card`
  that is a no-op (same surface), but a `List` dropped onto a tinted or dark band
  will punch an opaque base-100 rectangle. Check the surface underneath first.
- **`Divider` carries block margin.** Flush bands inside a card need
  `className="my-0"`.
- **`MockupCode` is `--color-neutral`**, not a `data-theme` island — it brings its
  own dark surface and `--color-neutral-content` ink. Don't wrap it in one.
- **`Steps` is horizontal and label-sized.** It fits an ordered process with short
  labels; if each stage carries a paragraph, use a card grid instead.

## `soft` is an option, not the default

Silica's `Badge`, `Alert`, and `Button` all default to **`solid`**. Do not write
`variant="soft"` reflexively. Overriding a library default on every element is a
decision, and it needs a reason each time.

A badge is a **signal**. When every badge on a page is a pale tint, nothing
signals anything — the page reads washed out, which is the same failure as
monotone or faded text. Default to solid; drop to `soft` only when a specific
element would genuinely shout over its neighbours, and say why in a comment.

**Card washes follow the module rule, not habit.** `bg-<color> bg-soft` is the
sanctioned module tint, but per CLAUDE.md's Color-Follows-Functionality rule:

- A **single-module page** (every module page — `/scheduling`, `/commerce`, …)
  keeps its cards **neutral**. The tint differentiates nothing when everything on
  screen is the same module. Identity rides the chrome, the hero band, the
  primary CTA, the Spark/Dot accents, and solid badges.
- A **cross-module page** tints only the ONE primary card per module hue. A wall
  of tinted cards is competing washes, not wayfinding.

If a surface is the single thing the section is pointing at, prefer **solid** over
a wash — and let the paired `-content` token supply the ink rather than
hand-picking a contrast partner.

## Color

Never a hex. Never `rgba()`. Never a hand-rolled `color-mix()`.

- Module hue: `getModuleColor(m)` → `{ color, bg: 'bg-module-x', ink: 'text-module-x' }`.
  The tinted wash is **`${M.bg} bg-soft`** — silica's own treatment. `M.color` is
  only for places needing a _value_ (an SVG `stroke`, a canvas fill).
- Status: the semantic colors (`success`/`warning`/`error`/`info`/`danger`).
- Near-black CTA: `<Button color="neutral">`. **Not** `style={{backgroundColor:'#0A0A0A'}}`.
- Dark bands: `<Section surface="dark">` or `data-theme="dark"`, which flips the
  whole `--color-base-*` ramp. Never paint `#0A0A0A` and then hand-pick `#FFFFFF`
  and `#A1A1AA` to sit on it.

## Server Components

Marketing sections are Server Components. `<Button render={<a/>}>` **throws at
prerender** ("Element type is invalid … got: undefined") because the element
crosses the RSC boundary as a lazy client reference. Use the class builders:

```tsx
import { buttonClasses } from '@wizeworks/silicaui-react/server';
<a href={x} className={buttonClasses({ size: 'lg', color: 'primary' })}>
  Label
</a>;
```

Import from `/server`, never the package root (the root is `'use client'`).

## What stays app-local

Only the marketing **band rhythm**, because silica has no marketing-page section
primitive: `Section` / `Container` (page gutter, section padding, the dark-island
switch, the 1280px content cap). These emit utility classes only — they add no
appearance of their own.

Everything else — type, ink, cards, pills, stats, code panels — is silica's.
