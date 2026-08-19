# Piggles builders on a phone

**Version:** 1.1
**Author:** Brandon Korous
**Last Updated:** 2026-08-18

Companion to [README.md](README.md). The five builders — theme, layout, page,
component, email — are the last desktop-shaped thing in a console that is
otherwise fully at home on a phone. This says what is actually wrong, and what
we build.

## This is not a layout problem

The layout is the part that already half-works. `tree-builder.tsx` and
`email-builder.tsx` collapse their three columns into one below 64rem and offer
a bottom bar to switch between them; the theme builder stacks its rail above the
board. Someone opening the page builder on a phone gets something that looks
like a builder.

They cannot build with it. Three of the five things you do to a block — **move
it, delete it, duplicate it** — exist only as a mouse drag or a keystroke, and a
phone has neither. Rearranging the columns more elegantly does not change that.
So the verbs come first and the layout second; doing it the other way round
produces a builder that looks finished on a phone and still cannot make a page.

## What is broken

**1 · Touch cannot drag anything. — FIXED 2026-08-18.** Every drag in the
package was the native HTML5 API — `draggable` plus `dataTransfer` — in
`palette/palette.tsx`, `navigator/navigator.tsx`, `canvas/canvas.tsx` and their
three email counterparts. Touch does not deliver those events on iOS Safari and
does not deliver them reliably on Android Chrome; that is the reason drag
libraries ship a separate touch sensor at all. On a phone no block could be
dragged from Insert onto the page, no layer could be reordered, and nothing on
the canvas could be moved.

All six surfaces now carry a second drag over **pointer events**, which every
input speaks — `react/drag/pointer-drag.tsx`, with the timing arithmetic split
out pure and tested in `react/drag/gesture.ts`. It runs BESIDE the native path
rather than replacing it: a mouse keeps the browser's own drag, which was
already proven, and only touch and pen come through the new one. Both ends feed
the same `dropPosition` / `resolveDropTarget` rule, so where a block lands cannot
depend on what you dragged it with.

The gesture is **press and hold** (280ms, 8px of slop). A finger cannot hover, so
the gesture needs a way to say "I mean to move this" that a scroll does not also
say: hold still and the block lifts; move first and the list scrolls. The lifted
block fades so the hold is visibly registered, the page is stopped from scrolling
under an active drag, near either edge the list pulls itself along so a drag can
reach past one screenful, and the compatibility click touch leaves behind is
swallowed — without that last one a dragged palette row landed twice, once where
it was dropped and once wherever a click decided.

Drag is scoped per DOCUMENT (`docKey`), not per kind. Two builders dock side by
side routinely, and a block dragged across the gap between them would otherwise
draw a drop indicator on a page it can never land in.

**2 · Delete and Duplicate are keyboard-only.** `builders/shortcuts.ts` binds
Backspace and Cmd-D and nothing else offers them — there is no button, no menu,
no row action anywhere in the package. On a phone you can add a block and then
never remove it.

**3 · The breakpoint asks the window, not the pane.** Those two builders are the
only files in the package using viewport prefixes (`lg:`); everything else in
the console uses `@container`, for the reason `lib/use-compact.ts` states
outright — a pane's width is unrelated to the screen's. Two failures fall out of
it. A pane docked narrow on a desktop still renders three crushed columns. And a
tablet in landscape at 1024px gets the full desktop three-column builder on a
touch screen — cramped _and_ drag-dependent, the worst of both.

**4 · Chrome eats the screen.** The page builder's top bar carries ten controls
— three devices, undo, redo, Preview, History, Save as piece, Save, Publish — in
a `flex-wrap` row, so on a phone it becomes two or three stacked rows. Under it
sits the three-way view switcher, under that the status bar, and under that the
shell reserves 80px for the floating nav bar. That is roughly a third of a
390x844 screen spent before any of the page is visible.

**5 · The builder paints a bar where the shell already has one.** The narrow
view switcher is a bottom bar sitting directly above the floating nav bar.
`components/mobile-stack.tsx` records that two bars stacked at the bottom of a
phone is exactly what the status strip was dropped for. We reintroduced it.

**6 · The device switcher cannot tell the truth on a phone.** `DEVICE_CLASS`
clamps every frame with `max-w-full`, so at 342px of usable canvas all three
devices render the same reflowed phone layout. Someone tapping **Computer** to
check their site is shown a phone layout labelled Computer — a confident wrong
answer, which is worse than refusing to answer.

**7 · The theme builder pushes its subject off screen.** It is the closest to
right, being already container-queried, but stacked narrow the rail takes
`max-h-96` — 384px — above the board, so the brand board the rail exists to
change starts below the fold.

## What we build

### Three widths, measured on the pane

| Container | Shape                                                                  |
| --------- | ---------------------------------------------------------------------- |
| 64rem +   | Three columns — Layers/Insert, canvas, Inspector. Unchanged.           |
| 40–64rem  | Canvas + Inspector. Layers/Insert behind a left drawer.                |
| under 40  | Canvas alone. Both rails behind edge drawers, opened from the top bar. |

`@container` throughout, with the wrapper/element split the theme builder
already documents: the query goes on a parent, never on the element carrying the
variants.

### Drawers, not a view switch

The current switcher **replaces** the canvas: you tap Change, the page
disappears, you adjust a colour, and you cannot see what it did until you tap
back. A drawer keeps the work on screen and returns you to exactly where you
were.

- **Layers / Insert** — a left drawer. You are browsing; the canvas does not
  need to be visible, so a modal drawer is right and `<Drawer side="left">` from
  silicaui is the component.
- **Inspector** — a **bottom** drawer at roughly half height, so the block you
  are changing stays visible above it. Adjusting padding while looking at the
  thing you are padding is the entire point.

### One bar, at the top

Below 40rem the builder paints no bottom bar at all — the shell owns that edge.
Everything moves into the top bar: the two drawer triggers, the device switcher,
undo and redo, Save and Publish. Preview, History and Save as piece fold into an
overflow menu. The status line becomes a word beside Save rather than a row of
its own.

### The verbs get buttons

A **node action bar** in the Inspector header, visible whenever something is
selected: move up, move down, move in, move out, duplicate, delete. Every one is
an op that already exists (`node.move`, `node.insert`, `node.remove`) — this is
UI over machinery that is already built and tested.

This is not a mobile feature. It is the same bar on a desktop, where it gives
keyboard and screen-reader users a real route to three verbs currently reachable
only by mouse-drag or keystroke.

Beside it, two touch paths for placement:

- **Tap to place** — the palette's existing `onInsert`, with an explicit rule
  (inside the selection when it can hold children, otherwise after it), the new
  node selected and scrolled to so you can see where it landed.
- **Move here** — tap a layer row's move control and the tree turns its gaps
  into tappable targets; tap one to land. Same `resolveDropTarget` the drag path
  uses, so the two agree by construction.

### The device switcher tells the truth

Keep the frame at its real width — 390 / 834 / 1440 — and **scale** it to fit,
rather than clamping it with `max-w-full`. Computer then shows a real desktop
layout, shrunk, that can be panned and pinched. A layout you cannot read at a
glance is still worth showing; a phone layout labelled Computer is not.

### The theme builder

Same treatment: the board is the canvas, the rail is a left drawer below 40rem,
and the `max-h-96` stack goes away.

## Decisions taken

- **The fix lives in `@wizeworks/studio`, not in Piggles.** All seven findings
  are in the platform package, and sparx inherits every one of them when it cuts
  over. Piggles' own `components/mobile/sheet.tsx` cannot be reached from there
  (wizeworks/CLAUDE.md RULE #0) and should not be — silicaui's `Drawer` is the
  component, and where it does not fit, the gap belongs upstream in silicaui
  rather than in a copy here.
- **Verbs before layout.** Phase 10 is ordered so that after the first three
  tasks a phone can already build a page inside today's layout.
- **44px tap floor**, matching the nav bar's own floor.
- **No new dependency.** No drag library — the touch drag is ~250 lines of
  pointer events over the ops and the drop rule that already existed, and the tap
  paths are taps against those same ops.

## Open questions

- **Q10.1 — is a modal Inspector drawer good enough?** It is modal by
  construction in silicaui, so while it is open the canvas cannot be tapped to
  select something else. Recommendation: ship modal. Selection is made _before_
  the drawer opens, and re-selecting is one dismiss away. If it grates in use,
  the answer is a non-modal variant in silicaui, not a hand-rolled panel here.
- **Q10.2 — does move-in / move-out earn its place in v1?** Up, down, duplicate
  and delete cover most edits. Recommendation: include all six — the catalog is
  nested by design, and a builder that cannot get a block into a container can
  only edit pages someone else's mouse built.
- **Q10.3 — should a phone offer the device switcher at all?** Recommendation:
  yes, once it scales honestly. Checking the site on a computer is a real thing
  to want from a phone.
