# 530 — "What needs you" said nothing needed her

**Status:** fixed and proven
**Severity:** critical
**Found by:** Devi, on the first screen of the morning
**Surface:** `lib/console/home-counts.ts` (new), `lib/console/home-data.ts`, `surfaces/home/signals.ts` — Piggles only
**Filed:** 2026-09-15
**Follows:** [522](522-her-overdue-list-was-empty-while-she-was-owed-986-dollars.md), [529](529-eight-seeded-views-pointed-at-screens-that-do-not-exist.md)

## What she saw

Home. The top of it. The thing the whole screen exists to say:

> **What needs you**
>
> **1** item is sold out
>
> Everything else is fine: everything is sent, everyone has had a reply, no
> bookings are waiting, **nothing is overdue** and nothing is running low.

She was owed **$986.50 across eight late invoices**.

The invoices list, two panes over, had a band across the top of it reading
**Late $986.50 · 8 invoices · worst 1–30 days**. Finance → Owed to you said the
same. The home screen said nothing was overdue.

## Why

The third place asking the same stale question.

```ts
invoices: {
  path: '/v1/invoicing/documents',
  query: { status: 'overdue', take: 1, skip: 0 },
},
```

`billing_documents.status` is written when something is **done** to a document,
and a due date passing is nobody doing anything ([522](522-her-overdue-list-was-empty-while-she-was-owed-986-dollars.md)).
For a shop billing ordinary customers it never says `overdue` at all.

The file's own header even described the filter as the right thing:

```
//   invoices   status=overdue           money that is late
```

It is not. That line and the code beneath it agreed with each other and both
were wrong, which is why reading the file changed nobody's mind for however long
it shipped.

## Why this one is worse than the empty list

An empty list is a queue you might doubt. **This is an assertion.** "Everything
else is fine" is a sentence, in plain words, on the first screen of the morning,
and the one thing it is most confidently wrong about is money somebody owes her.
Nothing on that screen invites a second look.

## What changed

- `query: { pastDue: true, take: 1, skip: 0 }` — the same filter the list and
  the aging report use, asked of the due date.
- The header comment now says `pastDue=true`.
- **The words: "late", not "overdue."** The invoices list badges a row **Late**
  and the band at the top says **Late**. "Overdue" was also the name of the
  stored status that turned out not to mean late, and no screen a business owner
  reads should carry one word twice meaning two different things.

## Why there is a new file

`SOURCES` had to move to `lib/console/home-counts.ts` to be testable at all.
The rest of `home-data.ts` is React — `useQuery`, `useReachableModules` — and the
console's test seat runs plain Node with no path aliases, so nothing importing
those can be reached by a test.

That is not a technicality. The half worth guarding is the **filters**, and every
value in them is a string or a boolean going into a query string: they all
compile, and any of them can be wrong. Nothing but a test that reads the query
could have caught this.

## Proven

Three guards in `home-counts.test.ts`. Putting `status: 'overdue'` back reddens
the first:

```
× asks the invoice question of the clock, not of the status column
AssertionError: expected undefined to be true
```

It asserts an **absence** as well as a value: adding `pastDue` beside the old
filter would still return almost nothing, because `status` narrows first, so
"it asks pastDue" alone would not say the defect had gone.

## Proven on her screen

```
What needs you

8  invoices are late
1  item is sold out

Everything else is fine: everything is sent, everyone has had a reply,
no bookings are waiting and nothing is running low.
```

Eight, which is the same eight the list shows and the same $986.50 the band has
been printing all along. The "everything else" sentence dropped its invoice
clause on its own, because it is built from the same counts.
