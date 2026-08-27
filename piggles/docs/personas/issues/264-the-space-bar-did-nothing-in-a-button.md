# 264 — The space bar did nothing, so her questions came out as one word

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · RULE #8 — writing the Shipping and returns page
**Surface:** mypiggles › My Site › Page, typing on the canvas
**Filed:** 2026-08-26
**Confirmed:** 2026-08-26

## What happened

Devi inserted **Questions people ask**, double-clicked the first question, and
typed over the sample one. What landed:

```
HowdoIswapsomethingforadifferentsize?
```

Every space was gone. Not collapsed, not turned into something else — never
inserted at all. The rest of the same page took spaces perfectly: the heading,
the standfirst, all three cards, every answer.

She would have had to publish an FAQ whose questions are unreadable, or give up
on the block.

## What should have happened

The space bar types a space.

## Why it matters

- **It is a block with one purpose and that purpose is sentences.** Every
  question in an FAQ is more than one word. The block was unusable.
- **Nothing says so.** No error, no warning, no disabled state. The caret is
  there, the letters appear, and only the spaces silently vanish — so the first
  assumption is that your own keyboard is broken.
- It reaches further than the FAQ. Any block that puts editable words on a real
  `<button>` has it, including the **Send button on the enquiry form** she had
  just put on her Contact page, and Previous/Next on the gallery.

## Where it lives

A `<button>`'s own keyboard contract is _the space bar activates me_, and the
browser goes on honoring it while the element is `contentEditable`. The FAQ
question is a real button, correctly:

```ts
// silica-catalog/src/sections/process.ts
part(el('button', '…', { text: q, attrs: { type: 'button' } }), 'trigger');
```

So does the enquiry form's submit ([convert.ts:65](../../../../wizeworks/packages/silica-catalog/src/sections/convert.ts))
and the gallery's Previous/Next. An `<a>` is unaffected — anchors activate on
Enter, not Space — which is why the Contact page's own "Email me directly"
button, which is an anchor with a `mailto:`, always typed fine and hid how wide
this was.

The editor's own key handling
([use-inline-text.ts](../../../../wizeworks/packages/studio/src/react/canvas/use-inline-text.ts))
already knew that a control's keys mean something else while you are typing into
it — Enter finishes the edit rather than inserting a line break, Escape puts the
old words back. Space was the case nobody had hit yet.

Proved on the page, not inferred:

```
keydown " " code Space  target BUTTON  editing true   → no keypress, no beforeinput
keydown "a"             target BUTTON  editing true   → keypress, beforeinput insertText "a"
```

## The fix

**The editor types the space for the controls that would have eaten it.**
`swallowsSpace` in [text-edit.ts](../../../../wizeworks/packages/studio/src/react/canvas/text-edit.ts)
names them — `<button>`, `<summary>`, and the ARIA roles whose contract is
activation — and only those. Everywhere else the browser's own space handling is
left alone, because it knows things we do not.

**Through `execCommand('insertText')`, not our own DOM insert.** That mattered
and cost the first attempt: with the key handler in place and firing, the words
STILL came out run together. A bare one-space text node at the end of a
contenteditable is unrendered whitespace, and Chrome discards it the moment the
next character arrives — so each space was inserted and then quietly swept away.
`execCommand` goes through the same editing pipeline the space bar itself would
have used, which knows a trailing space has to be held open.

**And `textIn` now hands back ordinary spaces.** Holding that space open is done
with a non-breaking space, which is invisible on screen, in the Words box and in
the tree — so without this it rides into the saved copy, the search description
and the published HTML as a character nobody typed and nobody can see. That
applies to every edit, not just this one.

## Confirmed

On the canvas, as Devi:

```
FAQ question   "How do I swap something for a different size?"   ✓
Form submit    "Send it to Devi"                                 ✓  (a real <button>)
Anchor button  "Write to me now"                                 ✓  (was never broken)
```

All four questions on `/shipping-and-returns` are hers and live.
`swallowsSpace` has a test that goes red without the `<button>` case; 161 studio
tests pass and the package typechecks.

## Also seen while here, not filed

The three collapsed answers in the FAQ block cannot be reached on the canvas at
all — the block ships them `hidden` and the editor does not run the disclosure
behavior, so clicking a question selects it rather than opening it. They ARE
reachable through Layers, which lists all eight nodes with their text, and the
Words box edits them normally. A longer route, not a dead end.

## Related

[[feedback_absent_behaves_like_fine]] — the third fault in this run whose whole
symptom is silence. Nothing typechecks differently, nothing warns, and the only
way to find it is to type a sentence and read it back.

[[feedback_test_as_a_business_owner]] — found by writing a real page, not by
opening the editor and looking at it.

## Rating effect

The page editor, in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
