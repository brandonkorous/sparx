# 148 — A half-hour booking sliced its own words in half

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · standing check — dates (raised by Brandon from the screen)
**Surface:** mypiggles › Bookings › Calendar — week and day
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** see below

## What happened

Nia's Saturday has three appointments on it. The hour-long cut reads properly.
The two half-hour dry cuts under it read like this:

> 5:00 PM
> ~~Dry cut~~
> ~~Nia Okafor~~

Not truncated. **Cut** — the second and third lines sliced through the middle of
the letters by the bottom edge of the block, so the words are legible as shapes
and unreadable as words. Two of her three Saturday appointments looked like a
rendering fault.

## Why it happened

A block is as tall as the appointment is long. That is the whole point of a
diary, and it means the space is not the designer's to choose:

| Appointment                 | Slots | Block     | Three lines need        |
| --------------------------- | ----- | --------- | ----------------------- |
| Cut and finish, 60 min      | 4     | 64 px     | ~48 px ✓                |
| Toner and gloss, 45 min     | 3     | 48 px     | ~48 px, no padding left |
| **Dry cut, 30 min**         | **2** | **32 px** | **~48 px ✗**            |
| Colour consultation, 20 min | 2     | 32 px     | ~48 px ✗                |

`EventBlock` drew time, service and client on every block regardless. Three of
this salon's ten services are half an hour or less, so this was not an edge: it
is most of a busy afternoon.

The give-away is that `overflow-hidden` does not shorten text, it **cuts** it.
`truncate` was on each line, so each line was correct on its own axis — the
horizontal one. Nothing was watching the vertical one, and there is no CSS that
would have: the block cannot know it has too much to say unless it is told how
tall it is.

## Where it lives

- [surfaces/scheduling/calendar-event-block.tsx](../../../apps/workbench/surfaces/scheduling/calendar-event-block.tsx)
- [surfaces/scheduling/calendar-grid.ts](../../../apps/workbench/surfaces/scheduling/calendar-grid.ts) — `Placement.slots`

## The fix

**The block is told its own height and decides what it can say.** `Placement`
already computed `spanSlots` to build the `h-[Npx]` class and threw the number
away; it now carries it.

| Height                                  | What it says                                  |
| --------------------------------------- | --------------------------------------------- |
| 4 slots (an hour or more)               | time / service / who — three lines, unchanged |
| 3 slots (three quarters of an hour)     | time / service — two lines                    |
| 2 slots or fewer (half an hour or less) | **one row**: `5:00 PM  Dry cut · Nia Okafor`  |

The one-row form is the important half. It does not drop the client — she is the
one fact on a block that is nowhere else on the screen — it puts her on the same
line, so the sentence runs out of **width** and ends in an ellipsis rather than
being cut through its middle. An ellipsis says "there is more"; a sliced letter
says "this is broken".

The status rail is now full height on every block, so a one-line booking still
carries its colour, and the hover title still names the whole of it whatever the
block itself had room for.

## Confirmed by

> Reopened Nia's week as her. The 3 PM Cut and finish still reads over three
> lines. The 5 PM and 6 PM dry cuts now read **"5:00 PM Dry cut · Nia Okafor"**
> and **"6:00 PM Dry cut · Tomas Herrera"** on a single line, complete, with no
> clipped glyph anywhere and the blue and green status rails running the full
> height of each block.
>
> At 390px (three days to a column set) the same blocks read **"5:00 PM Dry …"**
> — cut by width, ending in an ellipsis, which is the honest form of running out
> of room. The client's name is what goes first there; tapping the block still
> opens it and names her.
