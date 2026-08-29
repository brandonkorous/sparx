# 287 — The order that would not load just said "Just a moment…" forever

**Status:** fixed
**Severity:** major (a pane that never resolves; the owner is left waiting on
something that will never arrive, with nothing to press and nothing to read)
**Found by:** P03 · Juniper Row · while re-proving [286] on a second pane
**Surface:** the console — Sell › an order. And every other pane whose data hook
does not turn retries off for a 4xx
**Filed:** 2026-08-27
**Confirmed:** 2026-08-27

## What happened

[286] was fixed and re-proved on a product. The same move on an **order** did not
reach an error message at all:

```
http://localhost:3022/commerce/orders/6ed18f0e-…      (Thistle & Rye's O-000001)
```

The pane opened, drew the pig, and said **"Just a moment…"**. It was still saying
it several minutes later. No error, no "not here", no Try again — just a spinner
with no end.

Reproduced with an id that belongs to nobody at all
(`11111111-2222-3333-4444-555555555555`, which comes back 422), so this is not
about another business's record. **Any order that cannot be loaded hangs the
pane.** Devi's own order O-000007 opens instantly from the same address bar, so
the route and the surface are fine.

## Why this is worse than [286]

[286] told her something false and gave her a button that could not work. This
tells her nothing and gives her nothing. A spinner is a promise that something is
coming. Waiting is the one response a person cannot argue with, so she will sit
there, then reload, then sit there again.

It also swallows the whole point of the pane's own error branch, which is written
correctly a few lines above and never runs.

## Where it lives

Measured in the running page rather than guessed. The four queries behind the
pane, read out of the live query cache:

```
["commerce","orders","11111111-…"]              status: pending   fetchStatus: paused   failureCount: 1
["commerce","orders","11111111-…","payments"]   status: pending   fetchStatus: paused   failureCount: 1
["commerce","orders","11111111-…","fulfillments"] …same
["commerce","orders","11111111-…","refunds"]      …same
```

Each one asked once, was refused, and then **stopped** — `paused`, not `error`.
`status` never leaves `pending`, so `isPending` stays true and `isError` never
becomes true:

```tsx
if (isError) { …the error state, which never renders… }
if (isPending || !order) return <PaneWaiting />;     // ← forever
```

Four requests went out, one each, and no retry ever followed:

```
GET /v1/orders/11111111-…               422
GET /v1/orders/11111111-…/payments      422
GET /v1/orders/11111111-…/fulfillments  422
GET /v1/orders/11111111-…/refunds       422
```

The shared default is `retry: 2`
([wizeworks/packages/query/src/query-client.ts](../../../../wizeworks/packages/query/src/query-client.ts)),
so a failure schedules a retry — and a retry that cannot start is held in
`paused` rather than failed. The pane is waiting on a retry that never runs.

**The product pane is not affected, and the difference is one line.**
`useProduct` refuses to retry a 404:

```ts
retry: (failureCount, error) =>
  error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
```

so it goes straight to `error` and renders. `useOrder` has no such guard, and
neither does most of the console. One hook got it right and became the only pane
that recovers.

## The fix

Retrying a 4xx is pointless everywhere, not just here: the request was refused
for a reason that will still be true a second later. So the guard belongs in the
shared defaults rather than being copied into every hook — the same single point
of change as [286].

`DEFAULT_QUERY_OPTIONS` gains a retry policy: never retry a 4xx except **408**
(timed out) and **429** (asked to slow down), which are the two that genuinely
change on their own. Anything with no status — a real network failure — keeps its
retries, which is what retries are for.

It reads the status structurally rather than importing `ApiError`, so the query
package gains no dependency and nothing has to be reinstalled mid-run.

**This is `wizeworks/`, so it lands on both consoles.** That is the right home
for it: "a refused request is not worth asking again" is a fact about HTTP, not
a brand's opinion. Every pane in both products that branches on `isError` gets to
reach that branch.

## Confirmed on the same two ids

Opened again from the address bar, as Devi, in the same browser:

| Pasted                                         | Answered | Before                       | After                                                                       |
| ---------------------------------------------- | -------- | ---------------------------- | --------------------------------------------------------------------------- |
| `/commerce/orders/6ed18f0e…` (Thistle & Rye's) | 404      | "Just a moment…" with no end | **That order is no longer here**, with the not-found pose ([286]'s wording) |
| `/commerce/orders/11111111-2222-…`             | 422      | "Just a moment…" with no end | "Could not load this order", with a **Try again** that is worth pressing    |

The 422 landing on the retryable wording is correct: it is not a 404, so nothing
claims the order is gone. Her own order O-000007 still opens and renders in full,
which is the case a retry policy is easiest to break.

## What this does not fix

The pause itself. A **5xx** still schedules a retry, and a retry that cannot
start is still held rather than failed — so a server error could in principle
park a pane on its waiting state the same way. Nothing in this run produced one,
so it is recorded rather than claimed, and it is a much rarer road than a 404.
