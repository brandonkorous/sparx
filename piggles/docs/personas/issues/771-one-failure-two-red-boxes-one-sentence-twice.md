# 771 — One failure, two red boxes, and one of them said it twice

**Status:** fixed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 272
**Surface:** platform — the failed-write net, both consoles
**Filed:** 2026-09-22
**Fixed:** 2026-09-22
**Confirmed by:** P03, failing the same write again and counting the toasts
**Blocked on:** —

## What happened

One press of **Send to the warehouse**. Two red boxes, stacked:

```
⊗ Could not create a walk
  Nothing on this order is a product you stock, so there is no shelf
  to walk to. Put the product on the line, or send it by hand…

⊗ That didn't save
  That didn't save. Check what you entered and try again.
```

The second one is wrong twice over. It says the same sentence as its own title,
one line apart. And it should not have been there at all: the pane had already
said what happened, in better words, with the way out on it.

## Why: a try/catch is invisible to the net

The failed-write net is careful and its header says exactly what it is for:

> Announce it ONLY if nobody else did. A mutation with its own `onError` has a
> call site that owns the conversation… Toasting on top would say the same thing
> twice and teach people to ignore both.

It decides that by watching for an `onError` handler:

```ts
handlers.onError = typeof callOptions?.onError === 'function';
```

But a call site that awaits `mutateAsync` in a `try`/`catch` passes no
`callOptions` at all. It caught the error, it said something specific about it,
and to the watcher it looked exactly like a call site that had said nothing.

MEASURED 2026-09-22 in one console: **113 `mutateAsync` call sites, of which 2
pass an `onError`.** At least 46 sit inside a `try`.

## Why: the body repeated the title

`writeFailureTitle` is one of three sentences — `Couldn't <do the thing>`,
`Couldn't save <the thing>`, or, when the mutation named neither, `That didn't
save`. Eight of the bodies underneath it also opened with "that didn't save",
so under the third title every one of them printed it twice.

(That third title is also the one almost everything gets, which is the carried
`WriteMeta.writing` adoption — 1,411 mutations that name neither.)

## What was done

**`mutateAsync` is a caller holding the error, by definition.** That is the
whole difference between it and `mutate`: `mutate` swallows the rejection, so a
caller who passes no `onError` really has said nothing and the net must speak.
`mutateAsync` hands the rejection over — the caller either caught it and said
their own thing, or did not and has an unhandled rejection, which is a fault at
the call site rather than a silent write. Either way the net speaking on top is
the duplicate its own header warns about.

This is not the "cannot tell, so speak" case the package's tests describe. It
can tell: the two functions are different functions. The crash report stays
unconditional, so nothing goes unseen by us.

**Five fire-and-forget calls became `mutate`.** `void x.mutateAsync(…)` discards
a promise that can reject; it meant `x.mutate(…)`, which is the API for not
waiting — and those five keep the net, which they would otherwise have lost.

**Every body stopped repeating its title.** The title says it did not save; the
body says why and what to do.

| was                                                                               | is                                                           |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| That didn't save. Check what you entered and try again.                           | Check what you entered and try again.                        |
| Something went wrong on our end, so that didn't save. Nothing you typed was lost. | Something went wrong on our end. Nothing you typed was lost. |
| You've been signed out, so that didn't save. Sign in again…                       | You've been signed out. Sign in again…                       |
| You're not connected to the internet, so that didn't save…                        | You're not connected to the internet…                        |

## Files

- `wizeworks/packages/query/src/mutation.ts`, `mutation.test.ts`
- `piggles/apps/workbench/lib/api/write-failure.ts`, `write-failure.test.ts`, `sparx/…`
- `piggles/apps/workbench/surfaces/inventory/pick-list-detail.tsx`, `surfaces/studio/publish-gaps.tsx`, `theme-actions.tsx`, `theme-library.tsx`, `sparx/apps/workbench/surfaces/inventory/pick-list-detail.tsx`

## Proof

The same failure, after. One box:

```
⊗ Could not create a walk
  Nothing on this order is a product you stock, so there is no shelf to
  walk to. Put the product on the line, or send it by hand from the order
  itself.
```

Both guards were proved red by putting the bug back:

```
× treats every `mutateAsync` as a caller holding the error
× never says the thing did not save, because the title just did
+   "That didn't save. Check what you entered and try again.",
```

The second one renders every failure this module can produce — offline, network,
401, 403, 404, 409, 412, 422, 429, 500, 503 — and fails on any body that says
the thing did not save, because the title already did.
[[feedback_a_test_that_cannot_go_red]]
