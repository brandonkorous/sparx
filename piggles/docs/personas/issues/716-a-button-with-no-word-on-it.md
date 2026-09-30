# 716 — A button with no word on it, in the one place you cannot hover

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 251
**Surface:** mypiggles + sparx — every pane toolbar; found on Stock › an order to a supplier
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen: the menu now reads Close · Print a label · Refresh this list · Copy a link to this
**Blocked on:** —

## What happened

Devi opened purchase order PO-000005 and tapped the menu at the top of the pane.

| what she saw                        |
| ----------------------------------- |
| **Purchase order actions**          |
| ✓ Close                             |
| 🖨 _(nothing)_                       |
| ↻ Refresh this list · 8 seconds ago |
| 🔗 Copy a link to this              |

Four rows. Three said what they were. One was a printer.

## Why it matters

`controls` **relocates**. Under 672px the pane toolbar folds away and everything
in `controls` is re-rendered, verbatim, inside the overflow popover. Only
`actions` are re-authored there as labelled rows.

Two files in this repo already say what that costs, in their own headers:

> `components/pane-toolbar-overflow.tsx`
> A menu has no position to read and no hover on a touch screen, so an
> unlabelled glyph is a button with no meaning.

> `surfaces/scheduling/calendar-toolbar.tsx`
> a popover row holding one bare chain glyph and no words is a button with no
> meaning on a device that cannot hover.

Both are right. Both were written next to code that kept doing it. This is the
seventh time this month a rule has been found written down in the file and
applied to one of N. [[feedback_a_fix_leaves_its_neighbour_behind]]

The purchase order's own comment argued the case out loud:

```tsx
/* The sticker that makes this order scannable at all. Icon-only: it is
a secondary action, and the tooltip carries the meaning. */
```

The tooltip carries the meaning **in the bar**. In the popover there is no
position to read and on a tablet there is no hover at all, and a warehouse is
the place a tablet gets used.

**MEASURED 2026-09-19** across both consoles: 679 pane toolbars, 662 bespoke
buttons written into them, **55 of which draw an icon and no words**. Twelve of
those are stepper arrows that bracket their own label — `[<] 15–21 Sep [>]` —
which reads correctly wherever it lands, and are exempted by name in the check.
That leaves **43**.

| slot       | count | what happens to it                                  |
| ---------- | ----- | --------------------------------------------------- |
| `controls` | 33    | relocates into the popover as a bare glyph          |
| children   | 5     | wraps to a second row, still nameless               |
| `primary`  | 4     | stays in the bar, still nameless, still unhoverable |
| `refresh`  | 1     | a lifecycle action parked in the refresh slot       |

## Three things this turned up on the way

**A prop that only one renderer read.** `ToolbarAction.title` is documented as
"hover text, set it when the action needs the longer form" and was read by
`ToolbarPrimaryAction` alone. Six secondary actions set it, so six sentences
were written and shown nowhere — including _"Import a list of old links: hold
Alt to open in a new window"_, which is the only place that modifier is named.

**A tone that was missing, and pushed actions out of the slot.** `ToolbarAction`
had `danger` and nothing else, so "Bring them back" — a good outcome that says
so in green — could only be had by hand-writing the button, which is how it lost
its name. `tone` now takes `success` too. The same gap had already pushed "Call
this run off" out once; a tone missing from that list is not a cosmetic gap, it
is a force pulling actions out of the one slot that keeps them labelled.

**A one-item menu behind an ellipsis.** Two panes put a single "Archive" behind
an unlabelled `⋯`, which then relocated into the overflow popover — a menu
opening a menu, with the hamburger beside it already meaning "the rest of the
controls". Both are now one labelled row.

**Four mirror gaps**, each fixed in one console and not the other: Linked
outside calendars (piggles converted, sparx not), the Search Console refresh
(piggles uses the house `RefreshButton`, sparx hand-rolled a bare circular
arrow), the transfer label (piggles put it in `primary`, sparx in `controls`,
neither named), and the pick-list pair (piggles in the children spill, sparx in
`controls`).

## What was done

All 43 are now declared as VALUES in `actions`, which gives them icon + label in
a wide bar and a full-width labelled row in the popover. Destructive ones carry
`tone: 'danger'` and keep their color in both shapes.

**`scripts/check-toolbar-glyph.mjs`** — new, wired into `pnpm
check:toolbar-glyph` and pre-push. It looks for a `<Button>` inside a
`<PaneToolbar>` whose children are an icon and nothing else. Deliberately
narrow: "could this ever draw a word?" needs a type checker, but "is every child
an icon?" needs only a scan, so the check UNDER-reports rather than blocking a
push over a guess.

Its first two versions were wrong in ways worth writing down:

1. **It stripped every brace group** before asking whether a word was left,
   which called 122 Save buttons wordless — `{isNew ? 'Add' : 'Save'}` is a
   word. [[feedback_a_test_that_cannot_go_red]]
2. **It did not know what a comment was.** JSX allows `//` between attributes,
   the comments in these files are prose, and prose has apostrophes — so
   `the narrow bar's popover` read as the start of a string, the scanner
   swallowed the rest of the tag looking for a closing quote, missed the `>`,
   and went on scanning the whole component as if it were still inside the
   toolbar. It reported table-row buttons as toolbar buttons. Found only by
   reading the list.

## Files

- `scripts/check-toolbar-glyph.mjs` — new, wired into pre-push
- `piggles|sparx/apps/workbench/components/pane-toolbar-actions.tsx` — `title`
  read by all three shapes, `tone` gains `success`
- 37 surfaces across the two consoles

## Proof

Put the print button back on the shelf editor as bespoke icon-only JSX: the
check exits 1 naming the file, the line, the slot and the accessible name.
Restored: `679 pane toolbars, 618 buttons, and every one of them has a word on
it.` 995 + 869 tests pass, both consoles typecheck, ESLint and Prettier clean.

On screen, PO-000005's menu now reads: **Close · Print a label · Refresh this
list · Copy a link to this.**
