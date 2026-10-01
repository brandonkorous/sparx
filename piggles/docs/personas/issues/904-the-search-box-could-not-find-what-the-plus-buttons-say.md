# 904 — "What do you want to do?" could not find what the + buttons say

**Status:** fixed
**Severity:** **major** — the search box is how this console is meant to be
driven, and it did not know a single action the navigation panel names
**Found by:** P03 · act 321
**Surface:** the search box (`components/launcher-entries.ts`, both consoles)
**Filed:** 2026-09-30
**Fixed:** 2026-09-30
**Confirmed by:** walked on screen; `components/launcher-create.test.ts` (5
tests, each of three breaks reddens exactly one)

## What she did

Typed **Connect somewhere else**, word for word what the `+` beside "Counts
from elsewhere" says, and pressed Enter. It opened an automation called
"Announce new blog post". The list under the box held two automations, a
customer called Rowan Ellery and her order. **Receive a delivery**, the `+`
beside Deliveries, found four automations and nothing to receive.

## Why

The box builds its rows from screen titles and keywords. A `+` lives on the
row as `createSurface` plus a label, and nothing but the panel ever read them.
So every action the panel names in this brand's words was invisible to the box
whose own placeholder asks what she wants to DO.

## The fix

`components/launcher-create.ts` turns each labelled `+` into a row under the
same app heading, opened exactly as the panel opens it (`id: 'new'`, then the
row's own params, so the till still knows which door it was). A `+` with no
words of its own ("New") is left out, and two rows sharing one action show it
once.

## On the screen

"Receive a delivery" → first row, under Stock → opens the delivery form.
"Connect somewhere else" → first row → opens the new-source form.
