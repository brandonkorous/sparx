# 893 — A queue with four filters and no way to see it whole

**Status:** fixed
**Severity:** **minor** — nothing on screen was wrong. The story the screen
exists to tell was split across four views that could not be put back together,
and the sibling screen one row down the same menu had the missing view
**Found by:** P03 · act 316, walking Sign-offs beside Sent back
**Surface:** mypiggles › Partners › Sign-offs, both consoles, and the REST
route underneath
**Filed:** 2026-09-30
**Fixed:** 2026-09-30
**Confirmed by:** 2 tests on the new empty state, proved red; typecheck on the
route; and her own two sign-offs, which now read as one story

## What she saw

Sign-offs offers four views, and only four:

```
Waiting · Signed off · Turned down · Withdrawn
```

Her whole history is two rows, and they are the same order twice:

```
PO-000004  $288.00  Turned down  "Ask Ashcombe for a price on 24 first.
                                  We nearly always pay less per shirt at two dozen."
PO-000004  $576.00  Signed off
```

That is a complete little story — she refused twelve at $24 a shirt, asked for a
price on two dozen, and signed off the better one — and no view could show it.
"Turned down" holds the first row, "Signed off" holds the second, and nothing
holds both.

**Sent back**, directly below it in the same menu, has had an **Everything**
option since it shipped.

## The route had no word for it

The handler's own comment had already found the gap and written it down:

> _"Defaulting that to pending returned an empty list for every order that had
> been dealt with … **There was no value of `status` that meant 'all', so asking
> for the trail was not possible at all.**"_

The workaround at the time was to make "no status" mean the whole trail — but
only **when an order is named**, because with no order named the route is the
to-do queue and a to-do queue should not open full of history. So the whole
trail was reachable for one order and unreachable for the queue.

## What I got wrong on the way

My first version had the console send no `status` for Everything, reading that
comment as though it applied to both questions. It does not. The screen came
back saying **"No order has ever been held for sign-off"** over a business with
two of them — a new view that lied, which is worse than no view.

I only saw it because I looked at the screen. The console typechecked, the
tests passed, and the request was well-formed and successfully answered; it was
simply answered with the pending queue, which was empty.
[[feedback_test_as_a_business_owner]]

## What it does now

`status=all` is a real value on the route, named for what it is:

```ts
// `all` is not a state an approval can be in - it is the absence of the
// filter, named so a caller can ask for it.
status: z.enum(['pending', 'approved', 'rejected', 'cancelled', 'all']).optional(),
```

and both questions honour it, while omitting `status` still means what it always
did.

On the pane:

- **Everything** joins the four, with the same word Sent back uses.
- The column heading follows the view: `Waiting` on the queue, `Outcome` on a
  single decided state, **`Where it got to`** on Everything, which is the only
  one true of a mixed list.
- The waiting badge branches on **the row's own state**, not the filter's, so a
  row still waiting reads as waiting even beside decided ones.
- The Approve / Send back pair renders only for a row that is actually waiting.
  The cell stays, so the column stays straight.
- The empty state gets its own sentence. The other three share "No order has
  reached this state"; under Everything there is no state to reach, so it says
  **"No order has ever been held for sign-off."**

Both consoles.

## Proved

**2 tests** on the empty words, and the wrong version:

```
no `all` case, so it falls to the shared sentence   →  1 fail
```

That one matters more than it looks: the shared sentence is grammatical, plain
and completely wrong under this filter, which is the kind of copy defect that
survives a read-through.

The type hole was caught by the compiler rather than by me. Widening the route's
enum made `'all'` assignable to a service filter that has no such state, and
`tsc` refused it until the condition was written so the narrowing is visible:

```ts
...(wholeTrail || q.status === 'all' ? {} : { status: q.status ?? 'pending' }),
```

## Checks

piggles console 172 files / 1613 tests, sparx workbench 141 / 1295,
`@wizeworks/crm` 29 / 286, `@wizeworks/automation-actions` 3 / 25, api-rest
34 / 275 — all green. Typecheck 0 on all five. All 59 structural guards pass.
ESLint and prettier clean.

**On her own screen**, Everything now reads:

```
Order                          Amount    Asked by     Where it got to
PO-000004 · Ashcombe Mills     $288.00   Devi Raman   Turned down
  "Ask Ashcombe for a price on 24 first…"
PO-000004 · Ashcombe Mills     $576.00   Devi Raman   Signed off
```

## Files

- `wizeworks/services/api-rest/src/routes/v1/inventory/po-approvals.ts`
- `piggles/apps/workbench/surfaces/inventory/po-approvals.tsx`
- `sparx/apps/workbench/surfaces/inventory/po-approvals.tsx`
- `piggles/apps/workbench/surfaces/inventory/po-approvals-data.ts`
- `sparx/apps/workbench/surfaces/inventory/po-approvals-data.ts`
- `piggles/apps/workbench/surfaces/inventory/po-approvals-empty.ts`
- `sparx/apps/workbench/surfaces/inventory/po-approvals-empty.ts`
- `piggles/apps/workbench/surfaces/inventory/po-approvals-empty.test.ts`
- `sparx/apps/workbench/surfaces/inventory/po-approvals-empty.test.ts`

## Also walked and correctly not filed

**The standing "Nothing waiting" label.** It sits immediately left of the filter
and does not change with it, so on the Signed off view it reads "Nothing
waiting" over a row. It is not a count of the list: it is built from the
server's `pending` figure, which is deliberately the count of everything still
waiting whatever the page is filtered to, and it is the number behind the nav
badge. It is true at all times and it answers the question the screen is for.

## The thing to remember

**Four filters over one record type are four questions, and the sum of them is a
fifth that nobody added.** Each view was correct, each was useful, and the thing
a person actually wanted to know — what happened to this order — lived in the
gaps between them.

The measurement that finds it is not "is each view right" — they all were. It is
**"put the sibling screens side by side and read their controls."** One of them
had the option and the other did not, and the one that did not was the one
holding a sequence.
