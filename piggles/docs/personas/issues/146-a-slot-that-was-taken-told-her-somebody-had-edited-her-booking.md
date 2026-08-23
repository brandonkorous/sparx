# 146 — A slot that was taken told her somebody had edited her booking

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · standing check — wrong moves
**Surface:** mypiggles › Bookings › Take a booking
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** see below

## What happened

Nia took a 2 PM on Tuesday for a walk-in. Then she filled the same form in again
for the same 2 PM, the way you do when you are not sure the first one went
through. The pane told her the truth:

> **Could not take this booking**
> That time is no longer available

And a toast appeared beside it saying something else entirely:

> **That didn't save**
> Someone else changed this while you had it open, so it was not saved over.
> Reopen it to see their version, then make your change again.

Nobody changed anything of hers. There is no "their version". This is a **new**
booking with nothing to reopen, and the only thing that happened is that the
time was already spoken for. Two answers to one question, one of them false, and
the false one is the one with instructions in it.

## Why it happened

api-rest returns **409** for two entirely different situations and the reporter
had one sentence for both:

| Code                    | What actually happened                                       |
| ----------------------- | ------------------------------------------------------------ |
| `SLOT_UNAVAILABLE`      | the time was taken; nothing of hers was touched              |
| `INVALID_BOOKING_STATE` | the booking moved on (confirmed, cancelled) since she opened |
| everything else         | a genuine optimistic-lock conflict, which is what it said    |

This is precisely the rule written at the top of the file that got it wrong:
"where one OUTCOME has two causes with different remedies, it gets two
messages. Advice is part of the contract." The remedy for a taken slot is
_choose another time_; the remedy the toast gave was _go and read somebody
else's edit_.

## Where it lives

- [lib/api/write-failure.ts](../../../apps/workbench/lib/api/write-failure.ts)

## The fix

The 409 branch splits on the code. A slot that went while she was typing gets
its own sentence, and it says what to do next:

> That time was taken while you were filling this in, so nothing was booked. Pick
> another time and everything else you typed is still here.

A record that moved on underneath her gets a second one:

> This has already moved on since you opened it, so nothing was changed. Reopen
> it to see where it stands now.

Everything else keeps the optimistic-lock sentence, which was right for the case
it was written for.

## Confirmed by

> Re-ran it as Nia. Took a Cut and finish at 10 AM on Thursday for a walk-in,
> then fired the same form at the same slot again: the pane says "Could not take
> this booking / That time is no longer available" and the toast beside it now
> says **"That time was taken while you were filling this in, so nothing was
> booked. Pick another time and everything else you typed is still here."** Nine
> refusals across four slots, all reading the same, none mentioning anybody
> else's version.
