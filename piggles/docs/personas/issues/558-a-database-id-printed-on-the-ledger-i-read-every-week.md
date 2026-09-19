# 558 — A database id printed on the ledger I read every week

**Status:** fixed and proven
**Severity:** medium
**Found by:** Devi, on the same screen as [557](557-the-item-column-was-84px-and-the-reason-column-was-521.md)
**Surface:** `wizeworks/packages/commerce/src/services/return-service.ts`
**Filed:** 2026-09-16
**Family:** [[feedback_non_technical_audience]] · [[feedback_a_fix_leaves_its_neighbour_behind]]

## What she saw

Five rows of **Every change**, each one a replacement she had sent a customer:

> **Sold**
> _Replacement sent for return 526b92cc-eecc-4e86-b6c9-5068c68b0db9_

She has no way to find out what that is. It appears on no other screen, it
matches nothing she can search for, and it is longer than the product name beside
it.

## Measured

```sql
SELECT count(*) FILTER (WHERE note ~ '[0-9a-f]{8}-[0-9a-f]{4}-…') AS notes_with_uuid,
       count(*) FILTER (WHERE note IS NOT NULL AND note <> '')   AS notes_total
FROM inventory_movements;
```

| notes with a raw id | notes with any text | movements |
| ------------------- | ------------------- | --------- |
| **6**               | 19                  | 1283      |

Six of the nineteen notes anyone has ever written are ids, and **all six** come
from the same line of code. Five are Devi's.

Every other note the platform writes names things the way a person would:
`${lot.lotNumber}`, `${list.number}`, `${order.orderNumber}`,
`${schedule.name}`, `${batch.filename}`. This was the only one.

## The cause

```ts
note: `Replacement sent for return ${input.returnId}`,
```

A return has no number of its own — the table has no such column — so everywhere
else in the product it is named by its **order**: the detail pane's title is
`Return · O-000016`, and the returns list sorts on the order number. This one
line reached for the id instead, because the id was the thing already in hand.

**The same fault was fixed once already, forty lines away.** From `approveReturn`:

```ts
// Read by a shop owner in a toast, so it says what she can DO about it.
// It used to name the return line's uuid, which is a sentence for a
// developer on a screen about somebody's shirt (persona issue 224).
```

Issue 224 fixed the toast and left the stock note standing. That is
[[feedback_a_fix_leaves_its_neighbour_behind]] with a two-month gap between the
neighbour and the fix.

## The fix

The sentence moves into its own pure module, `return-notes.ts`, and the service
looks the order number up:

```ts
export function replacementStockNote(orderNumber: string | null): string {
  if (orderNumber === null || orderNumber.trim() === '') {
    return 'Replacement sent for a return';
  }
  return `Replacement sent for the return on order ${orderNumber.trim()}`;
}
```

Null only when the order behind the return has been hard-deleted. The fallback
says less rather than falling back to the id.

Her rows will read **Replacement sent for the return on order O-000016**.

## Proven

`return-notes.test.ts`, three assertions. The one that matters is the third,
because the wording was never the thing that broke — the **caller** was:

```ts
const notes = [...source.matchAll(/note:\s*([^\n]*)/g)].map((m) => m[1]);
for (const note of notes) {
  expect(note).not.toMatch(/\$\{[^}]*(\bid\b|Id\b|\.id\b)[^}]*\}/);
}
expect(source).toContain('replacementStockNote(');
```

Proven red by putting the original line back:

```
AssertionError: expected '`Replacement sent for return ${input.…'
  not to match /\$\{[^}]*(\bid\b|Id\b|\.id\b)[^}]*\}/
Tests  1 failed | 2 passed (3)
```

The first version of that regex used `\b(id|Id)\b`, which does **not** match
`returnId` (the `Id` is preceded by a word character), so it went green with the
bug installed and only the weaker second assertion caught it. Reversed until
right and wrong differed, per [[feedback_a_test_that_cannot_go_red]].

214 commerce tests pass.

## Still open

The five rows already in the database keep the old text: the note is stamped onto
the movement when the swap is settled, and nothing rewrites history on an
append-only ledger. They refresh on the next seed run. Nothing was changed in the
database for this.
