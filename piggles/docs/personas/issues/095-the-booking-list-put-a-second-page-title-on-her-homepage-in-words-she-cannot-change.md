# 095 — The booking list put a second page title on her homepage, in words she cannot change

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · act 5
**Surface:** mypiggles › My Site › Page › Add › Booking services — and the published homepage
**Filed:** 2026-08-22
**Fixed:** 2026-08-24
**Confirmed by:** headings read off Nia's homepage and her /book page — see below
**Blocked on:** —

## What happened

Nia's homepage needed a price list. Her starter came with one hardcoded as text —
four services, four prices, none of them hers — so she deleted it and added the
live one the palette offers:

> **Booking services** — The live list of services open for booking, each linking
> to its time-picker. Pinned: style and surround it, but it can't be removed.

That part is excellent. Her ten real services render with her real prices, her
real lengths and her own descriptions, and they will follow her Bookings for ever
without her touching the page again.

It also brought two lines she did not write and cannot edit:

> **Book with us**
> Choose a service to see open times and reserve your spot.

So her homepage now reads:

> **What we do, and what it costs** _(hers, `<h2>`)_
> **Book with us** _(the block's, `<h1>`)_
> Choose a service to see open times and reserve your spot.
> _(the ten services)_

## The `<h1>` is the real problem

Read off the live page:

| Tag    | Text                                        | Size |
| ------ | ------------------------------------------- | ---- |
| **H1** | Two chairs. No rush. Book the one you want. | 60px |
| H2     | What we do, and what it costs               | 36px |
| **H1** | **Book with us**                            | 36px |
| H2     | A two-chair salon, on purpose               | 36px |

**Two `<h1>` elements on one page.** A screen reader announces two page titles; a
search engine gets a page that claims to be about two different things. And the
second one is smaller than the first, so nothing on screen tells the owner it
happened.

The `<h1>` is right where the block was designed to live — `/book`, where it is
the page's only heading. It is wrong everywhere else, and the Add palette offers
the block for every page.

## Why it matters

This is the block that finally makes a price list honest — the one thing on a
salon's homepage most likely to go stale is a hand-typed menu, and this fixes it
for good. It should be the easy recommendation. Instead placing it costs the owner
her own section heading, or leaves a visible stutter of two titles in a row.

She has no third option. Selecting the block gives Design controls and
`Link straight to this part`; there is no field for its heading and no switch to
turn it off.

## How to reproduce

Every time.

1. Any page that is not `/book`.
2. Add › search "booking services" › **Booking services**.
3. Publish, and read the page's headings.

## Where it lives

The core renders its own header + subtitle by design — the `/book` route says so
in as many words
([wizeworks/apps/site/app/book/page.tsx](../../../../wizeworks/apps/site/app/book/page.tsx)):

```ts
// No shell heading — the services list core renders its own header + subtitle.
```

That is the correct call for `/book`. What has not been decided is what the same
core should do on a page that already has a title, which is every other page the
palette will let you put it on.

## The fix

Not made — it is a product decision first, and there are three defensible answers:

- **The heading becomes a prop.** `heading` and `subheading` on the core, drawn by
  the Host panel that [093](093-her-contact-page-showed-a-map-of-another-salons-street-and-no-screen-could-move-it.md)
  added, with the current words as their defaults and blank meaning "no heading".
  Cheapest, consistent with every other core, and it lets `/book` keep exactly what
  it has today.
- **The heading level follows the page.** The core emits `<h1>` only when the page
  has none, `<h2>` otherwise. Fixes the accessibility half on its own and leaves
  the words alone.
- **Both.** The words are the author's, and the level is worked out rather than
  chosen — which is what the blueprint harness already does for pages with no `h1`
  of their own.

What is not defensible is the state today: a second `<h1>` and two sentences in
the platform's voice, on a page whose whole point is that it is hers.

## What Nia did instead

Kept her own heading and deleted her subtitle, so the section reads as a title
followed by the widget's own label rather than two competing sentences. Recorded
in act 5.

## Decision — 2026-08-24, Brandon

**The heading belongs to the author.** A pinned core does not get to put words on
somebody's homepage that they cannot edit.

## Rating effect

`My Site › Page` and the published homepage are scored in [rating.md](../rating.md).

## The fix — 2026-08-24

Brandon's answer was "authors", so the words are hers. The LEVEL is worked out
rather than chosen, which is the "Both" option above — and it had to be, for a
reason the first attempt made obvious.

**The words.** `scheduling.services` gains `heading` and `subheading` props
([host-nodes.ts](../../../../wizeworks/packages/silica-catalog/src/host-nodes.ts)),
drawn by the same Host panel every other core uses, defaulting to today's
sentences so no published page changes wording on its own. **Blank means no
heading at all** — which is exactly what Nia wanted: her own `<h2>` above the
block, and nothing from the platform under it.

**The level comes from the ROUTE, not from a stored prop.** `/book` passes
`bookingHeadingIsPageTitle`, and only there does the core emit `<h1>`.

That last part is not a detail. Dropping the core to `<h2>` unconditionally
fixed the homepage and left `/book` with **no `<h1>` at all** — the seeded
`/book` page carries no heading of its own precisely because the core used to
supply one, so every already-published booking page would have lost its title
silently. A stored prop could not fix those pages either; a route-derived level
fixes them without touching a single tenant's content.

## Confirmed by

> Headings read off the live pages, 2026-08-24.
>
> **Nia's homepage** — the page this was found on. One `<h1>`, hers:
>
> ```
> H1  Two chairs. No rush. Book the one you want.
> H2  What we do, and what it costs        ← hers
> H2  Book with us                         ← the block, no longer an <h1>
> H2  A two-chair salon, on purpose
> ```
>
> The two-page-titles problem is gone, and the stutter she worked around by
> deleting her subtitle is now hers to remove properly: blank the block's
> `heading` and the section is her own `<h2>` followed by her ten real services.
>
> **The `/book` page** — still exactly one `<h1>`, still the page's own subject:
>
> ```
> <h1 class="…">Book with us</h1>
> ```
>
> Both checked against Juniper Row and Halo & Hem, whose `/book` pages were
> published BEFORE this change — the level is derived at render, so neither
> needed rewriting.
