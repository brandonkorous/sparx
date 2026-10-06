# 019 — The domain step said the site was already live

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 1
**Surface:** workbench › first-run setup › "Make it yours"
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** —
**Blocked on:** —

## What happened

Under "Happy on the free address?":

> Your site is live at gillettdiesel.sparx.zone. Just hit Continue. You can add a
> domain anytime from Settings.

Three problems:

1. **False.** Nothing is live yet; the site goes live at Launch.
2. **No such place.** The workbench has no "Settings". Domains live in
   **Domains**, under **Your business**.
3. **Nothing for a domain he already owns.** Gillett has owned gillettdiesel.com
   for years. The step only sells new ones; it never says he can connect his own
   (the Domains screen can).

## The fix

Both consoles' `step-domain.tsx`: "Your site goes live at gillettdiesel.sparx.zone
when you launch. Just press Continue. Already own a domain, or want one later? Buy
or connect it anytime from Domains, under Your business."

Piggles' `step-domain.tsx` was 562 lines, over its 250-line rule, so touching it
meant splitting it: `domain-shared.ts`, `domain-rows.tsx`, `domain-contact.tsx`,
`domain-contact-field.tsx`. Whole pieces moved; a sorted diff of the old file
against the five new ones shows only import lines and `export` keywords changed.

## Confirmed by

Not yet: the sentence names "Domains, under Your business". To confirm when Doty
looks for Domains after launch (act 2) that this is where he finds it.

Checks: sparx and Piggles workbench `tsc --noEmit` exit 0; eslint 0; prettier
clean; `check:console-parity` green.

## Rating effect

—
