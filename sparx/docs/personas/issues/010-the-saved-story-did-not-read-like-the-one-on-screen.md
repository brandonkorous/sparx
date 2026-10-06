# 010 — The saved story did not read like the one on screen

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 1
**Surface:** workbench › first-run setup › the story (saved text) and step-by-step switches
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** re-ran P01 act 1 — saved text reads "I supply other businesses …" and one "I also" sentence
**Blocked on:** —

## What happened

The story is saved as the written record of what the owner told us. Doty's read:

> I run diesel parts and repair … **I’ll** supply other businesses … I also
> remember every customer. I also post to my social pages. I also run promotions
> and see what works. I also keep my team’s schedules and hours.

Two faults:

1. **Wrong tense.** The screen said "I supply other businesses" (he already runs
   the business). The saved text said "I’ll supply". The story screen had been
   fixed to follow the tense; the saved text and the marketing hero had not.
2. **Four "I also" sentences in a row.** Each switch flipped in step-by-step
   started its own sentence.

## What should have happened

The saved text matches the screen word for word, and a switched-on module joins
the last sentence.

## Why it matters

It reads like a machine wrote it, on the one record that is meant to be his own
words, and it says he has not started a business he has run for decades.

## Where it lives

- Sentence leads written three times: `story-canvas.tsx` (tense-aware),
  `toProse` in `lib/onboarding/story-state.ts` (both consoles, always "I’ll"),
  and the marketing hero `sparx/apps/web/components/marketing/landing/story-tokens.ts`.
- `toggleModuleInStory` in `story-state.ts` called `addNewLine`.

## The fix

- `@wizeworks/story-schemas` `lineLead(tense, index)`: the one source for "I" /
  "I also" / "I’ll" / "I’ll also". Used by both canvases, both `toProse`, and the
  marketing hero.
- `toggleModuleInStory` (both consoles): an owner phrase joins the last
  sentence; a customer phrase still joins the opening; a story with no owner
  sentence starts one.
- `line-lead.test.ts`: 2 tests. Forcing the old always-future lead turns 1 red.

## Confirmed by

> Re-ran P01 act 1. Saved prose: "… I supply other businesses, send an invoice
> and get paid, … and let an AI assistant help me run it. I also remember every
> customer, post to my social pages, run promotions and see what works, and keep
> my team’s schedules and hours. Find me at gillettdiesel.sparx.zone."

Checks: story-schemas 11/11 tests, tsc 0; sparx and Piggles workbench tsc 0;
eslint 0; prettier clean.

## Rating effect

—
