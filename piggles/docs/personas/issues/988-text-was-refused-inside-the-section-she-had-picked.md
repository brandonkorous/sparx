# 988 — Text was refused inside the section she had picked

**Status:** confirmed
**Severity:** major
**Found by:** P09 · The Marrow Review · act 10, designing a correction notice
**Surface:** mypiggles › My Site › Email designs › an email › Add & layers › Insert (both consoles, shared studio)
**Filed:** 2026-10-11
**Fixed:** 2026-10-11
**Confirmed by:** P09 on screen, 2026-10-11
**Blocked on:** nothing

## What happened

Rosalind made a new email, "Correction notice", to tell her readers about a
wrong figure. It had her header and footer and nothing between them. She opened
Insert and clicked **Text**. The editor said:

- **"Text" can't go there. It needs to sit inside a section. Add a section
  first, or pick one in your email, then add this to it.**

So she added a **Section**. It was added, and it was selected. She clicked
**Text** again and got the same message. She picked the section in Layers, where
it was highlighted, and clicked **Text** a third time. Same message.

She had done both things the message told her to do. A new email could not get
its first line of words from the Insert list. This is the first thing anyone
does in a new email.

## Why

A clicked row landed BESIDE the selection (`resolveEmailDrop`, position
`after`), climbing outward until something could hold it. Beside a section is
the email body, which holds only sections, and nothing is above the body. So
Text with a section selected had nowhere to go, every time. The message promised
"pick one in your email, then add this to it"; the code never tried "to it".

## The fix

`clickedEmailSlot(root, anchorId, node)` in `wizeworks/packages/studio/src/email/drop.ts`:

- With something selected that can HOLD the block (a section, a column, a link
  group), the block goes inside it, at the end. That is what the message says.
- Otherwise it goes beside the selection, climbing, as before. A Section with a
  section selected still lands after it, and Text with a text block selected
  lands after that text block.
- With nothing selected, the end of the email (`appendEmailSlot`), as before.

`react/email/palette.tsx` uses it for every clicked row.

## Proof

- `src/email/drop.test.ts`, 6 new cases: Text into a selected empty section;
  at the end of a section with content; into a selected column; a Section
  after a selected section; Text after selected text; nothing selected uses the
  end of the email.
- Red: without the inside rule, 3 of the 6 fail. Restored, 15 of 15. The
  studio's email tests pass (36). Lint, format and the studio typecheck are
  clean.
- On screen: with her section picked, **Text** added "Write something…" inside
  it. She wrote the correction in the Copy box, saved and published ("Saved.
  This is what recipients get."), and sent it to 37 readers (issue 985).
