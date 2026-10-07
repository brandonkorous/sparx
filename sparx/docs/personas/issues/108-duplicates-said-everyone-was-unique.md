# 108 — Duplicates said "every customer looks unique" while phones were never checked

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 7 (looking for the second Desmond Achterberg after the import)
**Surface:** workbench › CRM › Duplicates (both consoles)
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

The import in [106] had made two Desmond Achterbergs: same name, same phone, one with no email. Doty opened Duplicates to clean it up. The screen said every customer looks unique.

It was checking email and surname plus employer only. Phone matching is a setting in How the CRM behaves, and it was off. Nothing on the screen said so, and nothing led to the setting.

The same screen labeled a customer who was taken off marketing as "Asked not to be contacted". That is a stronger claim than the record holds: they can still get their receipts and invoices.

## What should have happened

An empty result says what it compared and what it did not, and offers the way to turn the rest on.

## Why it matters

"Every customer looks unique" reads as a measurement. It was the result of one comparison never being made. An owner believes it and keeps two records of one person, so his history and his money split in two.

## Where it lives

`surfaces/crm/duplicates.tsx` drew one fixed sentence for the empty state, whatever the match rules in `crm.settings` said. The rules were already in the pane's hand.

## The fix

Both consoles:

- `surfaces/crm/workspace-data.ts`: `duplicatesCheckedWords(rules)` turns the match rules into the two halves of a sentence, what was compared and what was not.
- `surfaces/crm/duplicates.tsx`: the empty state names both ("Nobody shares an email address or a surname and employer. Phone numbers are not compared…") and has a "How the CRM behaves" button that opens the setting. The badge reads "Do not send marketing".

Test, proved red:

- `surfaces/crm/duplicates-checked.test.ts`, both consoles: the old fixed sentence reddens 2 of 2.

## Confirmed by

On screen, 2026-10-06, as Doty: with phone off the empty state named phone as not compared and opened How the CRM behaves. He turned phone on. Duplicates then showed "Very likely · Same phone number", Desmond Achterberg twice, with "Do not send marketing" on the badge. "Merge them" left one Desmond (37 customers, 1 Achterberg in the database) and the empty state now reads "Nobody shares an email address, a phone number or a surname and employer."

## Rating effect

—
