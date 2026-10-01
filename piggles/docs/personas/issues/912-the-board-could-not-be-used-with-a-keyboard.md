# 912 — The deals board could not be used with a keyboard

**Status:** fixed
**Severity:** **major** — the board promises keyboard moves under every board
("tab to one, press space, move with the arrow keys, then space again"), and
not one step of it worked
**Found by:** P03 · act 321
**Surface:** `components/record-board.tsx` (both consoles; every board)
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** on screen, through the board's own announcements: lift
"Over Quote sent", one left arrow "Over Worth pursuing", drop "Moved the deal
to Worth pursuing", and the database agrees. A mouse drag still works.
`components/board-keyboard.test.ts` (5; moving two columns per press reddens 2)

## Three faults, stacked

1. **Space never lifted a card.** The card spread the drag sensor's handlers
   (`{...listeners}`) and then set its own `onKeyDown` after them. The later
   prop wins, so the sensor's key handler was replaced, under a comment saying
   "Space belongs to the drag sensor".
2. **A keyboard drop landed on nothing.** The drop target came from
   `pointerWithin`, which asks where the pointer is. A keyboard drag has none.
3. **An arrow did not move one column.** The default step is 25 pixels. And
   measuring the lifted card was unreliable in the dock: a straight-line
   "closest centre" picked the short empty column next door over the tall one
   holding the card, so one press read as two columns.

## The fix

The card hands every key but Enter on to the sensor. A keyboard move measures
nothing: the board remembers the card's column from the moment it is lifted,
each arrow press moves that one column, and the drop lands there. A mouse drop
still lands where the pointer is.
