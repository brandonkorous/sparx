# 362 — The set-up screen spoke another product's language

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · once [361] let the screen open at all
**Surface:** mypiggles › Home › Get set up › What you use
**Filed:** 2026-09-01
**Fixed:** 2026-09-01
**Confirmed by:** the screen, read top to bottom, in her language

## What happened

With the crash fixed, the first screen a new Piggles business meets could finally be
read. It said:

> **Switch on what you use**
> Every **module** is one toggle — flip it and your **plan updates the instant you
> do**. You are free for 14 days with no card; **this is just what you would pay
> after**.

Under it, the rows: **Builder · Commerce · CMS · CRM · Email · B2B · Fleet ·
AI · MCP · Scheduling · Dropship**. Above them, a step rail beginning **Modules**.
Expand any row and the pitch underneath:

> The foundation every **sparx** site starts on … edge-cached pages, instant
> **TTFB** worldwide. Power users go fully **headless** against the same **API**.
> _Replaces **Webflow** + hosting + a **CDN**._

Every entry had one of those last lines. Across thirteen rows the screen named
**Webflow, Shopify Advanced, Storyblok, HubSpot Sales Pro, Klaviyo, Shopify Plus,
Zapier Team, Calendly, Acuity, Spocket, FreshBooks, inFlow, Katana and Intercom** —
fourteen other companies, on the first screen, to a woman who sews clothes.

And it was wrong about the product, not only about the words. **Piggles has one flat
plan.** `platform.settings.modules` is hidden from this console for exactly that
reason, with the note "Piggles has no module pricing (RULE #2)". The screen beside it
promised a plan that changes as you flip switches.

## What should have happened

The rows are called what the rail already calls them: **My Site, Sell, Content,
Customers, Messages, Bookings**. The sentences are the ones somebody who runs a
business would use. Nothing names another company. Nothing implies a per-app bill on
a product built not to have one.

`BANNED_IN_PRODUCT_COPY` in `@piggles/config` already lists CMS, CRM, headless,
module and API. The root CLAUDE.md already bans competitor names in shipped
artifacts. Both rules existed; nothing enforced them here.

## How to reproduce

Every time, for every new business.

1. Open **Get set up** (`/get-set-up/steps`).
2. Read the step rail, the heading, the ten rows, and their expanded detail.

## Why it matters

It is the introduction. A person who has just signed up is deciding whether this
product is for them, and it opened by talking past them in somebody else's
vocabulary, then quoted a price model the product does not have.

The competitor list is its own problem. Naming fourteen rivals to a brand-new
customer tells them exactly what to go and compare, which is why shipped artifacts
do not do it.

## Where it lives

- [modules.ts](../../../apps/workbench/lib/onboarding/modules.ts) — the catalog
- [wizard-steps.ts](../../../apps/workbench/surfaces/onboarding/wizard/wizard-steps.ts) — the rail and the headings
- [step-modules.tsx](../../../apps/workbench/surfaces/onboarding/wizard/step-modules.tsx) — the "Specialised" divider
- [story-summary.tsx](../../../apps/workbench/surfaces/onboarding/story/story-summary.tsx) — "a blank Builder site"
- [check-nav-vocabulary.mjs](../../../scripts/check-nav-vocabulary.mjs) — why none of it was caught

## The fix

**The copy.** Every row renamed to the name the rail already uses, taken from
`@piggles/config`'s `APPS` — except where one app fronts several capabilities: "Sell"
covers commerce, trade and dropshipping, and the board has a row for each, so the two
that are not the app itself are named for what they do (**Trade customers**,
**Dropshipping**). Every sentence rewritten for somebody who runs a business. Every
`replaces` line now says what an owner stops paying for without naming who they stop
paying: "a website builder and a separate hosting bill", "a wholesale add-on, or a
second shop for trade".

The step rail: Modules → **What you use**, Workspace → **Your name**, Domain →
**Web address**, Payments → **Getting paid**, Launch → **Go live**. The heading's
supporting line loses the trial-and-plan sentence entirely and says what is true
here: "Turn on what you want, leave the rest, and change your mind whenever you like.
It never changes what you pay."

Also removed: `DEFAULT_ON = ['builder', 'commerce', 'cms']`. A new business starts
with **nothing** switched on and turns on exactly what it wants; that is the premise.
The constant was exported, read by nothing, and contradicted `story-state.ts`, which
correctly starts everything off. A comment stands in its place saying why there is no
such constant, because the next person to want one should read that first.

**And the reason nobody caught it.** `check:piggles-nav` exists to comb this console
for sparx's vocabulary, and it reported green through all of the above. It reads two
seams: surface titles (overridable in `vocabulary.ts`) and `productCopy('key',
'fallback')` calls (overridable in `copy.ts`). The switchboard is neither — it is an
ordinary object literal in a data file, rendered straight to the screen — so the
entire first screen sat outside the check. Precisely the failure shape a structural
check has when it hard-codes where to look: it scans one place and prints green over
everywhere else.

A **third seam** now covers plain catalogs, scanned by named field rather than "every
string in the file" (a checker that flags `key: 'cms'` is a checker somebody switches
off). It also carries a `COMPETITORS` list, checked only in the catalogs, where the
strings are known to be prose — a surface title will never say "Shopify". The
denominator is printed, so the count is visible rather than assumed: **485 → 596
rendered strings, 111 of them from catalogs.**

Proved red three ways, on a copy of the file rather than on the live one:

| Change                            | Result                                                      |
| --------------------------------- | ----------------------------------------------------------- |
| `name: 'Content'` → `'CMS'`       | `[CMS] catalog "CMS" SWITCHBOARD_MODULES.name`              |
| a `replaces` line naming Intercom | `[Intercom] catalog "a live chat service like Intercom"`    |
| `SWITCHBOARD_MODULES` renamed     | throws: "It has moved or been renamed … would scan nothing" |

## Confirmed by

> Opened **Get set up** as Devi. The rail reads **What you use / Starting point /
> Your name / Web address / Getting paid / Go live**. The rows read **My Site, Sell,
> Content, Customers, Messages, Trade customers, Connections, Bookings,
> Dropshipping**. Expanding **My Site** gives "The website itself. Start from a
> design that already looks finished, change the words and pictures by clicking on
> them, and point your own web address at it when you are ready", and closes with
> "Replaces a website builder and a separate hosting bill." No other company is named
> anywhere on the screen, and the plan sentence is gone.

## Rating effect

`workbench.onboarding` — previously unrated. Recorded in [rating.md](../rating.md).
