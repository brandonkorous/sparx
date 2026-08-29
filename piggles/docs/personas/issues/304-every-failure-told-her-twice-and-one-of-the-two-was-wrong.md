# 304 — Every failure told her twice, and one of the two was wrong

**Status:** fixed
**Severity:** minor (two toasts for one failure on 496 of the console's writes;
the second is generic, sometimes gives advice that does not fit, and never
dismisses itself)
**Found by:** P03 · Juniper Row · while proving [303]
**Surface:** the console — everywhere a write can fail
**Filed:** 2026-08-28
**Fixed:** 2026-08-28
**Confirmed by:** The same 409, before and after

## What happened

Pressing **Refund $63.00** on O-000005 raised two toasts at once, saying the same
sentence under two different headings:

> **Could not refund this order**
> This order has no captured card payment to refund. Refund the customer
> manually, or issue account credit.

> **That didn't save**
> This order has no captured card payment to refund. Refund the customer
> manually, or issue account credit.

The second is the global failed-write net, and it stays until it is clicked.

**Where it is not merely noise:** adding a version whose code is already taken
answers **409**. The call site names it exactly — _SKU "THE-EVERYDAY-XS-CLAY"
already exists_ — and the net's 409 branch says something else entirely:

> Someone else changed this while you had it open, so it was not saved over.
> Reopen it to see their version, then make your change again.

Nobody else changed anything, there is no version to reopen, and making the
change again does the same thing. Correct advice for a conflict; wrong advice for
this one, sitting beside the sentence that got it right.

## What should have happened

The reporter's own docblock already says it, and it is the right rule:

> Announce it ONLY if nobody else did. A mutation with its own `onError` has a
> call site that owns the conversation (usually a better one) … Toasting on top
> would say the same thing twice and teach people to ignore both.

## Where it lives

[write-failure-reporter.tsx](../../../../piggles/apps/workbench/components/write-failure-reporter.tsx),
one line:

    if (typeof event.mutation.options.onError === 'function') return;

with a comment above it asserting exactly what does not happen:

> `onError` on the mutation itself, not on the observer: a component's own
> `mutate(vars, { onError })` **also lands here**, and both mean the same thing.

It does not land there. In `@tanstack/query-core@5.101.0`, `MutationObserver.mutate`
puts the per-call options in a **private** field:

    mutate(variables, options) {
      this.#mutateOptions = options;
      this.#currentMutation = this.#client.getMutationCache().build(this.#client, this.options);

The mutation that reaches the cache is built from `this.options` — the
`useMutation` options alone. A watcher on the mutation cache can never see a
per-call handler, and `#mutateOptions` is a hard private field, so it cannot read
harder either.

**496 call sites in the console pass `onError` to `mutate()` / `mutateAsync()`**,
which is the idiom the codebase uses everywhere, including both handlers in
`useOrderRisk`. Every one of them was announcing its failure and then being
announced over.

## The fix

The answer only exists at the moment `mutate` is called, so it is caught there.
`@wizeworks/query` now exports its own `useMutation` — TanStack's, plus one thing:
a per-hook object carried **by reference** on `meta`, whose `onError` flag is set
on every `mutate` call. `callerHandledError(mutation.meta)` reads it back off the
cache, and the reporter asks that as well as the old question.

`index.ts` already did `export * from '@tanstack/react-query'`, so exporting
`useMutation` after it shadows the star — **and all 147 files that import
`useMutation` from `@wizeworks/query` got this without an edit.** That shadowing
is load-bearing and invisible, so it has its own test: if the star ever wins, the
package stops handing callers ours and this bug comes back silently.

One honest limit, written into the docblock rather than left to be discovered:
the flag belongs to the HOOK, not to an individual mutation, because `meta` is
shared by every mutation a hook builds. Two calls from one hook instance in
flight at once, one handled and one not, share the last answer. The cost is a
missing or an extra toast, never a lost write — and an unreadable answer is
treated as "nobody spoke", so the net errs toward speaking.

## Confirmed by

The same 409 on the same button. Adding `THE-EVERYDAY-XS-CLAY` when that code is
already reserved now raises **one** toast:

> **Could not add that version**
> SKU "THE-EVERYDAY-XS-CLAY" already exists

The generic second toast, and its wrong conflict advice, are gone. Six tests in
`@wizeworks/query` cover the shadowing and the flag, including the reference
semantics the whole thing turns on.

## Not checked

- **A 5xx.** There the two toasts say genuinely different things — the call
  site's own sentence, and the net's "something went wrong on our end". The
  suppression now silences the second one there too, which is what the docblock
  asks for, but no 500 was driven on a screen this run.
- **The other console.** `wizeworks/apps/admin` shares `@wizeworks/query` and so
  picks up the export, but it has no failed-write reporter, so the flag is inert
  there. Not exercised.
