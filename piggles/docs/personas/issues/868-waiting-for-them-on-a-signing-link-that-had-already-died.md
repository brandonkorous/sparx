# 868 — "Waiting for them" on a signing link that had already died

**Status:** fixed
**Severity:** **major** — a request for a customer's signature showed the state it
was last written with, and nothing writes the state that matters. A link that ran
out three weeks ago still read "Waiting for them", and the only thing that would
have corrected it is the one person who cannot: the customer, opening a link that
no longer works. The screen also never said whether they had **opened** it, on a row
whose own writer calls that "the whole question a business has three days after
sending a quote"
**Found by:** P03 · act 307, sweeping the Customers surface with the dev ports down
**Surface:** mypiggles › Invoices › a quote or invoice › Signatures, in both consoles
**Filed:** 2026-09-28
**Fixed:** 2026-09-28
**Confirmed by:** 10 tests, proved red by reinstating the bug

## Three things on the row, none of them drawn

```ts
export interface DocumentSignature {
  id;
  signerName;
  signerEmail;
  status;
  requestedAt;
  expiresAt; // never null. Not drawn.
  viewedAt; // written by the signing page. Not drawn.
  signedAt;
  declinedAt;
  declineReason;
}
```

The pane drew the status, the sent date, the name, the email and the decline
reason, all well. It could not answer either question a person actually has while
waiting: **have they looked at it**, and **is the link still alive.**

## The sharpest part is in the code that writes it

`viewByToken`, on the public signing page:

```ts
} else if (found.status === 'pending' && found.viewedAt === null) {
  // "They opened it" is the difference between a customer who is thinking
  // about it and one who never got the email — which is the whole question
  // a business has three days after sending a quote.
  await tx.billingDocumentSignature.update({ where: { id: found.id }, data: { viewedAt: new Date() } });
}
```

Somebody wrote the field, wrote down exactly which question it answers, and the
console drew nothing. [[feedback_fetched_but_never_rendered]]

Of the three signature rows on the development database, **two have `viewed_at`
set** — one signed, one declined. So the data was there and correct.

## And the stale status

`status` becomes `'expired'` two ways:

1. the signer opens the dead link (`viewByToken`, above), or
2. `expireStale` runs.

```
$ grep -rn "expireStale" .  (whole repository)
wizeworks/packages/crm/src/services/signature-service.ts:481:export async function expireStale(…)
```

**One reference: its own definition.** And its doc comment states the caller as
fact:

> Per tenant, like the SLA sweep and for the same reason… **the schedule that calls
> this already walks tenants.**

There is no such schedule. [[feedback_screen_over_a_function_nobody_calls]]

`listForDocument`, which is what the console reads, is a plain `findMany` with no
expiry check. So the console's own read never corrects it either:

```ts
export async function listForDocument(ctx, documentId) {
  return withTenant(ctx, (tx) =>
    tx.billingDocumentSignature.findMany({
      where: { documentId },
      orderBy: { requestedAt: 'desc' },
    })
  );
}
```

There is a second cost beyond the wrong word. "Take it back" renders on
`status === 'pending'`, and `revoke` refuses only a status that is not pending — so
the pane offered to withdraw a dead link and the server would have **accepted it**,
recording a withdrawal of something nobody could use.

## What it does now

```
before   Signed        10 Sep 2026        after   Signed        10 Sep 2026
         Dana Whitfield                            Dana Whitfield
         dana@example.test                         dana@example.test

         Waiting for them   1 Sep 2026             Ran out   1 Sep 2026
         Priya Raman                               Priya Raman
         priya@example.test                        priya@example.test
         [Take it back]                            They never opened it
                                                   The link stopped working on 8 Sep 2026
```

And while a request is genuinely live:

```
Waiting for them   20 Sep 2026
Dana Whitfield
dana@example.test
They opened it 24 Sep 2026
The link works until 27 Oct 2026
[Take it back]
```

"They opened it" and "They have not opened it yet" and "They never opened it" are
three different pieces of news, and the third only makes sense once the link is
dead. A signed or declined request says nothing about either, because it has
already answered itself.

## Why a read-side overlay and not a schedule

The stored status is the record of what was **done**. The date is the fact that
decides what is **true now**, and it is already on the row, never null. So the pane
derives the effective status and leaves the row alone — the same shape as the SEO
scorecard's refreshed wording (issue 863), for the same reason: a read that writes
is a surprise, and a schedule is ongoing spend nobody asked for.

Only `pending` can be stale, and only in one direction. A test pins that: `signed`,
`declined`, `revoked` and `expired` are things that happened, and a date cannot
make them untrue. A read that second-guessed them would be rewriting history on
screen.

`expireStale` is left in place and still has no caller. Wiring a schedule is a
cost decision, and the screen is now correct without one — so the honest state is
recorded here rather than quietly fixed with a new cron.

## Proved

**10 tests**, and proved red by putting the bug back:

```
trust the stored status, and collapse never/not-yet → 4 of 10 fail
```

The four are the ones that matter: a dead link reads expired, "Take it back" stops
being offered, "never opened" is distinguished from "not opened yet", and the
expiry line moves into the past tense.

`now` is a parameter rather than a call to the clock, so the tests stand at a fixed
date instead of being true only this week.

**Checks:** typecheck 0 on both workbenches. Tests: piggles invoicing 8 files / 85.
ESLint and prettier clean.

## Files

- `{piggles,sparx}/apps/workbench/surfaces/invoicing/signature-state.ts` (new)
- `piggles/apps/workbench/surfaces/invoicing/signature-state.test.ts` (new)
- `{piggles,sparx}/apps/workbench/surfaces/invoicing/signatures.tsx`

## The thing to remember

**A status column is a record of writes, not a description of the world.** It is
correct the instant it is written and drifts from then on, and the drift is
invisible because a status looks authoritative. The question to ask of any stored
state is: what writes this, and can the thing that writes it be relied on to run?
Here the answer was "a customer opening a link that has stopped working", which is
nobody.

And: **a doc comment naming its caller is not evidence of a caller.** "The schedule
that calls this already walks tenants" is the kind of sentence that stops the next
person looking. [[feedback_verify_capability_in_code_not_docs]]

## Also checked on Customers, and correctly not filed

- **Email open tracking** (`openCount`, `clickCount`, `firstOpenedAt` on an
  engagement message) is drawn nowhere, and 0 of 6 messages carry a value because
  nothing writes them. Rendering it would put a confident "0 opens" over an
  unmeasured send. The platform already handles the same field honestly one layer
  up: `SalesTemplate.openCount` is documented "ALWAYS NULL. Nothing on the platform
  writes it… Kept in the shape, and kept NULL, deliberately", and `openRate` returns
  null rather than zero. That is the right answer and it is already in place.
  [[feedback_never_present_absence_as_measurement]]
- **`firstResponseDueAt` / `resolutionDueAt` on a request** are fetched and not
  drawn, which would matter to a business with requests. Devi has none, and the
  platform has none, so there is no measurement to stand on. Noted.
- **My own sweep had a hole worth recording.** The first pass looked for a field
  named nowhere inside its own surface folder and reported 43 in the CRM — most of
  them false, because `workspace-data.ts` lives in `crm/` and its only consumer is
  `invoicing/signatures.tsx`. Re-run across the whole app it is 24, and the
  signature fields drop to exactly one, `viewedAt`. The narrow scan would have had
  me "fix" a panel that was already built.
