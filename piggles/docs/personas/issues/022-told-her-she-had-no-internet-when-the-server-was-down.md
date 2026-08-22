# 022 — It told her she had no internet. The server had returned 503

**Status:** fixed
**Severity:** major
**Found by:** P01 · Thistle & Rye · act 7 — saving the About page
**Surface:** mypiggles › every screen that saves anything
**Filed:** 2026-08-20
**Fixed:** 2026-08-20
**Confirmed by:** — (see "What is not confirmed")

## What happened

Marisol pressed **Save** on the About page. A red panel came up:

> **That didn't save**
> You're not connected to the internet, so that didn't save. Check your
> connection and try again — what you typed is still here.

She was connected. The console was live, the site preview beside it was loading,
and the very next click loaded another page from the same server. What actually
happened is on the wire:

```
PUT     /v1/builder/pages/37ef8670-…/silica   503
OPTIONS /v1/builder/pages/37ef8670-…/silica   503
```

The API answered **503** — and because the CORS preflight got the same 503, the
browser handed the console a bare `TypeError: Failed to fetch`, which is the
identical rejection a dropped Wi-Fi link produces.

## What should have happened

Say the true thing, and give advice that works:

> We couldn't reach Piggles just then, so that didn't save. Your connection
> looks fine, so this is probably us — wait a moment and save again. What you
> typed is still here.

## How to reproduce

Any write while the API is down or restarting:

1. Stop or restart `api-rest`.
2. Change anything in the console and press Save.
3. The panel says you are not connected to the internet.

## Why it matters

**The message sends her to fix something that was never broken.** She restarts
the router, waits for it to come back, signs in again, tries once more — several
minutes spent on a problem that was ours and that a ten-second wait would have
cleared. Every one of those minutes she is also being told, by implication, that
the fault is at her end.

It is the same shape as [008](008-it-told-her-to-do-two-things-she-had-just-done.md):
one outcome, two causes, one remedy printed — and the printed remedy is the
wrong one for the cause that actually fired.

The file that produced it is not careless — it is the best-written error module
in the console, it explains itself, and it says exactly what it is doing:

> "`fetch` rejects with a bare TypeError for DNS failures, refused connections,
> and a dropped Wi-Fi link alike — indistinguishable from each other and, for the
> operator, all the same event."

Indistinguishable to us, yes. **Not the same event to her**, because the two
causes have different fixes. That is the line worth keeping: where one outcome
has two causes with different remedies, it needs two messages, even when the code
cannot tell which one it is looking at — because it CAN tell, from
`navigator.onLine`, which advice is safe to give.

## Where it lives

`piggles/apps/workbench/lib/api/write-failure.ts` — `isOffline`, which returned
true for `error instanceof TypeError` as well as for `!navigator.onLine`.

## The fix

The two are now separate tests with separate messages:

```ts
/** The browser itself says there is no connection. The one case where "check
 *  your connection" is real advice. */
function isOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

/** The request never reached us, but the connection is fine. */
function isUnreachable(error: unknown): boolean {
  return error instanceof TypeError;
}
```

`offline` keeps its sentence. `unreachable` gets one that blames us, tells her
the connection is not the problem, and asks for the only thing that helps —
waiting a moment and saving again.

## What is not confirmed

The 503 was a real one, caught in passing, and it has not been reproduced on
purpose: doing that means stopping `api-rest`, and the dev stack belongs to
Brandon. What IS confirmed is the diagnosis — the 503 and the preflight 503 are
both in the tab's network log, and the console's exception is the `TypeError`
this branch reads.
