# 581 — Blamed for a filter I never touched

**Status:** fixed and proven on screen
**Severity:** medium
**Found by:** Devi, on Sell → Questions people ask
**Surface:** `piggles|sparx/apps/workbench/surfaces/commerce/{qa-list,reviews-list,moderation-empty}.ts*`
**Filed:** 2026-09-16
**Family:** [[feedback_a_fix_leaves_its_neighbour_behind]] · [[feedback_never_present_absence_as_measurement]] · [[feedback_one_outcome_two_causes]]

## What she saw

She opened Questions people ask. She typed nothing and touched no control:

> **Nothing matches those filters**
> Try a different word, or switch the filter back to All.

There was no word to try and no filter to switch back.

## Why

```ts
const [status, setStatus] = useState('pending');
const anyFilter = search.trim() !== '' || status !== 'all';
```

The pane OPENS on the waiting queue, which is the right default — the reason to
click Questions is almost always "is anything waiting on me". And `anyFilter` is
therefore **true the instant the pane loads**.

The sibling pane in the same folder — Reviews, same queue idea, same `pending`
default — already fixed exactly this, and left the rule in a comment:

> _THREE STATES, NOT TWO … A filter the PANE set is not a filter the person set._

Questions was the neighbour left behind. Fifth time this run.

## The third state the first fix still missed

Reviews got two of the three right and kept a sentence with the same shape one
level down:

> **Nothing waiting for you**
> No review is waiting to be published. **Switch the filter to All to see the
> ones already on your website.**

That points at a second empty screen for a shop that has never had one — the same
defect as [570](570-every-request-has-been-answered-over-a-queue-nobody-has-ever-used.md),
where the time-off queue offered "Switch to Everything" over nothing.

```sql
select count(*), count(distinct tenant_id) from commerce_product_questions;  -- 65 rows, 10 tenants
select count(*), count(distinct tenant_id) from commerce_product_reviews;    -- 129 rows, 10 tenants
select count(*) from tenants where settings->'modules'->'commerce'->>'enabled' = 'true';  -- 43
```

**43 shops have the store switched on and only 10 have ever had a question or a
review.** The other 33 would be sent to an empty second view.

## The fix

One pure module, `moderation-empty.ts`, serving both panes in both consoles, with
four states rather than two:

| state                                                | now says                                                                                                                   |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| a word the person typed                              | **Nothing matches those filters** — the one case where "try a different word" is real advice                               |
| nothing has ever arrived                             | **No questions yet** — "Nobody has left one. When a customer asks a question about one of your products, it appears here…" |
| the queue the pane opened on, with history behind it | **Nothing waiting for you** — "…Switch the filter to All to see the ones already on your website."                         |
| a status the person chose                            | **Nothing matches those filters**                                                                                          |

The "ever" count is a `take: 1` probe on the same endpoint with no status, gated
so it only fires when the answer could matter (the list came back empty and
nothing was typed). A queue with rows in it makes no extra request at all, and
`enabled` stays OUT of the query key — it says whether to ask, not what was
asked. The list's own `total` could never answer it, because it carries the
filter ([572](572-two-more-empty-queues-that-said-the-work-had-been-done.md)).

**Now**, verified in the browser, on both panes:

> **Nothing waiting for you**
> No question is waiting to be published. Switch the filter to All to see the
> ones already on your website.

## Proven

**`moderation-empty.test.ts`** — 9 tests, both consoles, including a property
that states the rule as a rule: "those filters" may appear only when the reader
typed a search or moved the status off the one the pane opened with, **except**
that a business with nothing at all is told so whatever the status, because no
filter can conjure a review nobody wrote.

Reinstating the original condition:

```
× does not blame a filter nobody set
    question: expected 'Nothing matches those filters' not to be 'Nothing matches those filters'
× says the queue is clear when there is history behind it
× does not send somebody to a second empty screen
    question: expected 'Try a different word, or switch the f…' to contain 'Nobody has left one'
× is still not reported as one when nothing has ever arrived
× name the right thing for each pane
× keeps the singular singular on the waiting queue
× never blames a filter the reader did not set
```

**7 of 9 red.**

## Checked and cleared

The other panes carrying "Nothing matches those filters" were swept for the same
shape. Three more open on a non-`all` default — invoicing workflows (`active`),
help requests (`open`) and booking series — and all three already compare against
their OWN default rather than against `'all'`, so none of them reports the
opening view as a filter. Only Questions had it.

|                 |                         |
| --------------- | ----------------------- |
| piggles console | **470 pass** (55 files) |
| sparx console   | **372 pass** (46 files) |
| typecheck       | both exit 0             |
| lint / prettier | clean                   |
