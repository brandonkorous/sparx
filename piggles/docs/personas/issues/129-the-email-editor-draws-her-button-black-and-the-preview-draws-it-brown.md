# 129 — The email editor draws her button black and the preview draws it brown

**Status:** fixed (act 324): the colors; the header the inbox shows is still not on the canvas
**Severity:** minor
**Found by:** P02 · Halo & Hem · act 9
**Surface:** mypiggles › My Site › Email designs › the editor canvas
**Filed:** 2026-08-23
**Fixed:** —
**Confirmed by:** P03 · Juniper Row · act 324, on her own Booking reminder
**Blocked on:** —

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

## Act 324: the cause, and the fix

Reproduced on Juniper Row's own Booking reminder: on the canvas a near-black
"Manage booking" and a plain "Upcoming"; in Preview her orange button, an
orange date and a blue "Upcoming".

It was the first candidate. Every color an author has not picked carries an
`Auto` flag (`bgAuto`, `colorAuto`, …), and the send repaints those from the
site's brand (`applyBrandColors` in `@wizeworks/email`). The canvas never did:
the brand colors it was handed (`emailColors`, from `/v1/builder/emails/frame`)
were used only to give a NEW block its colors (`palette.tsx`). A block already
in the design drew its stored value, `#111827`.

Now the API paints the document the editor loads with the same function, the
same brand and the same fallback the send uses
(`builderEmailService.brandForCanvas`, called from `GET /v1/builder/emails/:id`).
A color the author picked has no `Auto` flag and is left as it is. The editor
does not count the painted colors as a change: Save stays off until she edits.
Seen on screen: the canvas now draws the orange button, the orange date and
the blue "Upcoming" the inbox gets. The color box reads the same painted value
(`node.bg`), so it should now show the color that will be sent; it was not
opened, because the page stopped answering the browser at that point.

**Still not the same:** the inbox's header bar ("Juniper Row") and footer are
drawn by the send around the body, and the studio's email canvas has no
notion of them, so the canvas shows the body alone. That is a canvas addition
(drawing `buildChrome`'s `frame` as inert chrome), not a color fix.

A side finding, filed as [919](919-her-automatic-emails-are-stuck-on-an-older-wording.md):
her Booking reminder still says "Hi Alex — a friendly reminder", although the
shipped default no longer has the dash, because the refresh that brings untouched
defaults forward does not recognize her stored version.
