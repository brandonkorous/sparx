# 531 — A promise about the next few minutes, twenty days late

**Status:** fixed and proven
**Severity:** major
**Found by:** Devi, opening the one newsletter she has ever sent
**Surface:** `surfaces/email/broadcast-stats-words.ts` (new, both consoles), `broadcast-stats.tsx`, `broadcast-review.tsx` (Piggles), `broadcast-detail.tsx` (sparx)
**Filed:** 2026-09-15
**Follows:** [246](246-delivered-nothing-a-minute-after-twenty-three-emails-went-out.md), [251](251-nobody-opened-it-was-green-and-twenty-three-went-out-was-grey.md)

## What she saw

Email → Broadcasts → Autumn drop announcement → **How it did**

> **Delivered**
> **23**
> On their way. Confirmations arrive over the next few minutes.

The send time is on the same screen, four inches up: **August 26, 2026 at 2:20 AM**.
Today is September 15. The confirmations were not arriving over the next few
minutes. They stopped being able to arrive nineteen days and twenty-three hours
ago.

## Why

That sentence is the FIX for [246](246-delivered-nothing-a-minute-after-twenty-three-emails-went-out.md).
A minute after pressing Send, "Delivered 0" told an owner her whole newsletter
had failed, when the truth was that nothing had been _confirmed_ yet. The repair
was to say which of the two it is, in words and in color:

```ts
if (stats.accepted > 0) {
  return {
    value: stats.accepted,
    hint: 'On their way. Confirmations arrive over the next few minutes.',
    tone: 'info',
  };
}
```

Read it as a whole sentence and the defect is in plain sight: **it is a claim
about the future with no clock in it.** It was written for the minute after a
send and shipped as the permanent state of every send that never gets confirmed.

This is the same shape as [522](522-her-overdue-list-was-empty-while-she-was-owed-986-dollars.md),
[526](526-a-cost-recorded-in-the-evening-was-not-there.md) and
[530](530-what-needs-you-said-nothing-needed-her.md), from the other side.
Those were a stored value that needed the clock and never asked it. This is a
sentence that needed the clock and never asked it. Same missing question.

## What it costs her

Being told to wait is worse than being told nothing, because waiting is an
instruction. A shop owner who reads that comes back tomorrow, sees the same
sentence, and concludes the screen is broken or that email is slow. The one fact
she can act on — twenty-three went out and **not one thing has come back since**
— was the fact the sentence was covering.

It is also the fact she must not be given a reason for. Two very different
things look identical from this screen: a mail service that does not report
deliveries at all, and mail that genuinely did not land. Naming either one is a
guess, and a guess here sends her off to fix the wrong thing
([[feedback_one_outcome_two_causes]]).

## What changed

A fourth state, and a deadline on the third:

| when                              | what the tile says                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| confirmed                         | **23** · Confirmed by the receiving mail server · green                                     |
| sent, within the hour             | **23** · On their way. Confirmations arrive over the next few minutes. · blue               |
| sent, past the hour, nothing back | **23** · These went out. Nothing has come back since to confirm they landed. · **no color** |
| nothing sent                      | **0** · Nothing has gone out yet                                                            |

No color on the new one on purpose. It carries no verdict, so it may not wear
one.

An hour is generous and the exact figure is not the point. The point is that the
promise **expires**.

A missing or unreadable send time keeps the gentler sentence. Being vague is
survivable; announcing that her mail did not land because a timestamp was absent
is not.

## The bigger half: the sparx console had none of the fixes

This screen exists twice, once per console, and they may not import from each
other. Looking at the second copy to apply the clock found that **246 and 251
had never travelled**, plus a third nobody had filed:

- **246.** `<StatBlock label="Delivered" value={stats.delivered} tone="neutral" />`
  — the raw zero, with no sentence under it at all. The original defect, still
  shipping.
- **251.** Opened and Clicked were `tone="success"` **literally**, not
  conditionally. A zero in the color of good news, every time.
- **New.** `hint={`${pct(stats.opened)} of delivered`}` where the percentage is
  computed against `delivered || accepted || recipients`. With nothing confirmed
  it printed **"0% of delivered"** — a share of what LANDED, calculated from what
  went OUT, at a moment when nothing had landed.

That is [[feedback_a_fix_leaves_its_neighbour_behind]] exactly. Two fixes, both
correct, both closed, both applied to one of the two places the code lives.

## Why there is a new file

Because a rule that lives inside a component is invisible from outside it. These
are pure decisions about **what a sentence says**, and every one of them compiles
whether it is right or wrong. The console's test seat runs plain Node with no
path aliases, so nothing importing React can be reached by a test — which is why
three defects in one function went four issues without a guard.

`broadcast-stats-words.ts` now holds the rules, in both consoles, as a leaf that
imports nothing. Eight guards each.

## Proven

Each break reddens exactly one guard, and nothing else:

```
RED   R1 remove the clock (the original bug)     ->  1 failed | 7 passed (8)
RED   R2 zero painted as good news (issue 251)   ->  1 failed | 7 passed (8)
RED   R3 always "of delivered"                   ->  1 failed | 7 passed (8)
RED   R4 a missing send time reads as failure    ->  1 failed | 7 passed (8)
RED   R5 window boundary off by one              ->  1 failed | 7 passed (8)
```

R2 and R3 are the sparx console's shipped code. They go red against the guard
that was written the same hour, which is the whole argument for the file.

## Proven on her screen

```
How it did

Delivered            Opened
23                   0
These went out.      0% of those sent
Nothing has come
back since to
confirm they landed.
```

## Measured, not read

153 email events exist platform-wide and **every one of them is `accepted`**.
No `delivered`, no `opened`, no `clicked`, no `bounced` — the dev mail provider
writes to the console and nothing comes back. The webhook path that would record
the rest is real (`email-platform/src/services/webhook-service.ts`), so this is a
local-environment absence and not a missing capability.

Which is exactly the condition the old sentence handled worst and the new one
handles honestly.

## Not changed, and why

**"Opened 0 · 0% of those sent"** stays. With 23 sent and no opens recorded it
is either true or unknowable, and the screen has no way to tell which: there is
no open-tracking setting on `email_settings` to read. Its color is already
`plain`, so it does not claim to be good news. Giving it a second sentence would
mean inventing a distinction the data does not support.
