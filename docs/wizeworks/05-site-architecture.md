# WizeWorks — Site Architecture & Page Specs

**Version:** 1.0.0
**Author:** Brandon Korous
**Last Updated:** 2026-07-30

---

## 1. Scope

`wize.works` — the WizeWorks company site. Built as a tenant on sparx.

It sells the **house**, not the products. Product detail lives on `sparx.works` and
`kanninja.com`; this site's job is credibility, point of view, and routing
([research §11](01-design-research-2026.md)).

The spine is **solution provider that also has products**
([positioning §1](02-positioning-and-audience.md)).

---

## 2. Sitemap

```
/                          Homepage
/how-we-work               The process — the spine of the pitch
/industries                Index of the eight
  /industries/[slug]       ×8 — retail, beauty, trades, professional,
                           manufacturing, food, health, nonprofit
/products                  The portfolio
/pricing                   What it costs to work with us
/about                     Who we are, honestly
/contact                   Start a conversation
/architecture              How it's built — for technical evaluators
/security                  Data, access, uptime, exit
/credits                   Photography credits
/legal/privacy             ─┐
/legal/terms                ├ plain-language summary above binding text
/legal/dpa                 ─┘
/llms.txt                  Answer-engine entity file
```

**No `/work` route.** [Positioning §8](02-positioning-and-audience.md) settled that this site
carries no social proof — no stories, no testimonials, no logos. The portfolio and the industry
pages carry the whole credibility burden.

**Launch cut:** homepage, how-we-work, industries index + 3 industries, products, pricing, about,
contact, security, legal. The remaining five industries follow as content, not as engineering.

---

## 3. Navigation

**Five items. Hard cap is six** ([research §12](01-design-research-2026.md)).

```
WizeWorks    How we work · Industries · Products · Pricing · About    [Start a project]
```

- Sentence case, no dropdowns except **Industries** (a single flat list of eight).
- `Start a project` is the only primary action in the header.
- **Mobile:** full-screen sheet, same six items, sticky `Start a project` bar at the bottom of the
  viewport on every page.
- **Footer** carries the long tail: architecture, security, credits, legal, the three product
  sites, the entity line, and location.

---

## 4. Homepage

Nine sections, following the anatomy in [research §5](01-design-research-2026.md) with the
solution-provider spine from [positioning §7](02-positioning-and-audience.md).

### 4.1 Hero

| Property | Spec                                                                               |
| -------- | ---------------------------------------------------------------------------------- |
| Headline | `display-xl`, Instrument Serif — **"We build the software your business runs on"** |
| Sub      | `body-l`, max 2 lines — the wedge, three sentences compressed to two               |
| Actions  | Primary `Tell us what's broken` · Secondary `See what we've built`                 |
| Visual   | Full-bleed photograph, 7/5 asymmetric split, hard crop — a real work environment   |
| Height   | Content-height. **Not** 100vh.                                                     |
| Motion   | None. The hero is static.                                                          |

**No eyebrow. No badge above the headline. No logo strip inside the hero.**

### 4.2 The wedge

The two bad options and ours, as a three-column comparison at desktop, stacked at mobile.
This is the most important section on the page — it is the only one that says why us.

Uses the table from [positioning §2](02-positioning-and-audience.md) verbatim. Our column is the
only one carrying pine; the other two stay neutral. Visible borders, no shadows, no icons.

### 4.3 How we work — condensed

Four steps with real durations attached. Links to `/how-we-work`.
Concrete beats aspirational: "Week one: we sit with you and map what actually happens," not
"Discovery."

### 4.4 Industries

The claim "every company" made credible. An eight-tile grid, each tile: industry name, one line in
that industry's own language, one photograph. Links to the industry page.

**This is the dense section** — the single sanctioned dose of visible-grid structure per
[brand §6](04-brand-and-visual-identity.md). Clay grid lines, mono labels, 1:1 tiles.

**It is also the most colorful thing on the site**: all eight industry hues appear at once as tile
fills ([brand §4.2](04-brand-and-visual-identity.md) layer 3). This section is what makes "every
company" visible rather than merely stated, and it is the main reason the homepage doesn't read
monotone.

### 4.5 The work

**No testimonials, no logos, no stories** — [positioning §8](02-positioning-and-audience.md) is a
position, not a placeholder. Credibility here comes from the artifact: real software, at real
fidelity, doing real work, shown large.

One screen, shown big enough to actually read, with two or three short annotations pointing at what
it's doing. **The one brass moment on the page is the single figure that quantifies the scope of
what we've built.**

### 4.6 Products

Three cards: sparx, kanNINJA, and AGCONN, each wearing its own product hue (Ember `#e04631` for
sparx).
One sentence each — what it is, who it's for — plus the
product's own accent color and mark, and a link out.

Resist selling here. The parent routes; the product site sells.

### 4.7 Range

The "big or small, tech or beauty" statement, made once, plainly, with two concrete opposite
examples side by side. Two columns, two real scenarios, no adjectives.

### 4.8 Pricing preview

A real band and how engagements are shaped. Links to `/pricing`.
Gating here is the most expensive friction available to us — do not do it.

### 4.9 Close

One heading, one line, one action: `Tell us what's broken`. Plus the low-friction alternative —
an email address that a human reads.

---

## 5. Page templates

### 5.1 Industry page (×8)

| Section       | Content                                                                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Hero          | Their day named in their words. Photograph from their world. `display-l`.                                                                 |
| The friction  | 3–4 specific broken things, in their vocabulary. No generic pain.                                                                         |
| What we build | The concrete system for this industry, with the artifact from [positioning §6](02-positioning-and-audience.md) shown as a real screenshot |
| A Tuesday     | One narrative paragraph walking through one real day on the system                                                                        |
| What it costs | The band for this shape of work                                                                                                           |
| Proof         | A story from this industry if we have one; the honest absence if we don't                                                                 |
| Close         | `Book a 20-minute call`                                                                                                                   |

**Rule:** never explain their business to them. Every industry page must be readable by someone in
that industry without a single sentence that makes them wince.

### 5.2 Product card (portfolio)

Product mark, name in the product's accent, one sentence of what it is, one sentence of who it's
for, link out. No feature list. No pricing. Coherent grid, distinct color — the sibling test from
[brand §1](04-brand-and-visual-identity.md).

### 5.3 Pricing

Blunt to the point of stark. The four rungs from
[positioning §7](02-positioning-and-audience.md), each with a real number or a real range, plus
what changes the number. If something genuinely can't be priced publicly, say why in one sentence
rather than hiding behind "contact us."

Include: what's included, what's not, what happens if you leave, and who owns the data. Ownership
and exit belong on the pricing page because that's where the finance reader is.

### 5.4 Architecture & security

The two pages where technical vocabulary is allowed, because a technical evaluator is reading.
Architecture gets the one systems-diagram treatment ([research §3.3](01-design-research-2026.md)).
Security covers data location, access control, backups, uptime, subprocessors, and exit — linking
to the existing [docs/corporate/legal/](../corporate/legal/) material where it applies.

---

## 6. The answer-engine layer

Per [research §10](01-design-research-2026.md) and [voice §11](03-voice-and-tone.md).

| Artifact              | Requirement                                                                                                                                                                |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entity statement      | Plain sentence in the first 200 words of `/` and `/about`                                                                                                                  |
| `Organization` schema | Name, URL, logo, address, founder, `sameAs` for the three products. **Entity name must match the resolved legal name** ([positioning §11](02-positioning-and-audience.md)) |
| `Service` schema      | One per offer rung                                                                                                                                                         |
| `FAQPage` schema      | On pricing and each industry page                                                                                                                                          |
| `BreadcrumbList`      | Every page below root                                                                                                                                                      |
| `llms.txt`            | Entity statement, products, offer ladder, pricing, contact. Maintained, not generated once                                                                                 |
| Question headings     | Real questions, answered in the paragraph directly beneath                                                                                                                 |
| Figures               | In text. Never only inside an image.                                                                                                                                       |
| OG images             | Per page. Edge-runtime, reading hex from `@sparx/brand` — the one sanctioned literal-hex context                                                                           |

---

## 7. Acceptance criteria

The site is not done until every one of these is true.

**Structure**

- [ ] Nav is 6 items or fewer; mobile has a sticky primary action
- [ ] Zero testimonials, logos, customer counts, or stories anywhere on the site
- [ ] Homepage is 9 sections, in the order in §4
- [ ] Every significant claim is within one screen of its evidence
- [ ] Pricing shows a real number or a real range with an honest explanation
- [ ] No email gate before the first meaningful thing

**Brand**

- [ ] Zero hex literals outside the two sanctioned contexts
- [ ] Zero `style={...}` props
- [ ] Zero eyebrows — including `<Badge>` used as one
- [ ] Zero gradients, zero shadows as visual devices
- [ ] Zero faded ink on readable text; body ≥16px everywhere, 18px on reading surfaces
- [ ] At least three hues carrying distinct functions on every page — a pine-and-neutrals page is a defect
- [ ] Headings neutral at every level; canvas, cards, and body copy neutral
- [ ] Brass only on figures and step numerals; clay only on editorial emphasis and the dense grid
- [ ] Semantics rendered as soft tints only — no solid success/warning/danger fill
- [ ] One industry hue per page outside the homepage grid
- [ ] Exactly one dense/grid-visible section per page
- [ ] Every photograph carries the same grade and a manifest row

**Voice**

- [ ] No exclamation points, no "solutions" as a noun, no manufactured urgency
- [ ] No unearned scale claims of any kind
- [ ] No sentence that would fit unchanged on a competitor's site
- [ ] 9th-grade reading level on customer-facing copy
- [ ] No single industry used as the default example anywhere

**Performance & access**

- [ ] LCP < 1.8s on mid-tier 4G mobile; CLS < 0.05
- [ ] Marketing JS < 120KB gzipped
- [ ] AA contrast throughout; AAA on body copy where achievable
- [ ] Keyboard-complete; visible focus on every interactive element
- [ ] `prefers-reduced-motion: reduce` yields a complete, good page
- [ ] Every image has explicit dimensions and correct alt

**Machine**

- [ ] Entity statement in the first 200 words of `/` and `/about`
- [ ] `Organization`, `Service`, `FAQPage`, `BreadcrumbList` schema present and valid
- [ ] `llms.txt` accurate and current
- [ ] Every figure appears in text, not only in an image

**Scorecard** — all ten axes in [research §14](01-design-research-2026.md) at 8 or above.
