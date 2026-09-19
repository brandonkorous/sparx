# 654 — The button that fixes it was written, and never put on a screen

**Status:** fixed
**Severity:** high
**Found by:** P03 · Juniper Row · act 229
**Surface:** Stock — Barcodes, Product labels; Customers — a group's page
**Filed:** 2026-09-18
**Fixed:** 2026-09-18
**Confirmed by:** P03 · Juniper Row · act 229 (driven on screen, every step)

## What she did

Devi opened **Barcodes** from the Stock menu, because she wanted price tickets on
her rails. She got a picture of a pig:

> **No barcodes registered yet**
> A barcode lets someone scan a box instead of typing what is in it.
> **[ Create codes and print labels ]**

She pressed it. **Product labels** opened, and gave her a second picture of a pig:

> **No barcodes to print**
> Things need a barcode before a label can be printed. We can make one for
> anything that arrived without a code from the maker.
> **[ Pick items to create codes for ]**

She pressed that. It opened the **Stock list**: 74 rows, a search box, no
checkboxes, no mention of codes, and nothing on the screen that makes one.

Three screens, two encouraging sentences, a dead end.

## What she had

|                           |         |
| :------------------------ | ------: |
| things Juniper Row sells  | **108** |
| of them anything can scan |   **0** |

And across the whole platform: 42 tenants with something to sell, 2 with a single
barcode between them, and **not one code ever created by the software** — the
minting path has never run in production.

## The cause

Everything needed was already written. Nothing was on a screen.

```ts
// product-labels.tsx
/**
 * The "give these items a barcode" action, as a button any list can drop in.
 */
export function GenerateBarcodesButton({ variantIds, onDone }) { … }   // 0 callers

/** How many of a set of items still have no code. The number that decides
 *  whether a warehouse can go scan-first at all. */
export function MissingBarcodeCount({ missing }) { … }                 // 0 callers
```

Both exported, in **both consoles**, imported by nobody.

The endpoint behind the dead button takes **500 items at a time**, skips anything
that already has a code, and returns what it made and what it skipped. The only
thing in the console that ever called it passed **one** id, from one item's own
page.

And the surface held a success message for a thing it could not do:

```tsx
const generate = useGenerateBarcodes();          // never fired
…
{generate.data && generate.data.generated.length > 0 ? (
  <Alert color="success">Created {…} codes. They are on the sheet below.</Alert>
) : null}                                        // could never appear
```

It survived lint because `generate.data` is read. It survived typecheck because
dead UI typechecks perfectly. It survived review because the file's own header
says the feature exists:

> **Items with no code get one, here.** This screen does not merely refuse to
> print an item without a barcode: it offers to mint one. That is the whole path
> from a spreadsheet catalogue to a scannable warehouse, and it is two clicks.

## The same paragraph, on the neighbouring screen

`barcodes-list.tsx` opens by naming the two things it exists to surface:

> A warehouse can only go scan-first when every item has a code, and the two
> things standing between a tenant and that are always the same: items with no
> barcode at all, and codes that two items both claim. **Both are surfaced at the
> top as counts you can act on.**

Conflicts had a card. **"Items with no barcode at all" was counted nowhere, in
either console.** [[feedback_a_fix_leaves_its_neighbour_behind]]

## Fixed

A `GET /v1/inventory/barcodes/unbarcoded` beside the conflicts endpoint, because
the two are the same question asked of different rows. Its predicate is the
minting rule word for word — a variant with no ACTIVE code — so the number on
the button is the number the button will act on. A count derived from a slightly
different question is how a screen comes to promise 12 and deliver 9.

**Barcodes** now leads with it, in the shape of the conflicts card directly above:

> ⚠ **108 things you sell have no barcode**
> Nothing can scan them, and no label can be printed for them. Piggles can give
> each one a real barcode from the range set aside for a shop's own things.
> **[ Give them codes ]**

And its empty-state button counts: **Give 108 items a code**.

**Product labels** carries the picker the dead button was written for: every
unscannable item, ticked, with **Create 108 barcodes** and **Choose which**.
Everything ticked by default, because nobody opens this wanting SOME of their
shop scannable, and reading 108 rows before you are allowed to press the button
is the sort of care that stops people bothering.

Driven on screen: 107 first (one unticked, to prove the skip), then the last one.
The list repopulated as the codes landed, the wording went singular at one, and
the sheet filled with real bars. It ended on:

> ✨ **Everything can be scanned now**
> 108 codes created. The labels are below, ready to print.

Juniper Row went from nothing scannable to a printable sheet in three clicks.

## Also: the record was shown only where it is always empty

`ListHistoryOnly` — third orphan, same shape, different module:

> The history alone — for a RULE-driven list, where membership is not editable
> but **"who dropped out this month" is still the interesting question**.

Written for that branch, rendered on neither. The **Comings and goings** panel
shipped only on hand-picked lists.

The measurement decides it:

|                    | membership events |
| :----------------- | ----------------: |
| rule-driven groups |         **1,342** |
| hand-picked groups |             **0** |

Every event on the platform belongs to the kind of list that never showed them,
and none belongs to the kind that did. Devi's **Newsletter Subscribers** has 23
members and 27 events, so four departures she could not see anywhere. On screen,
the first thing the panel said was that **Tomas Beaulieu has come off her
newsletter list twice in three weeks**. [[feedback_fetched_but_never_rendered]]

## Guard

`pnpm check:orphan-surfaces` — an exported component in a `surfaces/` file that
nothing in its own console renders fails the build. It found 1,318 exported
components and every one of them is drawn somewhere; no exceptions are named.

Dead UI is not harmless. It reads as FINISHED — props, styling, a doc comment
saying what it is for — so the next person to ask "does the console do X?" finds
X in the tree and stops, while the screen that needed it goes on not having it.
[[feedback_screen_over_a_function_nobody_calls]]

Proved red four ways:

1. a new component nothing renders → names the file and the export
2. the ACTUAL defect put back (un-render `GenerateBarcodesButton`) → names it
3. a comment that mentions the name must not count as a use → still red
4. a scan root moves → exits 1 rather than passing over nothing
   [[feedback_structural_checks_go_blind]]

Two things were deleted rather than wired, because git holds them and a file in
the tree is a claim that the console does this: `MissingBarcodeCount`, whose job
the new sentence does better, and Piggles' copy of `WelcomeBanner`, a leftover
from the fork whose replacement (`FirstRunPanel`) is already on the Piggles home
in the Piggles voice. Sparx still renders its own copy.

## The check's own near miss, which is the point of the check

The first version used two regexes to strip comments. It reported **twelve**
orphans, five per console that are plainly registered and shipping. The
block-comment pattern had matched the `/*` inside a line comment that mentions a
URL:

```
// api-rest `/v1/email/*` backend (broadcasts, sending domains, …)
```

and then ran for 3,202 characters to the next close, swallowing every import in
`catalog/email.ts`. Nine registered surfaces vanished from the scan at once.

Before that it had the opposite failure and went GREEN: it counted a name
appearing anywhere, so the comment I had just written — "`GenerateBarcodesButton`
was exported with no importer" — made the orphan look used, and the tick printed
while `MissingBarcodeCount` was still orphaned.

A regex cannot see that a `/*` is inside a comment, or that a `//` is inside a
string, because knowing that IS the parse. It walks the source once now, four
states, no cleverness. [[feedback_codemod_diff_your_own_sweep]]

## Files

- `wizeworks/packages/inventory/src/services/barcodes.ts`, `…/services/inventory-service.ts`, `…/src/index.ts`
- `wizeworks/services/api-rest/src/routes/v1/inventory/barcodes.ts`
- `piggles|sparx/apps/workbench/surfaces/inventory/{product-labels,barcodes-list,scan-data}.tsx|ts`
- `piggles|sparx/apps/workbench/surfaces/crm/segment-detail.tsx`
- `piggles/apps/workbench/lib/console/copy.ts`
- `piggles/apps/workbench/surfaces/onboarding/welcome/welcome-banner.tsx` (deleted)
- `scripts/check-orphan-surfaces.mjs` (new), `package.json`, `.githooks/pre-push`
- `docs/150-inventory-api-reference.md` (regenerated)
