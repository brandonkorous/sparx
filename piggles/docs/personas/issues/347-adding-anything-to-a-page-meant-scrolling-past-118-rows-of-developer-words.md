# 347 — Adding anything to a page meant scrolling past 118 rows of developer words

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · opening Insert to build out her About page
**Surface:** mypiggles › My Site › Page › Insert
**Fixed:** 2026-08-30
**Confirmed by:** the order read back off her own console, and five tests proved red first

## What happened

Devi opened Insert to add something to her About page. The first screen offered her,
in order:

> **Layout** — Section · Container · Stack · Row · Grid · Card · Clickable Card ·
> App Shell · Scroll Area · Overflow List · Join

Nine of those eleven mean nothing to a person who sews clothes for a living. Under it
came **Content**, then Form, Navigation, Overlay, Feedback, Data, Media, Interactive.

**Measured on her own console, before the fix:**

|                                                    |                             |
| -------------------------------------------------- | --------------------------- |
| Rows in the palette                                | 261                         |
| Rows before the first group of ready-made sections | **118**                     |
| Height of the list                                 | 12,816px in an 890px window |

So the shaped blocks — the ones written in her language, the ones her own "Made in the
studio" page is built out of — started about **six and a half screens down**.

## What she was scrolling past on the way to

The groups that were down there, verbatim:

> Page structure · Pictures · Big pictures · Helping people choose · How it works ·
> People and proof · Where and when · Getting in touch · Writing · News and listings ·
> Selling · Video, audio & maps · Your shop · Your bookings · Your site · Your writing ·
> Your media

Every one of those is a sentence a business owner can act on. **People and proof** is
where "The team" lives; **Getting in touch** is where the enquiry form lives; **Page
structure** holds "Opening with a wide picture" and "Text beside a ticked list". Those
are the three blocks her About page actually needed.

## Why it mattered

**This is a plausible answer to why her About page was two paragraphs long.** An owner
who opens the one panel called "add something to your page", meets a screen of Overflow
List and App Shell and Scroll Area, and closes it, has been told — wrongly — that this
is a tool for somebody else. The thing built for her was real and finished and eleven
screens away.

The palette's own header named the risk and offered search as the answer:

> A grouped browse is only useful to someone who already knows which group a thing is in.

Search is a good answer for somebody who knows the word to type. It is no answer at all
for somebody who is browsing precisely because she does not.

## The fix

One place: `mergeCatalog` appends what a host contributes, so `hostFirst` now hoists
the host's own groups above the framework's before the palette renders them.

**After, on her console:**

> Products · Page structure · Pictures · Big pictures · Helping people choose ·
> How it works · People and proof · Where and when · Getting in touch · Writing ·
> News and listings · Selling · Video, audio & maps · Your shop · Your bookings ·
> Your site · Your writing · Your media · **Layout · Content · Form · …**

Primitives start at row 103 instead of row 1. Nothing is hidden and nothing is renamed;
search still finds either instantly. **The primitives are not demoted for being
unimportant** — an author laying out a row of three needs a Grid. They are what you
reach for second, once the shaped thing is on the page and needs adjusting.

Ordering here rather than in each host's own list keeps every host on the same side of
the decision, and `SPARX_CATALOG`'s internal order (which its own comment calls "the
order an author sees") is preserved whole.

**By KEY, and only for a key the framework did not already carry.** `mergeCatalog`
folds a host group into a base group of the same key; hoisting one of those would drag
the framework's rows up with it. There is a test for exactly that.

## Confirmed by

`@wizeworks/studio`: **184 tests across 23 files**, five of them new. Proved red by
making the hoist a no-op:

```
× puts a host group ahead of every framework group
× keeps the host list in the order the host chose
```

Then read back off her live console: 18 groups in her language, then Layout. Typecheck
clean, 23 files passing.

## Rating effect

Against `P03 console — Juniper Row`, the page editor. This is the one of this batch
that changes what every tenant on the platform meets first.
