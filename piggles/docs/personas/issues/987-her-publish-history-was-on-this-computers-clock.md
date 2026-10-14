# 987 — Her publish history was on this computer's clock

**Status:** confirmed
**Severity:** minor
**Found by:** P09 · The Marrow Review · act 10, after Publish everything
**Surface:** mypiggles › My Site › Publish › Every time you published, and a page's History; sparx › the studio's version history (Your drafts, Published)
**Filed:** 2026-10-11
**Fixed:** 2026-10-11 (both consoles)
**Confirmed by:** P09 on screen, 2026-10-11 (Piggles)
**Blocked on:** nothing

## What happened

Rosalind's business is in London. She pressed Publish everything at 09:39 UTC,
10:39 on her clock. On a computer set to California time, her publish history
said:

- **"Sunday, October 11 · 2:39 AM · Published · 27 pages"**

Publishes made at 3:45 AM on Friday in London sat under **Thursday,
October 8** at **7:45 PM**, a day early. Nothing said whose clock it was. This is the list she uses to choose a
version to put her site back to, and its times did not match her own day.

Issue 984 moved her campaigns onto her business's clock. The version lists
were left on the old one.

## Why

`piggles/apps/workbench/surfaces/studio/when.ts` built its two `Intl` formats
with no `timeZone`, so they used this computer's. `publish-releases.tsx` and
`history-rows.tsx` used them. sparx's `version-history.tsx` had its own pair the
same way, and measured "Today" and "Yesterday" against this computer's midnight.

## The fix

- Piggles `when.ts`: `versionDay(iso, zone)`, `versionClock(iso, zone)` and
  `versionClockNote(zone, device, at)`, formats cached per zone.
  `publish-releases.tsx` and `history-rows.tsx` read the business's zone with
  `useReaderClock`, or this computer's until one is set, and say whose clock
  under the list: "Times are on your business's clock, British Summer Time."
  The put-back confirm uses the same clock.
- sparx: new `surfaces/builder/studio/version-clock.ts` with `versionClock`,
  `versionDayLabel(iso, zone, now)` (Today and Yesterday on the business's
  calendar) and `versionClockNote`. `version-history.tsx` uses them for both
  tabs and shows the note under the tabs.

## Proof

- `surfaces/studio/when.test.ts` (Piggles, 3) and
  `surfaces/builder/studio/version-clock.test.ts` (sparx, 3): 09:39 UTC reads
  10:39 AM in London and 2:39 AM in Los Angeles; 23:30 UTC on Saturday is
  Sunday's heading in London (sparx: "Today") and Saturday's in Los Angeles
  ("Yesterday"); the note names British Summer Time, or this computer's clock
  when no zone is set.
- Red: the formats without `timeZone` fail 2 of 3 (Piggles) and 1 of 3 (sparx).
  Restored, all pass. The changed files lint and format clean. Both consoles'
  full typecheck runs out of memory, so they are not typechecked.
- On screen (Piggles): "Times are on your business's clock, British Summer
  Time." Her publish reads **Sunday, October 11 · 10:39 AM**, and the publishes
  that read Thursday 7:45 PM now sit under **Friday, October 9** at 3:45 AM.
