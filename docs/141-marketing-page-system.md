# The marketing page system — extracted from the landing page

**Version:** 1.1
**Author:** Brandon Korous
**Last Updated:** 2026-07-30

The homepage (`apps/web/app/page.tsx` → `components/marketing/landing-v3/*`) is the only
page on sparx.works that was designed as a whole rather than assembled. Everything else
reads as leftover content because it was built against a different, older vocabulary and
never given a compositional system.

This document is the landing page **reverse-engineered into rules** — voice, flow, color,
type, structure, motion, CTA — so the other ~40 routes can be brought up to it instead of
each being redesigned from scratch.

It is the **composition** layer. The **component** layer already has a contract:
[apps/web/components/marketing/SILICA-VOCABULARY.md](../apps/web/components/marketing/SILICA-VOCABULARY.md)
(which component, which token, which ink). Read that one for "what do I build this out
of." Read this one for "how do the pieces sit together to make an argument."

---

## 1. The band map — what the page actually is

Nine sections. The page canvas is `--color-base-200` (`#f3f5f9`), set on `body` in
`globals.css`, so a section with **no** background class is already a light grey band.

| #   | Section     | Surface                             | Resolves to                 | Shape                            | Device                       |
| --- | ----------- | ----------------------------------- | --------------------------- | -------------------------------- | ---------------------------- |
| 1   | Hero        | `data-theme="dark"` + `bg-base-100` | `#070a16` near-black        | full-bleed, `min-h-dvh`          | live typing story rotator    |
| 2   | Whoever     | `data-theme="dark"` + `bg-primary`  | Ember `#e04631` under video | full-bleed, `rounded-b-4xl`      | 8-clip video montage + scrim |
| 3   | Story       | _(none — canvas)_                   | `#f3f5f9`                   | full-bleed                       | sticky headline + card stack |
| 4   | Switchboard | `bg-base-100`                       | `#ffffff`                   | `m-6 rounded-4xl` **inset card** | interactive module toggles   |
| 5   | Timeline    | `bg-neutral`                        | slate `#282e39`             | `m-6 rounded-4xl` **inset card** | numbered chips + hairline    |
| 6   | Proof       | _(none — canvas)_                   | `#f3f5f9`                   | full-bleed                       | tilted torn-paper receipt    |
| 7   | Workbench   | `bg-primary`                        | Ember `#e04631`             | `m-6 rounded-4xl` **inset card** | real app-shell recreation    |
| 8   | FAQ         | _(none — canvas)_                   | `#f3f5f9`                   | full-bleed                       | accordion + sticky headline  |
| 9   | Final CTA   | `data-theme="dark"` + `bg-base-100` | `#070a16` near-black        | `m-6 rounded-4xl` **inset card** | offer + two buttons          |

**Three rules fall out of this table, and they are the whole visual system:**

1. **No two adjacent bands share a value.** dark → ember → grey → white → slate → grey →
   ember → grey → dark. You never scroll past two of the same thing.
2. **Full-bleed vs. inset is meaningful.** The opening two bands run edge-to-edge (they
   are the world). Everything after the argument starts is either the page canvas or a
   `m-6 rounded-4xl` **island** floating on it. The island says "this is a distinct
   thing"; the canvas says "this is the page talking."
3. **Every section carries exactly one structural device**, and no two sections share
   one. Sticky column, card stack, toggle grid, timeline rail, tilted receipt, app
   frame, accordion. This is what makes it read as designed rather than as a stack of
   `<h2>` + three cards.

### Dark is a scoped island, never a global theme

Three sections go dark. Two of them (`hero`, `final-cta`) do it with
`data-theme="dark"` on the `<section>` — a **DOM-scoped silica theme island**. Inside it,
`bg-base-100` resolves to the dark canvas and `text-base-content` resolves to light ink,
so **every child needs zero color overrides**. The outline button, the caption, the lede —
all correct by construction.

The Timeline instead uses `bg-neutral` + `text-neutral-content`, because `neutral` is
already a dark surface in light mode and needs no scoping.

Either technique is fine. What is **not** fine is what the old pages do: hardcode
`#0A0A0A` and then hand-fix every child's color. If a band is dark, scope the theme.

### The dark ladder

The page uses three darks, and as of 2026-07-30 that is deliberate rather than accidental
— each one is a different role:

| Token                   | Light     | Dark      | Role                                             |
| ----------------------- | --------- | --------- | ------------------------------------------------ |
| `base-100` (dark theme) | `#070a16` | `#070a16` | The canvas of a dark theme island                |
| `secondary`             | `#0c1433` | —         | Brand navy, as a heavyweight card fill           |
| `neutral`               | `#282e39` | `#323844` | The inverse **utility** surface — bands, buttons |

`--color-neutral` was previously commented out in `@sparx/brand/theme.css`, so
`bg-neutral` fell through to silicaui's generic default. The commented-out values are
worth recording because they show what a bad neutral looks like, measurably:

- **Light was `#0c1433`** — byte-identical to `--color-secondary`, a contrast ratio of
  **1.00** against it. Two registered color names resolving to one color; `bg-neutral` and
  `bg-secondary` were indistinguishable wherever they met.
- **Dark was `#08111f`** — **1.04** against the dark canvas `#070a16`. A `bg-neutral` band
  in dark mode was, for practical purposes, not there at all.

The replacements are `oklch(30% 0.022 265)` light and `oklch(34% 0.022 265)` dark. Hue 265
matches the base ramp's cool cast (`base-200` and `base-300` are both h=265) so it reads as
family; chroma 0.022 is about a **third** of secondary's 0.062, which is what keeps it
legible as a slate rather than a second navy. Light measures 13.6:1 against white ink with
a 1.32 step off `secondary`; dark measures 11.8:1 and sits 1.68 clear of the canvas, which
is the direction that matters — an inverse surface on an already-dark page has to be
**raised**, not sunk.

---

## 2. Voice

### The headline formula

Every single headline on the page is a **complete sentence with a terminal period**, six
words or fewer per part, and six of nine are **two-part with a hard stop in the middle**:

```
YOUR STORY, / MULTIPLIED.
Whoever you are, it's already for you.
Your business grew. / So did the mess.
Start with a spark. / Switch on the rest when you're ready.
One ordinary day. One extraordinary advantage.
Less software. / More business.
Your whole business, open at once.
Frequently asked.
Light the spark.
```

The pattern is **setup → turn**. The first clause states the reader's world; the second
either names the cost of it ("So did the mess") or the escape from it ("More business").
Nothing is a noun phrase. Nothing is a feature name. "Powerful modules for modern
commerce" is the sentence this page never writes.

Rules:

- **Full stop, always.** The period is doing tonal work — it makes the line land instead
  of trail.
- **Six words or fewer per clause.** Longest is "Switch on the rest when you're ready."
- **Second person or imperative.** "Your", "you", "Start", "Light".
- **The accent lands on one word, not the line.** `<span className="text-primary">` wraps
  exactly one word ("MULTIPLIED.") or, twice, just the **period** — `for you.` and
  `Light the spark.` A single ember dot as the accent is the house move.

### The lede formula

One to three sentences, `text-2xl` (24px), `max-w-xl`, second person, and it always
answers **"what does that mean for me?"** — never "what is this?"

> "You already know your story. Tell sparx yours, and we'll assemble the website,
> customers, scheduling, payments, marketing, and operations into one connected platform
> that grows with you, so you can focus on building your business instead of managing
> software."

Note the shape: short declarative → the promise → the payoff clause beginning with **"so
you can"**. That "so you can…" turn appears repeatedly. It is the page's core rhetorical
device: never state a capability without immediately stating the human consequence.

### Word choice — what the page does and doesn't say

**Does:** kettle, evening, browser tabs, second monitor, receipt, chores, logins,
re-typing, the kettle boils. Concrete, domestic, physical nouns.

**Doesn't:** solutions, seamless, empower, leverage, robust, unlock, streamline,
best-in-class, cutting-edge. Zero instances on the entire page.

**Numbers are always real numbers**, never rounded marketing figures: `7:12 AM`,
`10:40 AM`, `$399`, `$1,600`, `2,769/mo`, `99.95%`, `20-min`, `five minutes`.

**Jargon is quarantined to the FAQ.** "MCP" appears once in body copy and is immediately
unpacked in the same sentence ("Because sparx exposes live business data through MCP, your
assistant answers with real orders, customers and inventory — not a stale export"). RLS,
Let's Encrypt, SPF/DKIM/DMARC, Kubernetes — all of it lives inside accordion answers where
a technical reader went looking for it. The scroll path is jargon-free.

### The negative-then-positive arc

The page is unafraid to describe the reader's pain in their own words before selling:

- "Every disconnected tool is another place to search, another bill to pay, and another
  chance for something important to fall through."
- "Evenings go to syncing lists, patching automations, updating stock counts, and figuring
  out which report is actually telling the truth."

Then it turns. The Story section literally labels the arc `Scattered → Complicated →
Connected` and colors it `error → warning → success`. **The color carries the argument.**

### Reassurance is a fixed triad

Under every CTA pair sits one `<Text variant="caption">` of **exactly three middot-separated
clauses**:

```
No credit card · Live in minutes · Start with only what you need
No card · Cancel anytime · Pay only for what you use
$0 to start · cancel any time · not ready? join early access →
```

Cost objection · speed objection · commitment objection. Every time.

---

## 3. Flow — the argument, in order

The nine bands are not nine topics. They are one argument:

| Band          | Job          | The move                                                             |
| ------------- | ------------ | -------------------------------------------------------------------- |
| 1 Hero        | **Promise**  | The claim, plus a live demo of the very first thing you'll do        |
| 2 Whoever     | **Qualify**  | Removes "is this for my kind of business?" before it's asked         |
| 3 Story       | **Diagnose** | Names the pain in the reader's language; earns the right to sell     |
| 4 Switchboard | **Answer**   | Interactive — the reader _builds their own_ stack and sees the price |
| 5 Timeline    | **Show**     | Abstract benefit → five concrete timestamped moments                 |
| 6 Proof       | **Justify**  | The receipt: what the alternative actually costs                     |
| 7 Workbench   | **Prove**    | The real product, not a mockup                                       |
| 8 FAQ         | **De-risk**  | Every objection a serious buyer has, answered directly               |
| 9 Final CTA   | **Close**    | The offer, restated in one line                                      |

Three structural properties worth stealing:

- **The interactive beat sits in the middle (band 4), not at the end.** The reader
  commits a small action — toggling modules — right after the pain is named and long
  before they're asked for an email.
- **The abstract-to-concrete ladder is strict.** Promise (band 1) → category (2) →
  feeling (3) → mechanism (4) → lived day (5) → dollars (6) → screenshot (7). Each band is
  more concrete than the one above it. A page that jumps to a screenshot in band 2 has
  nothing left to escalate to.
- **Only two internal anchors exist** (`#modules`, `#day`), and both are targeted by a
  **secondary** CTA in an earlier band. The hero's second button is a scroll, not a
  navigation — it keeps the reader on the argument.

---

## 4. Color

### The palette in play

| Token                   | Value (light)   | Where it's allowed on a marketing page                             |
| ----------------------- | --------------- | ------------------------------------------------------------------ |
| `primary`               | Ember `#e04631` | The commit CTA; one accent word/period per headline; one full band |
| `secondary`             | `#0c1433`       | One heavyweight card fill (the receipt panel)                      |
| `base-100`              | `#ffffff`       | Inset island on the canvas                                         |
| `base-200`              | `#f3f5f9`       | The page canvas — the default, un-styled band                      |
| `neutral`               | slate           | A dark inset island                                                |
| `error/warning/success` | —               | **Argument color** — the Scattered/Complicated/Connected ladder    |
| `success`               | —               | The outcome badge on each timeline moment ("Order handled")        |
| `module-*`              | 15 hues         | Identity only — a module's chip, tile, or numbered marker          |

### The rules

1. **Ember is rationed.** It appears as: the primary button (every band that has one),
   one accent word or period per headline, two oversized numerals in Proof, and exactly
   **one** full band (Workbench). That scarcity is why it reads as the brand color rather
   than as decoration. A page that paints three sections ember has no primary color left.

2. **Module hues are identity, never decoration.** The timeline's numbered chip wears
   `MODULE_HEX[m.module]` because that moment _is_ that module. The switchboard tiles wear
   their own hue because each tile _is_ a module. Never a module hue as a background wash
   or a section accent.

3. **Semantic color carries the argument.** The `error → warning → success` badge ladder
   in Story is the only reason those three cards read as a progression rather than three
   parallel complaints. Use semantic color where there is an actual semantic.

4. **No gradients, no shadows, no decorative rules.** The video scrim is deliberately a
   **flat** `bg-black/60`, with a comment explaining that it is flat on purpose. Surfaces
   separate by base-tone shift, radius, and real layout.

5. **Ink is never faded to make hierarchy.** Rank comes from scale (96px vs 24px vs 16px)
   and weight. See §9 — the page has three live violations of this and they should be
   fixed before they're copied.

---

## 5. Type

The whole page runs on **six steps**. No page-local scale, no `fontSize`, no arbitrary
values.

| Role         | Classes                                                                | Rendered         |
| ------------ | ---------------------------------------------------------------------- | ---------------- |
| H1           | `size="display"` + `text-5xl sm:text-6xl md:text-7xl xl:text-8xl`      | 48 → 96px        |
| H2 (section) | `size="display"` + `text-6xl sm:text-7xl`                              | 60 → 72px        |
| H2 (closing) | `size="display"` + `text-7xl sm:text-8xl`                              | 72 → 96px        |
| Card title   | `<CardTitle className="text-2xl">` (hero cards: `text-4xl`/`text-5xl`) | 24 / 36 / 48     |
| Lede         | `<Text variant="lead" className="text-2xl">`                           | 24px             |
| Body         | `<Text>` — occasionally `text-lg`/`text-xl` inside a card              | 16 – 20px        |
| Caption      | `<Text variant="caption">`                                             | reassurance only |

Two constants applied to **every** display headline: `leading-[0.95]` (hero:
`leading-[0.92]`) and `tracking-tight`. Tight leading at large sizes is the single biggest
reason the headlines look typeset rather than defaulted.

Two hard constraints, both learned the hard way and documented in code comments:

- **The H1 scale is responsive because it has to be.** At a flat `text-8xl`, "MULTIPLIED"
  is ~495px and overflows every phone. The step to 8xl waits for `xl`.
- **The Timeline headline starts one step lower** (`text-5xl`) because it owns the page's
  longest unbreakable word ("extraordinary"), which overflowed a 294px column and
  silently scrolled the page sideways.

Check the longest word in every new headline against the narrowest column it lives in.

---

## 6. Structural devices

The catalogue in use, and what each is good for. **One per section, never repeated.**

- **Sticky headline + scrolling content** (`lg:grid-cols-[0.85fr_1.15fr]` + `lg:sticky
lg:top-24`) — Story, Timeline, FAQ. The claim stays pinned while the evidence scrolls
  past it. This is the workhorse; it's used three times, which is the upper limit.
- **Interactive builder** — Switchboard. The reader configures and watches a number
  change.
- **Numbered rail** — Timeline. A `w-px` hairline behind `h-14 w-14` module-colored
  markers, with cards floated off it.
- **Object as illustration** — Proof. A tilted (`rotate-[-4deg]`), torn-edged
  (`clip-path` polygon), barcode-footed receipt slip overhanging a navy card. It is a
  _thing_, not a chart, and it makes an abstract cost argument physical.
- **Real product frame** — Workbench. A faithful CSS recreation of the actual app shell.
- **Live typing demo** — Hero. Types the real onboarding grammar at reading speed (38ms
  per character), with module chips landing whole after a 260ms beat.
- **Ambient video** — Whoever. Eight clips, lazy, poster-first, disabled under
  `prefers-reduced-motion` and under 768px.

Every one of these degrades correctly: reduced motion gets whole stories on a timer,
mobile gets a poster image, and the sticky columns collapse to stacked blocks.

---

## 7. Motion

Restrained, and all of it earns its place:

- `Reveal` — a 30-line IntersectionObserver wrapper, `translateY` + fade, 80ms stagger per
  `index`. Used on **two** sections only (Timeline, FAQ). It is not sprinkled everywhere.
- The hero rotator's typing, which is content, not chrome.
- The video crossfade, `duration-500`.
- `scroll-behavior: smooth` on `html`, for the two in-page anchors.

No parallax, no scroll-jacking, no counters, no animated gradients. Everything honours
`prefers-reduced-motion`, and `Reveal` has an explicit defense against the back-navigation
case where restored scroll strands an on-screen element at `opacity: 0`.

---

## 8. CTA system

Fixed and mechanical — copy it exactly.

- **Always exactly two buttons.** Never one, never three.
- **Primary is `color="primary" variant="solid"`, secondary is `variant="outline"`** with
  no color prop — inside a dark island the outline resolves itself.
- **Primary copy is a verb + the reader's possessive:** "Start your story", "Start free",
  "Start your site". Secondary is zero-commitment: "See a day on sparx", "Explore the
  modules", "Book a 20-min call".
- **Arrows are semantic:** `→` for commit, `↓` for an in-page scroll.
- **Size is `xl` in the hero and closer, `lg` mid-page.**
- **Every CTA is tracked**: `signupHref('landing-v3-hero')` — the ref string names the
  band. New sections must pass their own ref.
- Server Components use `buttonClasses({...})` on an `<a>`, **never** `<Button
render={<a/>}>` — silica's `cloneElement` on an RSC lazy reference throws at prerender.
  This is documented in a comment on every file that does it; keep the comment.

---

## 9. Defects found while extracting this — all fixed 2026-07-30

Kept in full rather than deleted, because these are the **failure modes to watch for when
porting**: every one of them survived on the single most-reviewed page on the site, which
is a fair warning about what will happen on forty less-reviewed ones.

**Copy**

1. **Two typos in the same sentence**, live on the homepage
   ([story.tsx](../apps/web/components/marketing/landing-v3/story.tsx)): "managing software
   **instaed** of **servicng** customers." → "instead of serving customers."
2. **A duplicated paragraph** ([proof.tsx](../apps/web/components/marketing/landing-v3/proof.tsx)).
   The section lede and the body of its own hero card were the same sentence, verbatim,
   ~15px apart. → The lede keeps the general claim; the card now sets up the receipt
   directly ("Four subscriptions, four bills, four copies of the same customer — and you
   still stitch them together by hand every week.").
3. **Brand capitalization drift** — "Sparx" in the proof copy and in the page `<title>`.
   → Lowercase `sparx` throughout; the offending sentence was rewritten anyway.
4. **Title/H1 mismatch.** The `<title>` promised "Run the business, not the software"
   while the H1 delivered "YOUR STORY, MULTIPLIED." → Title is now
   `sparx — Your story, multiplied`; the description still carries the platform keywords.
5. **`aria-label` overrode visible text** on the hero's primary CTA — it read "Launch your
   site" on a button saying "Start your story", so a voice-control user saying what they
   could see hit nothing (WCAG 2.5.3, label-in-name). → The label now contains the visible
   text; it exists only to drop the trailing arrow glyph.

**Rule violations**

6. **Faded readable text, three places** (RULE #3). The Switchboard faded a _headline_ to
   `/55` and its lede to `/70`; the Timeline faded its lede to `/70`. → All at full ink.
   The Switchboard's two stacked `<h2>`s (one sentence split across two headings, the
   second dimmed to fake a hierarchy) are now **one** `<h2>` with a line break and the
   house single-word accent on "spark".
7. **Eyebrow badges, two places** (RULE #2). → The Proof chip ("The cost of disconnected
   tools" — also hand-built from `bg-secondary-content/15 border-secondary-content/25`,
   i.e. a re-skinned Badge) is **deleted**; the title carries itself and the receipt states
   the cost literally. The Story chips are **kept but moved**: their error→warning→success
   ladder is doing real argument work, so they now trail the card copy as a verdict —
   which is what a Badge is for, state on a thing — instead of introducing the heading.
8. **A shadow** — `shadow-2xl` on the receipt slip. → Removed; the tilt, the border and the
   base-tone step already separate it from the navy card.
9. **Hardcoded `text-white`** on the timeline's numbered markers, over an inline
   `MODULE_HEX` fill. → Both replaced by real utilities,
   `MODULE_BACKGROUND_COLOR[m] + MODULE_CONTENT_COLOR[m]`. The second map is new, and the
   same fix applies to [module-toggle-card.tsx](../apps/web/components/marketing/module-toggle-card.tsx),
   which was painting its glyph `color="#FFFFFF"` on a module fill.
10. **`text-accent-content` on a `bg-base-100` surface** — the ink that belongs _on_
    `accent`, used on a surface that isn't accent. It happened to render dark and would
    have inverted the day `accent` moved. → `text-base-content`.

**Dead code**

11. **The video ticker's active state was a no-op** —
    `i === current ? 'text-base-content' : 'text-base-content'`, so the playing clip was
    never marked. → Active is now `text-primary font-semibold`; the inactive labels stay at
    full ink rather than being faded, so the distinction is carried by color and weight.

**Found in passing, also fixed**

12. **`--color-module-commerce-content` failed contrast** — `#ffffff` on the Commerce
    orange `#f97316` measures **2.80:1**, failing not just AA's 4.5 but the 3.0 large-text
    floor, and it was the only one of the 17 module fill/ink pairs that did. Its own
    comment already read "white fails AA on this fill" — the value had simply never
    followed, while `cms`/`crm`/`email`/`inventory` all carry that same note _and_ a dark
    ink. → `#431407` (orange-950, the dark tint of the module's own hue, matching how
    those four resolve it): **5.58:1**. All 17 pairs now pass AA.

---

## 10. What the other pages do instead

The gap is not taste, it is **vocabulary age**. Measured across `apps/web`:

| Legacy pattern                                                                         | Instances |
| -------------------------------------------------------------------------------------- | --------- |
| Files importing `marketing/primitives` (`Display`/`Container`/`Section`/`Spark`/`Dot`) | 104       |
| `text-ink-muted` / `text-ink-subtle` (faded secondary ink tiers)                       | 435       |
| `mkt-*` bespoke CSS classes from `marketing.css`                                       | 127       |
| Routes that are literally a `<ComingSoon>` stub                                        | 9         |

The `<ComingSoon>` routes are `/about`, `/changelog`, `/contact`, `/enterprise`,
`/hosting`, `/migrate`, `/open-source`, `/press`, and `/market/[category]`. Several of
them (`/contact`, `/enterprise`, `/hosting`) are pages a _buyer_ looks for. They render a
centered headline, a grey paragraph, and a "← Back to sparx.works" button — and the copy
in the stub's `description` prop is often better than the page it replaces.

Typical secondary-page shape today, e.g. `/security`:

- `<Display as="h1" size={64} lineHeight={64}>` — a page-local px scale, not the six-step
  system
- `text-lede text-ink-muted` — the lede is dimmed by default
- Two `bg-base-200` sections in a row, then nothing. **No band rhythm, no device, no
  second surface, no CTA.**
- `<Spark />` after the title as the sole visual idea

That is the entire diagnosis. These pages aren't ugly; they are **one band long**, in one
color, with no structural device and no argument arc. They read as forgotten because
structurally, they _are_ an unfinished first band.

---

## 11. The port checklist

For any marketing page being brought up to the homepage's standard.

**Argument**

- [ ] Write the page's arc as one sentence per band before writing any copy. Minimum
      four bands: promise → diagnose → show → close. Three or fewer and it will read as
      a stub no matter how it's styled.
- [ ] Every band gets more concrete than the one above it.
- [ ] The page ends on a CTA band. No page ends on prose.

**Voice**

- [ ] Every headline is a complete sentence, terminal period, ≤6 words per clause.
- [ ] One accent word or period per headline in `text-primary` — never a whole line.
- [ ] Every lede contains a "so you can…" consequence clause.
- [ ] Zero instances of: solutions, seamless, empower, leverage, robust, streamline,
      unlock, best-in-class.
- [ ] Numbers are real. Jargon lives in an FAQ or a footnote, never on the scroll path.
- [ ] Under every CTA pair: a three-clause middot caption (cost · speed · commitment).

**Color & surface**

- [ ] No two adjacent bands share a surface. Alternate canvas → island → dark.
- [ ] Dark bands are `data-theme="dark"` islands or `bg-neutral` — never a hardcoded hex
      with hand-fixed children.
- [ ] Ember appears on: the primary buttons, one accent word per headline, and **at most
      one** full band.
- [ ] Module hues mark identity only.
- [ ] Zero gradients, zero shadows, zero decorative rules.
- [ ] Zero `/opacity` or `text-ink-muted` on anything meant to be read. If it looks too
      loud at full ink, the size is wrong, not the color.

**Type**

- [ ] Six steps only. `size="display"` + a `text-*` class — no page-local px scale, no
      `Display size={64}`.
- [ ] `leading-[0.95] tracking-tight` on every display headline.
- [ ] Longest word in each headline checked against its narrowest column.

**Structure**

- [ ] Each band has one structural device, and no two bands share one. Reuse from §6
      before inventing.
- [ ] Sticky-headline layout is `lg:grid-cols-[0.85fr_1.15fr]` + `lg:sticky lg:top-24`.
- [ ] Inset islands are `m-6 rounded-4xl`; section padding is `px-6 py-24 sm:px-8
lg:py-32`; content caps at `max-w-7xl`.

**Mechanics**

- [ ] Components come from `@wizeworks/silicaui-react` per SILICA-VOCABULARY.md. No
      `marketing/primitives`, no new `mkt-*` classes.
- [ ] Server Components use `buttonClasses()` on an `<a>`, with the RSC comment.
- [ ] Every CTA carries its own `signupHref('<page>-<band>')` ref.
- [ ] `Reveal` on at most two bands.
- [ ] `aria-label` matches the visible button text, or is omitted.

---

## Related

- [apps/web/components/marketing/SILICA-VOCABULARY.md](../apps/web/components/marketing/SILICA-VOCABULARY.md)
  — which component and which token (the layer below this one)
- [docs/35-ui-variant-system.md](35-ui-variant-system.md) — the four-axis control system
- [docs/sparx-brand-guide.md](sparx-brand-guide.md) — the module hues and brand marks
- [CLAUDE.md](../CLAUDE.md) — RULE #1 (silicaui first), #2 (no eyebrows), #3 (soft is a
  signal, not a default)
