# 296 — A full stop sat on a line of its own

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · rating the panes
**Surface:** workbench › AI › Permissions and Instructions; sparx console
**Filed:** 2026-10-17
**Fixed:** 2026-10-17
**Confirmed by:** sparx as Doty (Gillett Diesel Service), 2026-10-17
**Blocked on:** —

## What happened

Under the Permissions intro, the note pointing at Instructions was two pieces: a sentence, and a link with the full stop after it in its own element. At most widths the link wrapped, and "Instructions." or a bare "." sat alone on the next line. Instructions had the mirror note pointing at Permissions, with the same fault.

## What should have happened

One sentence that wraps like any other.

## How to reproduce

1. Open AI › Permissions at about 1100px wide.
2. Read the line under the intro.

## Why it matters

It reads as a broken page, on the screen that decides what an outside app may do.

## Where it lives

`surfaces/ai/tool-policies.tsx` and `surfaces/ai/prompts-list.tsx`.

## The fix

Both notes are one `<Text>` sentence with the link inside it, so the full stop travels with the word before it.

No test: this is the words on the page.

ESLint and the workbench `tsc` run out of memory on this machine: not checked.

## Confirmed by

sparx as Doty, 2026-10-17. Permissions reads "This is about an outside app reaching into your business and acting. It’s not the writing help sparx does with your own AI account: that’s in Instructions." as one sentence, wide and at 360px. Instructions reads the same way toward Permissions.

## Rating effect

See the pane's row in `rating.md`.
