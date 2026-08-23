# 129 — The email editor draws her button black and the preview draws it brown

**Status:** open
**Severity:** minor
**Found by:** P02 · Halo & Hem · act 9
**Surface:** mypiggles › My Site › Email designs › the editor canvas
**Filed:** 2026-08-23
**Fixed:** —
**Confirmed by:** —
**Blocked on:** scope — a canvas-theming question, not part of the reminder work

## What happened

The same button, two screens, two colors.

On the **canvas**, "Change or cancel" is a near-black slab, and the inspector's
**Background** swatch beside it reads `#111827`. In the **Preview**, and therefore
in the inbox, it is the warm brown of Halo & Hem's own theme. The "Upcoming" chip
does the same: plain on the canvas, brand blue in the preview.

## What should have happened

One of them is what recipients get, and it is the preview. The canvas is the
screen an author looks at while deciding, so it should be showing the same thing.

## How to reproduce

1. My Site › Email designs › Booking reminder.
2. Compare the button on the canvas with the button in Preview. Every time.

## Why it matters

Low stakes today — the preview is one click away and is correct. It matters
because the inspector shows a hex box with a value in it, and an author who edits
that box is editing something the canvas obeys and the send may not. A control
that appears to set a color and does not is worse than no control.

## Not diagnosed

Two candidates, and this was not chased because it is a canvas-theming question
rather than anything to do with the act that found it:

1. **`colorAuto`.** Email nodes carry it: unset means "take the brand's color at
   render", and setting a color in the inspector pins it (`colorAuto: false`,
   `panels-content.tsx`). If the shipped default tree leaves it unset, the send
   repaints from the brand and the canvas may be drawing the stored literal.
2. **The canvas theme.** `buildChrome` returns a `colors` map and its comment says
   the studio builds its canvas theme from THAT "so silica's live repaint colors
   every block in exactly the brand + fixed-semantic colors the inbox gets". If the
   mechanism is right, something is not reaching it.

Whichever it is, the inspector's swatch should show the color that will actually
be sent, and say when it is following the brand rather than a value.
