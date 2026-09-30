# 734 — Shown, with nobody answering

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 261
**Surface:** mypiggles + sparx workbench — Questions people ask / Questions & answers
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen: asked a question as a shopper, showed it without answering, found it again under the new view, answered it from there
**Blocked on:** —

## What happened

Opening **Questions people ask**. The filter opens on **Waiting** and says
nothing is. Switching to **All** shows one question, two weeks old, from Tomas
Villalobos, `Published`.

Nothing on the screen says whether anybody replied to it.

## Why it matters

Showing a question and answering it are two separate acts, on purpose: the
queue's own note says you often want to write the answer and read it back
before it goes public. So a question can sit on a product page with silence
underneath it, and that state is one click away from this table — the green
tick in the Actions column publishes a question with no answer, and so does the
bulk **Show** button over a whole selection.

Once it is shown, it is gone. `listPendingQuestions` is
`where: { status: 'pending' }`, so the card queue behind **Work the queue**
never offers it again. **MEASURED 2026-09-19:**

```
GET /v1/commerce/questions   select: { id, productId, body, status, createdAt,
                                       displayName, customer, product }
                             → no answers, no count, nothing
```

So the table could not have shown it even if it wanted to.

**And the rule was already written down, one screen across.** The per-PRODUCT
reviews pane counts `answers.length === 0` and writes "3 questions have no
answer yet" above the list, because the endpoint IT reads includes the answers.
The catalog-wide table — the one the file's own header calls the primary list
surface, "the shape that survives hundreds of questions a day" — read a
different endpoint that selected none. The one screen built for triage across
every product was the one screen that could not see the thing worth triaging.
[[feedback_a_fix_leaves_its_neighbour_behind]]

## What was done

**An `answerCount` on the row**, as a `_count`, not the answers themselves:
the table needs one word, and pulling every answer body for every row to learn
it would be a second table's worth of text down the wire.

**An `unanswered` filter on the endpoint**, beside the `unfinished` flag the
checkout-session list already has for the same reason: answered-ness lives in a
child table, so a caller cannot work it out from a page of rows.

**An Answer column**, from `@lg`. `Answered` and `3 answers` are quiet text;
only **No answer yet** wears a badge, because the whole job of the column is to
pick out the rows still waiting on her. It is `info`, not `warning`: the Status
cell beside it already spends amber on **Waiting for you**, and two amber pills
in one row saying two different things is RULE #4 one hue up from grey.

**A fifth chip, "No answer yet"**, in the same group as the three statuses.
From her side they are five ways of saying which ones she is looking at, and a
second chip row for one question is two controls to read before she can start.
The words match the column exactly, and they state a fact rather than claiming
she owes a reply — which would be wrong for a question she has hidden.

**An empty state for it that is good news.** "Every question has an answer /
Nothing is waiting on a reply from you." The generic branch would have told her
to try a different word she never typed, about a view that is empty because the
work is done. [[feedback_one_outcome_two_causes]]

**A line on the toast at the moment she creates the state**: "It has no answer
yet, so it goes on the page on its own until you answer it." The bulk version
counts exactly the rows that moved AND had nobody's reply, not the rows that
were already shown.

**The answer box no longer promises the wrong thing.** Its placeholder said
"once you show it, everyone reading the product's page sees your answer under
their question" on every question, including ones already shown — naming a step
she had taken and implying her answer stayed private until she took it again.
There are three sentences now, one per state. This matters more after the rest
of the fix than before it: the new view exists precisely to hand her shown
questions, so the sentence that was wrong for them is the one she will read
most. [[feedback_a_promise_in_copy_is_a_contract]]

## The same pane at 360px

Adding a column is what made this worth measuring, and the table was already
broken there. The Question cell carried `max-w-md` — one desktop number, 448px,
wider than the whole pane. **MEASURED at a 360px pane:** the table was **706px**
in a **343px** scrollport, the status badge read "Publis" and the Actions
buttons, the only way to show or hide a question from this list, sat off the
right-hand edge behind a sideways scroll.

It is the give-cell now (`w-full max-w-0 truncate`), so the question takes
whatever the other columns leave and truncates instead of pushing them off, and
the select-checkbox column is hidden below `@sm`. Ticking twenty rows to act on
them at once is not what a phone is for; pressing show or hide on the one in
front of you is.

**706px → 343px. No sideways scroll.**

No `min-w-56` floor with it, deliberately: the floor in `components/table.tsx`
protects a naming column whose siblings are all floored number cells, and here
224px is itself too wide beside a badge and two buttons at 360.

## Checked and NOT a defect

**"Hana Petrov from Marguerite Adeyemi" is right.** The question was asked
through the storefront while a shopper was signed in, so the endpoint attributed
it to that account and kept the signed name beside it. Both halves on purpose —
the account is who to look an order up against, the signed name is the only one
the website ever shows (issue 641).

**The "Asked" column wraps to two lines at some widths.** `whitespace-nowrap`
would fix it and would also trip `check:column-floor`, which would then require
a floor on the give-cell and undo the 360px fit. The column is
`hidden @2xl:table-cell` so it never renders at the width that matters; the
guard is static and cannot know that. "22 minutes ago" over two lines is
legible, and distorting the code to route around a check is worse.

## Files

- `wizeworks/services/api-rest/src/routes/v1/commerce/lists.ts`
- `piggles|sparx/apps/workbench/surfaces/commerce/question-answers.ts` — new
- `piggles|sparx/apps/workbench/surfaces/commerce/question-answers.test.ts` — new
- `piggles|sparx/apps/workbench/surfaces/commerce/qa-list.tsx`
- `piggles|sparx/apps/workbench/surfaces/commerce/qa-queue.tsx`
- `piggles|sparx/apps/workbench/surfaces/commerce/moderation-data.ts`
- `piggles|sparx/apps/workbench/surfaces/commerce/moderation-empty.ts`
- `piggles|sparx/apps/workbench/surfaces/commerce/moderation-empty.test.ts`

## Proof

On screen, end to end, on Juniper Row's own website and console:

1. Asked a question about The Ash Overshirt through the product page's own
   **Ask a question** form.
2. It arrived under **Waiting** with a blue **No answer yet** beside an amber
   **Waiting for you**.
3. Pressed the green tick. Toast: **Question shown on the page** — "It has no
   answer yet, so it goes on the page on its own until you answer it." The row
   left the waiting queue, as it always did.
4. Pressed **No answer yet**. One row: green `Published`, blue `No answer yet`.
   **Before this change that row was reachable from no view that would tell her
   it needed a reply.**
5. Clicked it. The queue opened focused on it with **Answer it**, and the box
   read "It is already on the product's page, so your answer appears under it as
   soon as you post."
6. Answered it. Both rows now read **Answered**, and **No answer yet** reads
   "Every question has an answer."

Both typechecks and ESLint clean across both consoles; all sixteen structural
checks pass. Both new pure modules were proved red by breaking what they guard.
