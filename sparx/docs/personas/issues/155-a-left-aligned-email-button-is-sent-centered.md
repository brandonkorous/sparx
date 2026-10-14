# 155 — A left-aligned email button is sent centered

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 10 (one email to the fleets)
**Surface:** workbench › Email designs (canvas vs "Preview & check"); every email sent
**Filed:** 2026-10-08
**Fixed:** 2026-10-08, in silicaui (PR #109, released as 0.59.0; sparx catalog raised to ^0.59.0 on 2026-10-08)
**Confirmed by:** P01 on screen, 2026-10-08
**Blocked on:** —

## What happened

In "Fleet winter readiness, November 2026", the "Book a winter check" button (from the "Text block" insert) sits at the left on the canvas. "Preview & check", which shows "what lands in the inbox", draws it centered. The saved button says `"align": "left"`.

## What should have happened

The button lands where the canvas shows it.

## Why it matters

The canvas is the owner's promise of the email. A button that moves between the canvas and the inbox is the email not looking like what was designed.

## Where it lives

silicaui, `packages/silicaui-builder/src/email/projector.ts`:

- `toEmailHtml` wraps the whole body in `<td align="center">`. In browsers that reads as `text-align: -webkit-center`, which centers block children, tables included.
- `renderButton` positions the button's table with `margin` only: `0 auto` for center, `0 0 0 auto` for right, and `0` for left. Nothing nearer than the body cell says "left", so a left button inherits the center.

Proposed fix, in silicaui: put the button table inside a full-width one-cell wrapper whose cell carries the alignment, `<table role="presentation" width="100%"><tr><td align="left|center|right">…</td></tr></table>`. This is the common way email HTML places a block, and it holds in Outlook too. Then raise the silicaui version in sparx's `pnpm-workspace.yaml` catalog.

## The fix

In silicaui, `packages/silicaui-builder/src/email/projector.ts`: a new `placed(align, html)` puts a block inside a full-width, one-cell table whose cell carries the block's own `align`. The button, the social row and the image use it, and their old `margin` positioning is gone. The nearest cell now says where the block goes, so it wins in browsers, and it is how Outlook places a block too (Outlook ignores `margin: auto`, which the right and center cases used). No `text-align` style on the cell: the attribute's `-webkit-*` value is what moves a block, and a plain `text-align` would replace it and stop centering one.

The measurement found more than the button. On the old markup, a left button, a left social row and a left image all landed in the middle, in every section that is not itself aligned left. Right, center and video were already right.

Test, proved red: silicaui `packages/silicaui-builder/e2e/email-block-alignment.spec.ts` renders the projector's real output in a browser and measures every block kind at every alignment, in sections aligned by default, left, center and right. On the old markup it fails 9 times (left button, left social row, left image, in 3 sections). It passes now. All 77 email e2e specs pass, builder typecheck and lint are clean, and the PR's CI is green.

Changeset: `@wizeworks/silicaui-builder` patch. Commit on branch `fix/email-button-align`, PR https://github.com/silicaui/silicaui/pull/109. Merging was refused to me; it is Brandon's.

## Confirmed by

P01 on screen, 2026-10-08, after sparx moved to silicaui 0.59.0: Email › Broadcasts ›
"Fleet winter readiness, November 2026" › "What was sent" (the server's real send
render, for Seamus O'Malley) draws "Book a winter check" at the left edge of the text,
as the canvas does.

Checked against every other email: all 45 of Gillett's designs were drawn with the old
(0.58.2) and the new (0.59.0) projector and every link and image measured. Only three
buttons moved, each from the center to the left, and each is stored `align: "left"`
under left-aligned text: "Book a winter check", and "Start exploring" and "Visit the
shop" in the Garage blueprint's two welcome emails. Nothing else moved by a pixel.

## Rating effect

—
