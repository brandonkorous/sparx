# 193 — Every detail she wrote printed its own name twice

**Status:** fixed and confirmed
**Severity:** minor
**Found by:** P03 · Juniper Row · act 4
**Surface:** Juniper Row's own website — any product with typed details
**Filed:** 2026-08-24
**Fixed:** 2026-08-24
**Confirmed by:** P03 · Juniper Row · 2026-08-24
**Blocked on:** —

## What happened

Devi filled in the Apparel details — fabric and construction, fit, care,
materials, made in. On the page each one came out like this:

```
FABRIC & CONSTRUCTION
                          ← a blank line, drawn, empty
Fabric & construction     Midweight cotton and linen canvas, 11oz…
```

The heading, then an empty line where the text should have been, then the same
words again as a label with the text beside them. Five sections, five times over,
and the five of them poured into ONE bordered box with no rule between them.

## Why it matters

It reads as a machine repeating itself. This is the detail block a customer opens
when deciding whether to keep a $128 shirt, and the sizing note she wrote to stop
returns is buried in it.

Nothing had ever rendered this block against real data. Devi is the first person
in this project to put a typed product on a real site, and all three faults were
waiting on the first look.

## Where it lives

`productAttributes()` in
[commerce.ts](../../../../wizeworks/packages/silica-catalog/src/commerce.ts).
Three separate mistakes, each one propping the next up so the result almost
looked right:

**1. The repeat flattened the sections.** A repeat renders its container's
CHILDREN once per item, INSIDE the container — it does not clone the container.
The per-section box WAS the repeat, so five sections' worth of headings and
values landed as fourteen loose siblings in one box. The nested materials repeat
did the same to its rows: two materials became four spans in one row.

**2. The scalar value rendered empty.** It was
`visibleWhen(bind(div, 'value'), 'value')` — and **a node carries ONE `data`
marker**, so the `visible` overwrote the bind. The div kept its authored text,
which is `''`. The file's own comments warn about exactly this, two functions up.

**3. The value appeared anyway, by accident.** A repeat over an EMPTY list
renders its template once (silica's placeholder convention), and for a scalar
section `items` is empty — so the row template rendered, resolved `label` and
`value` off the SECTION, and printed both. That accident is why nobody noticed
mistakes 1 and 2: the text was on the page, just in the wrong element with its
own label stuck to it.

## The fix

- The section box is now the repeat's CHILD, so each section gets its own box and
  its own rule.
- The condition and the value are two nodes: a wrapper carries `visible`, a `<p>`
  inside it carries the bind.
- The rows repeat carries `omitWhenEmpty`, so a scalar section renders no row at
  all instead of its template.

## Confirmed on screen

The Ash Overshirt's page:

```
FABRIC & CONSTRUCTION
Midweight cotton and linen canvas, 11oz, woven in Portugal…

FIT
Boxy and straight, cut to sit over a tee or a fine knit…

MATERIALS
Cotton                                                    60%
Linen                                                     40%

MADE IN
Denver, Colorado
```

Each under its own heading, once, with a rule between the sections and the two
materials on two rows. Three new tests pin all three: printed once, one box per
section, one row per material.

## Rating effect

None recorded — the tenant's own website has no row in [rating.md](../rating.md).
