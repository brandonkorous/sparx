# 269 — The phone menu kept the link she had just changed

**Status:** partly fixed — the two menus are now told apart; they are still two
**Severity:** major
**Found by:** P03 · Juniper Row · RULE #8 — putting the new page in the header
**Surface:** mypiggles › My Site › Header & footer
**Filed:** 2026-08-26
**Confirmed:** 2026-08-26

## What happened

Devi built a "Made in the studio" page and went to put it in her menu. Her
header carried a "Book" item she has never had a use for — she sells clothes and
takes no bookings — so she used it: **Header & footer → Book → Words "How it's
made", Goes to `/made-in-the-studio` → Save → Publish.**

The canvas updated. The footer she edited next updated. The published page
header updated. And this was still in the live HTML:

```html
<nav hidden data-sui-part="panel" class="@md:hidden …">
  <a href="/shop">Shop</a>
  <a href="/book">Book</a> ← the phone menu
  <a href="/blog">Journal</a>
  …
</nav>
```

The header holds **two independent copies of the nav** — the row shown from
tablet up, and the panel behind the hamburger on a phone. They are separate
nodes with separate ids. Editing one does not touch the other.

So her desktop menu said "How it's made" and her phone menu still said "Book",
pointing at `/book`, which answers **"No services are bookable yet."**

## Why it matters

- **It is the phone half that goes stale**, and for a small clothing label most
  visitors arrive on a phone. The copy the owner CAN see is the copy fewer
  people read.
- **Nothing about the editor suggests there is a second one.** The canvas at
  desktop and tablet width renders the panel `hidden`; at phone width the panel
  is closed, so it is not on the canvas at any of the three preview sizes.
- **Layers listed it and gave her no way to tell them apart.** Both navs are in
  the rail, in both depth modes, and both were labelled `Menu` — because both
  fell through to the same tag label. Two identical rows, neither on the canvas,
  no indication which one the phone uses.
- **It fails silently and stays wrong forever.** No warning at Save, none at
  Publish, and the owner has no reason to look. She would find out when a
  customer told her, or never.

## The shape of the bug

This is not "the mobile view is broken". The mobile menu WORKS — the hamburger
trigger is there, the panel opens, the links are live. The defect is that the
header's content is **stored twice and edited once**. Any edit an owner makes to
a nav item has to be made a second time, in a place they have to know exists.

The same is true of anything else duplicated into the panel: renaming "Journal"
to "Notes", removing a link, adding one.

## The fix, and the part of it that is not fixed

**Done: a row an author cannot see on the canvas now says why it is not there.**
[layer-tree.ts](../../../../wizeworks/packages/studio/src/react/navigator/layer-tree.ts)
reads the node's own responsive classes and names the screens it is for:

```
Menu on a bigger screen        ← hidden … @md:flex
  Shop · How it's made · Journal · About · Contact
Button on a phone              ← btn … @md:hidden   (the hamburger)
Menu on a phone                ← flex flex-col … @md:hidden
  Shop · How it's made · Journal · About · Contact
```

It is **derived from the tree, not stored in it**, which is the whole reason to
do it this way: it works on layouts that were installed months ago, and it needed
no version bump and no migration. Blueprint content is copied at install and a
fix in this repo never reaches a site already built from it — that is [263]'s
lesson, and deriving the label sidesteps it entirely.

A name the author gave a layer still wins; the suffix only fills in where we were
falling back to "Menu"/"Group"/"Button" anyway. Proved red by returning `''` from
the new branch:

```
AssertionError: expected 'Menu' to be 'Menu on a phone'
AssertionError: expected 'Group' to be 'Group on a phone'
```

**Not done: they are still two copies.** Renaming a nav item is still two edits,
and nothing warns you when the pair disagrees. The honest fix is that the header
should hold ONE menu that renders two ways, and that is an engine change (silica
nodes are concrete — there is no "same nodes, second presentation"). Until then
this issue stays open on that half, and the labels are what make the second edit
findable rather than invisible.

## Repaired on her site

**Show every layer → Menu on a phone → Book → Words + Goes to**, Save, Publish.
Both menus now read "How it's made" and point at `/made-in-the-studio`, confirmed
in the served HTML — the `/book` count on the page went 2 → 0.

## Confirmed

Layers reads "Menu on a bigger screen" / "Button on a phone" / "Menu on a phone"
on Devi's existing layout, with no republish. 165 studio tests pass, the package
typechecks, prettier and eslint are clean.

## It was written down a persona and a half ago

`rating.md`'s `builder.layout` row already said it, scored on P02:

> "a nav item added once shows in both the desktop bar and the phone drawer only
> because you edit BOTH menus by hand, and nothing says the second one exists"

Seen, understood, written into the ratings file as a reason the pane scores 6 for
Ease — and never filed, so nothing was ever going to be done about it. It then
did exactly what the sentence describes to the next business that touched the
header. A note in a scoring column is not a defect record; if it is worth costing
a pane two points it is worth an issue.

## Related

[[feedback_absent_behaves_like_fine]] — a stale duplicate renders exactly like a
correct one, and only on the device the owner was not looking at.

[[feedback_responsive_top2_rule]] — responsive is non-negotiable for tenant
sites. This is the authoring side of that rule: the phone version is not just
something to render correctly, it is something the owner has to be able to EDIT.

## Also seen while reading the layout

Three `<p>` nodes in the footer carry an `href` (`Explore` and the business
description point at `/`, `Account` at `/account`). The renderer's per-tag
attribute allowlist drops them, so nothing reaches the page and no visitor is
affected — but selecting one in the builder shows a filled-in "Goes to" box on
an element that is not a link, and typing in it does nothing. Cosmetic, listed
here rather than filed.

## Rating effect

Header & footer, in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
