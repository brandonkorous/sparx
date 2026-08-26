# 226 — A link to somebody else's record spins for ever

**Status:** open
**Severity:** minor
**Found by:** P03 · Juniper Row · act 7 — the RULE #7 neighbour check
**Surface:** mypiggles, any detail pane reached by address
**Filed:** 2026-08-25
**Blocked on:** scope

## What happened

The standing check: paste another business's record id into the address bar and
confirm nothing comes back.

Nothing came back — and nothing else did either. `mypiggles.com/commerce/returns/a71e43c0…`,
an id belonging to **Threadline**, opened a pane that showed the mascot and
**"Just a moment…"**, and went on showing it. Thirty seconds. A minute.

The same for another tenant's ORDER (`0c6f80e7…`, Halo & Hem) and for an id that
belongs to nobody at all (`00000000-0000-4000-8000-000000000000`).

## The part that matters is fine

**There is no leak.** api-rest answers all three with a clean refusal:

```
404  {"success":false,"error":{"code":"NOT_FOUND",
     "message":"ReturnRequest a71e43c0-… not found", …}}
```

Row Level Security holds. Devi cannot see Threadline's returns, Halo & Hem's
orders, or anything else that is not hers, and the run continues.

## What should have happened

The console already owns the right answer and shows it beautifully elsewhere:

> **Could not load this return**
> This is a problem reaching the server. The return itself is unaffected —
> nothing has been changed or lost. **[ Try again ]**

That, or a plainer "there is nothing here". Either is a way onward. A spinner
that never stops is a dead end, and the person is left deciding whether to keep
waiting.

## What was ruled out

- Not the deep link mechanism. An order of Devi's own that had **never been
  opened in this browser** (`cca38202…`, O-000002, Tessa Wren, $101.95) resolved
  from the address bar immediately and completely.
- Not a slow retry. The shared query client is `retry: 2` with the default
  backoff, which settles in about three seconds.
- Not the server. All three ids answer 404 in milliseconds when asked directly
  from the same page with the same token.
- Not a crash. The pane error boundary has its own screen and it never appeared,
  and the browser console is clean apart from an unrelated React warning about a
  `value` prop with no `onChange`.

Both `OrderDetailSurface` and `ReturnDetailSurface` test `isError` **before**
`isPending`, so an errored query should reach `PaneLoadError`. It does not, and
`PaneWaiting` is also the `<Suspense>` fallback in
[surface-mount.tsx](../../../../piggles/apps/workbench/components/surface-mount.tsx),
so the two are indistinguishable on screen — which is itself part of why this is
hard to place.

**The cause is not isolated.** Recording that rather than guessing (CLAUDE.md
RULE #4).

## Why it is not fixed here

It reproduces on every detail pane in the console, for any id that does not
resolve, and the fault is in the dock or the query layer rather than in the
returns and orders surfaces this act was testing. **Blocked on: scope.**

What it would take: find why an errored query leaves the pane in the waiting
branch, then give the two states different pictures so a hang and a slow load
can be told apart at a glance.

## Rating effect

Not scored — it is a state no pane currently escapes from, so it belongs to the
chassis rather than to any one surface. Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
