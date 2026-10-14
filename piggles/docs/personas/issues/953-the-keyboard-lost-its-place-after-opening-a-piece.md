# 953 — The keyboard lost its place after opening a piece

**Status:** fixed (act 7)
**Severity:** major
**Found by:** P09 · The Marrow Review · act 7, writing a piece with the keyboard only
**Surface:** both consoles: the Ctrl K box, and any pane that becomes another (New content becoming the piece)
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P09 · act 7, Ctrl K › Write something new › Enter, then Tab
**Blocked on:** —

## What happened

1. Ctrl K, "Write something new", Enter. The New content pane opened. Focus went to the
   page itself: the next Tab reached the skip link, then the rail, about thirty stops
   from the form.
2. After **Create**, the pane became the piece. Focus fell to the page again.

## Why

- The Ctrl K box, closing, handed focus back to whatever had it before, which for
  someone who pressed Ctrl K was the page.
- A pane retargeted in place unmounts its old view, and the focused button with it.

## The fix

- `components/pane-focus.ts` (new, both consoles): `focusWasLost`, `focusActivePane`,
  `focusOpenedPane`. Moves focus into the active pane only when nothing holds it, so a
  row that opens its own dialog keeps its focus.
- `components/launcher.tsx`: `finalFocus` sends focus to what was opened, not back.
- `lib/workbench/controller.ts` `replace()`: after the new view mounts, focus goes back
  into the pane.
- `components/skip-to-workspace.tsx` re-exports from `pane-focus.ts`.

## Proof

- `launcher-focus.test.ts` (both consoles), 4. `focusWasLost` answering false reddens
  1; removing the launcher's hand-off reddens 1; removing the controller's reddens 1.
- On screen: Ctrl K, "Write something new", Enter, then Tab, Tab reaches **Kind of
  content**.

## Found on the same pass, and fixed

- **The body editor's toolbar was fourteen Tab stops** between the standfirst and the
  body. It is now one stop, with the arrow keys, Home and End inside it (the ARIA
  toolbar pattern): `packages/cms-editor/src/toolbar-keys.ts` (new) and `editor.tsx`.
  `toolbar-keys.test.ts`, 3; making `nextToolIndex` answer nothing reddens 2.
- **The picture picker's groups were a row of buttons**, each its own Tab stop, with the
  unselected ones painted `neutral` and album counts faded. They are silica `Tabs`
  (pills, the module's color) in both consoles: one stop, arrows inside. On screen: Tab
  reaches "All", ArrowRight twice and Enter shows Product, one Tab leaves for "New
  album".
- The picker said "not saved until you save the whole page" while she wrote a piece. It
  now says "until you save your changes", in both consoles.

The schedule dialog letting Tab reach the rest of the console is by design: it is scoped
to its pane (`PaneScope`), so the rest of the console stays usable.
