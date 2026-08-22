# 083 — A link to an order this salon cannot see spun for ever

**Status:** open
**Severity:** minor
**Found by:** P02 · Halo & Hem · standing checks (someone else's business)
**Surface:** mypiggles › Sell › Order
**Filed:** 2026-08-21
**Fixed:** —
**Confirmed by:** —
**Blocked on:** scope — the retry policy is `@wizeworks/query`, shared with sparx

## The security half passed, and that is the headline

Nia was handed a link to an order belonging to **Thistle & Rye**, a different
business in the same database:

```
/commerce/orders/ee8bd403-2dfe-477e-a8c2-58e367e09ad5
```

`GET /v1/orders/ee8bd403…` → **404**. Nothing about Marisol's order reached
Nia's screen: no number, no customer, no total, not even an acknowledgement that
the id exists. Row Level Security did what it is there for.

Two smaller notes, neither a leak:

- The subresources (`/payments`, `/fulfillments`, `/refunds`) answer **200** for
  a foreign order id, where the parent answers 404. They return that tenant's
  own (empty) rows, so no content crosses, but the status codes disagree about
  whether the order exists.
- This could only be tested at all after [082](082-a-link-to-any-screen-in-the-console-opened-nothing-at-all.md)
  was fixed. Before that, deep links opened nothing, so the check would have
  reported "nothing came back" whether or not anything leaked.

## What happened, and what is wrong

The **Order** panel opened, showed the pig and **"Just a moment…"**, and stayed
there. Watched for over thirty seconds across three attempts. No error, no
"this no longer exists", no Try again, no way onward except closing the panel.

The panel is not broken in general: opening one of Nia's own orders from
Sell › Orders renders it fully (SO-91007, Priya Sundaram, $144.40).

## What should have happened

What the People and equipment panel does with the same situation:

> **This no longer exists** — It has been removed. Any bookings already made
> against it are unaffected.

The order panel already has that branch. It renders "Could not load this order"
on `isError`. `isError` never arrives.

## How to reproduce

Every time.

1. Sign in as `p02.nia@piggles.test`.
2. Open `/commerce/orders/<any uuid this tenant does not own>`.
3. Wait.

## Why it matters

A dead end, of the kind an owner cannot reason about. "Just a moment" is a
promise that something is coming; nothing is coming. She is most likely to reach
this by being sent a link to the wrong business's order, or to one that has been
deleted, and in both cases the honest answer is short and already written.

Scored `minor` rather than `major`: no wrong money, no false statement, nothing
lost, and the security behaviour underneath is correct.

## Where it lives

Not in the panel. Instrumented, the query never reaches `error`:

```
status: pending   fetchStatus: fetching   failureCount: 0
status: pending   fetchStatus: fetching   failureCount: 1
      failureReason: ApiError: Order ee8bd403… not found
status: pending   fetchStatus: paused     failureCount: 1   navigator.onLine: true
```

**`fetchStatus: paused` after the first failure, and it never resumes.** The
query is left permanently `pending`, which is precisely `isPending && !order` —
the branch that renders "Just a moment…".

`DEFAULT_QUERY_OPTIONS` in
[wizeworks/packages/query/src/query-client.ts](../../../../wizeworks/packages/query/src/query-client.ts)
sets `retry: 2` with the default `networkMode: 'online'`, so a failed attempt is
retried and a retry is paused whenever the query layer believes there is no
connection. `navigator.onLine` says otherwise, so what the query layer believes
and what the browser reports have diverged.

**Honest limit on this diagnosis:** I could not rule out the automated browser as
the cause of the pause — the tab had been navigated repeatedly by tooling, which
is a plausible way to produce a stale offline belief that a person's browser
would not. What is NOT in doubt is the screen: three attempts, thirty seconds
each, permanent "Just a moment…". What would settle it is opening the same link
by hand in an ordinary window.

## The fix, not made here

**A 404 should not be retried at all.** "Not found" will not become found by
asking again, so the retry is pointless whether or not it pauses — and skipping
it removes the pause window entirely, sends the panel straight to its "this no
longer exists" branch, and drops two wasted requests from every mistyped link.

That is one predicate on the shared query client
(`retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2`),
which is `@wizeworks/query` — shared with sparx, so outside the surface under
test. Doing it per pane instead would be a call-site patch of a policy that
belongs in one place (root RULE #1), and there are dozens of panes.

## Confirmed by

—
