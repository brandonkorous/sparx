# 021 — The free address was public before launch

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 1
**Surface:** tenant site renderer (:3004) · first-run setup copy
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** — (on screen at the act 13 second account; see below)
**Blocked on:** —

## What happened

Mid-setup, before Doty pressed Publish, a stranger opening
`gillettdiesel.sparx.zone` (dev: `localhost:3004/?tenant=gillettdiesel`) got a
working page: "Gillett Diesel Service" in the header, "Welcome. Thanks for
stopping by.", an empty shop, a booking link and a contact form. Setup told him
twice that the address "goes live the moment you launch".

## What should have happened

Either the address shows nothing of his until he launches, or setup says plainly
that a starter page is already up.

## Why it matters

A page under his business name that he has never seen, taking contact-form
messages before he knows the inbox exists.

## Where it lives

Not a renderer defect. `wizeworks/apps/site/lib/silica.ts` serves the code
`starterSite` to any tenant that has published nothing, on purpose (docs/118,
"coverage guarantee": "a fresh tenant's site is live from day one instead of
blank"). What was false is setup's description of it, in four places per console:
the Workspace heading, the Workspace address hint, the Domain step, and (Piggles)
`wizard-steps.ts`.

## The fix

Both consoles, copy only:

- Workspace heading: "Your free web address already works, and shows your site the
  moment you launch."
- Address hint: "Free, and yours to keep. It already shows a simple starter page;
  your site replaces it the moment you launch."
- Domain step: "Your site replaces the simple starter page at {address} when you
  launch."

The Launch step's "Publishing makes it live at …" stays: it is about his site,
which is what publishing puts there.

## Confirmed by

Doty is past these steps. To confirm on screen with the second test account made
for the act 13 isolation check.

Checks: sparx and Piggles workbench `tsc --noEmit` exit 0; eslint 0; prettier clean.
