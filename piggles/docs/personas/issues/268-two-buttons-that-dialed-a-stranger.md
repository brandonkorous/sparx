# 268 — Two palette buttons dialed a stranger, and my own guard did not look at them

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · RULE #8 — reading the section catalog while building "Made in the studio"
**Surface:** mypiggles › My Site › Page › Insert (the "Book a time" and "Map" blocks)
**Filed:** 2026-08-26
**Confirmed:** 2026-08-26

## What happened

[265] found two blocks shipping invented contact details and fixed them. Two more
were shipping the same made-up number, and these are worse than the ones that
were fixed, because a visitor can TAP them:

```
Book a time   "Call instead"   →  tel:+15551234567
Map           "Call us"        →  tel:+15551234567
```

On a phone, that is a dialer opening on a number nobody at this business owns.
The prose caption [265] removed only printed a number; these place the call.

## Why the map one is the sharper of the two

The Map block's address column reads:

```
Your business name
123 Example Street
Your town, POST CODE
Call us              ← the only line that is not announced as a placeholder
```

Three lines say "replace me" in plain words. That is exactly what makes the
fourth dangerous: an owner who edits the three obvious placeholders has been
trained, by those three lines, to read anything NOT shouting at them as real.
"Call us" looks like the one finished thing on the block.

`place.ts`'s "Find us" had this same button and it was deliberately removed —
its comment says so:

> "No 'Call us' button beside a pressable number: it repeated the link directly
> above it, and its `href` was a literal nobody could reach."

The reasoning was written down. It was applied in one file and not the other.

## Where my own fix fell short

[265] shipped [starter-contact.test.ts](../../../../wizeworks/packages/silica-catalog/src/starter-contact.test.ts),
and its own comment says why it is scoped the way it is: _"The starter is the
strict case, because it is the one thing that lands on a live site without the
owner choosing it."_ That reasoning is still right, and it is also the reason
the guard saw nothing here — the palette is not the starter.

So the fix closed the two blocks I had opened by hand and guarded a different
set of files. One of the two survivors is in `convert.ts`, sixty lines below a
line I edited in that same commit.

## The fix

**Both bind to `site.identity.phone`** via `boundContactAction`, so the
destination is the business's or the button is not rendered at all. Neither
label changes: "Call instead" and "Call us" stay the author's words.

**And a guard over the WHOLE palette.**
[catalog-contact.test.ts](../../../../wizeworks/packages/silica-catalog/src/catalog-contact.test.ts)
builds every one of the 80 blocks in `SPARX_CATALOG` and fails on a literal
`tel:` or `mailto:` in an attribute.

It checks ATTRIBUTES, not text, and that is the whole precision of it: a block
may PRINT `(555) 123-4567` where `_contact-fields.ts` has bound it, because the
business's own number replaces the sample at render. An attribute is never a
sample — it is where the tap goes — and a bound one is not written into the tree
at all, so there is nothing to false-positive on.

Two blocks are exempt BY KEY, `stockists` and `location_cards`, which is [265]'s
line held exactly where it was drawn: those are tables an author replaces
wholesale, and the invented shop names beside the numbers announce them. Naming
them one at a time makes the exemption a decision somebody made rather than a
hole in the pattern.

Proved red by restoring the map block's original line:

```
FAIL  "Map" carries no tel: or mailto: of its own
block "map_embed" links to tel:+15551234567 — use boundContactAction so the
destination is the business's, or the button is not there
```

Green now, with the denominator asserted rather than assumed: the suite fails if
the palette it walks ever drops below sixty blocks, so a scan that silently
covered three of them cannot report the same green as one that covered all 80.

## Left alone, and said out loud

The Map block's `Your business name / 123 Example Street / Your town, POST CODE`
stay as they are. They reach nobody, they announce themselves, and binding them
would empty the column for a business that has not filled in Site identity yet.
The defect here is a number that CONNECTS, not a placeholder that reads as one.

## Confirmed

1,274 catalog tests pass, the package typechecks, and prettier is clean.

## Related

Third and fourth instances of [265]. The lesson that generalises is about the
guard, not the blocks: a guard scoped to the file where a bug was FOUND proves
nothing about the file the bug came from. See
[[feedback_structural_checks_go_blind]] — this is the softer version of that
failure, a scan that runs correctly over the wrong denominator.

## Rating effect

The Insert palette, in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
