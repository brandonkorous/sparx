# WizeWorks — Brand & Visual Identity

**Version:** 1.0.0
**Author:** Brandon Korous
**Last Updated:** 2026-07-30

---

## 1. Brand architecture

**Decided 2026-07-30:** WizeWorks holds a **distinct parent identity**. The products sit inside it
as siblings, each keeping its own accent color and mark.

```
WizeWorks — pine + bone + warm ink + serif display
  │   own accent, own mark, own typographic system
  │
  ├── sparx      — Ember  #e04631   (content & commerce platform)
  ├── kanNINJA   — TBD              (project management)
  └── AGCONN     — TBD              (farmwork jobs + training)
```

| Layer                                                      | Owned by    |
| ---------------------------------------------------------- | ----------- |
| Typographic system, grid, spacing rhythm, motion, neutrals | **Parent**  |
| Accent color, wordmark, product voice, product site        | **Product** |

**The test:** you should be able to see two product cards side by side and know they're siblings
without them looking like the same product. Coherence comes from type and layout; distinction comes
from color and mark.

**Why not shared:** if WizeWorks wore sparx's palette, the parent would read as "the sparx company"
and get visually crowded out the moment a second product grows. The parent has to outlive any one
product.

---

## 2. Brand attributes

Five words, and what each one means in a design decision.

| Attribute      | Means                                          | Shows up as                                                    |
| -------------- | ---------------------------------------------- | -------------------------------------------------------------- |
| **Grounded**   | Real software for real work, not a vision deck | Real screenshots, real numbers, warm neutrals over cool gray   |
| **Considered** | Every element earns its place                  | Neutral chassis, zero decoration, generous space               |
| **Durable**    | Built to still be here in ten years            | Editorial serif, structural layout, no trend-chasing surfaces  |
| **Direct**     | Says the thing                                 | Big plain type, no eyebrows, no hedging copy                   |
| **Range**      | Serves a salon and a distributor equally       | Industry-neutral imagery and language; specificity via variety |

---

## 3. The mark

**Designed 2026-07-30.** Artwork in [assets/](assets/), outlined from Instrument Serif
(SIL OFL 1.1 — outlining for a mark is permitted), harfbuzz-shaped, -0.02em tracking.

### 3.1 Wordmark

**"WizeWorks", one word, medial capital W, with the `z` in pine.**

One letter carries the identity — the same move sparx makes with its "x", which gives a family
resemblance without imitation. The `z` is the right letter because it is the name's own quirk: it
is what makes it _Wize_ and not _Wise_. Coloring the whole "ize" was the original brief; it was
built and rejected — it splits the read into "W-ize-Works" and dilutes a one-letter idea across
three.

| File                 | Use                                                 |
| -------------------- | --------------------------------------------------- |
| `wordmark.svg`       | Light surfaces — ink `#191713`, z in pine `#1B5E43` |
| `wordmark-dark.svg`  | Dark surfaces — bone `#F2EFE8`, z in `#3FA47B`      |
| `wordmark-black.svg` | One-color black; the z drops to 50% opacity         |
| `wordmark-white.svg` | One-color white; same treatment                     |

3492 × 798, ratio **0.229**. **Minimum width 92px** (≈20px cap-height) — verified legible.
Clear space: the cap-height of the W on all sides.

### 3.2 Icon

**The wordmark's own W, reversed out of a solid pine tile**, corner radius 14%.

This was decided by testing, not taste. Four monograms were built and rendered down to 16px:

| Tried                          | Result at 16px                                                   |
| ------------------------------ | ---------------------------------------------------------------- |
| Bare serif W                   | ❌ Hairlines vanish — a grey ghost                               |
| Serif W with a pine bar        | ❌ The bar swallows the letter                                   |
| Geometric sans W, barred       | ⚠️ Legible, but a sans mark under a serif wordmark is two brands |
| **Serif W reversed on a tile** | ✅ **Holds** — the tile carries the silhouette                   |

That is the whole finding: **a high-contrast serif cannot survive a favicon on its own.** Reversing
it out of a solid field moves the burden from the hairlines to the tile, which keeps the mark in
the same typographic family as the wordmark instead of inventing a second one for small sizes.

| File             | Use                                 |
| ---------------- | ----------------------------------- |
| `icon.svg`       | Light surfaces — pine tile, paper W |
| `icon-dark.svg`  | Dark surfaces                       |
| `icon-black.svg` | One-color black tile, white W       |
| `icon-white.svg` | One-color white tile, black W       |

1183 × 1183. Legible to **16px**.

### 3.3 Lockup

Icon + wordmark, icon at the wordmark's cap-height, gap equal to the icon's corner radius. The
wordmark alone is the default above ~200px; the lockup is for headers, and the icon alone for
favicons, app icons, and avatars.

### 3.4 Delivery

The finished artwork ships as **tenant media** — `upload_image`, then `update_site_settings` with
`logoLightMediaId` / `logoDarkMediaId` / `faviconMediaId`. It does **not** go into `@sparx/brand`,
which holds the platform's own marks and is unreachable from a tenant
([06](06-build-plan.md)).

### 3.5 Non-negotiable

- Never "Wizeworks", "WIZEWORKS", "wize works", or "Wize Works" in brand text.
- Never re-set the wordmark in live text — it is outlined artwork. The `z` is a path, not a span.
- Never recolor the `z` to anything but pine, or drop it to ink in a color context.
- Never place the wordmark on a photograph without a solid backing plate.
- Never stretch, condense, or re-track. The ratio is fixed at 0.229.

---

## 4. Color

**Locked 2026-07-30.** The earthy direction stands, on the evidence in §4.4.

### 4.1 The formula — a palette, not an accent

Every trend survey says the same thing: near-black, near-white, and **one** loud accent
([research §7](01-design-research-2026.md)). **We are deliberately not doing that**, and this
section exists to say so before someone "fixes" a page by flattening it back to primary.

A single-accent palette produces a monotone screen. It has been called out twice on sparx work as
the thing that makes a built site feel dead, and the reflex that causes it is always the same:
a page looks inconsistent, so every colored thing gets set to primary, and now the page is
consistent and lifeless.

**The rule instead — color follows functionality:**

> **One hue per _function_, many functions per page.** The chassis stays neutral. Every element
> that represents a distinct thing wears the color of that thing, wherever it appears.

This is the same doctrine the sparx dashboard runs on, and it is not in tension with the research
finding — the research is warning against **decorative** color, a second brand hue sprinkled around
for variety. That remains banned. What is required is **functional** color: if two elements mean
different things, they may not look the same.

**The anti-monotone floor.** Every page must legibly carry **at least three distinct hues by
function** beyond the neutrals. A page rendered in pine + bone + ink alone is a defect, not a
minimal aesthetic. If you cannot find three functions worth distinguishing on a page, the page is
under-built.

**What stays neutral, always:** the page canvas, non-primary cards, body ink, borders, rules, and
the grid. Color rides the signals, never the chassis.

### 4.2 The palette

Five layers. Each has a job; none is decoration.

#### Layer 1 — Neutrals (the chassis)

Warm, not cool. Neither pure white nor pure black in either mode.

| Token                  | Light     | Dark      | Purpose                        |
| ---------------------- | --------- | --------- | ------------------------------ |
| `--color-base-100`     | `#FFFFFF` | `#141310` | Cards, the topmost surface     |
| `--color-base-200`     | `#F6F4EF` | `#0F0E0B` | Page canvas (bone / warm coal) |
| `--color-base-300`     | `#E5E1D8` | `#28251E` | Borders, rules, dividers, grid |
| `--color-base-content` | `#191713` | `#F2EFE8` | Body ink and every heading     |

Set the bone canvas next to a cool `#F4F4F5` and the difference reads instantly. The warmth is the
whole reason this palette is worth having.

#### Layer 2 — The house trio

The three hues that belong to WizeWorks itself, each with a fixed job.

| Name      | Token       | Light     | Dark      | Owns                                                                  |
| --------- | ----------- | --------- | --------- | --------------------------------------------------------------------- |
| **Pine**  | `primary`   | `#1B5E43` | `#3FA47B` | Primary actions, links, active nav, the mark's accent                 |
| **Brass** | `secondary` | `#A9761F` | `#D3A24C` | Figures and data — the number that matters, step numerals, chart keys |
| **Clay**  | `accent`    | `#9C4A2F` | `#C4704F` | Editorial emphasis — pull statements, the dense index, callout rules  |

Content inks: pine `#FFFFFF` / `#08120E` · brass `#1A1206` **always dark** · clay `#FFFFFF`.

⚠️ White on brass measures 4.0:1 and **fails AA for body text.** Brass fills carry dark ink,
always; brass is never text on a light surface below 24px. Pine on white is 7.7:1; clay on white
is 6.1:1 — both fine.

**Clay vs. the Anthropic read.** §4.3 flags that warm cream + serif + terracotta is a recognizable
territory right now. Clay `#9C4A2F` is a dark brick oxide, not the light salmon terracotta that
look is built on, and it is the _third_ hue here rather than the primary — the primary is a deep
green, which that territory does not use at all. Keep it that way: **clay never becomes the
dominant hue on a page.**

#### Layer 3 — Industry hues

Eight industry pages ([positioning §6](02-positioning-and-audience.md)), eight hues. This is the
main engine of a non-monotone site: it turns "we serve everyone" from a sentence into a visible
system, exactly the way module colors work in the sparx dashboard.

| Industry                             | Name           | Hex       |
| ------------------------------------ | -------------- | --------- |
| Retail & specialty shops             | **Tobacco**    | `#8A5A2B` |
| Beauty, wellness & personal care     | **Plum**       | `#6E3F55` |
| Trades & field service               | **Brick**      | `#9C4A2F` |
| Professional services                | **Slate teal** | `#2F5C64` |
| Manufacturing & distribution         | **Iron**       | `#4A5560` |
| Food & hospitality                   | **Olive**      | `#63702F` |
| Health & clinical practices          | **Sage**       | `#4C7D6E` |
| Nonprofits, associations & education | **Aubergine**  | `#513B63` |

All eight clear 4.5:1 against white and carry white ink. Sage is the tightest at 4.7:1 — never set
it below 16px on a light surface.

These need the tenant-named-color capability in §10 — **which does not exist yet.** Once it does,
each lands on a registered slot and yields `bg-*`, `text-*`, `btn-*`, `badge-*`, and the `bg-soft`
tint like any other color. There is no working tenant-side substitute today.

**How they're used:**

- On the homepage industries grid, all eight appear at once as tile fills. That section is
  deliberately the most colorful thing on the site.
- On an industry page, **that one hue replaces pine** as the page's action and emphasis color —
  hero rule, primary button, artifact annotations. Pine stays in the header chrome so you always
  know whose site you're on.
- **Never more than one industry hue on a page** outside the grid.

Trades shares Brick with the house accent clay. That is intentional, not a collision: clay _is_
the trades hue promoted to house duty, which is why it reads as work.

#### Layer 4 — Product hues

Owned by the product, never by us. They appear only on portfolio cards and links out.

| Product  | Hex       |
| -------- | --------- |
| sparx    | `#e04631` |
| kanNINJA | TBD       |
| AGCONN   | TBD       |

**Ember never tints a WizeWorks page.** It appears on the sparx card and nowhere else.

#### Layer 5 — Semantics

`success`, `warning`, `danger`, `info` — a separate axis from brand color, resolved via
`statusTone()`.

> ⚠️ **An all-earthy palette compresses hue space, so brand and semantic hues sit close.** Pine is
> a green and so is success; brass is amber and so is warning; clay is a red-brown and so is
> danger. This is the same class of collision the sparx guide documents for Inventory amber vs.
> warning, and it needs a structural answer, not a hue tweak.
>
> **The rule: brand hues appear as _solid fills_; semantics appear only as _soft tints_** — a pale
> wash with dark ink, via `<Badge color={statusTone(s)} variant="soft">` or a soft callout.
> Treatment separates them even where hue does not. A solid `success` fill is never used on this
> site.

### 4.3 The color-assignment map

Explicit, so nobody has to guess. **If an element isn't listed, it's neutral.**

| Element                                      | Color                                               |
| -------------------------------------------- | --------------------------------------------------- |
| Page canvas, non-primary cards, grid, rules  | Neutral — `base-200` / `base-100` / `base-300`      |
| **Every heading, at every level**            | Neutral — `base-content`. Headings are never tinted |
| Body copy                                    | Neutral — `base-content`, full strength             |
| Primary action button                        | Pine — or the industry hue on an industry page      |
| Secondary action button                      | Outline on neutral                                  |
| Inline links in body copy                    | Pine                                                |
| Active nav item, current-page marker         | Pine                                                |
| The one headline figure in a section         | **Brass**                                           |
| Process step numerals, ordered-list markers  | **Brass**                                           |
| Data labels, chart keys, tabular emphasis    | **Brass**                                           |
| Pull statement, editorial emphasis rule      | **Clay**                                            |
| The dense index section's grid + mono labels | **Clay** on neutral                                 |
| Industry tile (homepage grid)                | Its own industry hue, solid fill                    |
| Industry page hero rule + actions            | That industry's hue                                 |
| Artifact/screenshot annotations              | The hue of whatever page they're on                 |
| Product card                                 | That product's hue                                  |
| Status, state, lifecycle                     | Semantic — **soft tint only**                       |
| Form validation                              | Semantic — soft tint only                           |
| Focus ring                                   | Pine                                                |

**Worked example — the homepage carries five hues by function and is still calm:** pine on the
hero action and the nav; brass on the one figure in §4.5; clay on the dense industries grid lines;
eight industry hues inside that grid's tiles; Ember on the sparx card. Canvas, cards, headings, and
body all stay neutral throughout. That is what "use the palette" means — not a rainbow, a system.

### 4.4 Market evidence for the earthy direction — and what it doesn't

The palette was challenged on 2026-07-30 with a fair question: _where is this actually working in
the market?_ This is the honest answer, and it is what the direction was locked on.

**The question asked:** five top-50 companies using earthy tones.
**The honest answer:** they don't exist at that altitude. Among the world's fifty largest
companies by market capitalization, an earthy or warm-neutral brand palette is effectively
absent — that tier is blue, red, and monochrome almost without exception. Anyone who produces a
list of five is stretching either "top 50" or "earthy."

What the evidence **does** support is narrower and more useful, because the proposal is really two
independent bets:

**Bet 1 — a deep, desaturated green as the primary. Strongly proven, at enormous scale.**

| Brand          | Hex        | Note                                            |
| -------------- | ---------- | ----------------------------------------------- |
| Starbucks      | `#00704A`  | Global top-100 by market cap                    |
| Rolex          | `#006039`  | The reference luxury deep green                 |
| John Deere     | `#367C2B`  | Industrial, B2B, deeply trusted                 |
| Land Rover     | deep green | Automotive                                      |
| Bottega Veneta | green      | The most-copied fashion green of the last cycle |

Deep green reads as established, durable, and expensive across wildly different categories. This
half of the proposal is not a trend bet.

**Bet 2 — a warm cream/bone canvas instead of cool gray. Proven, but recent and concentrated.**

The clearest exemplar in software is **Anthropic / Claude** — warm parchment canvas with a
terracotta accent (`#da7756`) and a serif type stack, explicitly chosen to feel warm and human
where the category is blue and purple. Warm off-white canvases are also documented as a live
2025–26 movement generally, described as a reaction against cold corporate white.

But it is a **movement**, not an establishment. It is roughly two years old and concentrated in
design-forward software and consumer brands, not in the top 50.

**The risk this surfaces, which matters more than the original question:** warm cream canvas +
serif display + earthy accent is, right now, **recognizably Anthropic's territory.** Landing there
would read as derivative of the most visible brand in AI — the opposite of what a distinct parent
identity is for. That risk did not appear in the original proposal and should have.

**Resolution 2026-07-30:** earthy stands. The green half is proven at scale; the warm half is a
young movement we are choosing to be early on rather than late. The Anthropic-adjacency risk is
managed structurally, not avoided — deep green primary instead of terracotta, clay demoted to
third hue, and a live eight-hue industry system that no single-accent brand has.

Sources: [Starbucks](https://usbrandcolors.com/starbucks-colors/) ·
[Rolex](https://www.schemecolor.com/rolex-logo-colors.php) ·
[Claude/Anthropic palette](https://mobbin.com/colors/brand/claude) ·
[warm-neutral movement](https://www.wix.com/blog/website-color-trends)

### 4.5 Rules

- **Color comes from tokens. Never a hex literal** in a component, ever
  ([CLAUDE.md](../../CLAUDE.md) RULE #1). The two sanctioned exceptions — edge-runtime OG images
  and third-party brand marks — are the only ones.
- **Never fix an inconsistency by flattening to primary.** If two colored things disagree, decide
  what each one _means_ and give it the hue for that meaning. Setting both to pine is how a site
  goes monotone.
- **No gradients** as a visual device. Separation comes from base-tone steps, real edges, radius,
  and layout.
- **No shadows** as a visual device.
- **A tint (`bg-soft`) is an accent applied to the one thing that earns it**, not a wash. Tint the
  one primary card per hue on a dense page and leave the rest plain.
- **Headings are never tinted.** Hierarchy comes from scale and weight; color marks function, and
  a heading's function is to be read.
- **Dark mode is a toggle, not a stance.** Design light-first; both must be complete, and every
  hue in §4.2 has a dark value.

## 5. Typography

**Decided 2026-07-30:** a display serif alongside Geist. Per
[research §6](01-design-research-2026.md) this is the highest-leverage, lowest-cost identity
decision available — one family, used on roughly a dozen strings per page.

### 5.1 The families

| Role                 | Family               | Weights      | Where                                      |
| -------------------- | -------------------- | ------------ | ------------------------------------------ |
| **Display**          | **Instrument Serif** | 400 + italic | `h1`, `h2`, pull statements. Nothing else. |
| **Interface / body** | **Geist Sans**       | 400, 500     | Everything a person reads or clicks        |
| **Data / metadata**  | **Geist Mono**       | 400          | Numbers, dates, labels, tabular data, code |

**Instrument Serif** (SIL OFL 1.1) is high-contrast, editorial, and single-weight — display-only by
construction, which enforces its own discipline. Fallback if it tests poorly at small display
sizes: **Newsreader** (OFL, variable, real optical sizes).

Geist Sans and Geist Mono are already wired in the monorepo (`sparx/apps/web/app/layout.tsx`), so only
one new family ships.

> **Budget amendment.** [Research §12](01-design-research-2026.md) set a ≤2-family budget. This is
> 3 families / 4 weights. Accepted deliberately: Instrument Serif is one weight with no italic
> needed on most pages, Geist Mono is subset to numerals and Latin, and the combined added weight
> is under 45KB. The ≤4-weight half of the budget still holds. Recorded here so nobody
> re-litigates it mid-build.

### 5.2 Scale

Body floor is **16px**, reading default is **18px** ([CLAUDE.md](../../CLAUDE.md) RULE #3).

| Role         | Family           | Size                          | Line | Tracking | Weight |
| ------------ | ---------------- | ----------------------------- | ---- | -------- | ------ |
| `display-xl` | Instrument Serif | `clamp(2.75rem, 6vw, 5.5rem)` | 1.02 | -0.03em  | 400    |
| `display-l`  | Instrument Serif | `clamp(2.25rem, 4vw, 3.5rem)` | 1.08 | -0.025em | 400    |
| `heading-m`  | Geist Sans       | `1.75rem` (28px)              | 1.2  | -0.01em  | 500    |
| `heading-s`  | Geist Sans       | `1.25rem` (20px)              | 1.3  | 0        | 500    |
| `body-l`     | Geist Sans       | `1.125rem` (18px)             | 1.65 | 0        | 400    |
| `body-m`     | Geist Sans       | `1rem` (16px) — **floor**     | 1.6  | 0        | 400    |
| `meta`       | Geist Mono       | `0.875rem` (14px)             | 1.4  | 0        | 400    |

**`meta` is for captions, labels, dates, and figures only.** It is never body copy. 14px body text
is a house violation.

### 5.3 Rules

- **Serif for display, sans for everything else.** A serif paragraph is not a WizeWorks pattern.
- **Sentence case everywhere** — headings, buttons, labels, nav.
- **No uppercase micro-labels above headings.** The no-eyebrows rule is absolute and applies to a
  `<Badge>` used in that slot exactly as it applies to a `<span>`.
- **Measure caps at 68 characters** on reading surfaces.
- **Hierarchy from scale, weight, and color — never from fading text out.** No `/opacity`, no
  `text-soft`, no `muted` on anything a person is meant to read.
- **Tabular numerals** (`font-variant-numeric: tabular-nums`) anywhere figures stack.
- **Never center a paragraph** longer than two lines.

---

## 6. Layout system

| Property          | Value                                                                |
| ----------------- | -------------------------------------------------------------------- |
| Grid              | 12 columns, 24px gutter desktop / 16px mobile                        |
| Max content width | 1200px                                                               |
| Reading measure   | 68ch                                                                 |
| Section rhythm    | 96px desktop / 64px tablet / 48px mobile vertical padding            |
| Corner radius     | 6px on controls, 10px on cards, 0 on full-bleed bands                |
| Border            | 1px `--color-base-300`. Structure is visible, not implied by shadow. |
| Breakpoints       | Silica defaults; every surface designed mobile-first                 |

**Structural principles**

1. **Alternate the band.** Sections alternate between `base-200` canvas and `base-100` surface to
   create rhythm without any decoration. This replaces what a gradient or a shadow would do.
2. **Full-bleed for imagery, contained for reading.** Photography breaks the container; text never
   does.
3. **Asymmetry is allowed and encouraged.** A 7/5 split reads more considered than 6/6. Centered
   everything is the template look.
4. **One primary action per screen.**
5. **Density is a signal.** Exactly one section per page may be deliberately dense — the capability
   index or the portfolio matrix, with visible grid lines and mono labels. That is our controlled
   dose of structural brutalism ([research §3.5](01-design-research-2026.md)). One. Not two.

---

## 7. Imagery

**Decided 2026-07-30:** the site carries photography, sourced from **Pexels**, because no
first-party customer photography exists yet.

[Research §3.4](01-design-research-2026.md) is blunt that stock photography is how this archetype
dies. That risk is real and it is accepted — so this section exists to make stock _not read as
stock_, which is entirely a matter of what you choose and how you treat it.

### 7.1 The governing rule

> **A photograph may show the world our customers work in. It may never stand in for a customer,
> an employee, or a result.**

No stock face is ever captioned, named, placed beside a testimonial, or put on an About/team page.
That is the line between atmosphere and fabrication, and crossing it would discredit every honest
claim on the site ([positioning §8](02-positioning-and-audience.md)).

### 7.2 What to search for

Subjects that are true of work in general and specific to no vertical:

- **Hands doing work** — writing, wrapping, measuring, plating, sorting, at a keyboard. Faces
  optional, often better absent.
- **Real environments, empty or near-empty** — a counter before opening, a workshop bench, a
  studio chair, a loading bay, a back office at 6am.
- **Materials and texture close-up** — paper, cardboard, steel, tile, fabric, wood, glass.
- **Light as subject** — window light across a room, a lit sign at dusk, shadow structure.
- **The unglamorous middle of the job** — the parts nobody photographs for a brochure.

Useful Pexels queries: `workshop bench`, `small shop counter`, `hands working wood`,
`warehouse aisle morning`, `salon interior empty`, `commercial kitchen prep`, `office desk paper`,
`open sign window light`.

### 7.3 What to never use

Every item here is a [research §4](01-design-research-2026.md) slop marker:

1. People laughing at a laptop. Any variant. Any number of people.
2. Handshakes, high-fives, whiteboard pointing, headset call-center smiles.
3. Anything obviously AI-generated — melted hands, impossible reflections, illegible signage,
   glowing circuits, chrome faces.
4. Abstract "technology" imagery — servers, network diagrams over cities, glowing orbs.
5. Anything with a legible third-party brand, logo, or product.
6. Recognizable individuals shown in any way that implies they endorse WizeWorks.
7. Two photographs from visibly different grades sitting on the same page.
8. Photography behind text without a solid backing plate.

### 7.4 Treatment

Consistency of treatment is what turns a set of unrelated stock photos into one brand's
photography. Applied to **every** image, without exception:

| Property      | Setting                                                                    |
| ------------- | -------------------------------------------------------------------------- |
| Grade         | Warm, slightly desaturated (-10 to -15%), lifted blacks. Matches bone/ink. |
| Contrast      | Medium-low. No crushed shadows, no clipped highlights.                     |
| Crop          | Hard and off-center. Full-bleed or a 7/5 asymmetric split.                 |
| Aspect ratios | 16:9 bands, 4:5 portraits, 1:1 index tiles. No other ratios.               |
| Corners       | Square on full-bleed, 10px inside a card.                                  |
| Overlay       | None. If text must sit over an image, it gets a solid plate.               |
| Format        | AVIF with WebP fallback, `srcset` at 640/1024/1600/2400                    |
| Weight        | ≤ 180KB at 1600px                                                          |
| Loading       | `loading="lazy"` below the fold, explicit `width`/`height` always          |
| Alt text      | Describes the content. Empty `alt=""` if purely atmospheric.               |

**Grade every image with the same preset.** One image out of grade undoes the whole set.

### 7.5 Licensing and provenance

The Pexels License permits free commercial use without attribution, with restrictions that matter
to us:

- Photos **may not** be sold unaltered or redistributed as stock.
- Identifiable people **may not** be shown in a way that is defamatory or implies endorsement —
  which is exactly why §7.1 exists.
- Some subjects carry property or trademark rights the license does not cover.

**Required:** every image ships with a manifest row — `file`, `source URL`, `photographer`,
`downloaded date`, `page used on`. Stored at `docs/wizeworks/assets/image-manifest.csv`. We are not
required to attribute; we are required to be able to prove where it came from.

**We credit photographers anyway**, in a single line on a `/credits` page. It costs nothing and it
is the right thing to do.

### 7.6 The better path

Stock is the bridge, not the destination. The moment a real customer will let us photograph their
shop, that shoot replaces the stock on their industry page. Track it — every stock image on the
site is a small outstanding debt.

---

## 8. Motion

**Motion must explain, not entertain** ([research §8](01-design-research-2026.md)).

| Type          | Duration  | Easing                          | Use                              |
| ------------- | --------- | ------------------------------- | -------------------------------- |
| State change  | 150–200ms | `cubic-bezier(0.2, 0, 0, 1)`    | Hover, focus, toggle, open/close |
| Entrance      | 300–400ms | `cubic-bezier(0.16, 1, 0.3, 1)` | Section reveal on scroll         |
| Demonstration | 600ms+    | linear or eased per content     | A workflow playing out on screen |

**Rules**

- **Design the static page first.** If it isn't good without motion, motion won't save it.
- **Removal test:** take the animation out. If the section communicates the same thing, the
  animation was decoration — delete it.
- **Nothing animates in and then just sits there.**
- **Nothing blocks first paint.** No intro sequences.
- **`prefers-reduced-motion: reduce` must yield a complete page**, not a broken or empty one.
  Elements appear in final state; demonstrations become static annotated stills.
- **Scroll-linked motion only above 768px.** On mobile, everything is static.

---

## 9. Component usage

The site is built on **silicaui + Tailwind utilities. Nothing else without explicit approval,
asked up front** ([CLAUDE.md](../../CLAUDE.md) RULE #1).

| Need             | Use                                                                               |
| ---------------- | --------------------------------------------------------------------------------- |
| Any control      | `@wizeworks/silicaui-react` primitive with `color × variant × size × shape` props |
| Layout / spacing | Tailwind utilities — always fine                                                  |
| Section chrome   | Composition in the theme, not per-page CSS                                        |
| Status           | `<Badge color={statusTone(s)} variant="soft">`                                    |
| A tint           | `bg-primary bg-soft` — never a baked hex                                          |

**Never:**

- A `style={...}` prop. Banned without explicit authorization, including CSS-var aliasing tricks.
- A hand-rolled replacement for something silicaui already provides.
- A background fill paired with a foreground text color — that is re-skinning a control.
- A bespoke CSS file.

If a page needs something silicaui doesn't have, **ask before building it**, not after.

---

## 10. Implementing this as a sparx theme

The WizeWorks site is a **tenant on sparx**, so this palette ships as a **saved theme**, not as an
edit to `@sparx/brand/theme.css`.

A sparx theme is a `DataThemePreset`
([wizeworks/packages/marketplace-schemas/src/theme-preset.ts](../../packages/marketplace-schemas/src/theme-preset.ts))
carrying **both** surfaces:

- **`v2`** — the real theme. `shared` (type, radii, spacing, container) plus a **complete `light`
  and `dark`** color map: `base100/200/300`, `baseContent`, `primary`, `secondary`, `accent`,
  `neutral`, `info`, `success`, `warning`, `danger`, `border`, optional `highlight`, and an
  optional `*Content` ink for every one of them.
- **`v1`** — the legacy `--st-*` storefront bridge (`wizeworks/packages/site-themes/src/tokens.ts`), a
  narrower set with no secondary slot. It is a compatibility surface, **not** the theme model.

**Author against v2.** Every color in §4 has a home there — including brass as `secondary` with
its mandatory dark `secondaryContent`, and full dark-mode values. Nothing in this brand needs a
platform change to express.

| v2 slot (light / dark)                    | Value                                     |
| ----------------------------------------- | ----------------------------------------- |
| `base100`                                 | `#FFFFFF` / `#141310`                     |
| `base200`                                 | `#F6F4EF` / `#0F0E0B`                     |
| `base300` · `border`                      | `#E5E1D8` / `#28251E`                     |
| `baseContent`                             | `#191713` / `#F2EFE8`                     |
| `primary` · `primaryContent`              | `#1B5E43` `#FFFFFF` / `#3FA47B` `#08120E` |
| `secondary` · `secondaryContent`          | `#A9761F` `#1A1206` / `#D3A24C` `#1A1206` |
| `accent` (clay) · `accentContent`         | `#9C4A2F` `#FFFFFF` / `#C4704F` `#1A0D08` |
| `info` · `success` · `warning` · `danger` | inherit silica — **rendered `soft` only** |
| `shared.fontHeading`                      | `Instrument Serif`                        |
| `shared.fontBody`                         | `Geist`                                   |
| `shared.radiusBox`                        | `10px`                                    |
| `shared.radiusField`                      | `6px`                                     |
| `shared.containerWidth`                   | `1200px`                                  |

Create via `create_saved_theme` → `apply_saved_theme`, **scoped to the WizeWorks site's
`propertyId`** — omitting it silently targets the tenant's primary site.

> ### The real gap: sparx has no concept of a tenant-named color
>
> Corrected twice, 2026-07-30. First draft said the industry hues "have nowhere to live" — wrong.
> Second draft said a tenant could reach them via `bg-[var(--color-industry-plum)]` — **also
> wrong.** The accurate finding is bigger than both, and it is not really about eight hues.
>
> **A tenant cannot name a color. At all.** The authorable palette is a fixed list of role names:
> `base-100/200/300`, `primary`, `secondary`, `accent`, `neutral`, `info`, `success`, `warning`,
> `danger`, `highlight`. That is what `describe_builder_styling` publishes as the class
> vocabulary, and there is no affordance anywhere — MCP or builder UI — for "here is another color
> of mine, call it Plum."
>
> **Why the arbitrary-value escape hatch doesn't save it.** Both theme emitters build a
> **hardcoded, closed** variable list from typed fields — `colorVars()` (`--st-*`) and
> `silicaColorVars()` (`--color-*`) in `wizeworks/packages/site-themes/src/v2/`. An extra key in an
> open input map has no path into the emitted CSS through them, so `bg-[var(--color-industry-plum)]`
> compiles to a rule referencing a variable that was never defined. (The newer silica path emits
> `theme.tokens` verbatim, so a custom `--color-*` key _may_ survive there — unverified, and it
> makes no difference to the point below.)
>
> **The asymmetry worth staring at:** silica takes an arbitrary-length color list. `sparx/apps/web` and
> `sparx/apps/workbench` register **25** — 9 semantics plus `module` and 15 `module-*` hues. `wizeworks/apps/site`,
> the surface tenants actually get, registers **10**. The platform has the capability, uses it
> freely for itself, and does not expose it to the people paying for it.
>
> **What should be built** — not for us, for everyone:
>
> 1. **A named-color primitive in the theme.** A tenant adds a color, names it, gives it a value
>    per mode, and gets an AA-checked `-content` ink derived for it — the same treatment the ten
>    roles get.
> 2. **A generic registered namespace** (`hue-1 … hue-12`) in `wizeworks/apps/site/app/globals.css`, so each
>    named color lands on a real registered slot and inherits the full class family — `bg-*`,
>    `text-*`, `btn-*`, `badge-*`, and the `bg-soft` tint.
> 3. **Surfaced in the builder** as choices with the tenant's own labels, not raw tokens.
>
> Then a clinic with departments, an agency with service lines, a distributor with brands, a
> franchise with locations, and WizeWorks with industries all get the same thing. **This is a
> prerequisite for the WizeWorks site, not a nice-to-have** — the eight industry hues are
> [§4.2](#42-the-palette) layer 3, and the palette does not work without them.

**Never edit `@sparx/brand/theme.css` for this site.** That file is the platform's, not a tenant's.

---

## 11. Do / don't

| ✅ Do                                        | ❌ Don't                                                     |
| -------------------------------------------- | ------------------------------------------------------------ |
| Warm bone canvas, warm ink                   | Cool gray canvas — that's every other SaaS site              |
| **Three or more hues per page, by function** | **A page in pine + neutrals only — that's the monotone bug** |
| **Give each meaning its own hue**            | **Flatten disagreeing colors to primary to "fix" them**      |
| Colored signals on a neutral chassis         | A tinted canvas, or color used as decoration                 |
| Neutral headings at every level              | Tinted headings                                              |
| Semantics as soft tints                      | A solid `success` / `warning` / `danger` fill                |
| One industry hue per page, outside the grid  | Two industry hues fighting on one page                       |
| Serif display, sans body                     | Serif body copy, or serif in the interface                   |
| Real screenshots at real fidelity            | Abstract illustrations of software                           |
| Visible borders and base-tone steps          | Shadows, glass, elevation effects                            |
| Photography full-bleed and hard-cropped      | Photography floating in a rounded card with a shadow         |
| One dense, grid-visible section per page     | Density everywhere — that's just noise                       |
| Sentence case, everywhere                    | Title Case headings, ALL-CAPS labels                         |
| Tokens                                       | Hex literals, `style={}`, bespoke CSS                        |
| A static page that's already good            | A page that needs motion to make sense                       |
| Dark ink on brass                            | White on brass — it fails AA                                 |

---

## 12. Open items

| #   | Item                                                                  | Blocks                  |
| --- | --------------------------------------------------------------------- | ----------------------- |
| 1   | ~~Design the wordmark + monogram~~ — **done 2026-07-30**, see §3      | —                       |
| 2   | Confirm Instrument Serif at display sizes, or fall back to Newsreader | Type system lock        |
| 3   | Product hues for kanNINJA and AGCONN                                  | Portfolio section       |
| 4   | Build the Pexels image set + manifest to §7                           | Every page with imagery |

**Palette locked 2026-07-30** (§4.2) — earthy, four layers, three-hue-per-page floor.
