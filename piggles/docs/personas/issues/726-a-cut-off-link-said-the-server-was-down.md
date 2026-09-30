# 726 — A cut-off link said the server was down

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 256
**Surface:** mypiggles + sparx workbench — `paneLoadReason`, and the 43 panes that were not asking it
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen: a malformed id now reads "That item owed is no longer here" with no Try again
**Blocked on:** —

## What happened

Found while opening **Owed** from a hand-typed address, to see what the pane
does with no record. The id was not a well-formed one, and the pane said:

> **Could not load what is owed**
> It may have been canceled, or the server is unreachable. Nothing anyone is
> owed has changed.
>
> [ Try again ]

The server was not unreachable. It answered in 30 milliseconds, with **422**:
that is not an id. Pressing Try again sends the same bad address again and gets
the same answer, forever.

## Why it matters

`paneLoadReason` in `lib/api-error.ts` exists precisely to stop this, and its
own header has two paragraphs about it:

> `<PaneLoadError>` has always been able to tell these apart and defaulted to
> `unreachable`, which is a CLAIM: a 404 came back in milliseconds and the
> screen said the server could not be reached, over a "Try again" that could
> only ever fail (persona issue 286).
>
> A 5xx is the THIRD case, and it was wearing the first one's sentence. The
> server WAS reached; it answered, and its answer was that it had failed
> (persona issue 467).

Two cases split out, one paragraph each, and a fourth left in the default:

```
404  → missing     ✔ issue 286
5xx  → failed      ✔ issue 467
422  → unreachable ✘
400  → unreachable ✘
```

A 400 or a 422 on a READ is a 404 wearing a different number. It reaches a
person the way a truncated id in a pasted link reaches them, which is the same
route issue 286 was written about.
[[feedback_a_fix_leaves_its_neighbour_behind]]

## And then the fix did not reach the pane it was found on

Putting the order's own address back after the change, the pane STILL said the
server was unreachable. `purchase-order-detail.tsx` does not ask
`paneLoadReason` at all:

```tsx
const gone = isNotFound(detail.error);
<PaneLoadError reason={gone ? 'missing' : 'unreachable'} … />
```

That is the two-case logic, decided at the call site, from a 404-only test.
**MEASURED 2026-09-19: 43 call sites across the two consoles do it.** Every one
of them was still answering issue 286 and neither of the two splits that came
after: a 500 reads "the server could not be reached" on all 43, which is exactly
what issue 467 was filed about and is still live wherever the call site decides.

`<PaneLoadError>` was built for this. It takes `title`/`description` for the
reachable case and `missingTitle`/`missingDescription` for the gone one, and
works the reason out from `error` itself. Forty-three panes reimplemented the
branch by hand instead of handing it the error.
[[feedback_a_fix_leaves_its_neighbour_behind]]

## What was done

`paneLoadReason` now calls a 400 and a 422 **missing**, in both consoles. The
existing missing copy already covered the case without a word changing: "It has
been deleted, **or the address points at something that is not in this
business**." And `PaneLoadError` drops the retry button on `missing`, so the
button that could never work is gone.

**403 stays where it was**, and the code says so: the thing IS there and
somebody simply cannot open it. Calling that deleted would be a different lie.

**All 43 call sites hand the verdict back.** 38 by a codemod whose output was
read line by line, 5 by hand because they test for missing in their own way
(`isCountNotFound`, `isFeedbackNotFound`, a raw status check on a post). The
flags and imports that fed them are gone with them.

A LITERAL `reason="missing"` is still allowed and 10 panes use it: those know,
with no error to read, because there is no id in the address at all.

Two tests added, and the existing 403 one kept and renamed, because it had been
recording "unchanged by this split" rather than a decision.

**`scripts/check-load-error-reason.mjs`** — new, wired into
`pnpm check:load-error-reason` and pre-push. A pane may hand over the error and
the words; never the verdict.

## Files

- `piggles|sparx/apps/workbench/lib/api-error.ts`
- `piggles|sparx/apps/workbench/lib/api-error.test.ts` — 2 new, 1 reworded
- 43 surfaces across both consoles
- `scripts/check-load-error-reason.mjs` — new, wired into pre-push

## Proof

Remove the new branch: 2 of 11 tests in `api-error.test.ts` fail. Restored: 11
pass, and the two consoles are on 1,005 and 875.

Put a hand-rolled `reason={gone ? 'missing' : 'unreachable'}` back on the recipe
pane: the check exits 1 naming the file and the line. Restored: `318 panes say
why they could not load, and every one of them asks the one place that knows.`

On screen, opening Owed at `…/00000000-0000-0000-0000-000000000001`, which the
server answers 422: **"That item owed is no longer here. It has been deleted, or
the address points at something that is not in this business. Nothing of yours
has been lost."** No Try again. And a purchase order at `…/PO-000004`, the shape
a truncated link takes, now reads **"This order no longer exists. It may have
been a draft that was deleted."** with no button. Both read "the server is
unreachable" over a dead Try again before the change.

1,005 piggles tests and 875 sparx tests pass; both typechecks and ESLint
clean.
