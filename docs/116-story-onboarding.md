# sparx Platform — Story Onboarding (Narrative Flow)

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-07-06

---

## 1. What this is

**Story** is a second onboarding front end: instead of clicking through six steps, the
owner **narrates their business in a sentence or two** and the platform assembles the
same setup live — modules, a starting-point blueprint, workspace identity, a web
address, and (when they sell) payments. It is the **primary** onboarding entry as of
2026-06-30; the classic six-step wizard ([docs/15](15-merchant-onboarding-prd.md)) is
untouched, fully supported, and linked both ways.

This is a **design + architecture doc**, not a second PRD. The north star, the
"modules, not plans" principle, the 5-minute goal, and the payments/domain/launch
mechanics are all owned by [docs/15](15-merchant-onboarding-prd.md); Story reuses them
verbatim. This doc covers only what is _new_: the narrative model, the entry policy,
and the plumbing that lets one back end serve two front ends.

> **The key architectural fact:** Story is a **new front end over the same commit
> pipeline** as the classic wizard. It reuses `tenant.settings.onboarding` state and
> the server actions in
> [apps/dashboard/app/(onboarding)/onboarding/\_lib/actions.ts](<../apps/dashboard/app/(onboarding)/onboarding/_lib/actions.ts>)
> (save-modules → install-blueprint → save-workspace → stripe-connect → publish). No
> new backend, no divergence in what gets provisioned.

---

## 2. Why a narrative

The wizard asks a non-technical owner to reason in the platform's vocabulary —
"modules," "templates," "workspace." A narrative asks them to reason in **their own**:
_"I run a salon for people, where they can book appointments and buy products."_ Each
phrase they say is a decision we can act on, but they never feel like they're
configuring software. The same clauses that read as a story to them resolve to a module
set, a blueprint, and a billing total for us.

The bet: this is **less intimidating** (a blank sentence beats a pricing switchboard),
**more honest** (they describe intent; we translate), and **legible** (the right rail
fills in as they talk, so cause and effect are visible in real time).

---

## 3. The grammar

The sentence **assembles itself** through a progressive composer. It is deterministic —
no AI parse, no model dependency.

### 3.1 Opening

```
I [want to start | run] a [industry] for [people | businesses | both].
```

- **Tense** — "want to start" (greenfield) vs "run" (existing business). A signal we
  record; it does not change the setup today.
- **Industry** — the load-bearing spine (§4). One of the eight real industry starters,
  or a generic. Choosing it turns on **Builder** (the always-on base site, $10) and
  scopes every downstream recommendation.
- **Audience** — people (consumers → CRM lens), businesses (→ B2B lens), or both.

### 3.2 Clauses

Everything after the opening is a **clause** — an atom that carries one or more modules
plus config. Clauses file themselves by **voice** into self-organizing sentences:

- **Customer-facing** clauses gather into the opening's tail:
  _"…where they can book appointments, buy products, and read our blog."_
- **Owner-side** clauses become ordered sentences:
  _"I'll sell wholesale to shops."_ then _"I also send a weekly newsletter."_
- The **closing sentence is always the web address**:
  _"Find me at bloom-salon.sparx.zone."_ (an inline, auto-fitting handle input).

Clauses are **click-to-change**: every token in the sentence is a dropdown (swap in
place, suggested-first) with an × to remove. Adding is inline — a per-sentence `+`
extends that sentence, and an end-of-story `+` starts a new one — so a story can be any
length from one clause to all of them. There is no hard sentence cap.

The full clause catalog lives in
[apps/dashboard/app/(onboarding)/story/\_lib/clauses.ts](<../apps/dashboard/app/(onboarding)/story/_lib/clauses.ts>);
the state model and pure reducers in
[story-state.ts](<../apps/dashboard/app/(onboarding)/story/_lib/story-state.ts>).

---

## 4. The industry-starter spine

The industry slot is one of the **8 real industry starters + a generic** (apparel, food,
electronics, auto-parts, salon, fitness, professional, wholesale). Picking it:

1. **Recommends** a clause set (the starter's clauses sort first, tagged "· suggested" —
   never auto-added; the owner still narrates).
2. **Matches** a blueprint vertical (§6).
3. **Preloads** the starter's seed data on commit and records `settings.category`.

Starters are defined in
[services/api-rest/src/lib/industry-starters.ts](../services/api-rest/src/lib/industry-starters.ts)
(contract `packages/modules/src/starters.ts`). An `IndustryStarter` **never writes
`settings.modules`** — it only provisions presets into modules the story already turned
on.

---

## 5. Module resolution

The module set is derived **purely from the clauses** the owner narrates —
`resolveModules(story)` in
[story-state.ts](<../apps/dashboard/app/(onboarding)/story/_lib/story-state.ts>):

- Each clause names its module(s); **Builder** is on whenever an industry is chosen.
- **Narrative dependencies** close over the set (`NARRATIVE_REQ`): selling anything
  pulls **Commerce** silently (dropship → commerce, b2b → commerce). The sentence shows
  only what the owner spoke; the rail shows the pulled-in module with a "· comes with X"
  caption.
- **Bundled-free** modules (invoicing, inventory with commerce | b2b) render "Included."
- **Fulfillment** (ship / local pickup / local delivery / market pickup) is a Commerce
  _sub-config_, not a module (ship is the sacred default once Commerce is on).

The right rail reuses the real pricing helpers from
[apps/dashboard/lib/modules.ts](../apps/dashboard/lib/modules.ts) — prices, dependency
graph, and colors are the single source of truth shared with the pricing switchboard, so
Story and the marketing pricing page never diverge (the same discipline docs/15 §4.1
requires of the wizard).

---

## 6. Starting-point blueprint

`pickBlueprint` selects the **richest catalog blueprint whose required modules are all
already enabled** (so installing it can never silently bill a module the owner didn't
choose), preferring the industry's vertical. If nothing is compatible, the commit starts
from a **blank Builder site** instead. The chosen blueprint installs as a **draft**; the
Launch step publishes it.

---

## 7. Architecture: one back end, two front ends

### 7.1 Commit reuses the pipeline

On "Build my …", `commitStoryAction`
([story/\_lib/actions.ts](<../apps/dashboard/app/(onboarding)/story/_lib/actions.ts>))
orchestrates the **existing wizard actions** in order: `saveModulesAction` (the API
enforces the billing graph, e.g. b2b → commerce) → `selectTemplateAction` |
`startFromScratchAction` → `saveWorkspaceAction`, then PATCHes the onboarding state with
the industry, the full narrative, and the next tail step. Identity: the handle →
`companyName = titleCase(slug)`, `slug`, `siteName`.

### 7.2 Standalone tail (payments + launch)

The flow is **fully standalone** — it never bounces to the wizard. After commit, the
same page continues in place through
[story/\_components/story-tail.tsx](<../apps/dashboard/app/(onboarding)/story/_components/story-tail.tsx>),
a `payments | launch` stage machine that **reuses** the wizard's `<StepPayments>` /
`<StepLaunch>` and actions inside the shared `<SurfaceFrame variant="page">`. The plan
rail and savings are rebuilt from the committed story so they stay consistent.

### 7.3 Stripe Connect resume

The payments step is a **Standard-OAuth redirect** to Stripe. Two constraints shape the
resume: Stripe's `state` JWT carries **only** the tenant id, and Standard-OAuth
`redirect_uri`s are **allow-listed in the Stripe dashboard** (we can't invent a
`/story/stripe-callback`). So `startStripeConnectStoryAction` sets a short-lived,
httpOnly, `SameSite=Lax` **flow-origin cookie** (`sparx_onb_flow=story`, name in
[story/\_lib/flow.ts](<../apps/dashboard/app/(onboarding)/story/_lib/flow.ts>)) and
reuses the registered `/onboarding/stripe-callback`, which reads the cookie and redirects
back to `/story?stripe_connected=1` (clearing it). A failed round-trip comes back as
`?stripe_error=<code>`, humanized into the summary on resume.

### 7.4 Persistence + resume (compose _and_ tail)

The whole narrative persists under `settings.onboarding.story` (the `StoryNarrative` zod
in [services/api-rest/src/routes/v1/tenant.ts](../services/api-rest/src/routes/v1/tenant.ts))
— both a signal we can surface later and the resume substrate. Two resume paths:

- **Post-commit tail** — after the Stripe reload, `story/page.tsx` sees
  `story != null && currentStep ∈ {payments, launch}` and rebuilds the tail via
  `storyFromPersisted`.
- **Pre-commit draft** — the composer debounce-saves the in-progress narrative
  (`saveStoryDraftAction`, which PATCHes **only** `story` — no `currentStep`/`completed`,
  so no modules activate and the page resumes the _composer_). A refresh or a trip away
  no longer loses the story. This mirrors how the wizard already persists each step; it
  is funnel-progress persistence, **not** an editor autosave (the platform's
  explicit-save-only rule governs CMS editors, not the onboarding funnel).

---

## 8. Entry policy — Story is primary

A single shared router,
[apps/dashboard/lib/onboarding-entry.ts](../apps/dashboard/lib/onboarding-entry.ts)
`onboardingEntryHref(state)`, decides where an unfinished tenant (re)enters. Precedence:

1. A story narrative exists (committed **or** an in-progress draft) → **/story**
2. The classic wizard was advanced (step moved off the first, or any step flagged
   complete) **without** a story → **/onboarding**
3. Otherwise — a fresh tenant → **/story** (the primary)

This never yanks a tenant out of the flow they actually started. It is wired into all
three entry points:

- **Post-signup** — `/story`, except a `?blueprint=` arrival (the marketplace/template
  funnel, docs/60 Ph5) still enters the classic wizard, whose template step honors the
  pre-pick.
- **Dashboard guard** — the mandatory-onboarding redirect in the dashboard layout routes
  through the helper.
- **Welcome banner** — the "Resume setup" CTA routes through the helper.

The classic wizard stays linked both ways: the Story rail offers "Use the classic
step-by-step setup," and the wizard's module step offers "Prefer to describe it in a
sentence?"

---

## 9. Design-system compliance

Story obeys the same rules as every surface:

- It renders inside the shared `<SurfaceFrame variant="page">` (the Builder-Indigo left
  rail + journey + `RailFooter`) and the shared `<SummaryCard>` — the same chrome as the
  wizard, so the two flows feel like one product.
- Clause chips are bespoke module-tinted tokens via `color-mix` on the module color vars
  (mirroring the `@sparx/ui` recipe) — they are _not_ re-skinned controls; the CTA is a
  real `<Button>` and "Included" is a real `<Badge>`.
- 16px body floor, no gradients, no eyebrow kickers, responsive (rail collapses under
  ~940px, the two-pane grid stacks to one column).

---

## 10. Open questions / future

- **Design promotion mechanics** — Story is the default today via the entry router. A
  future explicit per-tenant toggle (or A/B) would let us measure Story vs classic
  completion before making the default irreversible.
- **Tense as more than a signal** — "want to start" vs "run" could branch copy or
  provisioning (e.g. import from an existing store) rather than only being recorded.
- **AI-assisted narration** — the composer is deterministic by design; an _optional_ AI
  clause-suggester (gated on the `ai` module) could propose clauses from a free-text
  description without becoming a hard dependency.
- **Richer resume UX** — the draft resumes silently; a "welcome back, here's your story
  so far" affordance could make the return feel intentional.
