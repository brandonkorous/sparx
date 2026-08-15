# SilicaUI Theme and Token Specification

## Source of truth

Piggles uses **SilicaUI** as the canonical implementation design system.

The product ships with two first-class themes, using SilicaUI's bare theme names:

- `light`
- `dark`

Piggles claims the bare names rather than `piggles-light` / `piggles-dark` because the
theme only ever applies inside a Piggles app. sparx's blocks also answer to `light`, but
`@sparx/brand/theme.css` is imported solely by the four sparx apps' `globals.css` and
never by a shared package — so no document loads both. The one thing that would break
this is a shared package taking a direct dependency on sparx's stylesheet; if a surface
ever has to show both brands at once, give Piggles a named island instead.

Both themes use the exact same semantic token names. Components must consume semantic SilicaUI tokens rather than hard-coded light- or dark-mode values.

## Required semantic colors

Piggles defines:

- `base-100`
- `base-200`
- `base-300`
- `base-content`
- `primary`
- `primary-content`
- `secondary`
- `secondary-content`
- `accent`
- `accent-content`
- `success`
- `success-content`
- `info`
- `info-content`
- `warning`
- `warning-content`
- `error`
- `error-content`
- `neutral`
- `neutral-content`
- `danger`
- `danger-content`

`neutral` and `danger` are **required, not optional**, and both were missing from an
earlier revision of this list.

Additional named colors are allowed only for durable semantic concepts, and every additional color must define a matching `-content` color in **both** themes.

# Canonical Light Theme

| Token               |     Value | Purpose                                                 |
| ------------------- | --------: | ------------------------------------------------------- |
| `base-100`          | `#FFFFFF` | Primary MDI windows, cards, dialogs, editors            |
| `base-200`          | `#FBF7F8` | Workspace/background and recessed surfaces              |
| `base-300`          | `#F0E8EA` | Stronger neutral separation / selected neutral surfaces |
| `base-content`      | `#202631` | Default readable ink                                    |
| `primary`           | `#FF6F86` | Canonical Piggles pink                                  |
| `primary-content`   | `#202631` | Content on primary                                      |
| `secondary`         | `#2D3443` | Deep navy/charcoal secondary brand surface              |
| `secondary-content` | `#FFFFFF` | Content on secondary                                    |
| `accent`            | `#FFB3C0` | Soft supporting pink                                    |
| `accent-content`    | `#202631` | Content on accent                                       |
| `success`           | `#14804A` | Success/completed state                                 |
| `success-content`   | `#FFFFFF` | Content on success                                      |
| `info`              | `#2563EB` | Informational state                                     |
| `info-content`      | `#FFFFFF` | Content on info                                         |
| `warning`           | `#F3B61F` | Warning/attention state                                 |
| `warning-content`   | `#202631` | Content on warning                                      |
| `error`             | `#C93838` | Error/destructive state                                 |
| `error-content`     | `#FFFFFF` | Content on error                                        |
| `danger`            | `#C93838` | Destructive vocabulary — `statusTone()` returns this    |
| `danger-content`    | `#FFFFFF` | Content on danger                                       |
| `neutral`           | `#52454F` | Inverse utility surface — dark bands, tooltips          |
| `neutral-content`   | `#FFFFFF` | Content on neutral                                      |

`neutral` is a warm plum-grey so it reads as a different **role** from `secondary`'s
cool navy. The test for that pair is a visible **surface step**, not categorical ΔE —
they are chrome that rarely abuts, unlike two hues in a nav rail. It measures a 1.38
step against `secondary` and 9.04:1 on white.

`base-100` is the **top** surface (MDI windows, cards, dialogs); `base-300` is the
deepest recess.

# Canonical Dark Theme

| Token               |     Value | Purpose                                      |
| ------------------- | --------: | -------------------------------------------- |
| `base-100`          | `#272D39` | Primary MDI windows, cards, dialogs, editors |
| `base-200`          | `#1C212C` | Workspace/background and recessed surfaces   |
| `base-300`          | `#151922` | Deepest recess / strongest separation        |
| `base-content`      | `#F4F5F7` | Default readable ink                         |
| `primary`           | `#FF7C91` | Piggles pink tuned for dark backgrounds      |
| `primary-content`   | `#20151A` | Dark ink on primary                          |
| `secondary`         | `#D7DBE3` | Light neutral secondary action/surface       |
| `secondary-content` | `#1B1F28` | Dark ink on secondary                        |
| `accent`            | `#8F4656` | Deeper supporting Piggles accent             |
| `accent-content`    | `#FFF4F6` | Light ink on accent                          |
| `success`           | `#38B875` | Success/completed state                      |
| `success-content`   | `#071A10` | Content on success                           |
| `info`              | `#68A3FF` | Informational state                          |
| `info-content`      | `#08162C` | Content on info                              |
| `warning`           | `#F6C95B` | Warning/attention state                      |
| `warning-content`   | `#241A04` | Content on warning                           |
| `error`             | `#EF4444` | Error/destructive state                      |
| `error-content`     | `#250909` | Content on error                             |
| `danger`            | `#EF4444` | Destructive vocabulary — `statusTone()`      |
| `danger-content`    | `#250909` | Content on danger                            |
| `neutral`           | `#6B5A66` | Inverse utility surface                      |
| `neutral-content`   | `#FFFFFF` | Content on neutral                           |

**Corrected — the base ramp direction.** An earlier revision assigned the three base
tokens in the opposite order, with `base-100` as the darkest. That put MDI windows
(`base-100`) visually **below** the workspace canvas (`base-200`) — the reverse of the
light theme, where `#FFFFFF` windows sit above a `#FBF7F8` canvas. It also contradicted
SilicaUI's own dark theme, where `base-100` is oklch(16%) against `base-300`'s
oklch(11%). The palette was right; the assignment was reversed. **`base-100` is the
lightest of the three in both themes** — raised surfaces catch more light.

**Corrected — dark `error`.** It was `#F06B6B`, which measures **ΔE 14.3** against the
dark `primary` `#FF7C91` — close enough that a Delete button and the brand read as the
same colour. `#EF4444` measures ΔE 32.2 and still clears AA on the same ink at 4.98:1.
Any future dark `error` must be checked against the dark pink, not just against its own
content token: every lighter rose fails this test.

# Brand continuity across themes

Dark mode is **not** an inverted version of light mode.

The brand must remain recognizably Piggles in both:

- Piggles pink remains `primary`.
- Base surfaces shift from white/warm-neutral to charcoal.
- Surfaces retain visible depth through `base-100`, `base-200`, and `base-300`.
- Pink is tuned slightly brighter in dark mode so it remains energetic without glowing.
- Status colors are tuned for dark surfaces while preserving semantic meaning.
- Typography, radius, iconography, logo geometry, and MDI behavior do not change by theme.

# MDI surface hierarchy

## Light

- workspace canvas → `base-200`
- standard MDI window → `base-100`
- recessed/secondary pane → `base-200`
- stronger neutral separation → `base-300`
- text/icons → `base-content`
- active/focused branded affordance → `primary`

## Dark

- workspace canvas → `base-200`
- standard MDI window → `base-100`
- recessed/secondary pane → `base-200`
- elevated/selected region → `base-300`
- text/icons → `base-content`
- active/focused branded affordance → `primary`

The hierarchy stays the same; only token values change.

# Content-pair rule

When a semantic color is used as a background, use its matching content token for direct content unless a tested component design intentionally overrides it.

Examples:

- `primary` → `primary-content`
- `secondary` → `secondary-content`
- `accent` → `accent-content`
- `success` → `success-content`
- `info` → `info-content`
- `warning` → `warning-content`
- `error` → `error-content`
- base surfaces → `base-content`

Never assume white text is correct on Piggles pink.

# Component rules

Prefer SilicaUI semantics:

- primary action → `primary`
- secondary action → `secondary`
- supporting branded emphasis → `accent`
- destructive action → `error`
- success state → `success`
- informational callout → `info`
- caution state → `warning`
- neutral work surfaces → base tokens

Do not create:

- `pinkButton`
- `darkCard`
- `warningGold`
- `lightModePanel`
- `darkModePanel`

if the semantic theme already expresses the intent.

# Theme switching

Theme switching should:

1. Change the active SilicaUI theme.
2. Preserve workspace/window state.
3. Preserve application state.
4. Avoid a full reload where practical.
5. Honor the user's explicit theme preference.
6. Support a system/default option if the product exposes it.

Recommended preference model:

- `system`
- `light`
- `dark`

The resolved theme becomes either `light` or `dark`, written to `data-theme`.

# Charts and data visualization

Charts should not directly reuse arbitrary brand/status colors.

For chart palettes:

- define a dedicated semantic chart palette if needed,
- provide light and dark values,
- preserve categorical distinction,
- verify contrast against both base systems,
- do not use `error` or `success` for a series unless the data itself represents error/success.

# App group colors

Piggles colors the **group**, not the app. Five group hues plus the brand cover all
fifteen apps; apps within a group separate by icon and label, never by hue.

| Group  | Hue                 | Apps                                        |
| ------ | ------------------- | ------------------------------------------- |
| Home   | `primary` (aliased) | Home                                        |
| Web    | `#4F46E5`           | My Site, Content, Get Found                 |
| Sell   | `#C2410C`           | Sell, Stock                                 |
| People | `#0E7490`           | Customers, Messages, Bookings               |
| Money  | `#4D7C0F`           | Invoices, Money                             |
| Run    | `#7E22CE`           | My Team, Automations, Partners, Connections |

**Why not one hue per app, the way sparx does it.** An 18-hue wheel is already at the
limit of what stays distinguishable, and Piggles reserves the whole rose family for the
brand pink, which pushes it over. A six-family wheel with lightness steps _inside_ each
family was measured first and produced 17 pairs under ΔE 18. Lightness does not separate
a nav rail. Five hues plus the brand measures ΔE 18.4 at its closest pair, and every hue
clears AA.

It also does product work: because every app ships enabled, the Piggles rail is full on
day one, so it needs a spine that sparx's gradually-filling rail does not.

`Money` is lime-700 rather than a money-green: at `#15803D` it measured ΔE 7.3 against
`success`, which would have made the Money app and a success badge the same colour.

Group hues are **theme-independent** — a saturated hue reads on either canvas, and the
tinted rendering comes from SilicaUI's universal `soft` treatment at paint time, so
there is no pre-baked tint token to drift. `Home` is the exception and is _aliased_ to
`primary` rather than copied, so it follows the pink into dark mode.

Adding a sixth group is a design decision, not a token edit: run the separation screen
against every existing hue **and both brand pinks** first.

# Shape and depth

| Token               |    Value | Note                                     |
| ------------------- | -------: | ---------------------------------------- |
| `--radius-selector` | `9999px` | Radio, Checkbox, Switch, Toggle          |
| `--radius-field`    |   `12px` | Input, Select, Textarea, Button          |
| `--radius-box`      |   `18px` | Card, Dialog, Popover, panels            |
| `--border`          |    `1px` |                                          |
| `--depth`           |      `1` | Piggles' soft elevation — see note below |

`--depth: 1` is SilicaUI's own default and is the **entirety** of Piggles' elevation
treatment: resting shadow plus hover-lift on Card, inset highlight on solid Buttons.
sparx sets it to `0` because flat, sharp and cool is sparx's identity; Piggles is soft
and rounded, and flat-edge separation reads colder than the brand wants.

This is the only sanctioned elevation. One token, no hand-rolled `shadow-*` in feature
code, nothing to add per component.

# Additional named colors

Additional SilicaUI colors are allowed only when:

1. The name represents meaning, not hue.
2. The role recurs across the product.
3. Both light and dark values exist.
4. Both themes define `<name>-content`.
5. Contrast is validated.
6. The color is added to `config/brand.tokens.json`.
7. The use is documented here.

One-off mockup colors must not become product tokens.
