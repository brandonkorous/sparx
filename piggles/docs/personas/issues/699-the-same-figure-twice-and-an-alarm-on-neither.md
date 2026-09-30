# 699 — The same figure twice, and an alarm the page then withdrew

**Status:** fixed
**Severity:** minor
**Found by:** P03 · Juniper Row · act 244
**Surface:** mypiggles + sparx — Stock › Stock reports; and Stock › How many you have
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen
**Blocked on:** —

## Three things on two report screens

### 1. The same number twice, with nothing saying why

> **What your stock is worth** $1,934.56
> **Money sitting still** $1,934.56

Both correct. Measured:

```
never sold   57 levels   423 units   $1,934.56
sold since   17 levels    75 units       $0.00
```

Every costed unit she holds is in something that has never sold, and everything
that HAS sold has no cost recorded. So the two figures are the same figure.

Two identical currency amounts under different labels is the shape a reader
treats as a broken screen, which is [692](692-a-breakdown-that-did-not-add-up.md)
with the arithmetic the other way up. The caption now says it:

> 57 lines have never sold. **That is every bit of the stock value you hold.**

### 2. An alarm the same page then withdrew

That figure wore `text-warning`. Underneath it, the dead-stock section said:

> **Nothing is gathering dust.** Nothing here has sat longer than your dead-stock
> window. 57 lines have not sold at all yet, **which is not the same thing as
> dead. They have not had the time.**

The figure covers two bands — "not sold in over 3 months" and "never sold" — and
the section below **explicitly excludes** the second from dead stock, in a comment
that says so:

> "Lines that have never sold at all. They are no longer counted as dead stock
> (they have not had the window to sell in)."

So a shop whose whole figure is never-sold got an alarm-colored number sitting
above a green box telling it nothing was wrong. Color is a claim
([[feedback_no_monotone_use_full_palette]]), and this one was withdrawn two
inches lower. The amber is now keyed on the band that IS a problem, the 90-plus
one. The figure still counts both, because that money is genuinely sitting still.

This figure is invisible to `check:count-ink` because its class is a template
literal rather than a string, so the check could not have caught it.

### 3. The headline card that was the only row beneath it

**How many you have** opens with a three-figure rollup, then lists each place.
With a single variant in a single location the rollup IS that row: the same three
numbers and the same three words, 150px apart, inviting the reader to look for a
difference that is not there.

```
products with any stock at all              188
…of those, with exactly ONE stock row        64   (34%)
Juniper Row                                   3 of 9
```

A third of the time this pane opened it printed its headline twice. The rollup is
now gated on there being more than one row to roll up, which is what its own
comment says it is for: "the product-wide answer first, so the question 'do I
have any' is settled **before anyone reads a single row**."

## Also, one punctuation fix on the same card

```
No reorder rule. Nothing will warn you when this runs down. · costs you $18.55 each
```

Two full sentences, then a list separator, then a lowercase fragment. The other
branch of the same line is dot-separated fragments throughout, and the cost
clause appends to both. It now reads:

> No reorder rule, so nothing will warn you when this runs down · costs you
> $18.55 each
