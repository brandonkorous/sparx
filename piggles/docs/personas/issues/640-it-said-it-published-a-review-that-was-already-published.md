# 640 — It said it published a review that was already published

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 221
**Surface:** mypiggles › Sell › After the sale › Reviews, and Questions people ask
**Filed:** 2026-09-18
**Fixed:** 2026-09-18
**Confirmed by:** P03 · Juniper Row · act 221 (clicked on screen, checked in the database)

## What happened

Sell › Reviews opens on **Waiting**, which was empty, and the empty state told me
to switch to **All**. I did, and there were my two reviews, both **Published**.

Every row offers the same two buttons: a green tick and a crossed-out eye. I
hovered the tick and it said **"Publish it"**, on a review the row beside it
calls Published. I pressed it, because I could not tell whether it meant "put
this on my website" or "this is on your website".

A green message came back: **"Review published."**

Nothing was published. It already was. But something did happen, and it was not
nothing:

|                           | before    | after                      |
| :------------------------ | :-------- | :------------------------- |
| what the row says         | Published | Published                  |
| when I decided it         | 26 August | **18 September**           |
| my record of the decision | one entry | **two, three weeks apart** |

My own history of that review now says I approved it twice. I did not. I pressed
a button that could not do anything, and the console wrote down that I made a
decision I never made.

The same tick sits on every hidden review, and on every question under Questions
people ask.

## How often this is the case, not the edge

Measured 2026-09-18:

|                             |               |
| :-------------------------- | ------------: |
| reviews on the platform     |           129 |
| of those, already published | **111** (86%) |
| waiting for a decision      |            13 |
| questions on the platform   |            65 |
| of those, already published |  **54** (83%) |
| waiting for a decision      |            10 |

So on the screen a shop opens to look at what customers wrote, **six rows in
seven** carry a button whose only effect is to falsify the record of when they
decided.

## Why it happened

`review-service.ts`, the one function every client goes through:

```ts
// Roll the product rating up/down whenever this change adds or removes the
// review from the APPROVED set … Same-status or pending↔rejected moves don't
// affect the aggregate.
if (input.status !== previousStatus && …) {
  await recomputeProductRating(…);
}
…
if (input.status === 'approved' && change.previousStatus !== 'approved') {
  await publishCommerceEvent({ topic: 'review.published', … });
}
```

**The question is asked twice in this function and answered correctly both
times.** The rating roll-up asks it. The event asks it. The comment says it out
loud: _same-status moves don't affect the aggregate_.

The three things above them do not ask it. The row update stamps `moderatedAt`,
the moderation log writes another entry, and the audit log writes a change from
`approved` to `approved` — every time, whether or not anything moved.
[[feedback_a_fix_leaves_its_neighbour_behind]] again, inside a single function.

`moderateQuestion` has the same split: its event guards on the previous status,
its audit log does not.

And the two bulk helpers say in their own comments **"Returns how many actually
changed"**, then count every id that did not throw. Select three published
reviews, press Show, and the toast says "Shown (3)".

## Why the screen offered it at all

Four screens in each console draw the pair — the reviews table, the reviews
queue, the questions table, the questions queue — and none of them looks at the
row's status before drawing it. The queue is the sharp version: it reads
`questionState(question.status)` into a variable, paints the status badge with
it, and then draws both decisions underneath as though it had never asked.

## The fix

**Two levels, because either alone leaves the other wrong.**

1. **A decision that changes nothing is not recorded as a decision.**
   `moderate` and `moderateQuestion` now return `{ changed }` and stop before
   writing anything when the status is already what was asked for and the note
   has not moved. Nothing is stamped, nothing is logged, no event fires. This is
   the single point of change: it holds for the console, the bulk paths, the MCP
   tools and anything written later.

   A same-status call **with a new note** is still a real decision and still
   recorded, because the note is the thing that changed.

2. **A screen does not offer a button that cannot do anything.** One shared
   `moderation-decisions.ts` in each console decides what a row may do:

   | the row says    | what it offers    |
   | :-------------- | :---------------- |
   | Waiting for you | Publish it · Hide |
   | Reported        | Publish it · Hide |
   | Published       | Hide              |
   | Hidden          | **Show it again** |

   "Show it again" rather than "Publish it", because from her side the second
   showing is not a first publication.

3. **The bulk toast counts what moved.** `moderateMany` counts only the ids that
   changed and reports the rest, so a selection of three already-shown reviews
   now says "Nothing to change. All 3 were already shown" instead of "Shown (3)".

## Guard

`moderation-decisions.test.ts` in each console, **12 tests**. The two that are
rules:

```ts
it('never offers a decision the row is already in', …)
it('says "again" for one being brought back, not "publish"', …)
```

Proved red by putting the stateless pair back: **5 of 12** fail.

`review-moderation-noop.test.ts` in api-rest, **5 tests**, driven through the
real service against the database:

| the test                            | proves                                         |
| :---------------------------------- | :--------------------------------------------- |
| approving an approved review        | no second log entry, `moderatedAt` untouched   |
| approving it with a new note        | still recorded, because the note is the change |
| hiding an approved review           | the ordinary path still writes everything      |
| bulk-showing two, one already shown | `count` is 1 and `unchanged` is 1              |
| showing an already-shown question   | one audit entry, not two                       |

Proved red by putting the unconditional writes back: **3 of 5** fail, and the
4 older review tests in `product-reviews.test.ts` all still pass with the fix in,
so nothing the earlier work guaranteed has moved.
