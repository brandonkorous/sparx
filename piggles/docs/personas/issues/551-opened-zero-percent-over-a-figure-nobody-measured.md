# 551 — "Opened 0%", over a figure nobody measured

**Status:** fixed and proven
**Severity:** high
**Found by:** Devi, looking at the one newsletter she has ever sent
**Surface:** `piggles|sparx/apps/workbench/surfaces/email/broadcasts-list.tsx`
**Filed:** 2026-09-16
**Follows:** [246](246-delivered-nothing-a-minute-after-twenty-three-emails-went-out.md), [251](251-nobody-opened-it-was-green-and-twenty-three-went-out-was-grey.md), [531](531-a-promise-about-the-next-few-minutes-twenty-days-late.md)
**Family:** [[feedback_never_present_absence_as_measurement]] · [[feedback_a_fix_leaves_its_neighbour_behind]]

## What she saw

Messages → Email campaigns:

| name                     | sent to | when         | opened | clicked | status |
| ------------------------ | ------- | ------------ | ------ | ------- | ------ |
| Autumn drop announcement | 23      | 3 weeks ago  | **0%** | **0%**  | Sent   |
| Sale announcement        | —       | Not sent yet | —      | —       | Draft  |
| Monthly newsletter       | —       | Not sent yet | —      | —       | Draft  |

Read as a row, that says twenty-three people got her newsletter and not one of
them opened it. That is a fact about her writing, and she would act on it.

## Measured

```sql
select type, count(*) from email_events group by 1;
```

| type       | count |
| ---------- | ----- |
| `accepted` | 153   |

One type. Platform-wide, across every tenant. Not one `delivered`, `opened`,
`clicked` or `bounced` row exists. `accepted` is written by the send itself;
every other count arrives later, from outside, and none ever has.

So `0%` is not a low number. It is the absence of any measurement, divided by
23 and rendered as a percentage.

## The same fix, the third time it stopped short

The DETAIL screen has been here three times:

- **246** — "Delivered 0" a minute after 23 emails went out.
- **251** — "Opened 0" in success green.
- **531** — the sentence that replaced 246 promised confirmations "over the next
  few minutes" with no clock in it, and said so for twenty days. That fix gave
  the Delivered tile four honest states, including _"These went out. Nothing has
  come back since to confirm they landed."_

The list, two files away, kept:

```ts
function rate(part: number, base: number): string {
  if (base <= 0) return '—';
  return `${String(Math.round((part / base) * 100))}%`;
}
const base = data ? data.delivered || data.accepted || broadcast.recipientCount : 0;
```

Same numbers, same fallback chain 531 called out by name, no sentence at all,
and a guard `rate` that only asks whether anything was SENT. Nothing asks
whether anything came BACK.

## The fix

`engagementCell` in `broadcast-stats-words.ts`, beside the rules 531 put there:

| state                                   | cell  | on hover                                                                                                                                                                          |
| --------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| nothing sent                            | `—`   | Nothing has gone out yet.                                                                                                                                                         |
| sent, nothing has ever come back        | `—`   | These went out, and nothing has come back about them since: no deliveries, opens, clicks or bounces. There is nothing to work a share out of, so this is not zero, it is unknown. |
| the service reports, and the share is 0 | `0%`  | 0 of 23 delivered.                                                                                                                                                                |
| the service reports                     | `25%` | 5 of 20 delivered.                                                                                                                                                                |

A real zero still shows as `0%`. Twenty-three delivered and no opens is a
measurement, and an unwelcome one, and it is hers to see. The third row is the
whole distinction: `anythingCameBack` asks about delivered, opened, clicked,
bounced, complained AND unsubscribed, so one bounce is enough to prove the pipe
works and turn the percentage back on.

The column is too narrow for a sentence, so the other half of the answer is a
`title` on the cell.

## Proven

Her list now reads **Opened — · Clicked —**, with that sentence on hover.

16 guards in `broadcast-stats-words.test.ts` (8 of them 531's, unchanged), proven
red by deleting the "nothing came back" case: 1 failed, 15 passed.
