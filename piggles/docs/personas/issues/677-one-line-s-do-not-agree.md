# 677 — "1 line(s) do not agree"

**Status:** fixed
**Severity:** minor
**Found by:** P03 · Juniper Row · act 240
**Surface:** mypiggles › Stock › What suppliers billed you › (an invoice), and eight more
**Filed:** 2026-09-18
**Fixed:** 2026-09-18
**Confirmed by:** P03, on the screen — see below
**Blocked on:** —

## What happened

Devi opened the invoice Ashcombe had sent twice. The check across the top said:

> **1 line(s) do not agree**

and the alert under it:

> **1 line(s) do not agree**
> Check these before the bill is approved for payment.

## This was already fixed once

`receipt-detail.tsx`, one screen along in the same folder, carries this comment:

> Counted in WORDS, not `n line(s)`. The helper that does it is imported at the
> top of this file and used twenty lines below, and these four were the ones it
> never reached — so a delivery two metres short told a dressmaker **"1 line(s)
> are short"** ([495](495-a-delivery-two-metres-short-said-1-line-s-are-short.md)). The verb has to agree too, which is why the count is
> asked twice.

That issue was a dressmaker, a short delivery, and this exact sentence. It was
fixed in receiving. The bill check beside it went on saying it, and so did eight
more strings elsewhere. [[feedback_a_fix_leaves_its_neighbour_behind]]

## What was found

MEASURED 2026-09-18 across both consoles, every package `src` and every service:
**nine live strings**, in three areas, none of them in the consoles' own copy
checks because those checks have never reached the packages
([657](657-the-spelling-guard-was-green-because-its-list-was-short.md)).

| Where                     | What it said                                                       |
| ------------------------- | ------------------------------------------------------------------ |
| a supplier invoice        | `1 line(s) do not agree` / `All 3 line(s) match…`                  |
| approving a bill (server) | `1 line(s) differ. Accept the difference with a reason…`           |
| a fitment level (server)  | `Can't remove level "Model": 12 node(s) still use it`              |
| minting barcodes (server) | `Could not mint a free barcode for 3 item(s)…`                     |
| the nightly pass (server) | `4 order(s) overdue; 2 flagged tonight`                            |
| importing posts           | `2 row(s) were skipped: see the list`                              |
| syncing a site (server)   | `none of the 4 incoming page(s) match any of the 9 stored page(s)` |
| a product option (server) | `Option "Size" requires at least 1 selection(s)`                   |
| reindexing (server)       | `2 of 5 collection(s) failed`                                      |

`product-types-service.ts` — in the same folder as two of them — has always
written `${inUse} product${inUse === 1 ? '' : 's'} still use it`.

## What should have happened

Count in words, both branches, verb included. Every console has a
`plural(count, one, many)` helper for the first half.

## How to reproduce

Before the fix: enter a supplier invoice that disagrees with the delivery on one
line, and read the check.

## Why it matters

The audience rule is the whole product: the people using this run shops, and
`line(s)` is a programmer saving themselves a ternary. It is not confusing so
much as **disqualifying** — it is the tell that nobody read the sentence back,
on a screen whose entire job is to be trusted about money.

And "1 line(s) do not agree" is also ungrammatical in the only case that matters,
because one disagreement is the common one.

## Where it lives

Nine files across `wizeworks/packages/*/src` and both consoles' surfaces. Listed
above.

## The fix

All nine rewritten with both branches and the verb:

```text
label: `${plural(match.linesFlagged, 'line', 'lines')} ${
  match.linesFlagged === 1 ? 'does' : 'do'
} not agree`,
```

and, where "All 1 lines match" would have been the result, a different sentence
rather than a cleverer template: _"The one line on this bill matches what was
ordered and what arrived."_

**A check, because the shape comes back one file over.**
`scripts/check-counted-in-words.mjs` reads every string literal in both consoles,
every package `src` and every service — comments stripped first, because a
comment may quote the old wording while explaining why it went. 4,601 files.

Two things are exempt and both are named with the reason. `http(s)` is a protocol
and not a count. `Attribute N value(s)` is **WooCommerce's own CSV column name**:
the importer looks a spreadsheet up by it, so "fixing" the wording there would
quietly stop every WooCommerce import finding its attribute columns. A name
somebody else chose is a key, not a sentence.
[[feedback_copy_edit_breaks_identity_lookups]]

**Proved red.** Putting `line(s)` back into the bill check reports exactly that
one string and exits 1.

## Confirmed by

> The invoice now reads **"1 line does not agree"** in both places, and
> `check:counted-in-words` reports 4,601 files read across 4 trees with nothing
> counted as `thing(s)`.

## Rating effect

Recorded in [rating.md](../rating.md) on the `inventory.supplier-bills.detail`
row.
