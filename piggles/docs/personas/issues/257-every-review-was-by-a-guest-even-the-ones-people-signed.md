# 257 — Every review was by "A guest", even the ones people signed

**Status:** fixed
**Severity:** minor
**Found by:** P03 · Juniper Row · act 11 — moderating the first review on her shop
**Surface:** mypiggles › Sell › Reviews (and Questions)
**Filed:** 2026-08-26
**Confirmed:** 2026-08-26

## What happened

Tessa Wren wrote a review on The Everyday Tee and typed her name into the Name
field, which the form asks for first and does not mark optional.

Devi's Reviews table:

| Review                                 | Product          | By          | Status          |
| -------------------------------------- | ---------------- | ----------- | --------------- |
| ★★★★★ Holds its shape after a hot wash | The Everyday Tee | **A guest** | Waiting for you |

Open the same review in the queue and it reads **"Tessa Wren · 4 minutes ago"**.

Two screens, one review, two different answers about who wrote it.

## What should have happened

The name she signed it with is the name on the review.

## Why it matters

- **It is the column an owner scans by.** A table of reviews is read down the By
  column — who is happy, who is not, who is a repeat customer. Every guest review
  saying "A guest" makes that column carry nothing.
- **It gets worse with volume, not better.** One review reading "A guest" is
  merely blank. Ten of them are indistinguishable from each other, and the table
  is the surface built for exactly the case where there are hundreds.
- The moderation card shows the name, so the table looks like it is telling you
  something different rather than telling you less. An owner has no way to know
  the name is a click away.

## Where it lives

The value was in the record the whole time, and two layers each dropped it.

**The API.** `GET /v1/commerce/reviews` in
[lists.ts](../../../../wizeworks/services/api-rest/src/routes/v1/commerce/lists.ts)
**searches** `displayName` and does not **select** it:

```ts
{ displayName: { contains: q.q, mode: 'insensitive' } },   // the WHERE clause
...
select: {
  id: true, productId: true, rating: true, title: true, body: true,
  status: true, orderId: true, createdAt: true,
  customer: { select: { … } },                              // no displayName
  product:  { select: { … } },
},
```

So an owner could **search for "Tessa" and find the review** — and then read
"A guest" in the row it returned. The endpoint knew the field well enough to
match on it and not well enough to show it.

**The console.** `customerLabel` in
[moderation-data.ts](../../../apps/workbench/surfaces/commerce/moderation-data.ts)
resolved a name from the linked customer ACCOUNT only:

```ts
if (!customer) return 'A guest';
```

A guest reviewer has no account by definition, so that branch was every guest
review. `ReviewListRow` did not declare `displayName` at all, so there was
nothing for it to fall back to even had it tried.

The queue was fine because its own row type carries `displayName` and its card
renders `review.displayName ?? 'Someone'`.

Both lists — reviews and questions — had the identical shape, and both are fixed.

## The fix

`displayName` added to both selects and both mappers in `lists.ts`, declared on
`ReviewListRow` and `QuestionListRow`, and `customerLabel` given the signed name
as its second source:

```
account name → the name they signed it with → their email → "A guest"
```

Fixed at `customerLabel` rather than at the two call sites, so Reviews and
Questions cannot drift apart on what "By" means.

"A guest" stays as the last resort, and is right there: somebody who left the
Name field empty genuinely is one.

## Confirmed

Re-opened Sell › Reviews as Devi, Shown filter. The By column now reads
**Tessa Wren**, matching the queue card and matching what the shopper sees on the
product page.

## Related

[[feedback_fetched_but_never_rendered]] — the commonest defect shape in this
codebase, and an unusually clean instance: the API filtered on the exact column
it refused to return.

## Rating effect

The Reviews table, in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
