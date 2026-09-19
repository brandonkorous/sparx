# 657 — The spelling guard was green because its list was short

**Status:** fixed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 231
**Surface:** both consoles, 93 strings across Selling, Customers, Email, Money, Stock, Partners, My Team, Bookings
**Filed:** 2026-09-18
**Fixed:** 2026-09-18

## What she saw

Devi called off a transfer. The toast said **canceled**. The badge beside it said
**Cancelled**. Two spellings of one word, an inch apart, on one screen.

`order-tone.ts` had them in the same object:

```ts
label: 'Cancelled',
detail: order.cancelledReason
  ? `This order was canceled: ${order.cancelledReason}`
```

## Why nothing caught it

There IS a guard. `lib/console/american-spelling.test.ts` is a good one: it scans
string literals rather than lines, exempts search aliases on purpose, prints a
denominator so it cannot pass over nothing, and has a test of its own matcher
after an earlier version was silently broken by a shell heredoc.

Its word list was fourteen entries, described as _"the words this codebase has
actually drifted on"_. That is a list built from whatever was found the day it
was written, and a list like that stops growing the moment it goes green.

`cancelled` was not on it. Neither were `cheque`, `travelled`, `labelled`,
`labour`, `neighbour`, `recognise`, `summarise`, `authorised`.

## What it was hiding

**93 replacements**, in both consoles:

| where                                                           |     |
| :-------------------------------------------------------------- | --: |
| `Cancelled` status labels                                       | ~70 |
| prose ("…when their order is cancelled.")                       |   6 |
| `Cheque number, who took it…` placeholders                      |   4 |
| `{ value: 'check', label: 'Cheque' }`                           |   2 |
| `labelled`, `summarise`, `neighbour`, `authorised` in sentences |   6 |
| search keywords sparx had only in British                       |   2 |

Those last two are worth their own line. sparx's launcher listed
`'authorise'` and `'organisations'` and NOT their American twins, which piggles
has both of. So a sparx owner typing the spelling the rest of the console uses
found nothing.

## What was NOT changed, and why

`cancelled` is the string in the database and in the event catalog
(`order.cancelled`). It is an identity. Renaming it would not fix a spelling, it
would silently stop a status filter matching, with every check still green.
[[feedback_copy_edit_breaks_identity_lookups]]

So the sweep left every key, every wire value and every dotted event name alone:

```diff
-  { value: 'cancelled', label: 'Cancelled' },
+  { value: 'cancelled', label: 'Canceled' },
-  <option value="cancelled">Cancelled</option>
+  <option value="cancelled">Canceled</option>
```

## The sweep's own near miss

Its first run made **97** replacements. One of them was:

```diff
- `${String(data.counts.cancelled)} customers have stopped their repeat orders…`
+ `${String(data.counts.canceled)} customers have stopped their repeat orders…`
```

A template literal's `${...}` is CODE. That renames a field the API sends and
turns the number into `undefined`, while the sentence around it still reads
perfectly. It was caught by reading the diff and nothing else — every check would
have stayed green. The sweep was restored from a copy taken beforehand and taught
to leave every interpolation alone. [[feedback_codemod_diff_your_own_sweep]]

The guard had the same blind spot, and now strips interpolations before deciding,
with a test for it.

## The guard's own hole, found by the red proof

After widening the list and fixing all 93, the guard was proved red by putting
one label back:

```diff
-  cancelled: 'Canceled',
+  cancelled: 'Cancelled',
```

**It stayed green.** `'Cancelled'` is a bare word whose American twin sits
elsewhere in that file, which satisfied the search-alias exemption — so a LABEL
was being treated as a deliberate keyword, and the guard passed over the exact
defect it had just been widened to catch.

Both alias exemptions now apply only to lowercase text: a search keyword is
written lowercase, a label is capitalized because it is read. Re-proved red: it
names `crm/tasks-list.tsx:65  cancelled  Cancelled`.
[[feedback_a_test_that_cannot_go_red]]

## What the guard does now

- **75 word pairs**, not fourteen, chosen as the ordinary British/American pairs
  a business console can plausibly contain rather than the ones somebody has
  already typed. A word that cannot appear costs nothing to list.
- Reads **JSX text** as well as string literals. `<option value="cancelled">
Cancelled</option>` has two spellings on one line and only one of them is
  copy; reading literals alone saw only the one that must never change.
- Exempts **dotted lowercase identifiers** (`order.cancelled`), **bare wire
  values**, and **lowercase alias phrases** whose American twin is a literal in
  the same file (`['labour cost', 'labor cost']`).
- Ignores `${...}`.

## Still open

The rule covers comments too, and the guard deliberately does not read them. Two
British spellings in api-rest messages were fixed by hand on the way past
(`a shelf labelled …`), which is a reminder that the PACKAGES have no guard at
all — every sentence `@wizeworks/inventory` or `@wizeworks/commerce` shows a
person is unchecked. That is a separate pass.

## Files

- `piggles|sparx/apps/workbench/lib/console/american-spelling.test.ts`
- 45 surface files across both consoles, plus two launcher catalogs
- `wizeworks/packages/inventory/src/services/bins.ts`
- `piggles/apps/workbench/surfaces/{commerce/order-tone,finance/payment-state}.test.ts` and the sparx twin
