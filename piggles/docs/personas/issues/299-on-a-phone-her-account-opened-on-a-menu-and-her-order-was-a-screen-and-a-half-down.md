# 299 — On a phone her account opened on a menu, and her order was a screen and a half down

**Status:** fixed
**Severity:** major (every page of the customer account area on every tenant
site, and the layout asked for the right thing — one utility silently lost an
argument to the one beside it)
**Found by:** P03 · Juniper Row · the 360px pass on [298]'s work (CLAUDE.md RULE #6)
**Surface:** the tenant site — **Account**, all eleven pages
**Filed:** 2026-08-28
**Fixed:** 2026-08-28
**Confirmed by:** Measured at 356px and at desktop, before and after

## What happened

Checking Jo's order page at 360px before scoring it, the account navigation was a
**635px-tall vertical list** — her name, her email, and eleven links stacked one
per line — with the order itself below all of it. On a 360×780 phone the first
screen is menu, the second screen is still menu, and her order starts somewhere
after that.

The layout was not asking for this. It says:

    max-[760px]:static max-[760px]:flex-row max-[760px]:flex-wrap

A wrapping row of chips, which is the right answer. Measured at a 356px viewport:

| Utility                 | Applied?                          |
| ----------------------- | --------------------------------- |
| `max-[760px]:static`    | yes — `position: static`          |
| `max-[760px]:flex-wrap` | yes — `flex-wrap: wrap`           |
| `max-[760px]:flex-row`  | **no — `flex-direction: column`** |

Two of the three took effect. The third did not, and it was the one that mattered.

## What should have happened

`flex-row` and `flex-col` set the same property, and the base `flex-col` was the
one that won at 356px. Measured, not inferred: at that width the computed
`flex-direction` was `column` while `position` and `flex-wrap` had both taken their
`max-[760px]:` values, and flipping the pair so the column sits inside the query
turned it into `row` at the same width. **Whatever decides the order between two
utilities of one family, a media query is not enough to overturn it** — so writing
`flex-col` with a `max-[760px]:flex-row` beside it gives a column at every width.

(I did not get to the generated stylesheet to read the emitted order back — the
CSS is served from query-string URLs the browser tool would not fetch. The
behavior above is measured at both widths and before and after the change; the
sheet-order account of _why_ is the likely reason and is not verified.)

**The reason this survived is that it looked like it worked.** The two utilities
either side of it — `static` and `flex-wrap` — are not in that family, so they
applied normally, and the grid collapsed to one column as intended. Everything
about the code and most of the rendered result said "this is responsive". Only the
one line that would have made it usable was inert, and nothing anywhere reported
it. The same fingerprint as [296] and [283]: green everywhere, doing nothing.

## How to reproduce

Before the fix, every time:

1. Sign in to any tenant site as a customer, on a phone or in a 360px frame.
2. Open any page under **Account**.
3. The navigation is a full-height stack. Scroll past all of it to reach the page.

## Why it matters

It is every page of the account area on every tenant site — Orders, Returns,
Addresses, Profile, and the two returns screens shipped in [297] the day before.
A shopper who taps "track my order" in an email lands on a menu.

Piggles' own audience is named in CLAUDE.md as including a 61-year-old on a phone
in a workshop. This is the case that rule exists for.

## Where it lives

[wizeworks/apps/site/app/account/(authed)/layout.tsx](<../../../../wizeworks/apps/site/app/account/(authed)/layout.tsx>)
— the `nav` element's class list.

## The fix

Stated narrow-first, so the two directions stop competing: the default is
`flex-row flex-wrap`, and `min-[761px]:flex-col` puts the column inside the query.
Now the later utility is the one the media query controls, so **each width gets
what it asks for** rather than one width getting whatever the sheet ordered. The
`sticky top-[92px]` moved into the same `min-[761px]:` group, which removes the
`static` override entirely rather than leaving a second pair to reason about.

The identity block at the head of the nav gained `w-full` — in a wrapping row it
would otherwise sit in the line as one more chip.

Nine inline `style` props on this file and on the order detail page went at the
same time; they are recorded under [298] with the rest of that work.

## Confirmed by

Measured in a 356px frame, signed in as Jo, on her own order:

|                     | Before   | After            |
| ------------------- | -------- | ---------------- |
| `flex-direction`    | `column` | **`row`**        |
| Nav height          | 635px    | **359px**        |
| Horizontal overflow | none     | none (341 = 341) |

276px of menu removed from the top of every account page, and the order heading is
visible without scrolling. The nav reads as four wrapping rows of chips with the
current page filled — Overview · Orders · Returns, then Estimates · Bookings ·
Requests, and so on.

**Desktop is untouched**: the same page in the full window still shows the 220px
sidebar column, vertical and sticky.

## Worth remembering

A `max-*:` variant did not override a base utility of the same family, and it is
not that arbitrary breakpoints are broken — `static` and `flex-wrap` beside it
worked perfectly. So the safe habit is to never put two utilities of one family in
a class list and expect the variant to win: state the narrow case as the base and
put the wide case in a `min-*:` query. Anywhere else in the repo that writes
`X max-*:Y` from a single family is worth the same 360px measurement, because it
will read as correct code and render as neither.
