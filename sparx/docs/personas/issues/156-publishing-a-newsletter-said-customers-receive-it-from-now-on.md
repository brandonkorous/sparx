# 156 — Publishing a newsletter said customers "receive it from now on"

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 10 (one email to the fleets)
**Surface:** workbench › Email designs › Publish
**Filed:** 2026-10-08
**Fixed:** 2026-10-08
**Confirmed by:** P01 on screen, 2026-10-08

## What happened

Doty pressed Publish on "Fleet winter readiness, November 2026". The confirm read: "Publishing makes this exact design the one your customers receive from now on."

For a newsletter that reads as "pressing this emails my customers". It does not: a newsletter goes out only when he sends it to an audience from "Write an email". The sentence is true only of the emails sparx sends by itself, like the Welcome email.

## What should have happened

The confirm says what Publish does to the email in hand. For an email sparx sends by itself: it changes what customers receive from now on. For an email the owner sends: publishing sends nothing; it makes the design ready to choose.

## Why it matters

An owner who reads "your customers receive" over a half-finished newsletter stops, or worse, presses "Keep editing" and never publishes, so the email never shows up in "Write an email".

## Where it lives

`sparx/apps/workbench/surfaces/builder/email/email-editor.tsx`, `onPublish`: one fixed sentence for every email.

## The fix

`publishDescription` in `surfaces/builder/email/email-publish-words.ts` (new) picks the sentence by the email's `key`. With a key (sparx sends it by itself): "This is an email sparx sends by itself. Publishing makes this exact design the one your customers receive from now on." Without: "Publishing sends nothing. It makes this exact design ready to choose when you “Write an email” to your customers." Both keep the line about the draft being captured as the live version.

Test, proved red: `surfaces/builder/email/email-publish-words.test.ts`. With the old single sentence, both of its 2 tests fail.

## Confirmed by

P01 on screen, 2026-10-08. Publish on "Fleet winter readiness, November 2026" reads "Publishing sends nothing. It makes this exact design ready to choose when you “Write an email” to your customers…".

## Rating effect

—
