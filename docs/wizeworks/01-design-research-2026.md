# WizeWorks — Design Research: What Business Platforms Look Like in 2026

**Version:** 1.0.0
**Author:** Brandon Korous
**Last Updated:** 2026-07-30

---

## 0. Why this document exists

WizeWorks needs a web presence that reads, instantly, as _a serious software and solution
provider for businesses of any kind_ — a 4-person beauty studio and a 400-person manufacturer
should both land on it and think "these people build things for companies like mine."

Before we design a single section, we need a shared, current picture of what that _looks_ like in 2026. This document is that picture. It is research first and instruction second: §1–§11 describe
what the market actually does, §12–§14 turn that into rules we hold ourselves to, and §15 lists
the decisions this research forces us to make.

**Scope note:** competitor and reference site names are deliberately absent — per house convention
we describe patterns in our own language in shipped artifacts. The archetype names in §3 are ours.

**Sources:** synthesis of 2026 B2B/enterprise web-design surveys, SaaS conversion-framework
analyses, and visual-trend reporting; full source list at the bottom.

---

## 1. The single biggest finding

**The shift in 2026 is structural, not aesthetic.**

Every credible survey lands in the same place: the sites winning business right now are not the
prettiest ones. They are the ones that are _legible_ — to a buying committee, to a search engine
that now answers instead of linking, and to a person on a phone with 40 seconds of attention.

The corollary matters more than any trend in this document: **a beautiful site with vague
positioning loses to a plain site with a specific claim.** Design's job in 2026 is to make a
specific claim unmissable, not to substitute for one.

Three forces are driving everything else:

| Force                       | What changed                                                                                 | What it does to design                                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Answer-engine discovery** | Search engines increasingly synthesize an answer instead of returning ten links              | Content must be structured, quotable, and specific. Vague hero poetry is invisible to a machine that must cite you.   |
| **Committee buying**        | A typical business software decision now involves ~6–11 people across incompatible functions | One page must serve an owner, an operator, and a technical evaluator without fragmenting into three different stories |
| **AI-generated sameness**   | Generative tools flooded the web with a recognizable default look                            | Evidence of human authorship — real screenshots, real numbers, real names, real opinions — is now a differentiator    |

---

## 2. The 2026 baseline (table stakes, not differentiators)

None of these will win anything. All of them will lose something if missing.

- **Sub-2-second load**, LCP and CLS prioritized. Motion budgets are performance budgets.
- **Mobile-first in earnest.** A majority of first touches and a large share of demo/contact
  requests originate on a phone. Sticky primary action on small viewports.
- **A real product or work visual above the fold.** Actual interface, actual artifact — not an
  abstract illustration, not a floating 3D blob.
- **Nav capped at 5–7 top-level items.** More than that and the committee splinters.
- **Proof in or immediately after the hero.** Not a logo strip 4 screens down.
- **Transparent pricing or an explicit, honest reason there isn't any.** "Contact us" with no
  band, no range, and no explanation now reads as a red flag rather than as enterprise poise.
- **No email gate on the first meaningful thing.** Let people see the work before they identify
  themselves.
- **AA contrast, keyboard-complete, reduced-motion honored.** Increasingly a procurement checkbox,
  not just an ethic.

---

## 3. The six visual archetypes currently working

These are the six coherent looks a business-platform site can credibly wear in 2026. Each is
internally consistent; the failure mode is mixing two and landing in neither.

### 3.1 Technical Editorial

Dense, typographic, confident. Big serif or high-contrast grotesque headlines set at real
editorial scale (72–140px desktop), body text at a genuinely readable 17–19px, generous measure
control (65–75 characters), and layout that behaves like a well-set magazine rather than a deck.
Color is restrained: paper, ink, one accent. Structure is visible — real rules between sections,
honest columns, tabular data shown as tables.

- **Signals:** competence, longevity, "we have opinions and have written them down."
- **Risk:** reads cold or slow if the copy is not actually good. This archetype has nowhere to
  hide — it is 80% writing.
- **Fit for WizeWorks:** **high.** It is the only archetype that scales across industries without
  looking like it was designed for one of them.

### 3.2 Product-as-Proof

The interface is the artwork. Real screenshots at real fidelity, cropped hard, layered in
sequence, annotated with short callouts. Motion is used to _operate_ the product on screen —
a cursor moves, a row updates, a number changes — rather than to decorate.

- **Signals:** "this exists, it works, here it is."
- **Risk:** requires the product to be genuinely photogenic, and requires constant maintenance as
  the UI changes. Screenshot rot is real and reads worse than no screenshot.
- **Fit for WizeWorks:** **high for the products section**, wrong for the company-level pages —
  WizeWorks sells more than one thing, so a single product cannot carry the top of the site.

### 3.3 Systems Diagram

The site explains a system: boxes, flows, layers, data moving between labeled things. Monospace
labels, thin rules, precise alignment, restrained palette with one hue used to trace a path.

- **Signals:** engineering rigor, integration competence.
- **Risk:** alienating to non-technical buyers, who are the majority of a committee. A diagram is
  a _supporting_ argument in 2026, not an opening one.
- **Fit for WizeWorks:** **selective.** Excellent on an architecture/how-we-work page. Fatal on
  the homepage of a company that must be legible to a beauty studio.

### 3.4 Warm Operational

Photography of actual work and actual people in actual places — a counter shop, a salon back
office, a warehouse aisle — cropped tight and color-graded consistently. Type stays clean and
modest; the imagery carries the emotion.

- **Signals:** "we work with businesses like yours."
- **Risk:** dies instantly on stock photography. This archetype requires real photographs or it
  reads as the most generic thing on the internet. It is also the archetype most damaged by
  AI-generated imagery, which the audience now detects.
- **Fit for WizeWorks:** **high, conditionally** — powerful for industry/customer pages _if and
  only if_ we have real photography rights. Otherwise skip entirely.

### 3.5 Structured Brutalism

Visible grids, hard edges, oversized type, deliberate density, monospace, high-contrast
monochrome with one loud accent. It signals authenticity by refusing polish.

- **Signals:** independence, technical credibility, "not a template."
- **Risk:** the single most-faked look of 2026. Good brutalism is meticulously designed to look
  careless, which is harder than polish. Done badly it reads as broken. It also skews young and
  technical — poor fit for a buyer over 45 evaluating an operations vendor.
- **Fit for WizeWorks:** **low as a whole-site language, useful as a spice** — one dense,
  grid-visible section (a capability index, a full portfolio matrix) inside an otherwise editorial
  site is the productive dose.

### 3.6 Kinetic Minimal

Very little on screen, everything moves. Scroll-driven reveals, cursor-responsive elements,
type that assembles itself, generous negative space.

- **Signals:** craft, modernity, design-forward.
- **Risk:** the highest cost-per-point-communicated of any archetype. Also the archetype that
  suffers most on mid-range Android and under reduced-motion, where it degrades to a nearly empty
  page. Motion-heavy sites also test poorly with committees, who scan rather than experience.
- **Fit for WizeWorks:** **low.** Borrow the restraint, not the choreography.

**Recommendation:** WizeWorks should be **Technical Editorial as the spine**, with
**Product-as-Proof** for the portfolio, **one Systems Diagram** page, and **Structured
Brutalism** as a single dense index section. Warm Operational only if real photography exists.

---

## 4. What is now dated — the 2026 slop signature

This list matters as much as the trends. These read, in 2026, as "generated" or "2021":

1. **Mesh / aurora / grainy-gradient hero washes.** The number-one tell. Universally recognized.
2. **Glassmorphic frosted panels floating over a blurred background.**
3. **Purple-to-blue gradient buttons** and the whole indigo-violet SaaS default palette.
4. **Abstract 3D blobs, chrome spheres, glowing orbs, circuit-board imagery** — the visual
   vocabulary of AI-generated "tech" imagery, now inseparable from it.
5. **The uppercase micro-label above every heading.** Introduced no information, cost a line,
   and appeared on every template. (Already banned in-house.)
6. **Big soft drop shadows** used to fake elevation on flat content. (Already banned in-house.)
7. **Stock photography of diverse people laughing at a laptop.**
8. **Feature grids of three cards with a thin-line icon, a two-word title, and a sentence of
   copy that says nothing.** The single most common way a real product is made to look fake.
9. **Faded gray body text at 13–14px** to look "refined." Reads as unreadable, because it is.
   (Already banned in-house.)
10. **Vague outcome poetry** — "unlock your potential," "built for the future of work." An answer
    engine cannot cite it and a buyer cannot repeat it.

Note how many of these we already ban. The house rules are, by accident of taste, an almost exact
inverse of the 2026 slop signature. That is a genuine advantage and we should lean on it hard.

---

## 5. Structural anatomy of a high-performing business-platform homepage

The consensus structure, in order. Deviations should be deliberate.

| #   | Section              | Job                                                 | 2026 specifics                                                                                    |
| --- | -------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1   | **Hero**             | One claim a visitor can repeat back after 5 seconds | 6–10 word headline, outcome-first; one supporting line; primary + secondary action; real visual   |
| 2   | **Demonstration**    | Show the thing working                              | Looping real interface, interactive tour, or a real artifact. Not an illustration.                |
| 3   | **Trust layer**      | Make the claim survivable                           | Max 3 metrics, or names, or one specific testimonial. Three is the cap — more reads as padding.   |
| 4   | **Problem → answer** | Prove we understand the buyer's day                 | Real pain in the buyer's own words, each paired with a concrete remedy                            |
| 5   | **Outcomes**         | Convert features into results                       | 3–4 outcomes with numbers, not a feature list. "Decisions 40% faster," not "real-time dashboard." |
| 6   | **Evidence**         | One story told properly                             | Named customer, named situation, measurable result. One deep story beats six logos.               |
| 7   | **Pricing preview**  | Remove the biggest unspoken objection               | Real numbers or a real range. Gating here is the most expensive friction on the page.             |
| 8   | **Close**            | A clear "start here"                                | One action, restated plainly, with the low-friction option first                                  |

**Distributed proof** is the newer refinement: rather than one trust section, credibility fragments
are placed adjacent to each claim they support — a metric beside the outcome it proves, a quote
beside the capability it validates, a certification beside the security claim.

**Committee legibility** is the other: the same page must let an owner read the outcome layer, an
operator read the workflow layer, and a technical evaluator read the architecture layer, without
any of them being told a different story. In practice that means _layered depth on one narrative_,
not three parallel narratives — a progressive-disclosure page, not a persona switcher.

---

## 6. Typography in 2026

The clearest trend line: **type is the interface**. Both because editorial boldness is in, and
because text is the cheapest, fastest, most machine-readable thing you can ship.

**What's live:**

- **Scale contrast is extreme.** Display type at 4–8× body size. Hierarchy from size and weight,
  never from fading text out.
- **Expressive serifs are back** for display, paired with a neutral grotesque for interface text.
  This is the strongest single differentiator against the sans-only SaaS default.
- **Monospace as a texture** for metadata, labels, numbers, code, and data — signaling technical
  authenticity. Sparingly: monospace body copy is a 2026 trend that will age badly.
- **Body copy has gotten bigger.** 17–19px is now standard for reading text; 16px is the floor.
- **Tighter display tracking** (-0.02 to -0.04em), normal body tracking.
- **Variable fonts** for weight/optical-size response across breakpoints without extra requests.

**What's dated:** all-caps micro-labels, letter-spaced "luxury" headings, thin weights (200/300)
at body size, and centered paragraphs longer than two lines.

**Implication for us:** the house stack is Geist at two weights (400/500), which is deliberately
quiet and correct for _product UI_. A **company** site can carry more voice than a dashboard. A
display face paired with Geist is the highest-leverage identity decision available to WizeWorks,
and it is nearly free — one font, used on maybe twelve strings.

---

## 7. Color in 2026

**The dominant formula: near-black + near-white + exactly one loud accent.** Complex palettes
consistently underperform. The accent's job is to be the only saturated thing on screen, so the
eye goes where you point it.

Secondary movements worth knowing:

- **High-contrast monochrome** with a single reactive hue — the technical-credibility look.
- **Warm neutrals** (bone, sand, clay) displacing cool grays as the "paper" tone. This is a quiet
  but strong 2026 shift and it is the cheapest way to look less like default SaaS.
- **Dark-mode-first marketing** is receding. Dark is now a toggle, not a stance.
- **Saturated blue-violet is the single most saturated market position in software** and reads as
  default. Any accent outside it buys distinctiveness for free.

**Rules we inherit:** no gradients as a visual device, ever; color comes from tokens, never hex;
a soft/tinted treatment is an accent applied to the one thing that earns it, not a wash.

> **Overridden 2026-07-30.** WizeWorks deliberately does **not** run a single-accent palette. The
> single-accent formula reliably produces a monotone screen, and flattening every colored element
> to primary has already been called out twice on sparx work as what makes a built site feel dead.
> The house doctrine instead is **color follows functionality** — one hue per function, many
> functions per page, chassis neutral. The research's real target is _decorative_ color, which
> stays banned. Specified in [04 §4.1](04-brand-and-visual-identity.md).

**Implication for us:** sparx already owns Ember `#e04631` against a deep navy ink `#0c1433` with
a cyan accent — a warm/cool pairing that is genuinely off-default. The WizeWorks brand-architecture
decision (§15) determines whether the parent shares that, inverts it, or holds its own ground.

---

## 8. Motion in 2026

The rule everyone converged on: **motion must explain, not entertain.**

- **In:** functional animation that demonstrates a workflow; scroll-linked reveals that pace a
  narrative; state transitions that show cause and effect; a cursor that operates a real UI.
- **Out:** cinematic intros that delay first paint; parallax for its own sake; elements that
  animate in and then simply sit there; anything that must complete before content is readable.
- **Durations:** 150–250ms for state changes, 300–500ms for entrances, 600ms+ only for something
  the user is meant to _watch_.
- **`prefers-reduced-motion` is non-negotiable** and the reduced state must be a complete page,
  not a broken one. Test by designing the static version first.

**Practical test:** if you removed the animation and the section communicated the same thing, the
animation was decoration. Keep it only if removal costs information.

---

## 9. Proof and credibility architecture

The strongest structural change in B2B design over the past two years.

- **Distributed, not centralized.** Proof lives beside the claim it supports.
- **Specific beats impressive.** "Cut quote turnaround from 3 days to 40 minutes for a 12-person
  distributor" outperforms "trusted by industry leaders" by a wide margin.
- **Named and dated.** Anonymous testimonials now read as fabricated by default — an unavoidable
  consequence of everyone knowing text is cheap to generate.
- **Show the artifact.** A screenshot of the real dashboard, the real invoice, the real report is
  worth more than any adjective.
- **Honesty about stage converts.** For an early company, stating exactly where you are
  outperforms implying scale you don't have — the audience is extremely well-calibrated at
  detecting inflation, and one detected inflation discredits every other claim on the page.

**Direct implication for WizeWorks:** we are a small studio with a large amount of real shipped
software. Do not build a logo wall — we don't have one, and a thin one is worse than none.

> **Overridden 2026-07-30.** The research above recommends one or two named customer stories as the
> depth play. Brandon's call went further: **this site carries no social proof at all** — no
> testimonials, no logos, no stories, no counts. The reasoning is that the consensus is describing
> companies whose product cannot be shown, and ours can. The research is left standing as reported;
> the divergence is recorded here and specified in
> [02 §8](02-positioning-and-audience.md).

---

## 10. Designing for answer engines

New in the last 18 months and now unavoidable: a large share of first contact is a machine reading
the site in order to summarize it to a buyer.

What that machine needs:

- **Declarative, self-contained sentences.** Each paragraph should survive being quoted alone.
- **Explicit entity statements.** "WizeWorks is a software studio in Visalia, California that
  builds business platforms" — stated plainly, not implied through vibes.
- **Question-shaped headings.** Real questions people ask, answered directly beneath.
- **Structured data** (`Organization`, `Product`, `FAQPage`, `BreadcrumbList`) and a maintained
  `llms.txt`.
- **Comparison content.** Direct, honest statements of what we are and are not, and who we are not
  for. Answer engines reward and reproduce explicit differentiation.
- **Numbers in text, not baked into images.** An image of a chart is invisible to the summarizer.

This pulls in the same direction as committee legibility and as good writing generally, which is
convenient: there is no tradeoff to manage here.

---

## 11. What multi-product parent companies do specifically

WizeWorks is a house with several products under it, which is its own design problem. The
patterns that work:

- **The parent site sells the house, not the products.** Its job is credibility, philosophy, and
  routing. Product detail lives on the product's own site.
- **A portfolio index is a real, designed section** — not a footer list. Each product gets a card
  that states, in one sentence, what it is and who it's for, and links out.
- **Visual coherence without uniformity.** Products keep their own accent color and mark; the
  parent supplies the typographic system, the layout grid, and the neutral palette. You should be
  able to tell two products are siblings without them looking identical.
- **The parent carries the point of view.** With no single product to demo, the parent's
  differentiator is _how it thinks_ — a stated philosophy of how software should be built for
  businesses, which then visibly manifests in every product.
- **Services and products are separated cleanly.** A company that both builds its own products
  and does client work must make the two paths obviously distinct on the homepage, or every
  visitor spends their first ten seconds confused about what they're being sold.
- **Industry pages are how "we serve everyone" becomes credible.** "For every business" is an
  empty claim on its own; six specific industry pages, each speaking that industry's language,
  make the general claim true by demonstration. This is the single most important structural
  answer to WizeWorks' "big or small, tech or beauty" requirement.

---

## 12. Budgets we hold ourselves to

| Dimension            | Budget                                                             |
| -------------------- | ------------------------------------------------------------------ |
| LCP                  | < 1.8s on 4G mid-tier mobile                                       |
| CLS                  | < 0.05                                                             |
| Total JS (marketing) | < 120KB gzipped                                                    |
| Fonts                | ≤ 2 families, ≤ 4 total weights, self-hosted, `font-display: swap` |
| Hero media           | < 400KB; video posters mandatory; no autoplay audio                |
| Top-level nav        | ≤ 6 items                                                          |
| Homepage sections    | 7–9                                                                |
| Body text            | ≥ 16px everywhere, 17–19px on reading surfaces                     |
| Contrast             | AA minimum on all text, AAA on body copy where achievable          |
| Motion               | Full parity under `prefers-reduced-motion: reduce`                 |

---

## 13. How the research collides with house rules

Several live 2026 trends are things we do not do. Recording the reconciliation so nobody
re-litigates it mid-build:

| 2026 trend                        | House rule            | Our substitution                                                                    |
| --------------------------------- | --------------------- | ----------------------------------------------------------------------------------- |
| Grainy / mesh gradient surfaces   | No gradients          | Solid tokened fills; separation via base-tone steps and real edges                  |
| Glassmorphism, floating elevation | No shadows            | Borders, base-tone shifts, radius, and in-flow layout                               |
| Uppercase kicker above headings   | No eyebrows           | The heading carries itself; hierarchy from scale, weight, and color                 |
| Faded gray secondary text         | No faded readable ink | Real ink tokens; de-emphasis through size and placement                             |
| Dense monospace body copy         | 16px floor, readable  | Monospace confined to labels, numbers, metadata, code                               |
| Single loud accent                | Use the full palette  | One hue per _function_, many functions per page; chassis stays neutral              |
| Kinetic hero choreography         | Motion must explain   | Static-first composition; motion added only where removal costs information         |
| Brutalist "carelessness"          | —                     | Density and visible structure, executed precisely — one section, not the whole site |

The pattern: we take the **structural** half of every trend and refuse the **decorative** half.
That is a coherent position, not a compromise, and it happens to be exactly what §1 says wins.

---

## 14. Scorecard — how we will judge the finished site

Score each 1–10; anything below 8 gets fixed before launch.

1. **Repeatable claim** — can a visitor say what WizeWorks does after 5 seconds?
2. **Industry-agnostic credibility** — would a beauty studio and a manufacturer both feel spoken to?
3. **Proof density** — is every significant claim within one screen of its evidence?
4. **Committee legibility** — owner, operator, and technical evaluator all served by one narrative?
5. **Machine legibility** — could an answer engine summarize us correctly from the text alone?
6. **Non-default** — does it avoid all ten items in §4?
7. **House compliance** — silicaui + Tailwind only, tokens not hex, no eyebrows/gradients/shadows/faded ink?
8. **Performance** — every budget in §12 met on a real mid-tier phone?
9. **Reduced-motion parity** — is the static version a complete, good page?
10. **Portfolio coherence** — do the products read as siblings without reading as clones?

---

## 15. Decisions this research forces

These block the branding document and are listed in the order they need answering.

1. **Brand architecture.** Does WizeWorks (a) share sparx's palette and type as one visual family,
   (b) hold a distinct parent identity that the products sit inside, or (c) act as a deliberately
   neutral container whose products carry all the color? §11 favors (b); (c) is defensible.
2. **Products vs. services.** Is WizeWorks primarily a product house that also consults, or a
   solution provider that also has products? This changes the homepage's spine, not just its copy.
3. **Display typeface.** Do we introduce a second family for display, per §6? Highest-leverage,
   lowest-cost identity decision on the table.
4. **Photography.** Do we have, or can we get, rights to real photographs of real customer
   operations? If no, §3.4 is off and we commit fully to Technical Editorial.
5. **Named proof.** Which customers can we name, with what numbers, on the record?
6. **Entity name.** Shipped code currently carries both "WizeWorks, Inc." and "WizeWorks LLC"
   (`apps/web/app/layout.tsx` vs `apps/web/app/careers/roles.ts`). One is wrong and it appears in
   structured data and legal copy.
7. **Industry set.** Which six to eight industries get real pages, per §11?

---

## Sources

- [B2B Website Trends to Watch in 2026 — Brightscout](https://www.brightscout.com/insight/b2b-website-trends)
- [SaaS website design in 2026 — best SaaS websites, examples & conversion framework — Stan Vision](https://www.stan.vision/journal/saas-website-design)
- [Aesthetics in the AI era: visual + web design trends for 2026 — AI Goodies](https://aigoodies.beehiiv.com/p/aesthetics-2026)
- [Enterprise UX: The Top B2B Experience Design Trends of 2026 — Dfeelings](https://dfeelings.com/en/blog/enterprise-ux-the-top-b2b-experience-design-trends-of-2026)
- [Brutalist Web Design 2026: When It Works, When It Fails — Brainy Papers](https://brainy.ink/paper/brutalist-web-design-2026)
- [Font Trends 2026: The 12 Type Movements Shaping Design This Year — Made Good Designs](https://madegooddesigns.com/font-trends-2026/)
- [Web Design Trends 2026: Brutalist UX & Invisible Logic — Fireart Studio](https://fireart.studio/blog/the-best-web-design-trends/)
- [Top B2B Website Design Trends for 2026 — Lowcode Agency](https://www.lowcode.agency/blog/b2b-website-design-trends)
- [Top Enterprise Website Design Trends to Watch in 2026 — demandDrive](https://www.demanddrive.com/insight/websites-that-sell-top-enterprise-website-design-trends-to-watch-in-2026/)
