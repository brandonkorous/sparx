# Learnings — Landing-page sections that drive positive user impact

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-06-30

A research-backed playbook for the marketing site (`sparx/apps/web`). We have a number of
sections to rework; this is the shared rubric so every rework is grounded in what
actually moves people, not taste alone. Read it before reshaping a section, and run a
section through the [checklist](#13-the-pre-ship-section-checklist) before shipping.

Everything here is filtered through sparx's binding brand discipline — **no gradients,
no eyebrows, semantic color, real product imagery only, the surface-depth system** — and
our audience: owner/operators of a **content and/or commerce** business, not just
"merchants." Where the research and our house rules interact, the house rules win on
_appearance_; the research wins on _structure and message_.

> Stats below are directional (mostly vendor CRO studies and NN/g summaries, not
> peer-reviewed). Treat them as "which direction, roughly how much," not gospel — the
> _principles_ are the durable part. Sources at the end.

---

## 1. The one law: clarity beats cleverness

This is the finding everything else hangs off. A visitor decides whether to stay in
**3–5 seconds**, scanning three things only: **headline, hero visual, primary CTA**
(NN/g). They spend ~**80% of their time above the fold**, and leave within **10–20s**
unless the value proposition gives them a reason to stay. Clarity of the value prop is
repeatedly cited as the **#1 driver** of conversion lift (MECLABS) — plain-language copy
has been measured converting **~6×** better than jargon.

Julian Shapiro's formula is the cleanest mental model:

> **Purchase = Desire − (Labor + Confusion)**

So every section has three jobs: **raise desire** (a real outcome the reader wants),
**cut labor** (fewer words, less scrolling, less thinking), **kill confusion** (say the
literal thing). When in doubt, make it _clearer_, not cleverer. A witty headline that
needs a beat to decode has already lost the 5-second scan.

**Apply:** if a section can't be understood with the sound off in five seconds, it's not
done — regardless of how polished it looks.

## 2. One section, one job

**A list is not a section.** A landing page exists to **answer the visitor's concerns and
pain points** and move them toward a decision. A bare grid of items — features, modules,
logos — with no stated concern it resolves and no goal it drives toward does _neither_:
it doesn't tell the reader why they should care, and it doesn't ask them to do anything.
Every section must (a) answer a real concern/pain and (b) have a goal. If you can't say
which worry a section removes and what it wants the reader to do next, it isn't a section
yet — it's an inventory.

Cluttered pages raise cognitive load (~+48% in UX studies) and **decision paralysis**
kills action. The fix is "**one goal per view**": each section answers exactly **one**
buyer question and hands off to the next. Buyers move through a fixed sequence of
questions — answer them _in order_:

1. Am I in the right place? (hero)
2. Is this real / who else uses it? (social proof)
3. What's the problem this solves, and is it _my_ problem? (problem framing)
4. How does it actually work / what do I get? (benefits, shown)
5. How does it compare / why you? (comparison, objections)
6. What does it cost / is it fair? (pricing)
7. What's still nagging me? (FAQ)
8. OK — how do I start? (final CTA)

If a section is trying to do two of these, split it. If two adjacent sections do the
same one, merge them. (This maps directly onto our surface-depth tiers — a single job
per plate.)

## 3. The page is an argument (anatomy & order)

The consensus high-converting structure (CXL, Julian, Leadfeeder, Conception Labs) is a
**promise → proof → problem → payoff → proof → objections → price → close** arc:

```
Navbar → Hero (promise) → Social proof (logos) → Problem/value → Benefits (shown)
       → Deeper social proof → Comparison / why-us → Pricing → FAQ → Final CTA → Footer
```

Notes that matter:

- **Average SaaS landing page converts ~3.8%** (lowest of any industry); top performers
  hit **11.6%+**. The delta is almost entirely structure + clarity, not traffic.
- **Progressive-commitment CTAs**: one CTA on a long page isn't enough, but the _same_
  "Start free" repeated everywhere reads as desperate. Change the CTA's _words_ to match
  what the reader just absorbed — same destination, different sentence. It should feel
  like a conversation, not a stuck record.
- Order is a dramaturgy: don't ask for the sale (pricing/close) before you've earned it
  (problem + proof). A section in the wrong slot underperforms even if it's individually
  good.

## 4. Headlines & value propositions

- **Outcome over feature, always.** "Save hours every week" beats "AI-powered
  scheduling." Nobody wants the proprietary algorithm; they want the time/money/relief.
- **Two proven hero hooks:** (a) a **bold, _quantified_ claim** ("Groceries delivered in
  1 hour"), or (b) **address the #1 objection** head-on. Don't try to handle every
  objection in the headline — save the rest for the body.
- **Litmus test:** _"If a visitor reads only this line, do they know exactly what we
  sell?"_ If not, it's a slogan, not a value prop. "Improve your workflow" fails;
  "Visually design sites with no code" passes.
- **Subhead = 1–2 sentences:** sentence one says what it _is_; sentence two says why the
  headline's claim is _credible_.

## 5. Show, don't tell (benefits & features)

Structure each feature/benefit as **header → short paragraph → image** (Julian):

- **Header:** a blunt value prop ("Cooks and sears," "No cleanup"), scannable so the
  reader self-identifies relevance in a glance.
- **Paragraph:** concise; handle only the _critical_ objection; link/disclose the rest so
  you don't break flow.
- **Image:** show the **product in actual use** — a GIF/screenshot of the real UI, not
  abstract art or stock photography. Real product imagery de-risks the reader's time and
  is the single most credible "image" you can use. **This is also our anti-slop rule:**
  the only imagery that earns its place is product truth or real human/vertical footage
  (see [§12](#12-translating-this-to-sparx)).

## 6. Social proof that converts

- **Specificity is the whole game.** "Cut our quote turnaround from 3 days to 2 hours"
  beats "Great product!" A testimonial converts when it tells a **before → after** with a
  **number** and a real name/photo/company.
- **Stack the types:** customer **logos** (instant legitimacy) + **metric** quotes
  (logical proof) + **video** (video testimonials measured ~**+80%** vs text; reviews up
  to **+270%**).
- **Counts:** keep **3–5 testimonials visible** (more = cognitive load), but a deep
  library signals scale (100+ correlates with materially higher conversion).
- **Placement:** a logo strip _just below_ the hero answers "is this real?" early; a
  richer proof block earns its keep later, right before or after the comparison/price.

## 7. Problem-framing sections (PAS)

For any "here's the pain you have today" beat (our "Six tabs. One bill." is exactly
this), use **Problem → Agitation → Solution**:

- **Problem (≈1 sentence):** name the specific pain so the reader feels _seen_ — "You're
  paying for six tools that don't talk to each other."
- **Agitation (2–3 sentences):** make the cost of the status quo concrete (wasted spend,
  no unified report, the Zapier duct tape) — but **don't overplay it**; melodrama reads
  as manipulation.
- **Solution (1–2 sentences + CTA):** present sparx as the _balm_, tightly aligned to the
  agitated problem, with proof and a way to act.

The emotional logic: make them feel the problem, then hand them the fix on a plate. A
problem section that states the problem and then **just stops** (no solution, no CTA) is
the most common failure — it builds tension and releases none.

## 8. Comparison / "why-us" sections

- **Comparison matrices reduce decision anxiety** and have been measured lifting
  conversion (~+18%). They work because they do the buyer's homework for them.
- **Value-focused beats competitor-focused.** 2025 analyses found defensive
  "we're better than X" messaging underperforms positive framing. Two routes:
  - **Category framing** ("Most platforms charge per seat; we don't") — durable
    (survives competitors' price changes) and non-defensive.
  - **Named comparison** (our current compare table names rivals) — higher recognition
    and concreteness, but dates faster and reads more combative.
  - _Decision for sparx:_ both are defensible; lean category-framed for evergreen
    sections (cost/stack arguments) and reserve named matrices for the dedicated
    head-to-head where recognition is the point. Don't mix defensiveness into the
    problem-framing beat.
- **Keep it scannable:** strong column alignment, light icon use, clear labels, sticky
  header on long tables, generous whitespace. Good comparison _design_ alone can lift
  conversion 30–50% without changing a single claim.

## 9. CTAs — the most-tested element on the page

- **First person wins.** "Start **my** free trial" beat "Start **your** free trial" by
  ~**90%** CTR (ContentVerve). Phrase the button as the _reader's_ own decision.
- **Name the benefit, not the mechanic.** Stating the concrete gain has lifted clicks
  **~161%**; "Get my savings breakdown" > "Submit." Action verb + specific outcome,
  2–5 words.
- **Continue the narrative.** The CTA should feel like _fulfilling the headline's
  promise_ ("Find food," "Start learning") — never generic ("Request a meeting").
- **Reduce friction at the button:** restate "no card · cancel anytime" inline; every
  field you remove lifts completion (one SaaS: 12→4 fields = **+68%**).
- **Wire them.** _Our current gap:_ many marketing CTAs are unwired `<Button>`s with no
  `href`. A CTA that goes nowhere is a conversion leak. Every primary CTA must point to a
  real destination (`https://app.sparx.works/sign-up`), and where it helps, carry intent
  into onboarding (e.g. preselected modules via query param — never personal data in the
  URL).

## 10. Numbers & specificity beat adjectives

Specific, _personal_ numbers convince; round, generic ones get skimmed. "The average SMB
pays $2,950/mo" is _someone else's_ number and gets nodded past; a figure the reader
recognizes as theirs ("you're running 5 tools at ~$2,100/mo") is persuasive. When you
can't personalize, at least **show your math** — break the number down so it reads
audited, not asserted. Replace vague benefits with concrete outcomes everywhere ("save
time" → "reduce paperwork 90%").

## 11. Visual hierarchy & scannability

- **Weight the top.** Pixels just above the fold get viewed ~2× more; spend your best
  asset there.
- **One primary action per view.** Secondary actions go visually quieter (ghost/outline),
  never competing for the same emphasis.
- **Whitespace is a feature** — it lowers cognitive load and signals confidence; a wall
  of dense cards reads as work.
- **Scannable, not readable.** People F-scan: lead lines with the meaningful word,
  front-load value, let them get the gist from headers + first lines alone.
- **Mobile (≥58% of SaaS pricing traffic):** stacked cards, accordions for dense tables,
  44px+ thumb targets. (Ties to our top-2 responsive rule.)

## 12. Translating this to sparx

How the above lands inside our system:

- **Imagery = product truth or real footage, never stock.** Decorative photography is the
  AI-slop tell we ban (alongside gradients/eyebrows). The "images" that convert for us are
  the **dashboard showcase** (real UI), the **"Whoever you are" video** (real
  human/vertical footage), and live product glimpses — not a person-at-a-laptop stock
  shot. Rational/economic sections (cost, comparison) are best "illustrated" by their own
  **data-viz**, not a photo.
- **Surface-depth carries the argument's rhythm.** Map section _job_ to tier: the
  recessed **ground** (`.mkt-ground`, surface-300) suits a "before/baseline/problem"
  beat; lifted **content** (surface-100) for front-of-house copy and proof; the **stage**
  (surface-200) for visual exhibits (modules, dashboard, comparison); **accent**
  (surface-opposite) for cinematic punctuation; **brand** purple for the hero/close.
  Problem on the floor, solution elevated.
- **Color follows functionality.** Use module hues to mark module functionality and
  **semantic color** (`statusTone`, soft callouts) to break dense text into scannable
  proof — not decoration.
- **Content _and/or_ commerce.** Frame outcomes for publishers/teams/operators, not only
  sellers. Vary the vertical; don't default to one industry.

## 13. The pre-ship section checklist

Run every reworked section through this gate:

- [ ] **One job** — answers a single buyer question and hands off to the next.
- [ ] **5-second clear** — headline + visual + CTA say what/why with the sound off.
- [ ] **Outcome headline** — names the reader's gain, not our mechanic; passes the litmus
      test.
- [ ] **Shows, doesn't tell** — real product/data imagery, not a list of names or stock.
- [ ] **Specific proof** — numbers/before-after/real names, not adjectives.
- [ ] **One primary CTA**, first-person + benefit, **wired to a real destination**,
      friction restated; secondaries visually quieter.
- [ ] **Right tier** — depth matches the section's job in the argument.
- [ ] **Scannable + responsive** — whitespace, F-scan order, stacks cleanly on mobile.
- [ ] **No slop** — no gradient, no eyebrow, no decorative stock image, no second brand
      hue for flavor.

## 14. Worked example — "Six tabs. One bill." (`StackReplacement`)

Applying the playbook to the section that prompted this doc:

**Diagnosis (why it underperforms):**

- Argues with an **average** ($2,950) — _someone else's_ number ([§10](#10-numbers--specificity-beat-adjectives)).
- **No CTA / no door** — builds the problem and releases no tension; the "how do I
  subscribe?" has no answer ([§7](#7-problem-framing-sections-pas), [§9](#9-ctas--the-most-tested-element-on-the-page)).
- The "after" panel **tells** (a list of module names) instead of **showing** the swap
  ([§5](#5-show-dont-tell-benefits--features)).
- Numbers feel **asserted**, not audited ([§10](#10-numbers--specificity-beat-adjectives)).

**Prescription (no interactive calculator — per direction):**

- Reframe as clean **PAS** on the **ground** tier: Problem (one line: too many tools, one
  fragmented mess) → Agitation (the real cost: wasted spend + no unified report, shown as
  the breakdown) → Solution (one platform, one bill).
- **Show the swap:** map each "today" tool → the sparx module that absorbs it, with a
  connector, so the replacement is _seen_, not listed.
- Make the **yearly savings the hero number** ("$30,012 / year"), with the math visible so
  it reads audited.
- Add a **wired, first-person CTA pair** ("Start my site free →" to sign-up + a quiet
  "See full pricing"), with "no card · cancel anytime."
- Resolve the **named-vs-category** question ([§8](#8-comparison--why-us-sections)): lean
  category-framed here (durable, non-defensive) and keep named comparison to the dedicated
  compare table.
- **No photographic imagery** — the data-viz of the swap _is_ the image.

This worked example is the template for the other reworks: diagnose against the
principles, prescribe against the checklist.

## 15. Motion — reveal data, don't dump it

Animation's real job on a landing page isn't decoration — it's **pacing the
information**. A dense comparison shown all at once reads as a wall; the _same_ data
revealed one relationship at a time reads as a guided argument. Motion lets a section
carry **more** data without overwhelming, and turns a static list into something that
feels alive — this is exactly the trick the best commerce platforms (Shopify et al.) use
on their "everything in one place" sections.

Patterns worth reaching for:

- **Staggered reveal** — rows/cards assemble in sequence so the eye absorbs one mapping at
  a time (our `<Reveal>` with an incrementing `index` does this, reduced-motion-safe).
- **Count-up** — a savings/metric number ticks up when it scrolls into view, pulling the
  eye to the payoff.
- **Consolidation / merge** — many scattered things animate _into_ one (literally
  animating the "many tools → one platform" thesis). The strongest, also the easiest to
  overdo.
- **Scroll-scrubbed sequences** — tie a short reveal to scroll progress so the visitor
  controls the pace.

Discipline (non-negotiable):

- **Meaningful, not ambient.** Motion must reinforce the argument; motion for its own sake
  is noise. If you can't say what a movement _teaches_, cut it.
- **Honor `prefers-reduced-motion`** — render the final state instantly; never gate
  comprehension on an animation.
- **Cheap to paint** — `transform`/`opacity` only; no layout thrash.
- **Kinetic energy replaces gradients.** Motion and kinetic type are our sanctioned source
  of "energy" — we get aliveness from movement, not from the banned gradient washes.
- **Verify live.** Motion cannot be judged from a still screenshot — record or watch it run
  before calling it done.

---

## Sources

- CXL — [How to Build a High-Converting Landing Page: Anatomy, Structure & Design](https://cxl.com/blog/how-to-build-a-high-converting-landing-page/) and [Reducing Cognitive Load](https://cxl.com/blog/reducing-cognitive-load/)
- Julian Shapiro — [The Landing Page Copywriting Guide](https://julian.com/guide/growth/landing-pages) (Desire − (Labor + Confusion); hero hooks; feature header/paragraph/image; specificity; show-don't-tell)
- Nielsen Norman Group findings (via summaries) — 3–5s judgment, ~80% time above the fold, 10–20s to leave; cited in [Hyperspeed: Above-the-Fold Optimization](https://hyperspeed.me/blog/above-the-fold-optimization/) and [Serbyte: Website Conversion Optimization](https://www.serbyte.net/insights/website-conversion-optimization-guide)
- Leadfeeder — [The Ultimate SaaS Landing Page Guide](https://www.leadfeeder.com/blog/saas-landing-pages-that-convert/) (friction questions; progressive-commitment CTAs; 3.8% / 11.6% benchmarks)
- Conception Labs — [SaaS Landing Page Optimization: Anatomy of High-Converting Pages (2026)](https://conception-labs.com/blog/saas-landing-page-optimization-anatomy-of-high-converting-pages)
- Social proof — [SaaS Hero: Landing Page Social Proof](https://www.saashero.net/content/landing-page-social-proof-examples/), [Genesys Growth: Social Proof Conversion Stats 2026](https://genesysgrowth.com/blog/social-proof-conversion-stats-for-marketing-leaders), [UserEvidence: Three Types of Social Proof](https://userevidence.com/blog/how-to-increase-your-landing-page-conversions-by-adding-3-types-of-social-proof/)
- Comparison sections — [Huemor: Best SaaS Pricing Page Examples](https://huemor.rocks/blog/best-saas-pricing-page-examples/), [InfluenceFlow: SaaS Pricing Page Best Practices 2026](https://influenceflow.io/resources/saas-pricing-page-best-practices-complete-guide-for-2026/)
- CTA copy — [VentureHarbour: 15 CTA Best Practices](https://ventureharbour.com/15-call-action-best-practices-increase-conversions/), [VerticalResponse: Write CTAs from the reader's POV](https://verticalresponse.com/blog/3-reasons-why-you-should-write-ctas-from-the-readers-point-of-view/) (ContentVerve first-person +90%)
- PAS framework — [LandingRabbit: PAS for SaaS Landing Pages](https://landingrabbit.com/blog/pas-formula), [Omniscient Digital: PAS Copywriting](https://beomniscient.com/blog/pas-copywriting/)
