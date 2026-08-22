# 027 — She typed new words on the page, and the box beside them put the old ones back

**Status:** fixed
**Severity:** major — silent data loss
**Found by:** P01 · Thistle & Rye · act 7 — writing the Celebration cakes page
**Surface:** mypiggles › My Site › Page — the canvas and the Inspector's Settings tab, together
**Filed:** 2026-08-20
**Fixed:** 2026-08-20
**Confirmed by:** P01 · act 7, on the screen

## What happened

Marisol double-clicked the green button on her new Celebration cakes page, which
said **Get a quote**, and typed **Ask about a cake**. The button changed. Good.

The Inspector was open beside it, on the same button, with a box labelled
**Words**. It still said **Get a quote**.

She clicked in that box and clicked out again — she typed nothing. The button
went back to **Get a quote**. Her edit was gone, with no message, no undo prompt,
and the canvas never even flickered.

Then, believing the box was the real one, she put the cursor at the end of it and
typed ` today`. The page now had a button reading **Get a quote today** — a
sentence she never wrote, made of the words she had just replaced.

## What should have happened

The two ways of changing the same words must not disagree. Whatever she changed
last is the answer; a box showing an older version of a value is a trap, because
the only way to leave a box is to blur it, and blurring it writes.

## How to reproduce

Every time.

1. Open any page in the builder with a text node on it — a button, a heading.
2. Double-click it on the canvas, select all, type something else, press Enter.
   The canvas updates, and the Layers list updates: the edit really did commit.
3. Look at the Inspector's **Words** box for that same node. It still holds the
   words from before the edit.
4. Click into that box and click out. The old words are written back over the new
   ones.

The same shape exists on five sibling fields, and one of them needs no canvas at
all: on an `<img>`, press **Choose** and pick a picture. That button writes both
`src` and `alt`. The **Picture** and **Describe the picture** boxes six lines
below it keep their old values, and blurring either one reverts the picture she
just chose.

## Why it matters

It silently discards work, and it does it through the one gesture that is
supposed to be safe — clicking away from a box without typing in it. Worse, the
page can end up displaying words nobody wrote, assembled from an old value and a
new fragment. She would publish that.

Inline editing exists because of [#019](019-the-only-way-to-change-a-word-is-a-box-on-the-far-side-of-the-screen.md);
the Words box was made honest about bound values in
[#023](023-a-box-that-took-her-words-and-changed-nothing.md). This is the seam
between those two fixes, and it was not there before either of them.

## Where it lives

[wizeworks/packages/studio/src/react/inspector/settings-tab.tsx](../../../../wizeworks/packages/studio/src/react/inspector/settings-tab.tsx)

Every box in the Settings tab is **uncontrolled** — `defaultValue` plus a commit
on blur, which is the right choice (an op per keystroke would bury undo). React
only re-reads `defaultValue` when the element remounts, and the element only
remounts when its `key` changes. All six keys were the node id and the field
name:

```tsx
<Textarea key={`${id}:text`} defaultValue={text} onBlur={…} />
```

The id does not change when the words do, so the box kept its mount-time value
for as long as the node stayed selected. The blur handler then compared that
stale value against the LIVE node text, found them different, and committed —
which is precisely the mechanism that put "Get a quote" back.

## The fix

Put the value in the key. One helper, applied to all six fields, so a box cannot
outlive the value it is showing:

```tsx
export function fieldKey(id: string, field: string, value: string): string {
  return `${id}:${field}:${value}`;
}

<Textarea key={fieldKey(id, 'text', text)} defaultValue={text} onBlur={…} />
```

Fixed at the shared component rather than at the call site, so sparx's workbench
gets it too — the file is `@wizeworks/studio`, not Piggles.

All six were changed together (`text`, `tag`, `href`, `src`, `alt`, `label`);
fixing only the one that bit would have left the picture-picker version of it in
place. Typing is never interrupted, because the value only moves on commit, and
a box mid-edit has not committed.

Five tests in
[field-key.test.ts](../../../../wizeworks/packages/studio/src/react/inspector/field-key.test.ts)
cover the invariant, including that clearing a value counts as a change. Suite:
**150 tests / 17 files pass**; the package typechecks clean.

## Confirmed by

Re-ran the reproduction as Marisol on the rebuilt Celebration cakes page, 2026-08-20.

Double-clicked the outline button reading **See our work**, selected all, typed
**See the sizes**, pressed Enter. With the node still selected, the Inspector's
**Words** box read **See the sizes** — before the fix it still said _See our work_.

Then the gesture that caused the loss: clicked into that box and clicked out
again without typing. The button stayed **See the sizes**. The Layers list — which
reads the node itself, not the canvas — also read **See the sizes**, so the
document, the canvas and the box all held one value.

**Not checked:** the picture-picker half of it (`src` / `alt` after pressing
**Choose**). Same helper, same key, but it has not been walked.

## Rating effect

None yet — `builder.page` is not re-scored until this is confirmed on the screen.
