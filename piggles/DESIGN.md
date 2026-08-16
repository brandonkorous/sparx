# DESIGN.md — Piggles

**Version:** 1.6
**Author:** Brandon Korous
**Last Updated:** 2026-08-16

The design contract for every Piggles surface. Binding for `piggles/**`; it
supersedes the root [DESIGN.md](../DESIGN.md) where the two disagree, and defers to
it where this file is silent. Rules of engagement (the platform boundary, the
lexicon, pricing) are in [CLAUDE.md](CLAUDE.md).

Canonical values come from the approved identity board,
[config/brand.tokens.json](docs/initial/config/brand.tokens.json).

**Do not compute color. The palette is Brandon's.** The numbers recorded in this
file are history — a note of why a token landed where it did — not a standing
instruction to re-derive them. Contrast ratios, ΔE separation screens and
"measured, not eyeballed" checks are **only** to be run when Brandon asks for
one. Recalculating the palette on every task wastes his time and yours, and the
arithmetic is not the authority anyway: he is.

What that leaves you: use the tokens as given, and follow the usage rules below
(a hue is a fill, ink is inherited, neutral must be earned). If a pairing looks
wrong on screen, say so and ask — do not go and re-derive the palette.

## 1. What Piggles looks like, in one paragraph

Warm off-white surfaces, a lot of roundness, one confident pink, deep readable
charcoal, and six calm colors that organise the whole product. sparx is cool,
sharp and technical; Piggles is warm, round and plain-spoken. If a screen could be
dropped into sparx without anyone noticing, it is not finished.

## 2. Color

### The brand

The canonical set is [SILICAUI_THEME.md](docs/initial/docs/brand/SILICAUI_THEME.md);
this is the shape of it.

| Token               | Value                   | On-fill ink   | Ratio |
| ------------------- | ----------------------- | ------------- | ----- |
| `--color-primary`   | `#FF6F86` Piggles Pink  | `#202631` ink | 5.69  |
| `--color-secondary` | `#2D3443` deep charcoal | white         | 12.47 |
| `--color-accent`    | `#FFB3C0` soft pink     | `#202631` ink | 9.01  |
| `--color-neutral`   | `#52454F` plum-grey     | white         | 9.04  |

**The pink takes dark ink, not white.** White measures 2.44:1 on `#FF6F86` — not
a preference, a failure. A pink button with a charcoal label is what the logo
board already does, and it reads friendlier than the alternative.

**Accent is deliberately low-emphasis.** `#FFB3C0` is a supporting branded
surface, not a second call to action — if a screen needs two competing primaries,
the screen is wrong, not the palette.

**`neutral` and `danger` are required, not optional.** Silica's `colors:` list
replaces its defaults rather than extending them, so an unlisted role vanishes.
Omitting `neutral` falls through to silica's cool slate — an off-brand grey nobody
chose. Omitting `danger` renders every `<Badge color="danger">` from a shared
surface colorless, because the platform's `statusTone()` returns `danger`, not
`error`.

**Themes are the bare names `light` and `dark`.** sparx aliases its blocks to
`light` too, but `@sparx/brand/theme.css` is imported only by the four sparx apps
and never by a shared package, so a Piggles app never loads both. If a surface
ever has to show both brands at once, give Piggles a named island rather than
reaching for the bare name.

### The six app groups

Piggles colors the **group**, not the app. Every app in a group wears its group's
hue; apps separate within a group by icon and label.

| Group  | Hue               | Apps                                        |
| ------ | ----------------- | ------------------------------------------- |
| Home   | `#FF6F86` (brand) | Home                                        |
| Web    | `#4F46E5`         | My Site, Content, Get Found                 |
| Sell   | `#C2410C`         | Sell, Stock                                 |
| People | `#0E7490`         | Customers, Messages, Bookings               |
| Money  | `#4D7C0F`         | Invoices, Money                             |
| Run    | `#7E22CE`         | My Team, Automations, Partners, Connections |

**Why not eighteen hues like sparx.** An 18-hue wheel is already at the edge of
distinguishable, and reserving the whole rose family for the brand pink pushes it
over — sparx's own `ai`, `scheduling` and `automations` sit 4–15° apart in exactly
the region Piggles needs. A six-family wheel with lightness steps _inside_ each
family was measured first and produced **17 pairs under ΔE 18** (`cms ↔ accent` at
5.5, `ai ↔ staff` at 9.1). Lightness does not separate a nav rail. Six hues, one
per group, measures **ΔE 18.4 at its closest pair** and every hue clears AA.

It also does product work: because every app ships enabled, the Piggles rail is
full on day one, and six color families give it a spine that sparx does not need.

**Adding a seventh group is Brandon's decision, not a token edit.** Ask; do not
go and derive one.

**Money is lime-700, not a money-green.** At `#15803D` it measured ΔE 7.3 against
`success` — the Money app and a success badge would have been the same color.

**Nav order should follow the groups.** Color grouping only pays off when grouped
items are adjacent; [config/apps.yaml](docs/initial/config/apps.yaml) currently
interleaves Content and Get Found (100, 110) away from My Site (20). Reorder so
each group is contiguous.

### Semantic color is its own axis

Light: `success` `#14804A` · `info` `#2563EB` · `warning` `#F3B61F` · `error` /
`danger` `#C93838`. Dark re-tunes each for its canvas.

**Every destructive color is checked against the brand pink, not just against its
own ink.** The dark `error` was specified as `#F06B6B`, which measures ΔE 14.3
against the dark pink `#FF7C91` — a Delete button and the brand reading as one
color. It is `#EF4444`: ΔE 32.2, still 4.98:1 on its ink. Every lighter rose fails
this test, so do not reach for one.

Status is resolved with `statusTone()` and rendered `<Badge color={statusTone(s)}
variant="soft">`, exactly as in sparx. Never a neutral status pill.

### Neutral needs Brandon's approval

Root RULE #4 applies in full and matters _more_ here, because warm greys are
seductive. **`color="neutral"` is not a choice you make — ask Brandon and get a
yes first.** The rule used to list what "earned" it; the list read as a checklist
to argue past, so it is gone.

If an element distinguishes A from B, its color carries the distinction. Reaching
for grey almost always means the question of what the thing MEANS got skipped —
destructive is `danger`, a favourite is `primary`, anything belonging to an app
is `module`.

### Picking `color` — the positive form, for every component

The clause above is a **prohibition**, and a prohibition with no positive form is
how `color="neutral" variant="outline"` became the house default for every second
button on the site — 24 across `apps/web`, 553 across the repo. Nobody chose it. It
is what gets typed when the rule says what not to do and nothing says what to do.

**This section is not about buttons.** It governs every component that takes a
`color` — `Button`, `Badge`, `Card`, `Alert`, `Tabs`, `Input`, `Progress`, an icon
chip, a hued heading, all of them. Buttons are only where the failure was noticed.

**The whole palette is available, and it is bigger than the four names that get
used.** Ten semantic roles — `primary` `secondary` `accent` `success` `info`
`warning` `error` `danger` `neutral` — **plus the six group hues**, reached by
putting `data-group="sell"` on an ancestor and asking for `color="module"`. That is
sixteen real choices. `SilicaColor` is `… | (string & {})`, so the editor offers a
handful and TypeScript catches nothing; pick from this list, not from autocomplete.

**The rule is one sentence: the component takes the color of what it is ABOUT.**
Not of its position in the layout, not of how important it feels.

| What the element is about                      | `color`                                 |
| ---------------------------------------------- | --------------------------------------- |
| Signing up — the one conversion action         | `primary` (and nothing else wears it)   |
| One app, one group, one module's functionality | `module`, under a `data-group` ancestor |
| The price, the bill, money going in or out     | `success`                               |
| Safety, privacy, how data is handled, an FYI   | `info`                                  |
| A limit approaching, something needing a look  | `warning`                               |
| Deleting, cancelling, losing something         | `error` / `danger`                      |
| An onward link with no subject of its own      | `secondary`                             |
| The second of a pair, beside a primary         | `variant="outline"`, **no `color`**     |
| Chrome — nav ghost, a reset, a menu icon       | `neutral`                               |

`accent` is not on that list on purpose: [theme.css](packages/brand/src/theme.css)
defines it as a low-emphasis supporting **surface**, not a second call to action.

Four things this is load-bearing about:

1. **Pink means one thing.** `primary` is the signup CTA and nothing else on the
   marketing site wears it. A "read more" in pink spends the one color a visitor
   has learned to read as _start_.
2. **The palette file already told us.** `--color-neutral` `#52454F` is annotated
   in `theme.css` as _"the inverse utility surface (dark bands, `btn-neutral`,
   tooltips)"_ — chrome. Putting it on a call to action is using a chrome token as
   an action token, and the annotation saying so was sitting there the whole time.
3. **The second-of-a-pair takes NO color.** Uncolored `outline` resolves to
   `base-content`, which the surface has already resolved — including inside a
   `data-theme="dark"` island, where a pinned `neutral` measures 2.52:1 and is very
   nearly invisible. Measured and recorded at the top of
   [close-band.tsx](apps/web/components/marketing/close-band.tsx); it holds on
   every surface, not just that band.
4. **A section's only action is solid, never outline.** RULE #4's positive form:
   the action a surface exists for is a filled shape. An outline button alone in a
   section is a section that does not know what it wants.

Worked examples now in the tree: the home page's FAQ offers two links and they are
`success` (the price) and `info` (how your data is handled) rather than two
identical greys — the color tells you which is which before the label is read.
[tool-ladder.tsx](apps/web/components/marketing/tools/tool-ladder.tsx) has done the
`color="module"` version of this all along, which is the precedent that should have
been followed everywhere.

## 3. Ink

Body ink is `--color-base-content` (`#202631` light, `#F4F5F7` dark). It is
inherited — do not write a text color onto a silicaui component, whose foreground
is already resolved from `color × variant`.

The board defines `inkSoft` `#4B5563`. It is a **real ink** (7.5:1 on white), not
a faded one, and it is permitted for genuinely secondary readable text — a
timestamp beside a name, a helper line under a field. It is **not** a licence to
reintroduce the faded-ink habit the platform removed in 2026-07: never
`/opacity`, never `text-soft`, on anything a person is meant to read. Hierarchy
comes from scale, weight and color.

Body floor is 16px. 18px for reading surfaces, 14px for captions only.

### A dark band is a theme island, not a background class

Painting a section `bg-secondary text-secondary-content` sets one surface and
changes **nothing** about how the tokens inside it resolve — every control in
that section carries on resolving against the light palette while sitting on a
dark ground. Set `data-theme="dark"` on the section and use `bg-base-200`
instead. Then base, content, borders and focus rings all flip together and
anything dropped into the band is correct without being told where it is.

Measured on the closing band of meetpiggles.com, ink against the band behind it:

| Ink                   | On `bg-secondary` (utility) | Inside `data-theme="dark"` |
| --------------------- | --------------------------- | -------------------------- |
| uncolored `outline`   | 1.06:1                      | **14.77:1**                |
| `primary` + `outline` | —                           | 6.56:1                     |
| `neutral` + `outline` | 1.4:1                       | 2.52:1                     |
| `accent` + `outline`  | —                           | 2.44:1                     |

Two rules fall out of that table:

1. **A secondary button on a dark band asks for `outline` and does not name a
   color.** Uncolored, it resolves to `base-content`, which the island has
   already flipped; pin a color and you have pinned a value that stops following
   the surface.
2. **`neutral` is not usable as ink on a dark ground in this palette** — it fails
   in both themes, so it is the wrong choice rather than a palette bug to route
   around. `neutral` stays what root RULE #4 says it is: the chassis, and the
   dismiss half of a decision pair on a LIGHT surface.

## 4. Shape

The loudest non-color difference between the brands, and it comes from the board
(`roundness: high`).

| Token               | Piggles  | sparx    |
| ------------------- | -------- | -------- |
| `--radius-selector` | `9999px` | `9999px` |
| `--radius-field`    | `12px`   | `6px`    |
| `--radius-box`      | `18px`   | `0.5rem` |
| `--depth`           | `1`      | `0`      |

The mark is a squircle and the wordmark is a rounded geometric. If the UI runs
sharp, the logo looks borrowed.

**Elevation is a Piggles identity signal, not a restraint to be spent
sparingly.** sparx sets `--depth: 0` because flat, sharp and cool is what sparx
is. Piggles is soft, warm and rounded, and that has a direct consequence for
separation: on sparx's cool greys a hairline border is a crisp edge, while on
`#fcf7f8` against `#ffffff` it is barely an edge at all. **Shadow is what
separates surfaces here.** Reach for it.

Two mechanisms, and the only rule is not to use both on the same element:

- **`--depth: 1`** — silica's own default, set once in `@piggles/brand`. It gives
  Card a resting shadow and hover-lift, and solid Buttons an inset highlight.
  Anything silica paints is already lifted; there is nothing to add.
- **Tailwind's `shadow-*` scale** — for everything Piggles owns and silica never
  sees: marketing bands and panels, the console's dock windows, any composed
  chrome. This is sanctioned in feature code and is the normal way to lift a
  Piggles surface.

**Stacking is the failure.** A `shadow-*` utility on a Card, Button, Dialog or
Popover doubles the token's shadow and reads as a rendering fault rather than as
depth. Silica paints it → leave it. Piggles owns it → lift it yourself.

## 5. Density — comfortable, not compact

sparx can be a dense utility surface. Its audience is a doer at a desk who wants
everything on screen at once, and compact serves them.

**Piggles is for somebody who did not choose to be in software today.** The
feeling every surface has to produce is _"I can breathe here"_: controls slightly
oversized, well padded, easy to scan and easy to hit; more vertical rhythm;
clear grouping. Comfortable density is the Piggles default, not an option.

The guard rail is equally specific. The goal is **soft, human, easy, composed** —
not toy-like, not cartoonishly large, not mobile-oversized-on-a-desktop. Comfortable
and premium, never giant and silly. If a screen starts reading as childish, that
is a failure of the same rule, not an excess of it.

### The mechanism: two tokens, not a thousand props

The obvious move — `size="xl"` on every control — is wrong twice over. It cannot
reach the ~500 SHARED workbench surfaces Piggles mounts and must never fork
([CLAUDE.md](CLAUDE.md) RULE #0), so the console would be comfortable in Piggles'
own chrome and stock everywhere the work actually happens. And it is exactly the
call-site patch root RULE #1 exists to stop.

silica sizes every field as **`--size-field × N`**, N being the size step. Move
the multiplicand and the whole ladder moves — in shared code and Piggles code
alike, with no edit at any call site.

| Token             | Piggles  | silica default | Effect                                        |
| ----------------- | -------- | -------------- | --------------------------------------------- |
| `--size-field`    | `0.3rem` | `0.25rem`      | xs 29 · sm 38 · **md 48** · **lg 58** · xl 67 |
| `--size-selector` | `0.3rem` | `0.25rem`      | checkbox / badge md 29px                      |
| `--field-gap`     | `0.5rem` | `0.375rem`     | label → control, 8px                          |
| `.card-body`      | `2rem`   | `1.5rem`       | card padding 32px                             |
| `.card-body` gap  | `1rem`   | `0.5rem`       | between stacked items in a card               |

**The default control is 48px** — a real step up from sparx's 40, comfortable
everywhere without anybody choosing it, including in all ~500 shared surfaces.
sparx is untouched: it never loads this stylesheet.

**A form asks for `size="lg"` — 58px, inside the 56–60 target.** That is the one
trade this scale makes, and it is the right one. Setting `--size-field` to
`0.35rem` would put the DEFAULT at 56px with no call site saying anything — but
the default is what every toolbar, filter row and pane header renders, and 56px
of chrome above a list is not comfort, it is a smaller list.

Asking for `lg` on a form is **not** the call-site patch root RULE #1 bans. That
rule bans patching SHARED code; choosing a size on a form you own is what the
prop is for. One decision per form, not one per control. `xl` (67px) is a
marketing hero CTA and nothing else.

**Selectors are their own lever.** `--size-selector` (silica's words: _"so a
dense checkbox can sit next to a large input"_) drives **Badge** as well as
Checkbox/Radio/Switch/Toggle — so it decides how big a status pill is in a table
row, which is a different question from how big an input is. If badges start
reading heavy in dense lists, drop this one alone rather than touching fields.

### What this lever does and does not reach

`--size-field` also drives **Alert, Toast, Progress, Meter, Toolbar, Menubar and
NavigationMenu** — not only inputs. That is half the reason the default sits at
48 rather than 56: whatever number is chosen, all of them wear it. If one still
reads bloated, pin that ONE family back with a rule in
`@piggles/brand/theme.css` (`.alert { --size-field: 0.25rem }`), never with a
class at a call site.

**Table is NOT on this lever** — its cell padding is its own — so a long list
does not lose rows to comfortable density. That is the right split: a person
scanning 200 products needs rows, and a person filling in a form needs room.

**Out of reach, honestly:** the gaps _between_ form groups (20–24px) and
_between_ major sections (24–32px) live as `gap-*` classes inside each surface's
own JSX. Piggles' own screens simply write them. For the shared surfaces there is
no lever short of Tailwind's `--spacing`, which also scales every width in the
spacing scale — including the app panel's `w-64`. **That one is deliberately not
taken.** Look at a real screen with everything above in place before reaching for
it; it may not be needed once the controls and the card padding have breathed.

## 6. Typography

Display is **Fredoka** — the roundest face that is still a working UI font, and
SIL OFL so it self-hosts without a licence negotiation. Body is **Inter**, per the
board's "high-legibility sans serif", and already in the repo's font pipeline.

**Fredoka's weight axis stops at 700.** `font-extrabold` and `font-black` are
therefore not distinct from `font-bold` on a heading — they clamp, silently and
harmlessly, but they buy nothing. Reach for size, not weight, when a heading needs
to grow. Body copy keeps Inter's full 100–900 range.

Avoid, per the board: condensed display faces, sharp corporate display faces, and
novelty faces. Confirm the stack against the final logo file before launch — if
the wordmark is drawn in something else, this follows it.

**No eyebrows.** Root RULE #2 applies unchanged: nothing sits above a heading to
introduce it — no kicker, no category chip, no `01/02/03`, and no `<Badge>` doing
the same job. A friendly brand is not a licence for editorial furniture.

## 7. What Piggles may do that sparx may not

- **Warmth.** A warm off-white canvas (`#FBF7F8`) instead of sparx's cool
  blue-grey. This is quiet and it is most of the difference.
- **Roundness and depth.** See §4.
- **The mascot.** Empty states, onboarding, success moments, 404s. Never in the
  nav, never during money, tax, payroll or deletion. That sentence is now
  ENFORCED rather than remembered: she is only reachable through
  `<PigglesMascot>` from [@piggles/mascot](packages/mascot/README.md), whose
  `MascotIntent` is a closed union with no member for a deletion confirm, a
  failed payment, a past-due account, a tax filing, a payroll run or a capacity
  block. Putting her in one means adding a line to that union and being asked
  why. Never a filename, never a raw `<img>` — the assets under
  `apps/*/public/mascot/` are generated and rewritten wholesale on every ingest.
- **The pale pinks.** `accentPale` `#FFE9ED` as washes and empty-state fills — the
  one sanctioned decorative use of brand color.

## 8. What is still banned

- **Gradients.** Unchanged from root. The single clearest AI-slop tell; no hero
  wash, no mesh, no aurora. Solid fills, discrete color, real product glimpses.
- **Re-skinning a control.** Root RULE #1 in full: a background fill paired with a
  foreground text color is recreating a `<Button>`. Reach for the silicaui
  primitive and its `color × variant × size × shape` props.
- **Inline `style`.** Including CSS-variable aliasing. Subtree theming is the
  `data-app` / `data-group` / `data-module` attributes and rules in
  `@piggles/brand/theme.css`.
- **Hardcoded hex.** Tokens only. The two sanctioned exceptions carry over
  unchanged: edge-runtime OG images (satori cannot resolve custom properties) and
  other companies' brand marks.

- **Hand-rolled shadows _on things silica already elevates_.** A `shadow-*`
  utility or a `box-shadow` on a Card, Button, Dialog or Popover is a re-skin:
  `--depth: 1` already elevated it, and painting over that is the call-site patch
  root RULE #1 exists to stop. Still banned.

  **It is not a ban on depth.** Read as one it produces flat Piggles chrome with
  a comment explaining why — which is what happened to the console's dock
  windows, left flat against a mockup that showed them lifted. Chrome that is
  not a silica component (a library's DOM, something we own outright) has no
  component shadow to double up on, and it gets elevated.

  **Use Tailwind's `shadow-*` scale for it.** silica has no elevation utility
  because Tailwind already ships one and two scales would drift apart; `--depth`
  only decides whether silica's own components carry theirs. Never hand-author a
  `box-shadow` — a tuned alpha ladder matches nothing and nothing points at it.
  The dock windows are the worked example: `shadow-sm` at rest, `shadow-lg` once
  torn off ([apps/workbench/app/globals.css](apps/workbench/app/globals.css)).

## 9. The ship gate

Before calling a Piggles surface done:

1. Every app-colored element resolves through `data-app` / `data-group`, with no
   hardcoded hue.
2. No brand conditional anywhere in shared code.
3. Every readable string uses the Piggles lexicon, not sparx's
   ([terminology.yaml](docs/initial/config/terminology.yaml)).
4. Nothing on screen would pass unnoticed inside sparx.
5. Light and dark both **looked at**. Open the surface in each and see that it
   reads. No contrast arithmetic unless Brandon asked for it — see the note at
   the top of this file.
6. Every state built — empty, loading, error, permission-denied — not just the
   happy path.
7. **It breathes.** No `size="sm"` reflex on a form control, no card whose
   padding is tighter than its contents deserve, no stack of groups run together
   with a 4px gap. And the other half of the same test: nothing so oversized it
   reads as a toy — if a control looks like it was built for a child's tablet,
   it has gone past composed and into silly (§5).
8. **Every claim on the screen is one the product already makes.** See §10.
9. **It can be taken in at a glance.** See §11.

## 10. Nothing on a Piggles screen may be invented

A design reference will hand you a customer count, a logo wall, an uptime figure
and a support promise, because that is what the genre contains. Piggles has not
launched. **Every one of those would be a lie, told on the screen whose entire
job is establishing that this software can be trusted with a livelihood.**

The rule is simple and absolute: **a claim on a product surface must already be
made on meetpiggles.com**, which is written so that every sentence is true rather
than reassuring. Its `/trust` page refuses, in writing, the two this genre asks
for most:

- **certifications** — "a badge on a page is the cheapest lie in this industry"
- **uptime percentages** — "a number nobody is measuring yet is not a commitment,
  it is a decoration"

So there is no "99.9% uptime", no compliance badge, no "trusted by thousands",
and no invented customer logos anywhere in `piggles/`. The substitute is not a
weaker claim, it is a **true** one doing the same work: naming the kinds of
business Piggles was built for lets a florist recognise herself without anybody
claiming she has already signed up. When there are real customers willing to be
named, that is where they go — and only then.

This is a superset of the platform's own rule that a value nobody measured must
never render as one. That rule is about data; this one is about copy.

## 11. Signed-out screens are a glance, not a read

Somebody arriving at a sign-in form is seconds from typing an email address, and
prose spends those seconds without buying anything. The sign-in and signup panels
are built to a strict shape: **a heading, then a title of three or four words and
ONE short line, three times.** The assurance strip below is the same — one line
per item.

If a point cannot be made in one short line it is not a point for this screen.
The long version already exists on meetpiggles.com, which is where a person goes
when they actually want it.

The diagnostic, since paragraph creep is gradual: read the panel out loud. If it
takes longer than the form takes to fill in, the panel is winning an argument
nobody is having.
