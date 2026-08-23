# 171 — Light and Dark wore the same icon

**Status:** fixed
**Severity:** design
**Found by:** P03 · Juniper Row · act 3
**Surface:** every Piggles app — the Appearance menu in the top bar
**Filed:** 2026-08-23
**Fixed:** 2026-08-23
**Confirmed by:** the menu reopened in both themes — three distinct glyphs, below

## What happened

Devi opened the Appearance menu to check the variant grid in the other theme.
Three rows: **Match my computer**, **Light**, **Dark**. The first had a little
screen beside it, which is exactly right.

The other two had the SAME icon as each other.

| Workspace was | Beside "Light" | Beside "Dark" |
| ------------- | -------------- | ------------- |
| Dark          | a moon         | a moon        |
| Light         | a sun          | a sun         |

So in a light workspace, the row that turns the lights off wore a sun. The icon
was not describing the row; it was repeating the state you were already in.

## What should have happened

A sun beside Light, a moon beside Dark, a screen beside Match my computer. An
icon on a menu row says what the row does — that is the whole reason it is there.

## How to reproduce

Every time, in all three Piggles apps.

1. Any Piggles surface → the appearance control in the top bar.
2. Read the two glyphs. They are the same one.
3. Switch theme, reopen. They are the same one as each other again, and both have
   changed.

## Why it matters

Small, and it is fair to call it small: the labels are right, the tick is right,
and nobody picked the wrong theme because of it. Filed as `design` rather than
inflated.

But it breaks the rule the root DESIGN.md states plainly — two things that mean
different things cannot share one appearance — and it does it in the one control
whose entire subject is the difference between two things. In a light workspace
the sun beside **Dark** is not merely uninformative, it is the wrong picture.

## Where it lives

[piggles/packages/ui/src/appearance-menu.tsx](../../../packages/ui/src/appearance-menu.tsx)

One helper, `glyphFor`, served both the trigger and the rows. For the TRIGGER it
is correct and deliberate — the file's own header explains it at length: the
trigger shows what your choice currently resolves to, so somebody on "match my
computer" at night sees a moon. The rows then inherited that rule, where it makes
no sense: a row is not the current state, it is an offer.

Worth noting it was written once and shared, which is why it was one fix rather
than three — the marketing site, the account app and the console all draw this
menu from here.

## The fix

Two named helpers instead of one, so the difference is in the code rather than in
whoever remembers it:

- `triggerGlyph(choice, theme, glyphs)` — unchanged, still resolves through the
  live theme, still what the header describes.
- `itemGlyph(choice, glyphs)` — a row's own meaning, with no `theme` argument at
  all, so the mistake cannot be made again by passing the wrong thing.

`AppearanceMenuItems` no longer reads `theme`; it stays in the props because the
trigger beside it needs one and callers pass a single object.

## Confirmed by

**Reopened the menu as Devi, in both themes.**

- Dark workspace: 🖥 Match my computer · ☀ Light · 🌙 Dark, tick against Dark.
- Light workspace: 🖥 Match my computer · ☀ Light · 🌙 Dark, tick against Light.

Three distinct glyphs, and the pair no longer changes with the theme.

## A separate thing seen here, deliberately NOT filed

Clicking a row in this menu with the automation harness did nothing — three
attempts, in both themes, with the row visibly highlighting on hover. Driving it
by keyboard worked, and dispatching a click programmatically also worked and
changed the theme.

That last result is what settles it: the handler is wired and fires on a real
click. What failed is the harness's synthetic mouse event reaching this
particular menu, and reporting that as a defect in Piggles would be recording a
tool's limitation as the product's. Noted here so the next person who sees it
does not chase it, and so the run does not silently drop something it saw.

## Rating effect

Console chrome rather than a pane, so no row in [rating.md](../rating.md).
