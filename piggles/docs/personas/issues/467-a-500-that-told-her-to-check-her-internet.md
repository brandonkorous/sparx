# 467 — A 500 that told her to check her internet

**Status:** fixed
**Severity:** major
**Found by:** waiting out the "By job" failure in [464](464-a-screen-that-answered-500-because-a-query-named-a-field-that-does-not-exist.md)
**Surface:** `<PaneLoadError>` — every pane in both consoles
**Filed:** 2026-09-09

## What was wrong

After about twenty-five seconds of retrying a request that answered **500**, the
pane finally said:

> **Could not work out what each job made**
> The server could not be reached. Nothing you have recorded is affected.
> [Try again]

The server was reached. It answered in 57 milliseconds. Its answer was that it
had failed.

A shop owner reading "the server could not be reached" goes and looks at her
internet, then her router, then rings somebody. None of it can help, because
nothing at her end is wrong.

## The same shape as issue 286, one cause later

`paneLoadReason` had two answers:

```ts
return isNotFound(error) ? 'missing' : 'unreachable';
```

Issue 286 split `missing` out of `unreachable`, because a 404 came back in
milliseconds and the screen said the server could not be reached, over a "Try
again" that could only ever fail.

**A 5xx is the third cause, and it was still wearing the first one's sentence.**
One outcome covering two causes whose remedies differ is exactly what sends
somebody off to redo work that was never the problem.

## The fix

Three states, not two:

| reason        | what happened                      | what to do                        |
| ------------- | ---------------------------------- | --------------------------------- |
| `missing`     | a 404 — the thing is gone          | go back; retry is hidden entirely |
| `failed`      | a 5xx — the server answered, badly | retry, but the fault is ours      |
| `unreachable` | nothing answered at all            | retry; it may well work           |

The sentence for the new one is owned by the component, not the call site, for
the same reason the "gone" sentence already is: **every caller's own description
is written about the unreachable case**, so a 5xx wearing it is wrong in a
hundred places at once. Fixing it at the component means one edit reaches all of
them, and no call site had to change.

> Something went wrong at our end, not yours. Nothing you have recorded has
> changed. Trying again may work, and if it keeps failing the fault is ours to
> fix.

Retry stays offered, because some 5xx really are momentary. Only the claim about
the connection goes.

| breaking                                    | reddens                                     |
| ------------------------------------------- | ------------------------------------------- |
| removing the 5xx branch in `paneLoadReason` | 2 — `expected 'unreachable' to be 'failed'` |

## Measured on the way, and NOT filed as a defect

While the failing request retried, the pane went on showing the PREVIOUS
filter's rows. Clicking "Appointments" listed two orders, under a highlighted
"Appointments" chip, for about twenty seconds.

That is `placeholderData: (previous) => previous`. Measured with the real library
rather than guessed:

```
DURING the failing fetch:  status 'success' · isError false · isPlaceholderData TRUE  · data = the OLD rows
AFTER it gives up:         status 'error'   · isError true  · isPlaceholderData false · data undefined
```

So the pane is told, correctly, that what it is holding is a placeholder — and
**none of the 155 call sites that use this pattern reads that flag.**

I am not filing 155 defects. Keeping the previous rows while the next answer
loads is a deliberate and generally right pattern (it is why the option exists),
the refresh button already reads as busy throughout, and at normal speed the
window is a few hundred milliseconds and invisible. What made it harmful here was
that the request could never succeed — and that is fixed in 464.

Recorded because the measurement is the useful part: **the console's stale-data
window is exactly as long as a failing request's retry ladder**, and it presents
that stale data as a success. If a second screen is ever seen misleading someone
this way, this is the mechanism, and `isPlaceholderData` is the flag nobody
reads.
