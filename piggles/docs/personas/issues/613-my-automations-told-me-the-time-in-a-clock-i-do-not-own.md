# 613 — My automations told me the time in a clock I do not own

**Status:** fixed
**Severity:** high
**Found by:** P03 · Juniper Row · act 207
**Surface:** mypiggles › Automations (list, detail, editor, reports)
**Filed:** 2026-09-17
**Fixed:** 2026-09-17
**Confirmed by:** P03 · Juniper Row · act 207 (seen on screen, before and after)

## What happened

I opened **Automations** to see what runs by itself. The first rule, the one
that chases unpaid invoices, said:

> **Every day at 00:00 UTC** · scanning Quotes & invoices

Two problems in five words.

I do not know what UTC is. Nothing on the screen said.

And even if I did: **00:00 UTC is 6:00pm here.** So the sentence that exists to
tell me when the rule runs is the one thing on the row that does not.

The editor was the same. Setting the time asked for **"At (UTC)"**, so the only
way to schedule a chase for nine in the morning was to work out what nine in the
morning is somewhere else and type that.

## Why it happened

`automations-presentation.tsx` had written the word by hand:

```ts
return `Every day at ${minuteToHHMM(schedule.atMinuteUtc)} UTC`;
```

The console has known the answer since **issue 081**, when a salon set her week
to 09:00-17:30 and her diary showed a full head of color at three in the
morning. That produced `useBusinessZone()`, whose own comment says:

> One reader rather than a default per form: three scheduling forms already
> wanted this, and each had written `'UTC'` by hand.

Finance reads it. Invoices reads it. Bookings reads it. Automations wrote
`'UTC'` by hand, which is the exact sentence that hook exists to end.

This is the fetched-but-never-rendered shape again: not a
missing capability, a value already sitting in the console's hand that four
screens drew and one did not.

## The fix

**`surfaces/automations/schedule-clock.ts`**, new, pure, with 23 tests.

| where          | was                                | now                                  |
| :------------- | :--------------------------------- | :----------------------------------- |
| the list       | Every day at 00:00 UTC             | **Every day at 6:00pm**              |
| a weekly rule  | Every Tuesday at 14:00 UTC         | Every Tuesday at 2:00pm              |
| a monthly rule | On day 3 of the month at 09:00 UTC | On the 3rd of the month at 9:00am    |
| every 60 min   | Every 60 minutes                   | Every hour                           |
| midnight       | 00:00                              | midnight                             |
| the editor     | At (UTC)                           | **At**, with the zone named under it |

The one-off field was wrong in a second way: it rendered a stored instant
straight into a `datetime-local` box, so the number shown was the UTC reading
wearing a local label. It now converts both ways.

**Whose clock gets said out loud.** `useBusinessZone()` has three answers and
they are three different things: a zone the business set, `null` for nobody set
one, `undefined` for still loading. A time shown on the device's clock because
nothing was on file now says so, which is issue 178's rule. The `clock` argument
is **required**, not optional, so the next caller has to answer the question
rather than inheriting UTC by leaving something out. Typecheck named all eight
call sites the moment it became required.

## The part that is honest rather than hidden

The engine stores a **minute of the UTC day** and ticks against it
(`automation/src/engine/schedule-tick.ts`). There is no zone on the record.

So a rule set at "7:00pm your time" is really a fixed moment in the UTC day, and
when the clocks change it becomes 6:00pm or 8:00pm on her clock. This module
does not paper over that: it converts with the offset in force on the day being
asked about, so the screen always says when the rule will actually run next. A
number that appears to have moved by an hour in November is the truth about a
UTC-stored schedule. A number frozen at what she typed would be the lie.

Two tests hold exactly that:

```ts
it('says the time on the reader s own clock, and never says UTC', …)  // 7:00pm in January
it('moves with the clocks, because a UTC-stored schedule does', …)    // 8:00pm in July
```

## Guard

23 tests in `schedule-clock.test.ts`, both consoles.

The ones that are rules rather than strings:

- daylight saving is a **tested fact**, not a hope: the same zone is asserted at
  a January instant and a July one, and the offsets differ by an hour.
- a half-hour zone (Asia/Kolkata, +5:30) is in there, because an offset in whole
  hours is an assumption that works everywhere except where it does not.
- wrapping past midnight in **both** directions, because 00:00 UTC is the
  previous evening in the Americas and the next morning in Asia.
- `localMinuteToUtc` round-trips `utcMinuteToLocal` across six times of day.
- `clockLabel` never prints a 24-hour figure or the letters UTC, checked across
  all 1,440 minutes of the day in steps of 7.
- an unrecognized zone name returns UTC rather than throwing inside a table cell.
- `ordinal` is tested on 11, 12 and 13, which is where the naive version says
  "11st".

Proven red by removing the conversion and leaving the formatting: **8 of 23**
fail, and the first is the line the list actually printed.

## Still open

**The schedule has no zone of its own.** Storing a minute of the UTC day means a
rule drifts an hour against the business's clock twice a year. Showing the true
next-run time is the right console-side answer, and the real fix is a zone
column beside the minute, which is a server model change and a migration. Not
done here; named so it is not rediscovered.

Noted, not changed: `automations-catalog.ts` seeds several rules at
`atMinuteUtc: 0`. That is midnight UTC for everyone, which is now visibly the
early evening for a US shop. Whether a platform default should be midnight
_local_ is the same model question as above.
