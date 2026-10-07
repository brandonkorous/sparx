# 140 — A daily reminder ran twice on one business day, and not at the time the screen said

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 10 (the overdue reminder)
**Surface:** every scheduled automation ("Every day at 6:00pm", "Every Tuesday at …"); the scheduler in `@wizeworks/automation`
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01, 2026-10-06
**Blocked on:** —

## What happened

"Chase overdue wholesale invoices" says "Every day at 6:00pm". Gillett's business clock is America/Denver.

The scheduler counts days in UTC. A rule's "once a day" is one run per UTC date, and it may run any time after its minute of the UTC day. Gillett's rules use minute 0 (6:00pm in Denver), so in practice they may run at any hour.

The reminder rules ask a question about the BUSINESS's day: "is this bill 7 days late today?", counted on Denver's calendar (issue 099 made that right). Denver's day and the UTC date overlap for only 18 hours. A bill that is 7 days late on Denver's Oct 6 matches from 00:00 to 23:59 Denver time:

- 00:00 Denver is 06:00 UTC Oct 6. UTC date Oct 6 has no run yet, so the reminder is sent.
- 6:00pm Denver is 00:00 UTC Oct 7. UTC date Oct 7 has no run yet, and the bill is still 7 days late in Denver, so the reminder is sent again.

So the customer is sent each notice twice, at midnight and at 6pm. The screen says the rule runs at 6:00pm. It ran at midnight too.

Weekly and monthly rules have the same split: "Every Tuesday at 6:00pm" in Denver runs on Monday at 6pm, because Tuesday is checked on the UTC calendar.

## What should have happened

A daily rule runs once per business day, at the time it shows. A weekly rule runs on the day it names, on the business's calendar. A business with no time zone set keeps UTC, as it does now.

## How to reproduce

Not yet seen in Gillett's run history: no reminder email rule has ever matched one of his bills ([139]). Found by reading the scheduler while fixing that, and proved by a test: a tick at 06:30 UTC Oct 6 and one at 00:30 UTC Oct 7 (both Oct 6 in Denver) enqueue two runs for one bill.

## Why it matters

Every notice to a customer goes out twice, and the second copy counts the days differently ([141]). For a business west of UTC, that is every US business.

## Where it lives

- `wizeworks/packages/automation/src/engine/schedule-tick.ts`: `isScheduleDue` and `scheduleWindowKey` read the UTC clock; the scanners count days on the business's clock (`automation-actions/src/resolvers.ts`, `billingFields`).

## The fix

- `automation/src/engine/schedule-tick.ts`: a daily, weekly or monthly rule is due and keyed on the BUSINESS's clock (`businessClockAt`, from `tenant_businesses.timezone`). Its time is the stored UTC minute plus today's offset, which is what the screen prints; the weekday and day of the month are the ones the owner picked. "Once a day" is once per business date. A business with no zone, or a zone the runtime does not know, keeps UTC exactly as before. Interval rules are unchanged.
- The clock math is the shared `@wizeworks/time` package (now a dependency of `@wizeworks/automation`: package.json, lockfile entry, and the workspace link pnpm would make).

What this changes for Gillett: his daily rules run once a day from 6:00pm Denver time, as the screen says, not from midnight. A late bill raised at 10am is put on credit hold at 6pm the same day, not within the minute (the timing [101] recorded).

Test, proved red:

- `automation/src/engine/schedule-tick.test.ts` (5): ticking every 30 minutes for three days, a Denver daily rule runs once a day at 18:00; across the clocks going back it runs at 18:00 then 17:00; a weekly Tuesday rule runs on Tuesday; no zone keeps the UTC day; an unknown zone falls back to UTC. With the zone ignored (the old clock), 3 fail, and the first shows the double: runs at "2026-10-06 00:00" and "2026-10-06 18:00".

## Confirmed by

In the run history, 2026-10-06, on Gillett: after the change, "Chase overdue wholesale invoices" ran for Wasatch Front with the key dated 2026-10-06 (Denver's day; UTC was already Oct 7), and "Invoice overdue (7 days)" ran once for 4459, keyed 2026-10-06. Second check at 6pm Denver on Oct 7 still to read: not checked yet.

## Rating effect

—
