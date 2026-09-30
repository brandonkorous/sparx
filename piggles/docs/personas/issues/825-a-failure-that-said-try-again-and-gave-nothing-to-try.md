# 825 — A failure that said "try again" and gave nothing to try

**Status:** fixed
**Severity:** correctness
**Found by:** P03 · Juniper Row · act 281
**Surface:** mypiggles workbench — the four Ship-direct panes
**Filed:** 2026-09-25
**Fixed:** 2026-09-25
**Confirmed by:** seen on screen as Devi
**Blocked on:** —

## The app is well written and three of its four screens could not fail well

Ship-direct is the app for goods another business holds and posts straight to
your customer. Its hardest job is explaining that it is NOT the suppliers you
already buy from, and every one of the four panes does it, in a sentence:

> These are goods another business holds and posts straight to your customer.
> That is a different arrangement from the suppliers you buy from and put on
> your own shelves.

The fourth one, Profitability, goes further and answers the next thing a person
would do before they do it:

> …you have not set one up, so there is nothing to weigh. **A longer period
> above will not change that.**

That is very good work. What sat under it was not.

## Try again, with nothing to try again with

Every one of the three list panes handled a failed read like this:

```tsx
{error ? (
  <EmptyState
    icon={…}
    title="Could not load your suppliers"
    description="Something went wrong reaching the server. Try again in a moment."
  />
```

A bare silica `<EmptyState>` — so no retry button, and no brand artwork where
every other failure in this console draws it. The only way out of a failed read
was to reload the whole workspace, which throws away every other pane a person
has arranged.

The sentence also told them the server was unreachable whatever the server had
actually said. `PaneLoadError` takes the error and tells a MISSING thing from an
UNREACHABLE one, and owns the rule that a missing thing gets no retry button
because there is nothing to retry. All three pass it now.
[[feedback_one_outcome_two_causes]]

## And two empty states with no picture

`products-list` drew both of its empty states — "no suppliers connected" and
"nothing matches" — as bare `<EmptyState>`s, directly beside a LOADING state
that draws the brand's own artwork. So the pig appeared while you waited and
vanished when the answer arrived.

`PaneEmpty` with the app's module now, which is what `profitability.tsx` was
already doing four files away.

## Files

- `piggles/apps/workbench/surfaces/dropship/{suppliers-list,products-list,orders-list}.tsx`

## Noted

`dropship.analytics` needed nothing. It was the only one of the four already
using the house components, and it is the only one whose empty state answers the
question a person asks next. Worth reading before writing another.
