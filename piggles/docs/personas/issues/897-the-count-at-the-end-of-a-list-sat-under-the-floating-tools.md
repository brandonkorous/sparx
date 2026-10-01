# 897 — The count at the end of a list sat under the floating tools

**Status:** fixed
**Severity:** **major** — the one fact a list footer exists to state was covered
by a button on twelve screens per console. On her Customers list, 53 of the 56
pixels of "38 in total" were underneath it
**Found by:** P03 · act 319, opening How things move (2 processes, 11 steps)
**Surface:** every unpaged list in both consoles. Piggles and sparx
**Filed:** 2026-09-30
**Fixed:** 2026-09-30
**Confirmed by:** a guard of 13 assertions, proved red six ways; and six of her
own screens, measured before and after

## What she saw

The bottom-right corner of her Customers list:

```
38 ... total
```

The workspace tools — the size glass, and the tidy menu in windows mode — float
at the canvas's bottom-right corner, above every pane. A pane docked against
that edge puts its footer in exactly that corner.

## Measured

Six of her screens, before. The number is how much of the count was underneath
the floating tools:

```
Customers          "38 in total"    56px wide    53px covered, 11px of 16 tall
Customer orders    "29 in total"    56px         53 × 11
How things move    "2 in total"     49px         45 × 11
Groups of customers "9 in total"    49px         45 × 11
Companies          "2 in total"     49px         45 × 11
Things to do       "5 to do"        —            same row, same corner
```

92 to 95 per cent of the width, and 69 per cent of the height.

## This was already solved once

`ListPagination` stands in the same corner and reserves room for the tools with
a class keyed on the canvas. That was issue 772, measured 2026-09-22: the tools
sat on 57px of the 134px rows-per-page picker and clipped it to "50 per pa".

Twelve surfaces per console do not use the pager. They end with a footer row
written out by hand:

```
crm/companies-list      crm/customer-orders     crm/customers-list
crm/deals-list          crm/object-types-list   crm/pipelines-list
crm/records-list        crm/segments-list       crm/tasks-list
crm/tickets-list        scheduling/bookings-list  scheduling/waitlist-list
```

A copied row has nothing to inherit a fix through, so 772's answer reached none
of them. [[feedback_a_fix_leaves_its_neighbour_behind]]

## Two more faults in the same div

**The count was 12px.** `text-xs`, under the console's own 14px caption floor —
beside a hint that had already been lifted OFF that floor, on the same line, in
the same element's sibling. Measured live: hint 14px, count 12px.

**The two scheduling footers put BUTTONS in the corner**, not text. Previous and
Next, under a floating control at `z-index: 9000`. Text under it is unreadable;
a button under it cannot be pressed. Devi has no bookings, so that pair was
fixed from the markup rather than proved on her screen.

## What it does now

One `ListFooter` component per console, and one `CANVAS_CORNER_CLEARANCE`
constant that both footers reserve, so a change to the room the tools need is
one edit rather than fourteen:

```
canvas-corner.ts      the reserved room, described once
list-footer.tsx       the row: open hint left, count right, 14px, clear of the corner
list-footer-words.ts  countLabel() — the words, which are a pure function
```

The surface still chooses its own words, because the words describe ITS rows:
"in total", "to do", "open", "on this process". It no longer chooses the layout,
the ink or the corner.

After, on the same six screens:

```
"38 in total"   66px of ink, 0px covered, 83px of clear air, 14px
```

## Why 144px

The worst case, measured: in windows mode the floating pill holds two 48px
buttons, a 4px gap, 8px of padding and a border — 110px — and sits 16px off the
edge. 144px clears it, and the same number in both footers keeps the last thing
on a paged list level with the last thing on a counted one.

Keyed on the CANVAS, not on a width. A container query cannot answer it: a 600px
pane docked right collides and a 900px pane docked left does not, and the
compact shell mounts no floating tools at all, so a phone would have paid for
room nothing was standing in. Checked at a 360px pane: the row is 335px wide
inside the pane, the page does not scroll sideways, and the count sits at the
left where the hidden hint leaves it.

## Proved

**13 assertions**, and six wrong versions:

```
the count goes back to 12px                  →  2 fail
the clearance comes off the count            →  2 fail
one surface goes back to a hand-rolled row   →  2 fail
the clearance class is spelled in a surface  →  1 fail
a pending count renders as zero              →  1 fail
a pager stops reserving the corner           →  1 fail
```

Six of the thirteen are the words, which are a pure function. The other seven
read SOURCE, because neither fault can fail a type check or a render test: a
`<p className="text-xs">` right-aligned in a flex row is valid TypeScript,
renders perfectly, and is invisible on the only screen anybody looks at.
[[feedback_structural_checks_go_blind]]

The one exception on the guard's list is named with its reason: sparx's
onboarding layout pushes to both ends and sits at the TOP of the page, where
nothing floats.

## Checks

Piggles console 175 files / 1642 tests. sparx workbench 143 files / 1314 tests.
Typecheck 0 in both. `check:console-parity` green — the three new components
exist under the same names in both consoles. ESLint and prettier clean.

## Files

New, in each console:

- `components/canvas-corner.ts`
- `components/list-footer.tsx`
- `components/list-footer-words.ts`
- `components/list-footer.test.ts`

Changed, in each console: `components/list-pagination.tsx` and the twelve
surfaces listed above.

## The thing to remember

**A fix that lives in a component reaches everything that uses the component,
and nothing that copied it.** Twelve surfaces had the same four lines of markup
because four lines is cheaper to retype than to import. The cost showed up nine
days later, on somebody else's screen, in a corner nobody was looking at.
