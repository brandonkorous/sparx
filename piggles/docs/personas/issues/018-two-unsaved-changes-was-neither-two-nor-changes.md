# 018 — "2 unsaved changes" was neither two nor changes

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Thistle & Rye · act 7
**Surface:** mypiggles › the status bar, every screen
**Filed:** 2026-08-20
**Fixed:** 2026-08-20
**Confirmed by:** rewrote the whole of her home page — heading, two paragraphs, three cards, four opening-hour rows, two buttons — with the page open in two panels. The chip now reads **"Not saved: Home"**, and the tooltip names it.
**Blocked on:** —

## What happened

Marisol is rewriting her home page. She changes the heading, then the paragraph
under it, then the two buttons. Bottom-right of the console, a warning chip says:

> **2 unsaved changes**

She keeps going — another heading, three cards, four rows of opening hours. Twelve
edits later the chip still says:

> **2 unsaved changes**

The number was never counting her edits. It was counting **panels**, and she had the
same page open in two of them. So the chip was saying "two", meaning "one page, twice
on screen", to somebody who had made twelve changes to one page.

Both halves of the sentence were wrong at once:

| The chip said | It actually meant                 |
| ------------- | --------------------------------- |
| `2`           | 2 panels — she had 1 unsaved page |
| `changes`     | panels, which are not changes     |

## What should have happened

Say what is not saved. Marisol has one page with unsaved work in it, so: **Not saved:
Home**.

## Why it matters

This is the chip somebody looks at before closing a laptop, and it is a **count that
does not count**, which the platform's own rules single out: a value nobody measured
must never be rendered as one. Two failure modes, and the second is the bad one:

1. She reads "2 changes", knows she made twelve, and wonders where ten went.
2. Worse, and more likely: two panels on two DIFFERENT pages also read "2", and it is
   the same sentence. The number carries no information she can act on either way.

The tooltip made it stranger — "Click to go to **the pane** with unsaved changes",
singular, on a chip that says two. And "pane" is not a word this product uses
anywhere else; the reload prompt calls the same thing a **panel**.

## How to reproduce

Every time:

1. Open any page in the builder. Open the SAME page again beside it (the row's
   "Open alongside").
2. Change one word. The chip reads **2 unsaved changes**.
3. Change fifty more words. It still reads 2.

## Where it lives

`piggles/apps/workbench/components/status-bar.tsx`. `useDirtyPanes()` returns pane
descriptors — the file's own header comment is honest about it ("The chip counts it")
— and the label just used the wrong noun:

```tsx
{
  dirty.length === 1 ? '1 unsaved change' : `${String(dirty.length)} unsaved changes`;
}
```

## The fix

Two changes, and the second is the one that matters.

**Count documents, not panels.** Two panels on one page are one document and one
draft — they share a store, editing in either changes both, and saving in either
saves both (verified: the second panel showed every edit as it was typed). So the
list is deduped by surface + params before anything is counted:

```ts
const key = `${pane.surface}:${JSON.stringify(pane.params ?? {})}`;
```

**Name it rather than counting it, while there is room.** One unsaved document is the
overwhelmingly common case, and its name is more use than the number `1`:

- one → `Not saved: Home`
- several → `3 not saved`, with the tooltip listing them by name.

The tooltip now says "Home has work you have not saved. Click to go to it." — and
says **panel**, matching the word the reload prompt already uses.

## Confirmed by

> Rewrote her entire home page with it open in two panels. Throughout, the chip read
> **Not saved: Home** — one page, named — and the tooltip named it too. Pressed Save;
> the chip disappeared and the status line moved to "Saved. Visitors still see the
> last published version."

## Rating effect

mypiggles › status bar — Ease 6 → 8. It is a good strip and the other four signals
are honest; this was the one that was not.
