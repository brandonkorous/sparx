# 563 — One screen asked the API 675 times, and took the whole console down

**Status:** fixed and proven
**Severity:** critical
**Found by:** Devi, when every pane in the console stopped loading at once
**Surface:** `piggles|sparx/apps/workbench/surfaces/inventory/picking-data.ts`
**Filed:** 2026-09-16
**Family:** [[feedback_a_fix_leaves_its_neighbour_behind]] · [[feedback_verify_capability_in_code_not_docs]]

## What she saw

Mid-way through an ordinary afternoon of clicking around Stock, the console
stopped working. All of it:

> **Could not load your counts**
> This is a problem reaching the server. Your counts are unaffected: the list
> just could not be read just now.

The tenant name went out of the top bar. "Working out the numbers…" never
finished. Every pane said something different and all of them meant the same
thing: nothing is loading.

Nothing was wrong with her network, her computer, or the server.

## Measured

Every `/v1/*` call was answering **500**, with these headers still attached:

```
x-ratelimit-limit: 600
x-ratelimit-remaining: 0
retry-after: 50
```

The API's budget is 600 requests a minute per IP. **One open screen had spent
it.** Network log for a single report endpoint, on one tab:

|                                             |                     |
| ------------------------------------------- | ------------------- |
| `GET /v1/inventory/reports/pick-throughput` | **675 requests**    |
| Two consecutive calls, apart                | **16 milliseconds** |

## The cause

`PickThroughputSurface` computed its window in the render body:

```tsx
const from = new Date(Date.now() - days * DAY_MS).toISOString();
```

and handed that string to the hook, which put it in the query key:

```ts
queryKey: pickKeys.throughput(query),   // query.from = "…T20:04:55.517Z"
```

An ISO string carries **milliseconds**. Every render produced a key react-query
had never seen, so it fetched; the fetch settled, which re-rendered; the
re-render read the clock again and minted another key. A closed loop with no
brake.

**Nothing looked wrong while it ran.** The hook sets
`placeholderData: (previous) => previous`, so the last good result stayed on
screen. The screen was serene and the API was on fire.

### It had been found and fixed six times already

`rangeForDays` is the shared helper for exactly this. Every one of its six call
sites carries a `useMemo` and the same warning:

> _Memoised on the preset alone: rangeForDays reads the clock, so recomputing it
> every render would mint a fresh query key each time and refetch forever._

Pick throughput did not use the helper. It wrote the same two lines by hand, and
so it never got the fix — [[feedback_a_fix_leaves_its_neighbour_behind]], and
this time the neighbour took the API down with it.

Swept both consoles for the shape: 79 render-time `Date` bindings, 9 of which
reach a hook call. Seven are safe (`useMemo`-wrapped, or day-precision via
`toDateInput`, which is `.slice(0, 10)`). The two that were not are the two
fixed here.

## The fix

**The hook takes a number of days, not a timestamp.**

A `useMemo` at the call site would have fixed this instance and left the trap
open for the next caller. Changing the signature closes it: `days` is a small
integer, the window is worked out inside `queryFn` where nothing keys on it, and
the clock is read when the request is made rather than on every paint. It is
the same shape `usePageResults` already uses in the builder.

## Proven

Same screen, same tab, network log cleared and the page left open:

|                                       | before  | after                           |
| ------------------------------------- | ------- | ------------------------------- |
| Requests on load                      | —       | **1** (plus its CORS preflight) |
| Requests accumulated                  | **675** | —                               |
| Requests in the next 30 seconds, idle | many    | **0**                           |

Both consoles typecheck; lint and prettier clean.

## What it exposed

The console never told her any of this. It said "a problem reaching the server",
which is what it says for a network fault. The API knew the real answer, put it
in a header, and then threw it away — see
[564](564-rate-limited-came-back-as-an-internal-error.md).
