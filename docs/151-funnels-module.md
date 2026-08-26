# 151 — Funnels: a named path to an outcome, and whether people finish it

Version: 1.1.0
Author: Brandon Korous
Last Updated: 2026-08-26

## Purpose

The Funnels module is the layer that binds an entry surface, an audience, a
follow-up and a definition of success into ONE named thing, and then counts how
many people made it through each step.

It is deliberately **not** a funnel builder. A funnel page is already a
`BuilderPage` with `frameId = 'none'`; a follow-up is already an `Automation` or
an `EmailSequence`; an audience is already a `Segment`. All four exist, all four
work, and none of them knows about the others. This module is the binding and the
measurement, not a fifth engine.

Related: [81-automation-module.md](81-automation-module.md) (the rule engine this
composes), [128-session-attribution.md](128-session-attribution.md) (the identity
model this is constrained by), [115-site-forms.md](115-site-forms.md) (the capture
backbone), [80-marketing-attribution-analytics.md](80-marketing-attribution-analytics.md)
(the two-level attribution model), [98-builder-customization-rebuild.md](98-builder-customization-rebuild.md)
(the node catalog the capture surfaces extend). Build log:
[152-funnels-build-log.md](152-funnels-build-log.md).

---

## 1. Why this exists

A tenant can already build every part of a marketing funnel on sparx today. They
cannot answer whether it worked.

The parts are genuinely good. `EmailSequence` holds an ordered journey as one
editable document with a re-entry policy and an `exitOnPurchase` goal.
`Automation` has event and schedule triggers, a sub-daily `interval` cadence
written precisely for "nudge two hours after a cart goes cold", versioned publish,
and a `goal` column whose own comment already makes this doc's argument: a run
with a goal answers whether it worked, not merely what happened. `Order` carries
first-touch attribution resolved at checkout. `FormSubmission` stores every lead
regardless of which modules are on.

What is missing sits between them. There is no row anywhere that says "these four
things are one campaign, this is what success means, and here is how many people
reached each step". The consequence is that the platform can tell a tenant that
4,000 people visited and that they took $12,000, and cannot tell them which of
the things they did produced either number.

`conversionFunnel()` in `wizeworks/packages/commerce/src/services/reporting-service.ts`
is the compact illustration: it reports `sessions = 0`, hardcoded, with a comment
saying analytics tooling has not landed. It has. Nothing wired it up, because
nothing owned the question.

## 2. Scope

**In scope.** The `Funnel` entity and its stage ladder; stage measurement under
the privacy model of §4; the workbench surfaces; the shipped recipe library; the
capture surfaces that feed a funnel (multi-step forms, quizzes, calculators,
triggered popups and bars); gated delivery of a lead magnet; SMS as an automation
action; and the offer steps (order bump, post-purchase upsell) that terminate a
commerce funnel.

**Out of scope, deliberately.** Split testing (§10). A second condition language.
Retargeting pixels or audience sync. Anything requiring a persistent anonymous
visitor identity (§4).

## 3. The module

`funnels` is a **free, separately-flagged, cross-cutting module**, off for every
new tenant. It carries no `MODULE_MONTHLY_CENTS` entry, no `REQUIRES`, and no
`BUNDLED_FREE` relationship.

The precedent is `social`, and the reasoning is the same one already written into
`finance`'s `BUNDLED_FREE` comment. A funnel has no value on its own: it pays off
through commerce, crm, email or scheduling, every one of which is already billed.
Charging separately for the thing that makes the paid modules work is charging
twice for one outcome, and it suppresses adoption of the modules that do earn.

The counter-argument was weighed and rejected on 2026-08-25: competitors sell
funnels as a headline product, so pricing it at zero prices our own best
demonstration at zero. The trade was taken knowingly. Funnels is what makes a
commerce or CRM subscription obviously worth keeping, and that renewal is worth
more than a second line item.

**Module identity: wine `#881337`.** Measured hue 342°, lightness 30%, saturation
75%; white ink resolves at 9.56:1, comfortably clear of AA. Chosen against a
palette already carrying eighteen module identities, where the red-rose, orange,
teal, blue and violet families are each full. It sits 5° from scheduling's
rose-600 `#e11d48` and carries its distance in **lightness** (30% against 50%),
which is exactly the move `staff`'s rust brown makes against commerce orange. Its
`-content` ink is `#ffffff`.

**And the funnel surface mostly borrows.** Wine is the chrome, the launcher entry
and the module's own identity. Inside a funnel, the stage ladder wears the hue of
the module whose outcome the funnel drives, through a nested `<ModuleProvider>`:
a commerce funnel's convert stage is orange, a booking funnel's is scheduling
rose, a lead funnel's is CRM cyan. This is the color-follows-functionality rule
doing real work rather than decorating, and it is the honest answer to needing a
nineteenth hue in a palette that has run out.

## 4. Identity: aggregate above the line, per person below it

This is the constraint everything else is shaped by, and it is not negotiable.

Sparx sites need no consent banner because a visitor is a salted hash of
(UTC date + tenant + IP + user-agent), computed server-side, never reversible,
and **rotated at UTC midnight**. Doc 128 §2 states that the hash is a lookup key
and **never a stored column** — storing it would freeze an identity designed to
expire, which is the property that keeps the product banner-free in every
jurisdiction we operate in.

So the funnel splits at the capture line:

- **Above it**, a stage is a COUNT and no row anywhere carries an identity.
  Nobody is followed.

  This clause used to read "the beacon increments `rollup_funnel_daily` at
  ingestion", and **that is wrong** (corrected in build, docs/152 B3). The rollup
  is maintained by a delete-then-insert reconcile, so the first nightly run over
  the window would erase every incremented count with nothing to say it had. It
  also contradicts the table's own claim to be recomputable from source: an
  incremented counter IS the source, and losing it loses the data.

  Both halves are DERIVED instead, each from where its facts already live. Above
  the line that is `site_analytics_events`, counted as distinct visitors on the
  rung's page — the table the rotating hash was designed to expire inside, and
  the same count `rollup_site_daily.visitors` already carries. So a `view` rung
  names a page, and nothing new is stored to make it work.

- **Below it**, a stage is a ROW keyed on a customer id or an email address —
  someone who has voluntarily identified themselves.
- **The join happens once, at capture**, by the same mechanism
  `resolveOrderAttribution` already uses: recompute the visitor hash in-request
  from IP + user-agent with the same `deriveVisitor` the beacon uses, look up
  that visitor's earliest pageview today, copy the DERIVED source / landing path
  / campaign onto the capture row, and discard the hash.

The report this produces reads: _"1,840 people saw the page, 210 gave us an
address, and here is what happened to each of those 210."_ That is the shape the
privacy model allows, and it happens to be the shape that answers the question.

**A schema comment must say why the visitor-hash column is absent.** An absent
column reads identically to an oversight, and adding one is the obvious way to
make anonymous multi-session progress work. It would also silently convert sparx
into a product needing consent infrastructure everywhere.

**Salt parity.** The resolver and the beacon share `SITE_ANALYTICS_SALT` because
both run inside `api-rest`. Moving either into a worker without carrying the
identical salt makes every match silently miss, with no error anywhere.

## 5. The data model

One schema file, `wizeworks/packages/db/prisma/schema/92-funnels.prisma`, three
models. All tenant-scoped with `ENABLE` + `FORCE RLS` + a `current_tenant_id()`
policy hand-authored in the migration SQL. All three are new and empty, so there
is no FORCE-RLS backfill loop.

### 5.1 `Funnel`

`property_id` is **NOT NULL**, unlike `Automation`'s. A funnel is a marketing
campaign for one business; a tenant-wide funnel spanning a machine shop and a
donut shop is not a thing anyone means. CASCADE with the site: deleting a site
narrows reach, never widens it.

| Column                            | Notes                                                                                                                                                                                                 |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kind`                            | `lead` / `recovery` / `purchase` / `booking` / `winback` / `custom`. Drives the default stage ladder and the recipe gallery grouping.                                                                 |
| `stages`                          | The ordered ladder as ONE JSON document, the same choice `automations.actions` and `email_sequences.steps` already make. Each: `{ key, name, kind: view\|capture\|qualify\|engage\|convert, match }`. |
| `goal`                            | The same `ConditionGroup` shape as `Automation.goal`, evaluated by the same evaluator. **Required on an active funnel** — a funnel without a goal is the exact thing this module exists to end.       |
| `goalValueCents`                  | Worth of one conversion when it is not an order total (a booked job, a qualified lead). **Nullable, and rendered as "not set", never as $0.**                                                         |
| `automationId` / `sequenceId`     | What runs it. Both SetNull: evidence outlives the rule.                                                                                                                                               |
| `entryPageId` / `entryFormNodeId` | Where it starts.                                                                                                                                                                                      |
| `origin` / `recipeKey`            | `user` \| `system`, mirroring `Automation.origin` / `clonedFrom`, for the shipped library.                                                                                                            |

### 5.2 `FunnelStageEvent`

One append-only row per (funnel, stage, KNOWN subject, occurrence). Exactly one
of `customerId` / `subjectEmail` identifies the subject, and both are people who
told us who they are. **No anonymous row is ever written to this table, and there
is deliberately no visitor-hash column** (§4).

Carries `entrySource` / `entryLandingPath` / `entryCampaign`, copied in at
capture. Same vocabulary as `SiteAnalyticsEvent.source`, so reports need no
mapping table — the same reason `Order.attribution*` uses it. `valueCents` is set
on the converting stage only; `refs` carries `{ cartId, orderId, bookingId,
submissionId }`.

`tenant_id` is a plain scalar with the FK hand-added in the migration, matching
the other high-volume tables, so `Tenant` does not grow a back-relation for a
leaf table.

### 5.3 `RollupFunnelDaily`

The above-the-line half: `(tenantId, propertyId, funnelId, stageKey, bucket)` →
`entered` / `converted` / `valueCents`. No identity anywhere. Maintained by the
same nightly reconcile that owns `rollup_site_daily`, with the open day
live-overlaid on read.

## 6. The engine seam

`@wizeworks/funnels` owns the service layer, stage recording, goal evaluation,
the daily reconcile, and the read model that assembles a ladder with counts,
rates and attributed value.

It re-implements nothing. Goals evaluate through
`@wizeworks/automation-schemas`' existing evaluator, so there is exactly one
condition language in the platform. Follow-up runs through `Automation` and
`EmailSequence` as they already are.

Dependencies are backend-safe only (`@wizeworks/db` + the schemas), the same
discipline `@wizeworks/email-sequences` keeps, so the reconcile runs in the
event-worker without dragging React in. A client-safe `./schemas` subpath carries
the stage and goal shapes for the workbench editor.

### 6.1 Events

`funnel.entered`, `funnel.converted`, `funnel.abandoned` — which is what lets an
automation react to a funnel rather than only drive one. Topic name == event
type, so each needs a topic in `terraform/envs/prod/main.tf`. `check:events`
unions both code-side catalogs and fails the push on a declared-but-unprovisioned
name; the failure it prevents is invisible in production, because publishing to a
missing topic throws a not-found that every publisher catches and logs.

## 7. Capture surfaces

The layer that most needed work. Each extends the builder rather than adding a
parallel system, and each feeds a funnel stage.

- **Triggers.** `builder-render` already has a dialog and a lightbox; the catalog
  already has an announcement bar and a popover. What was missing is a reason for
  any of them to appear: on load, after N seconds, at N% scroll, on exit intent,
  on cart value above a threshold, on a returning visit.
- **Frequency caps are client-local**, in `localStorage`, and this is not a
  shortcut. A server-side cap needs the durable anonymous identity §4 refuses.
  Local also degrades honestly: a cleared browser sees the offer again, which is
  a far smaller harm than a consent banner on every tenant site.
- **Multi-step forms**, with a partial-submission record, so an abandoned form is
  still a lead rather than nothing.
- **Quiz and calculator.** The largest capture-rate lever available. The outcome
  writes a real score through the existing CRM scoring model, never a bespoke
  number — a quiz that concludes someone is a certain kind of buyer and leaves no
  trace the sales side can see is a toy, and `explain_crm_score` already exists
  to make the reasoning inspectable.
- **Gated delivery.** A signed, expiring link to a private-bucket asset, emailed
  after opt-in. The whole mechanism exists pointed the other way: form uploads
  already mint server-signed tokens and download through an authenticated,
  RLS-scoped route.

## 8. SMS

`sms.send` is registered through the same `registerAction` seam the crm and email
actions use, calling `@wizeworks/sms` rather than re-implementing it, so events
and audit fire once at the source.

**It ships fully built and switched off.** The provider credential is absent by
default, so the action cannot spend until it is deliberately enabled. What is not
optional, and is part of the slice rather than a follow-up:

- Text consent recorded separately from email marketing consent.
- A working `STOP` handler feeding the suppression path.
- Quiet hours honoring the recipient's timezone.
- Per-tenant rate limiting that trips **before** the bill, not after.

A runaway automation must hit a ceiling, not an invoice.

## 9. The shipped library

A funnels module that opens to an empty list is not finished. It ships with
working, installable funnels, one per module with an outcome worth chasing: cart
recovery, welcome, win-back, post-purchase review and reorder, quote follow-up,
booking no-show recovery, and lead nurture.

Each is a `Funnel` with `origin: 'system'` plus the sequence and automation it
binds, installed on module activation through the existing preset seam, and
clonable to edit the way locked automations already are.

Recipes are authored as a **full superset**, and the installer writes only the
slices the tenant's active modules enable. A recipe is never filtered or blocked
on modules; it writes what applies and skips the rest.

## 10. Split testing is deferred, on purpose

Every funnel product ships A/B testing, and building it early here would be
wrong. A typical tenant site does not have the traffic to reach significance on a
headline test inside a quarter, so the feature mostly produces confident-looking
noise — and confident noise is worse than no number.

The prerequisite is not a date. Once the stage counts of §5.3 are real, they say
which tenants have the volume to make a test honest. Build it for them, and show
everyone else the sample size they would need rather than a result they cannot
trust.

## 11. Empty states

Every funnel surface needs **two** empty states, and collapsing them is a bug
that tells a business owner their campaign failed when it has not started:

- **Never ran.** No one has entered this funnel yet.
- **Ran, converted nobody.** People entered and none reached the goal.

The same rule governs `goalValueCents`: a value nobody set is rendered as "not
set", never as `$0.00`.

## 12. Both brands

The engine, the schema, the builder nodes, the automation action and the capture
endpoints are platform code and live under `wizeworks/`. Piggles may not import
anything under `sparx/`, and `check:deletability` walks the real dependency
closure to prove it.

The workbench surfaces are per-brand and are built **twice** — once in
`sparx/apps/workbench/surfaces/funnels/`, once in
`piggles/apps/workbench/surfaces/funnels/` — the same as every other surface in
both apps. Shipping the module in sparx alone leaves piggles with a flag that
opens onto nothing.
