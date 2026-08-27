# 279 — The menus had never been clicked

**Status:** fixed
**Severity:** major (the way to her password and two-step verification was in no menu at all)
**Found by:** P03 · Juniper Row · opening every menu in the console with a mouse, which
[277] made possible for the first time
**Surface:** the console chrome — the site switcher, the account menu on both desktop and phone
**Filed:** 2026-08-27
**Confirmed:** 2026-08-27

## Why this sweep happened at all

[277] found that an invisible backdrop sat on top of every menu in the console, so a
mouse click reached none of them. It had survived five sessions because a note of mine
called it a limitation of my tools and told me to drive menus with the keyboard instead.

Which means that for the whole persona run to date, **no menu in this console had ever
been opened the way Devi opens one.** So the first thing to do after fixing it was to
open all of them and read what was there.

Three of the eight carried something wrong.

## 1. The site switcher spent its only action row on a greyed-out sentence

Devi has one site. She opens the switcher and gets:

> **YOUR SITES**
> Juniper Row ✓
> ─────
> _Each site keeps its own arrangement_

The last row is `<DropdownMenuItem disabled>`. Three things follow from that:

- It is **faded to 4.38:1** against the menu — measured, not eyeballed — which is below
  the 4.5:1 floor, on a sentence whose whole purpose is to be read.
- It is announced to a screen reader as `role="menuitem" aria-disabled="true"`: **an
  action she cannot take**, when it is in fact a fact about how sites work.
- The sentence is already the trigger's tooltip, word for word. So the row said nothing
  the menu did not already say, twice over.

And it occupied the one place a person thinks about their sites — where the way to a
SECOND one belongs. `platform.settings.sites` exists, is reachable from the nav, and has
a **New site** button on it. The switcher just never pointed at it.

Now the row opens that screen. The fact it displaced was never lost: the tooltip still
says it.

## 2. Neither account menu led to the screen holding her password

Left over from [278], which found the whole Security surface non-functional and noted
this at the bottom as "still open, noted not filed". Her own name in the top bar offered
billing, cookie choices and sign out. Not her password. Not her devices. Not two-step
verification. Search finds the screen; the menu named after her did not link to it.

The phone menu did not either, and a phone is where a person is most likely to be told
to turn two-step on.

Both now carry **Signing in and security**, and both read the label through the same
lookup the nav, launcher and command palette use, so a rename reaches all of them at
once rather than leaving two menus behind.

## 3. Her email address was rendered as a group heading

The identity block at the top of the account menu was a `<DropdownMenuLabel>`. That is
silica's **group heading** — the component behind "YOUR SITES" and "SAVED LAYOUTS" — and
it carries `text-transform: uppercase`, `opacity: 0.55` and `font-size: 12px`.

So the one line in the product that answers "which account am I signed in to" showed her
address as:

> **P03.DEVI@PIGGLES.TEST**

Uppercase, at 55% opacity, at 12px. Not the address she has, in a treatment that exists
to de-emphasise, in the one place whose entire job is to be checked.

The fix is not a text-colour utility on top of the component (that is the RULE #1 re-skin
this repo has 54 shipped examples of). It is to stop using a heading component for
something that is not a heading: the block is now a plain element, and inherits the
menu's normal ink at normal case. Measured after: **12.66:1**, `text-transform: none`,
name 16px, address 14px.

Silica has no non-heading header slot for a menu. When it does, this becomes that
component — the comment at the call site says so.

## Verified by doing it

As Devi, clicking, in dark and light:

- Site switcher → **Add or manage sites** → the Sites screen opens, showing Juniper Row
  as Primary with a **New site** button.
- Account menu → **Signing in and security** → the Security surface opens.
- Her name and address read `Devi Raman` / `p03.devi@piggles.test`, normal case.
- The phone menu at 360px in an iframe: same rows, everything inside the width,
  `documentElement.scrollWidth === clientWidth === 360`. Both themes.

## The other five menus were fine

Worth saying, because a sweep that only reports faults implies the rest were not looked
at. **Add something**, **Appearance**, **Saved layouts**, **This window** and **Tidy up**
all read well and all work. The Tidy up menu in particular does the thing this repo is
usually good at — it names each choice by what happens on screen ("Bring everything
back", "Fan them out", "Share the screen out") rather than by what a window manager calls
it, and each carries a full sentence of explanation at readable size.

Two smaller things noted, not filed:

- **Fan them out** does nothing when there is a single window, which is correct and
  indistinguishable from broken. It is the only one of the three that has no visible
  effect at n=1.
- After settling an order in full, the toast still reads "The order shows what is left to
  pay" — true for a part payment, and not for the one that clears the balance.

## The lesson worth keeping

A workaround that works, next to an ordinary path that does not, is a question — not a
convenience. I wrote the note that made this a five-session blind spot, and the cost was
not the one bug: it was that **an entire class of control went untested** because I had
convinced myself the tool could not test it.
