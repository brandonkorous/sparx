# 491 — The workspace scrollbars flickered, then sat there over content that fits

**Status:** fixed
**Severity:** minor
**Found by:** Brandon, watching the console while act 121 was being driven
**Surface:** the workspace canvas, every pane (both consoles)
**Filed:** 2026-09-09

## What was wrong

The scrollbars around the workspace flickered on and off, and then stayed on
over a workspace with nothing to scroll.

Measured on the pane frame at rest:

| box        | width  | height |
| ---------- | ------ | ------ |
| visible    | 1327   | 938    |
| scrollable | 1342   | 953    |
| difference | **15** | **15** |

Fifteen pixels is exactly one scrollbar. Both axes overflowed by exactly one
scrollbar, which is the signature of each one being caused by the other. Forcing
`overflow: hidden` for a moment collapsed both numbers to `1342 x 953` — an
exact fit. **The overflowing content WAS the scrollbars.**

## Why

The canvas has three layers (see the header of `use-window-canvas.ts`). The
middle one, the CLIP, is the layer that decides how far the frame scrolls, and
it was given a pixel size floored at the frame's own visible width:

```ts
let width = Math.max(frame.clientWidth, Math.ceil(extent.width));
let height = Math.max(frame.clientHeight, Math.ceil(extent.height));
// …
const next = { width: `${width}px`, height: `${height}px` };
```

In tabs mode nothing floats, so `extent` is `0` and that floor is the whole
answer: **the clip is set to exactly the width at which a scrollbar starts.**

`clientWidth` is a ROUNDED integer. On any display with fractional layout — any
scaling factor — the true content box is something like `1341.6`, `clientWidth`
reports `1342`, and the pixel written back is a fraction WIDER than the box it
was read from. That fraction conjures a scrollbar. The scrollbar shrinks the
box. A resize observer watches the frame, so it re-reads the smaller box and
writes that back, and the other scrollbar goes.

The comment sitting directly above it argued the loop was impossible:

> `clientWidth` already excludes a scrollbar that has appeared, so a vertical one
> cannot conjure a horizontal one.

That sentence is true and beside the point. It answers "can a scrollbar already
on screen cause the other one", and the answer is no. It never asks what STARTS
one, and the fraction is what starts one. **Reading the comment as a claim about
the code, rather than as a checklist to verify, is what let this stand.**

## The fix

A pixel size only while a window genuinely reaches past the frame. Otherwise the
inline size is cleared and the clip's own `w-full h-full` holds it — a
percentage of the frame's content box, which can never be the cause of its own
scrollbar.

```ts
const next = {
  width: width > frame.clientWidth ? `${width}px` : '',
  height: height > frame.clientHeight ? `${height}px` : '',
};
```

## Proven

Both halves, by measurement:

- **Nothing pushed out:** inline size is empty, `1342 x 953` in a `1342 x 953`
  box, overflow `0 x 0`. No scrollbars.
- **A window dragged past the right edge:** inline width becomes `1453px`,
  `overflowX` is 111 — one horizontal scrollbar — and **`overflowY` is 0**. That
  last number is the proof: before the fix, a horizontal scrollbar conjured a
  vertical one.
- **Dragged back inside:** inline size empty again, overflow `0 x 0`. The
  "back inside ⇒ none" promise in the file's own header comment now holds.
