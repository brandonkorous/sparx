# 016 — Setup offered a made-up company name as his

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 1
**Surface:** workbench › first-run setup › step-by-step › "Name your workspace"
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** re-ran P01 act 1 — both name fields open empty with a "Bob's Barbers" hint; the sentence no longer claims he told us anything
**Blocked on:** —

## What happened

The Workspace step said **"We pre-filled what you told us at signup."** The
Company name and Site name boxes held **Doty's workspace**. Doty never typed that:
sign-up asks only for a name, an email and a password, and the server made the
company name up from his first name (`workspaceNameFor` in
`wizeworks/packages/auth/src/provision-tenant.ts`).

## What should have happened

The boxes start empty, so he types the names his customers know. The sentence
claims nothing he did not say.

## Why it matters

A filled box reads as done. Pressing Continue would have put "Doty's workspace" on
the business record and on the public website's name, and the sentence told him
those were his own words.

## Where it lives

`sparx/apps/workbench/surfaces/onboarding/wizard/wizard.tsx`: `initial.companyName`
and `initial.siteName` read the tenant and primary-site names straight through;
`HEAD.workspace` carried the false sentence.

## The fix

- Until the Workspace step has been saved (`completed.workspace`), both fields
  start empty; after that they show what he saved.
- The sentence: "Your company and its first site, named the way your customers
  know you. Your free web address goes live the moment you launch."
- The Site name hint was "Primary"; it is now "Bob's Barbers" like the company box.

Piggles is not affected: its sign-up asks for the business name, so its
"pre-filled what you told us" is true there.

## Confirmed by

> Re-ran P01 act 1. "Name your workspace": Company name and Site name empty with
> the hint "Bob's Barbers". Typed "Gillett Diesel Service Inc." and "Gillett
> Diesel Service", pressed Continue: the Domain step opened and searched
> "gillettdieselserviceinc".

Checks: sparx workbench `tsc --noEmit` exit 0; eslint 0; prettier clean.

## Rating effect

Recorded with the first-run setup row.
