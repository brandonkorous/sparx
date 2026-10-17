# 295 — Setup kept a made-up web address under the name she typed

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · confirming [252] and [255] (a new business with nothing in it)
**Surface:** workbench › first-run setup › step by step › "Name your workspace"; sparx console and Piggles
**Filed:** 2026-10-17
**Fixed:** 2026-10-17
**Confirmed by:** sparx as Ines Varga (Quiet Bench Repair, a test business), 2026-10-17
**Blocked on:** —

## What happened

A new owner signed up, chose step by step, and on "Name your workspace" typed
"Quiet Bench Repair" as the company and the site. The box under it, "Your web
address", still read `merry-orchard-1523`, the placeholder every business is given
when its account is made. She pressed Continue, and the launch step read "Your
workspace is ready … merry-orchard-1523.sparx.zone". Nothing on the way suggested an
address made of her own name.

Piggles had the same fault and fixed it at sign-up (Piggles issue 010); the console's
setup step never followed.

## What should have happened

While the address is still the placeholder, it follows the company name as she types
it, and the availability check runs on that. An address she typed herself is never
changed.

## How to reproduce

1. Sign up a new account and open setup › "Prefer step-by-step?".
2. Continue to "Name your workspace" and type a company name.

## Why it matters

The free address is the first thing a customer sees of the business, and setup is
where it is decided. A word pair and four digits on a site called "Quiet Bench
Repair" reads as unfinished, and most owners take what the form already holds.

## Where it lives

The placeholder is `randomFriendlySlug` in `@wizeworks/auth` (`friendly-slug.ts`),
whose comment says owners "personalize it in the onboarding Workspace step". That step
(`surfaces/onboarding/wizard/wizard.tsx` in sparx, `wizard-inner.tsx` in Piggles) set
the company name and left the address alone.

## The fix

- `@wizeworks/auth/friendly-slug`: `isFriendlySlug(slug)`, read from the same word
  lists the placeholder is made from, so the two cannot drift. It also knows the
  collision fallback's extra `-xxxx`. Exported as a subpath for the consoles.
- Both consoles: `surfaces/onboarding/wizard/address-follow.ts`,
  `addressAfterNameChange(address, previousName, nextName)`: while the address is
  empty, still the placeholder, or still the one the previous name made, it becomes the
  name through the shared `slugify` (accents folded, 63 characters). Otherwise it is
  left alone. The workspace step's company box calls it.

Tests: `address-follow.test.ts`, 7 per console. Dropping the placeholder check reddens 3. Prettier clean. ESLint and the workbench `tsc` run out of memory on this machine:
not checked. The Piggles step file stays under its 250-line rule (249).

## Confirmed by

sparx as Ines Varga (`p01.emptycheck@sparx.test`, "Quiet Bench Repair"), 2026-10-17,
back on "Name your workspace" after the first pass. Retyping the company name turned
the address into `quiet-bench-repair`, with "quiet-bench-repair.sparx.zone is
available". Typing `qbr-tools` into the address and then adding " Co" to the name left
`qbr-tools` as it was. Set back to `quiet-bench-repair` and finished: the launch step
read "quiet-bench-repair.sparx.zone".

Not checked: Piggles on screen (tests only).

## Rating effect

—
