# 866 — Opening your hours and pressing Save deleted your summer hours

**Status:** fixed
**Severity:** **major** — a weekly block of hours can be bounded by two dates, and
the platform supports it end to end: the column, the writer, the availability
engine, the REST route, and the MCP tool whose own description tells an assistant
that "`validFrom`/`validTo` (YYYY-MM-DD) bound a seasonal schedule". The console's
write shape had no room for them, and the save **replaces the whole week**, so
opening Availability and pressing Save destroyed every seasonal bound on every
day — on a screen that had never shown her the dates existed
**Found by:** P03 · act 307, checking Bookings with the dev ports down, from the
code and the database
**Surface:** mypiggles › Bookings › Availability › Weekly hours, in both consoles
**Filed:** 2026-09-28
**Fixed:** 2026-09-28
**Confirmed by:** the round trip, held down by a test that reddens on the original
bug

## The capability, end to end, minus one screen

```
scheduling_availability_windows.valid_from / valid_to   date columns, shipped
setAvailabilityWindows()                                writes them
availability.ts                                         honours them:
    if (w.validFrom != null && dayStart < w.validFrom) continue;
    if (w.validTo   != null && dayStart > w.validTo)   continue;
GET  /…/availability                                    serializes them
PUT  /…/availability                                    accepts them (zod,
                                                        nullable, YYYY-MM-DD)
set_resource_hours (MCP)                                ADVERTISES them
```

And the console:

```ts
/** What a PUT sends for one day-window (no id — the whole week is replaced). */
export interface AvailabilityWindowInput {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
}
```

Three fields. The type it reads back has five. So the editor loaded a week,
dropped the dates on the floor, and PUT it back without them.

## Why that is destruction and not merely an omission

The writer is a replace:

```ts
await tx.availabilityWindow.deleteMany({ where: { resourceId: input.resourceId } });
await tx.availabilityWindow.createMany({ data: input.windows.map(…) });
```

Which is correct, and documented in the MCP tool's own words ("REPLACES the whole
week in one call, so send every window you want to keep"). It means a client that
cannot express a field **deletes** that field. The screen's only statement about
what Save does is "the whole week is written at once (the server replaces it
wholesale)", which is true and does not sound like a warning.

So the failure needs no mistake by anybody. Set seasonal hours through the AI
assistant, which the MCP tool invites; open Availability the next morning to move
Tuesday by half an hour; press Save. The dates are gone, no message, and the
screen looks exactly the same before and after.

## Measured

```
scheduling_availability_windows      236
  …with valid_from                     0
  …with valid_to                       0
```

**Zero, which is what a screen that cannot hold a field produces.** So this bites
nobody today — and it is a capability that four layers implement, one layer
advertises to assistants, and the only editing surface silently reverses.

## What it does now

One switch above the week, because seasonal hours are one decision even though the
dates are per block. A shop with ordinary hours sees exactly what it saw before.

```
Hours change with the seasons                                 [ ○ ]
The same hours every week, all year.

Tuesday   [09:00] to [17:00]  [×]
```

Turned on, each block gains its pair:

```
Hours change with the seasons                                 [ ● ]
Each block of hours can be limited to part of the year. Leave a date
empty for no limit at that end.

Sunday    [10:00] to [16:00]  [×]
          from [Jun 1, 2026] until [Aug 31, 2026]
```

**It starts on when the stored week has dates**, so a seasonal week set through
the assistant opens showing them rather than hiding them and then deleting them.

**Turning it off says what it will do**, before Save:

> The same hours every week, all year. Saving now will remove the dates already
> set on this week.

That sentence is the difference between an explicit choice and the silent deletion
this issue is about. It appears only in the state where it is true — she has dates
and has just switched off — and a test holds that.

**A backwards range is refused.** The engine skips a day before `validFrom` and a
day after `validTo`, so `Aug 31 → Jun 1` matches nothing and the block would be
saved and never apply. Save is now disabled and the row says why: "The second date
comes before the first, so these hours would never apply."

Dates are typed in `DayInput`, so a half-typed date reports itself rather than
being read as blank (issue 741's fix carries over for free).

## Proved

**11 tests** on `season-window.ts`, and proved red twice:

```
drop the from<=to compare, and the warning sentence   → 3 of 11 fail
make the editor drop both dates on the way out
  (the original bug, reinstated exactly)              → 1 of 11 fails
```

The second is the one that matters. `seasonFromWire` / `seasonToWire` are the two
halves of the translation — the wire says `null` for "no limit", `DayInput` says
the empty string — and the pane now calls them rather than spelling the ternaries
inline, so **the tested code is the shipped code** and the regression cannot come
back through the pane.

The date-compare test is deliberately not just one case: `YYYY-MM-DD` is
fixed-width and big-endian so a string compare is a day compare, which looks like
a shortcut, so a year boundary is pinned both ways.

**Checks:** typecheck 0 on both workbenches. Tests: piggles scheduling 2 files /
17. ESLint and prettier clean on both consoles' scheduling surfaces.

## Files

- `{piggles,sparx}/apps/workbench/surfaces/scheduling/season-window.ts` (new)
- `piggles/apps/workbench/surfaces/scheduling/season-window.test.ts` (new)
- `{piggles,sparx}/apps/workbench/surfaces/scheduling/setup-data.ts` (the write shape)
- `{piggles,sparx}/apps/workbench/surfaces/scheduling/availability-settings.tsx`

## The thing to remember

**A replace-all save turns a missing field into a delete.** A client that cannot
express something is usually just less capable than the server. When the write is
"here is the whole thing", it is actively destructive, and the gap is invisible
because the screen never displayed the field it is erasing.
[[feedback_absent_behaves_like_fine]]

And the thing that made it findable: **the MCP tool description was the only place
on the platform that told the truth about this feature.** A tool description is
copy, and copy that names a capability is a promise — one an AI assistant will act
on, writing data the console then reverses.
[[feedback_a_promise_in_copy_is_a_contract]]

## Also checked on this surface, and dropped

- **`materializedThrough` on a booking series, `offeredAt` / `resourcePref` on a
  waitlist entry, `imageUrl` / `intakeFormId` on a service, and four fields on a
  calendar connection** are all fetched and drawn nowhere. Each is a candidate of
  the same family and none is destructive, so they are noted for a later pass
  rather than folded into this one.
- **Juniper Row has 2 resources, 1 location and 0 services**, so she cannot take a
  booking at all yet. That is her setup, not a defect, and the Bookings surface
  says so in its own empty state.
