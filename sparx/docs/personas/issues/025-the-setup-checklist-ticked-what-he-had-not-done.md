# 025 — The setup checklist ticked what he had not done, and its buttons went to the wrong screens

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 2
**Surface:** workbench › "Get set up" checklist
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** re-ran P01 act 2 — "4 of 6 done"; "Set your site address" open with "Manage domains"; "Connect Stripe" opens Payment providers
**Blocked on:** —

## What happened

"You're set up. Here's what's next. **5 of 6 done.**" Two of the five were not done:

- **Set your site address** — "Purchase a domain or connect one you already own."
  Ticked. Doty had skipped the domain step; he has no domain.
- **Confirm your site details** — "Make sure the contact email and site name look
  right." Ticked from the first second for every business.

And the one open item's button, **Connect Stripe**, opened Business details.

## Why it matters

A checklist is the owner's list of what is left. Two false ticks hide the two
things Gillett most needs before going live (its own domain, and being able to
take money is the third), and the one button that was left took him somewhere
else.

## Where it lives

- `wizeworks/services/api-rest/src/routes/v1/tenant.ts`, `GET
/v1/tenant/onboarding/progress`: `done: Boolean(tenant.name)` and `done:
state.completed.domain` (which Continue sets when the step is skipped).
- `lib/onboarding/reads.ts` `surfaceForHref` (both consoles): loose matching with
  a Business details fallback. `/onboarding?step=payments`, `/cms` and
  `/marketplace/blueprints` all fell through to Business details; `/builder`
  named `builder.pages.list`, which is not a screen.

## The fix

- Site details: done when the name is one a person chose — not sign-up's
  "<First>'s workspace" and not the story flow's title-cased web address
  (`src/lib/onboarding-name.ts`, read from the name so a rename on any screen
  counts). Description now says what is checked: "Give your business and your
  site the names your customers know."
- Site address: done when a domain other than the free subdomain exists for this
  tenant. **The first version counted every tenant's domains**: `domains` has no
  row-level security (it serves hostname lookups), so `withRequestTenant` did not
  scope it and the 5 custom domains in the database ticked Doty's box. Caught on
  screen; the count now filters `tenantId` explicitly.
- `surfaceForHref` (both consoles): explicit cases for every href the server
  sends: payments → Payment providers, blueprints → Blueprints, `/cms` → Content,
  `/builder` → `builder.pages`.
- Tests: `test/unit/onboarding-name.test.ts` (4; removing the placeholder rule
  reddens 1); `lib/onboarding/checklist-links.test.ts` in both consoles (5 each,
  and each target key must be registered in the catalog; the old payments mapping
  reddens 1).

## Confirmed by

> Re-ran P01 act 2: "4 of 6 done", "Set your site address" open with "Manage
> domains", "Connect payments" open. Pressed "Connect Stripe": **Payment
> providers** opened ("sparx Pay … Flat 0.5% per transaction", "Your own Stripe
> … No sparx fee").

Checks: api-rest tsc 0; sparx and Piggles workbench tsc 0; eslint 0; prettier clean.

## Rating effect

—
