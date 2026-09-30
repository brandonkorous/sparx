# 713 — The words the server writes were never looked at

**Status:** fixed
**Severity:** minor
**Found by:** P03 · Juniper Row · act 250
**Surface:** mypiggles + sparx — Stock › Units, and 17 other files across the platform
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** the new check, proved red, and the migration applied and read back
**Blocked on:** —

## What happened

Devi opened **Units**. Under Volume and Length:

| Code | Called                           |
| ---- | -------------------------------- |
| L    | 1 **litre** · 2 **litres**       |
| ML   | 1 **millilitre** · 2 millilitres |
| M    | 1 **metre** · 2 **metres**       |
| MM   | 1 **millimetre** · 2 millimetres |

She is in America.

## Why it matters

There is a guard for this. `apps/workbench/lib/console/american-spelling.test.ts`
has held since Piggles said "licenses" and sparx said "licences" in the same pane
title. It is a good guard. Its `PAIRS` list already contains `litre → liter` and
`metre → meter`.

It scans two directories:

```
apps/workbench/surfaces        apps/workbench/lib/surfaces
```

Not one of the four words above is in either. They are in
`commerce-schemas/src/uom.ts`, seeded into every tenant the first time anybody
opens the pane. A rule written down and applied to one of the places it holds.
[[feedback_structural_checks_go_blind]]

**Two of the four would have survived the list anyway.** `\bmetre\b` does not
match inside "millimetre" — the character before it is a word character, so there
is no boundary. The guard knew the word and could not see it.

**MEASURED 2026-09-19** across `wizeworks/packages` + `wizeworks/services`: 2,287
files, 96,568 string literals, **24 British spellings in copy a person reads**.

## What was done

**`scripts/check-american-spelling.mjs`** — the same rules as the console test,
pointed at the server, plus the compound metric words the original list could not
reach. Wired into `pnpm check:american-spelling` and pre-push.

Five things it does NOT touch, each named at the top of the file rather than
guessed:

1. **A wire value.** `'cancelled'` is the string in the database and in the event
   catalog. Respelling it would stop a filter matching, not fix a spelling.
2. **An import column alias.** `'fulfilment centre'` matches a heading in
   somebody else's spreadsheet, and sits beside its American twin on purpose.
3. **A proper noun.** Earl Grey is a tea.
4. **Another company's own term.** Xero's software says "Organisation" on its own
   screens, so an error telling somebody to go and look there has to say the word
   they will see. Keyed by file AND word, so it cannot spread.
5. **A FORMER name.** `previousNames: ['Order cancelled: email']` is a lookup key
   on rows that already exist — it is the whole reason a system automation can be
   renamed at all. Respell it and the rename stops reaching every tenant who has
   the old one, which installs a SECOND rule and emails the customer twice.
   [[feedback_copy_edit_breaks_identity_lookups]]

**24 strings fixed**, including the three cancel emails a customer receives. Those
ride the existing refresh: the outgoing body fingerprints were captured BEFORE
the edit and appended to `PRIOR_DEFAULT_BODY_FINGERPRINTS`, so every tenant still
on the untouched shipped default rolls forward to the new wording, subject
included, and every tenant who has edited theirs is left alone.

The console badge for a canceled order has said **"Canceled"** since the status
sweep. The email it sends said "cancelled". Same order, same moment, two
spellings.

**A migration for the rows already written.** `STARTER_UNITS` is copied into a
tenant once and never updated, so respelling the source reaches new tenants only.
`20270513000000_starter_units_are_spelled_the_american_way` refreshes the four
seeded names, guarded on `is_system = true` AND the exact old strings, so a unit
a business renamed themselves is never touched. The CODE (`L`, `ML`, `M`, `MM`)
is the identity and does not move.

## Files

- `scripts/check-american-spelling.mjs` — new, wired into pre-push
- `wizeworks/packages/commerce-schemas/src/uom.ts` — the four units, and
  `pluralise` → `pluralize`
- `wizeworks/packages/builder-schemas/src/default-emails{,-silica}.ts` — the three
  cancel emails
- `wizeworks/packages/builder/src/services/email-default-refresh.ts` — three
  outgoing fingerprints appended
- `wizeworks/packages/automation-actions/src/seeds/{commerce,subscriptions}.ts` —
  renamed, with the old names kept as `previousNames`
- 13 more files across migration, crm, media, finance, silica-catalog, api-rest
- `wizeworks/packages/db/prisma/migrations/20270513000000_…/migration.sql` — new

## Proof

Put `name: 'litre'` back in `uom.ts`: the check exits 1 naming the line. Restored:
`2,287 server files, 96,541 string literals, 83 British words looked for. Every
word the server writes is spelled the American way.`

**The migration ran** (2026-09-19 20:00 UTC, one pending, applied with
`prisma migrate deploy` after Brandon stopped dev for it). Read back:

| code | name           | plural_name     |
| ---- | -------------- | --------------- |
| L    | **liter**      | **liters**      |
| ML   | **milliliter** | **milliliters** |
| M    | **meter**      | **meters**      |
| MM   | **millimeter** | **millimeters** |

Zero rows on the database still carry any of the four British names. Codes,
`is_system` and the CS × 12 conversion set through the new pack-sizes editor are
all untouched, which is the point of matching on the full old string rather than
on the code.
