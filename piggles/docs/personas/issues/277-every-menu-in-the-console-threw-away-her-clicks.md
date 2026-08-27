# 277 — Every menu in the console threw away her clicks

**Status:** fixed
**Severity:** blocker
**Found by:** P03 · Juniper Row · investigating a harness note that turned out to
be a real defect wearing a harness costume
**Surface:** the whole console — every `DropdownMenu`, `Menubar` menu and
`ContextMenu` (19 call sites), plus `PreviewCard`
**Filed:** 2026-08-27
**Confirmed:** 2026-08-27

## What happened

Devi clicks the appearance button in the topbar. The menu opens, correct and
readable, three choices: Match my computer, Light, Dark. She clicks **Light**.

The menu closes. Nothing changes.

She does it again, more deliberately, cursor square in the middle of the word.
The menu closes. Nothing changes. The console stays dark.

Nothing is greyed out, nothing errors, nothing is logged. The menu opens every
time and closes every time, exactly as a menu should — it simply never does the
thing she picked.

**Every menu in the console behaved this way.** Not the appearance menu
specially: the account menu, the "Add something" menu, the "More" menu on a
record, every row's action menu. Nineteen call sites.

## Why nobody had caught it

Three separate things conspired to make this invisible.

**The keyboard works perfectly.** Open the menu, arrow down, press Enter — the
item activates, the theme changes, everything is fine. Any check that drives a
menu by keystroke passes. This is the same reason the identical bug survived in
`<Select>` earlier (see the comment block in `app/surface-support.css`): it took
someone clicking one.

**The popup is not faded, not disabled, not misplaced.** Its computed background
is fully opaque, the items highlight correctly under the keyboard, and hit-testing
is the only thing that is wrong. There is nothing to see.

**I had recorded it as a harness quirk.** Five times across five sessions I wrote
down "Base UI menu items swallow synthetic clicks" and moved on with a
workaround, because `element.click()` in the console always worked. That note was
wrong, and it was wrong in the most expensive possible direction: it explained a
real defect away as a property of my tools, so I stopped looking each time I hit
it. `element.click()` works _because_ it skips hit-testing entirely — the thing
that was broken.

## What was actually wrong

An invisible backdrop was sitting on top of every menu, and clicks were landing
on it instead of on the item.

Base UI portals an overlay as two siblings: the **positioner** (which holds the
popup) and an **inert backdrop** (`position: fixed; inset: 0`) that blocks the
page while the overlay is open. The backdrop has a `clip-path` cutout so the
trigger stays clickable — a hole over the trigger, and nothing else. It is
supposed to sit _below_ the popup.

The console shifts silica's z-scale above dockview's floating panes, and gives
that backdrop `z-index: 10030` so it clears the panes too, deliberately below
`--z-popover: 10070`. The numbers are right. The problem is where 10070 lands:

```
div[role=presentation]          position: absolute   z-index: auto    ← positioner
  div[role=menu].dropdown       position: static     z-index: 10070   ← inert here
    div[role=menuitem]
```

**`z-index` does nothing on a `position: static` element.** silica writes
`z-index: var(--z-popover)` onto `.dropdown`, which is static, so the popup's real
stacking level is whatever its positioner has — `auto`, i.e. 0. The backdrop at
10030 wins, covers the popup, and eats the click.

Measured on the live console, at the exact centre of the "Light" item:

```
document.elementFromPoint(1431, 146)
  → div[role=presentation]  z-index: 10030  ← the backdrop, not the item
```

and the event trail for one real click:

```
pointerdown → div[role=presentation]     ← backdrop; menu dismisses here
pointerup   → div.dv-watermark           ← menu already gone
click       → body
```

## Why the existing guard missed it

`app/surface-support.css` already fixes exactly this, and its comment already
states the rule correctly: _"z-index has no effect on a static element."_ It
raises the positioner instead. But it did so by **naming the popups it hosts**:

```css
[role='presentation']:has(> .select-popup),
[role='presentation']:has(> .calendar-popup),
[role='presentation']:has(> .popover),
[role='presentation']:has(> .menu) {
  z-index: var(--z-popover, 70);
}
```

`.dropdown` is not in that list. `.menu` **is**, and looks like it covers menus —
but `.menu` is silica's static nav-list component, not the dropdown popup. silica
names the popup `.dropdown` _specifically_ to keep the two apart, and says so in
its own source. The list read as complete and was not.

This is the failure mode from [[feedback_absent_behaves_like_fine]] in its purest
form: the missing entry renders a perfect, beautiful, fully-painted menu that
silently discards input. Nothing typechecks differently. Nothing lints. Nothing
looks wrong in a screenshot.

## The fix

Match what a positioner **is**, so the rule cannot miss a component:

```css
[role='presentation'][data-side][data-align] {
  z-index: var(--z-popover, 70);
}
[role='presentation'][data-side][data-align]:has(> .tooltip) {
  z-index: var(--z-tooltip, 80);
}
```

Base UI stamps `data-side` + `data-align` on every anchored positioner. The inert
backdrop carries neither, so it stays at 10030 — which is the point, since raising
it is what broke `<Select>` the first time round. Dialog and Drawer are not
anchored, carry no `data-side`, and keep their own levels.

## Verified

- Clicking **Light** with a real mouse click flips the theme; clicking **Dark**
  flips it back. Same coordinates that failed before the change.
- `elementFromPoint` at each item's centre now returns the item, on the appearance
  menu, the account menu, "Add something" and "More".
- `<Select>` still works (it was the one that already had a patch).
- Rule resolution measured directly: generic positioner 10070, with `.dropdown`
  10070, with `.select-popup` 10070, with `.tooltip` 10080, backdrop unmatched.

## What this leaves upstream

silicaui writes `z-index` onto a static popup surface in **five** components —
`.dropdown`, `.popover`, `.preview-card`, `.select-popup`, `.calendar-popup`. In
`navigation-menu` it already does the right thing and puts the token on
`.navigation-menu-positioner`. Until the other five follow, the console needs the
rule above; the block is marked for deletion when they do, with the standing
instruction to **verify by measuring, not by reading the changelog** — 0.28
documented this fix without it taking effect.

## The lesson worth keeping

A workaround that works is not evidence that the thing it works around is
unfixable. I had a reliable way to click menu items and used it five times without
once asking why the ordinary way failed. The note I wrote to save time each
session is what kept the defect alive.
