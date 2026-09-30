# 767 — A British spelling shipped under the guard built to catch it

**Status:** fixed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 271
**Surface:** platform — two spelling guards and the copy under them
**Filed:** 2026-09-22
**Fixed:** 2026-09-22
**Confirmed by:** proved red three ways, then green
**Blocked on:** —

## What happened

She turned the accepted quote into an order and the toast said:

> Order O-000020 created
> The accepted quote is now a real order, ready to **fulfil**.

There are two guards over exactly this. Both were green.

## Why

There were **two lists**, kept in step by hand, and they had fallen out of step
twice:

|              | `scripts/check-american-spelling.mjs`  | each console's `american-spelling.test.ts` |
| ------------ | -------------------------------------- | ------------------------------------------ |
| scans        | packages, services, seed data, catalog | that console's surfaces                    |
| entries      | 96                                     | 78                                         |
| `fulfilment` | yes                                    | yes                                        |
| `fulfil`     | **no**                                 | **no**                                     |
| `millimetre` | yes                                    | no                                         |

`\bfulfilment\b` cannot match "fulfil". The noun is the longer word, so the
shorter one never comes up against the boundary — which is the same shape the
script's own header already describes for `\bmetre\b` and `millimetre`, a bug
that had already seeded `millilitre` into every tenant once. The lesson was
written down and applied to one word family. [[feedback_structural_checks_go_blind]]

## What was done

**One list.** `scripts/british-words.mjs` exports `BRITISH_WORDS`; the CLI check
and both console tests import it. Plain data, no side effects, so a vitest file
reads it as safely as the script does, with a `.d.mts` beside it for the
TypeScript side. Adding a word now covers every surface at once.

**The list went from 96 pairs to 200.** The bare verbs the noun-only entries had
been hiding (`fulfil`, `enrol`, `instal`), the `-ise` family the list had
started and not finished (`realise`, `minimise`, `finalise`, `itemise`,
`standardise`, `specialise`, and twenty more), and the words a real tenant's own
copy can hold: a textile business writes about **fibre** and **woollens**, a
food one about **savoury** and **yoghurt**, a jeweller about **jewellery**.

## What the widened list found

Fifteen live British spellings in text a business owner or their customer reads,
none of them in a comment, all of them respelled:

| where                                             | word                        |
| ------------------------------------------------- | --------------------------- |
| `db/sample-data/packs/auto-parts.ts`              | Standardised                |
| `db/sample-data/packs/florist.ts`                 | parlour palm                |
| `inventory/services/pick-lists.ts`                | nothing left to fulfil      |
| `inventory/services/report-registry.ts`           | every difference itemised   |
| `silica-catalog/first-party-themes.ts`            | theatre · a rumour of cream |
| `silica-catalog/sections/compare.ts`              | every line itemised         |
| `silica-catalog/sections/place.ts`                | a written itemised price    |
| `silica-catalog/sections/process.ts`              | Itemised, fixed, and valid  |
| console · `automations-catalog.ts`                | An invoice is finalised     |
| console · `engagement-composer.tsx`               | Try dialling directly       |
| console · `scheduling/resource-detail.tsx`        | a speciality, a location    |
| console · `surfaces/inventory/reports-ageing.tsx` | the FILE NAME               |

Two were **search keywords**, which is the one sanctioned reason to hold a
British spelling — and both held it INSTEAD of the American one, not alongside
it. `'fulfil'` and `'ageing'` were the only spellings that would find those
panes, so an owner typing "fulfill" found nothing. Both now list the American
form first and keep the British as the alias, which is what the exemption was
always for.

`reports-ageing.tsx` was renamed to `reports-aging.tsx`, with `AgeingCard` →
`AgingCard`. The accounting code next to it already said `bucketAging`.

## Files

- `scripts/british-words.mjs`, `scripts/british-words.d.mts` — the one list
- `scripts/check-american-spelling.mjs` — reads it
- `piggles/apps/workbench/lib/console/american-spelling.test.ts`, `sparx/…` — read it
- the fifteen files above

## Proof

```
check-american-spelling: 2290 server files, 96683 string literals,
200 British words looked for.
Every word the server writes is spelled the American way.
```

Both console guards: 7 tests passed.

**Proved red on the exact word that slipped through.** Putting `fulfil` back in
the console toast:

```
+ "invoicing/lifecycle.tsx:397  fulfil    is open in a new tab, ready to fulfil."
  Tests  1 failed | 6 passed (7)
```

And back in `pick-lists.ts`, for the server check:

```
  wizeworks/packages/inventory/src/services/pick-lists.ts:204
      fulfil -> fulfill
```

Both green again once restored. [[feedback_a_test_that_cannot_go_red]]

## One more, found on the way

Two tests in `wizeworks/packages/email` were red at HEAD, asserting
`toContain('Cancelled')` against silica default emails an earlier sweep had
already respelled to "Canceled". The templates were fixed and their test was
left behind. Updated in the same pass.
