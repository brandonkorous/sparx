# 019 — To change a word on the page you type it into a box on the other side of the screen

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Thistle & Rye · act 7
**Surface:** mypiggles › My Site › Page — the builder canvas
**Filed:** 2026-08-20
**Fixed:** 2026-08-20 — inline editing built, not the fallback
**Confirmed by:** P01 · act 7, on the screen

## What happened

Marisol opens her home page to replace "Kettle & Crumb" with her own name. The
heading is right there on the canvas, at 60-odd pixels tall. She does what anybody
does with text they can see: she **double-clicks it**.

Nothing happens. No caret, no selection, no editing state — the canvas does not
react to a double-click at all. What her second click actually did was leave the
selection where it was; the keystrokes that followed went to the browser, not to the
heading, and selected the whole console instead.

The real way is: select the layer, cross to the Inspector on the far right, switch
from **Design** to **Settings**, and type into a textarea labelled **Words**. That
works, and the field is well named. It is just nowhere near the word.

## What should have happened

Double-clicking text on the canvas puts a caret in it.

Every builder a small-business owner has ever touched behaves this way, and the
canvas already knows which node was clicked — it is how selection works. Piggles'
audience is named in its own rules as people who are "comfortable with a phone and
impatient with software"; the double-click is not a power-user shortcut, it is the
first thing they try.

## How to reproduce

Every time, any text node:

1. **My Site → Page**, open any page.
2. Double-click a heading or paragraph on the canvas.
3. Nothing. Type — the characters go to the page, not the heading.

## Why it matters

Small, because there IS a way and the Inspector is discoverable once you know the
Design/Settings split. Worth filing for three reasons:

1. **The failure is silent.** A double-click that does nothing reads as "this text is
   locked", not "use the panel instead". Nothing on screen points at Words.
2. **It doubles the distance for every edit.** Rewriting one page of hers took
   roughly forty round trips between the canvas on the left and a textarea on the
   right, with the canvas scrolled away from whatever was being typed — so the words
   were being written without the sentence in view.
3. **The editing surface is 4 lines tall.** Words is a small textarea; her hero
   paragraph is three sentences, and it scrolls inside itself while the actual
   rendered paragraph is off-screen.

## Where it lives

`wizeworks/packages/studio/src/react/canvas/` — `canvas.tsx`, `hit.ts`,
`render-node.tsx`. There is **no** `contentEditable`, no `dblclick` handler and no
double-click path anywhere in the canvas: this is a capability that was never built,
not one that broke. `surfaces/studio/page-settings-panel.tsx` and the node inspector
are the only text entry points.

## What was built

Inline editing, not the cheaper fallback. Double-clicking any node that holds
words puts a caret **at the word that was clicked** (`caretPositionFromPoint`),
and from there it behaves like text:

| Gesture      | What happens                                                                    |
| ------------ | ------------------------------------------------------------------------------- |
| Double-click | Caret lands where you aimed                                                     |
| Type         | The words change on the page, at the size and color they really are             |
| `Enter`      | Finishes the edit. Never inserts a line break — the tree cannot hold one        |
| `Escape`     | Puts the original words back, and writes nothing                                |
| Click away   | Finishes, same as `Enter`                                                       |
| Paste        | Arrives as WORDS — styled markup out of a document is flattened, never imported |
| `⌘Z`         | One undo entry per edit, not one per keystroke                                  |

Three things that had to be true and are:

1. **The tree only learns at the end.** Committing applies `node.setText` — the
   same op the Inspector's Words box applies — so undo, the dirty flag, the
   status bar and a second pane open on the same page all keep working without
   knowing inline editing exists.
2. **The element owns its text while it is being typed into.** React renders the
   words it had when the caret went in and is never handed different ones until
   the edit commits, so a hover, a selection change or an edit landing in another
   pane cannot eat the caret.
3. **Only real text takes a caret.** `ownText` in `tree/walk.ts` is now the one
   test, shared with the Inspector: a node holding blocks is a container (writing
   into it would discard everything inside), an `<img>` holds nothing, and an
   empty `<div>` is a layout box rather than an empty sentence. Found on the
   screen — the first build put a caret in the hero photograph.

Two defects were found and fixed while confirming this by hand:

- **The edit closed in the millisecond it opened.** React's `onBlur` is
  `focusout`, which BUBBLES, so every focus change under the canvas arrived at
  the handler — including the pane taking focus during the very click that
  started the edit. Guarded to the edited element.
- **Finishing an edit killed the pane's shortcuts.** The element stops being
  editable, so the browser dropped focus to the document and `⌘Z`, Delete and
  Duplicate went dead until something was clicked. Finishing at the keyboard now
  hands focus back to the canvas (which is `tabIndex={-1}` for exactly this).

## What it would take, and why the fallback was not taken

Inline editing on a canvas that renders a node tree is not a small feature — the
caret has to write back into the tree through the same op pipeline as everything
else, so undo, the dirty flag and multi-panel sync all keep working, and rich text
inside a heading has to stay out. That is a builder design decision.

**A smaller step was available:** make the double-click select the node, open the
Inspector on **Settings**, and focus **Words** — the same three actions performed
by hand, on the gesture already tried. It was not taken. It would have left the
words being written on the far side of the screen from the sentence, which is the
actual complaint; the gesture would have worked and the problem would have
remained.

## Where the fix lives

- `wizeworks/packages/studio/src/tree/walk.ts` — `ownText`, the shared rule for
  what can hold words (+ `src/tree/own-text.test.ts`, 8 tests)
- `wizeworks/packages/studio/src/react/canvas/use-inline-text.ts` — the gesture,
  the commit, Enter/Escape, focus
- `wizeworks/packages/studio/src/react/canvas/text-edit.ts` — the DOM half: caret
  from a point, paste flattening
- `wizeworks/packages/studio/src/react/canvas/render-node.tsx` — renders the
  edited node `contentEditable` and stops it being draggable while it is
- `wizeworks/packages/studio/src/react/inspector/settings-tab.tsx` — its local
  copy of the rule deleted, now sharing `ownText`

## Rating effect

mypiggles › My Site › Page — Ease 8 → 9; recorded in [rating.md](../rating.md).
