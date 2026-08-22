# 047 — Every dropdown in the console ignored the mouse

**Status:** fixed
**Severity:** **blocker** (no `<Select>` anywhere in the console could be used with a mouse)
**Found by:** P01 · Thistle & Rye · act 10 — setting a café's payment terms
**Surface:** mypiggles — everywhere. Found on Customers › Companies › Trade terms.
**Filed:** 2026-08-21 · **Fixed:** 2026-08-21
**Confirmed by:** P01 · act 10 — Ferrous Coffee Bar saved on 14-day terms, by clicking

## What happened

Marisol opened **Payment terms**, the list dropped down, she clicked **14 days to
pay** — and the box still said **No agreed terms**. She tried again. Same. She
tried **Status** instead: clicked **Credit hold**, box still said **Active**.

Nothing errored. The list opened, painted correctly, closed on click. It simply
never took the choice.

## Why it matters

It is every dropdown in the console. Payment terms, status, lifecycle stage,
relationship, the assigned rep — anything built on silica's `<Select>`. A form
whose selects cannot be set is a form that cannot be filled in.

And it fails in the worst available way: **silently, and looking like it worked.**
There is no error, no disabled styling, no explanation. A person clicks, sees the
old value, and concludes they mis-clicked. Marisol would have concluded the
software was broken, and she would have been right.

## Why it survived

**The keyboard worked perfectly.** Focus the select, arrow down, Enter — the value
takes, the help text underneath updates, Save enables. So every automated check,
every keyboard-driven script and every accessibility pass would go green. It took
somebody clicking with a mouse.

Which is exactly the point of driving the screen as the person, and exactly why a
green endpoint proves nothing: this defect is invisible to anything that does not
have a pointer.

## Why it happened

Base UI portals every overlay into `div[data-base-ui-portal]` on `<body>`, and
silica positions them from its own z-scale, which tops out at 90. dockview's
floating panes sit at 1001 and climb, so an overlay opened inside a floating pane
rendered BEHIND the pane. The fix for that, in the console's `globals.css`, was:

```css
[data-base-ui-portal] > * {
  z-index: 10000;
}
```

aimed at the POSITIONER — the comment above it says so explicitly. But the
positioner is not the portal's only child. Base UI also renders a
`[data-base-ui-inert]` backdrop as a **sibling**, and `> *` raised that to 10000
too, while silica's own rule held the positioner down at `var(--z-popover, 70)`.

The backdrop is `position: fixed; inset: 0` with a clip-path cutout — and the
cutout is punched around the **trigger**, not the popup. So the only clickable
part of an open dropdown was the button that opened it. `elementFromPoint` on the
centre of an option returned the backdrop, not the option. Hovering an item did
not even highlight it.

A blanket selector written for one child, landing on a sibling that had to stay
underneath.

## The fix

Silica's z-scale is deliberately a SYSTEM property — its own comment: _"a
transient surface must outrank anything it can be opened from… no component prop
can make it win, because a child can't out-stack its own parent's level."_ So the
whole scale moves at once, through the tokens it is built on:

```css
:root {
  --z-drawer: 10040;
  --z-dialog: 10050;
  --z-lightbox: 10060;
  --z-popover: 10070;
  --z-tooltip: 10080;
  --z-toast: 10090;
}

/* Base UI's internal backdrop has no z-index of its own, so it needs one to
 * clear dockview — but BELOW every silica overlay, or it eats the popup it
 * exists to serve. */
[data-base-ui-portal] > [data-base-ui-inert] {
  z-index: 10030;
}
```

Every relative order silica specifies is preserved exactly; the whole family
simply clears the dock. No component override, nothing to remember at a call
site, and one `:root` block instead of a selector that guesses which children it
is talking to.

The guide/tour card's own `9500` still sits above the dock's tools and below
every overlay, as its comment intends.

## Confirmed

Reloaded, hovered **14 days to pay** — it highlighted under the cursor for the
first time. Clicked it; the box read **14 days to pay**. Saved, reopened the
record, still 14 days. The Companies list's Terms column reads it too.

## Note

`sparx/apps/workbench/app/globals.css` never carried the blanket rule, so the
sparx console was never affected. This is a piggles-workbench-only fix.
