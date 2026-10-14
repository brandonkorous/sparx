# 948 — Her contributors list said nobody had published anything

**Status:** fixed (act 6)
**Severity:** minor
**Found by:** P09 · The Marrow Review · act 6, building the Contributors page
**Surface:** mypiggles › My Site › a page (the editor canvas), both consoles
**Filed:** 2026-10-08
**Fixed:** 2026-10-08
**Confirmed by:** P09 · act 6, the Contributors page in the editor: the line drawn dashed, its hover note saying when it shows
**Blocked on:** —

## What happened

Rosalind added **List of your authors** to her new Contributors page. In the editor
it showed one placeholder card ("Their name", "A few lines about them.") and, under
it, **"Nobody has anything published yet."** She has four contributors with eleven
published pieces between them. Her Journal and section pages read "No posts yet"
under their cards in the same way.

## Why

The canvas draws the page as it is authored, every node once, so each can be
selected and edited: a list's card once, and its "nothing here" line, which on the
live site shows only while the list is empty. Nothing on the canvas said that line
was conditional, so it read as a statement about her site.

## The fix

A node that shows on the live site only sometimes (`data.kind === 'visible'`) is
drawn with a dashed edge in the console's own color, and says when on hover: "Shows
on your site only while this list is empty" or "Shows on your site only when it has
something to show" (`gateNote`, `@wizeworks/studio`). It stays editable. Both consoles
share the editor, so both have it.

## Proof

- `gate-note.test.ts` (studio), 3. Making `gateNote` answer nothing reddens 2.
- On screen, as Rosalind: the Contributors page in the editor, the empty line, the
  portrait and the biography each drawn dashed; the empty line's hover note reads
  "Shows on your site only while this list is empty."

## Still open

- The canvas still shows one placeholder card rather than her four contributors.
  Drawing real records into an editable canvas means drawing copies nobody can
  select; the dashed line answers what she misread.
