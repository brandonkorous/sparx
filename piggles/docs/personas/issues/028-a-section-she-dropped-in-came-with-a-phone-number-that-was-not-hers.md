# 028 — A section she dropped in came with a phone number that was not hers

**Status:** fixed — the placeholder can no longer be mistaken for a real number
**Severity:** major
**Found by:** P01 · Thistle & Rye · act 7 — building the Celebration cakes page
**Surface:** mypiggles › My Site › Page — Insert › "Enquiry form" (and its siblings)
**Filed:** 2026-08-20
**Fixed:** 2026-08-20
**Confirmed by:** — (owed: insert the section again as Marisol)

## What happened

Marisol added the **Enquiry form** section to her cakes page. It arrived complete
and good-looking, and under the intro it said:

> Or call **01233 000000**, Monday to Friday, 8am to 5pm.

That is not her number, and those are not her hours — she is closed Mondays and
shuts at 2pm. It looks exactly like a real phone number, in a real sentence, in a
section that otherwise needed no editing.

## What should have happened

The number should have been hers. She had already typed it into **Your site →
How customers reach you**, and the Contact page draws it from there and renders
**01632 960 118** with no page edit at all — that is what
[#024](024-she-typed-her-phone-number-in-and-the-page-kept-the-fake-one.md) and
[#025](025-the-link-showed-its-own-address-where-the-phone-number-belonged.md)
were about.

## Why it matters

Everything else in a catalog section reads as obviously-placeholder — "Furniture
that outlives the room", "Quoted per job". **A phone number does not.** It is
seven digits that look like seven digits, in a sentence that is already true, on
a page that is otherwise finished. The failure mode is publishing it: a customer
rings a stranger, and the shop never learns why nobody called.

Three sibling sections carry the same number:
`sections/convert.ts:86`, `sections/layout.ts:187` (a footer "Call us" item, with
a matching `tel:+441233000000`), and `sections/place.ts:90` + `:131`.

## Where it lives

[wizeworks/packages/silica-catalog/src/sections/convert.ts:86](../../../../wizeworks/packages/silica-catalog/src/sections/convert.ts#L86)

```ts
caption('Or call 01233 000000, Monday to Friday, 8am to 5pm.'),
```

The catalog authoring contract says bindings are for exactly this:

> `bound(node, 'path')` → attach a data binding. **Use only where a real data
> field fits**; otherwise author static placeholder text.
> — [catalog/CONTRACT.md:31-33](../../../../wizeworks/packages/builder-schemas/src/catalog/CONTRACT.md#L31)

A phone number in a "call us instead" line is a real data field —
`site.identity.phone` — and it demonstrably resolves.

## The fix

Brandon's call, 2026-08-20: **"fake phone numbers are ok as long as it's
(555) 123-4567."**

That is option 2 in the original filing, and the objection to it — "a number
that cannot be mistaken for one … cheaper, and worse" — was wrong about WHICH
number. `000 000 0000` is a broken placeholder. `(555) 123-4567` is the reserved
fictional block: it reads as a phone number's SHAPE while being recognisable to
almost anyone as not a real one, which is exactly the property the old
`01233 000000` lacked. The repo already agreed with itself here — every sample
data pack (`db/src/sample-data/packs/*`) uses reserved 555 numbers, and
`builder-schemas/src/catalog/data-input.ts` uses this exact string as a form
placeholder. `silica-catalog` was the one outlier.

Every placeholder number in the catalog is now `(555) 123-4567`, with
`tel:+15551234567` behind it:

- `sections/convert.ts` — the "or call instead" caption + the call action
- `sections/layout.ts` — the footer "Call us" item
- `sections/place.ts` — the single location, and all three branch cards
- `sections/offer.ts` — the four stockists
- `sections/media.ts` — a `tel:+10000000000` that was not even well-formed

**A locale mismatch this introduced, and closed in the same pass.** The catalog's
fictional business was British — Ashford, Kent, `TN23 1QX`, branches in
Canterbury and Maidstone, a service area of Kent towns, "Bank holidays vary",
"Town or postcode is enough". A North-American phone number in a Kent address
block is a placeholder that contradicts itself, and it was the only file group in
the repo not set in the US (every sample-data pack is Portland, Chicago, Austin,
Asheville). The addresses, town lists and two UK-only phrases moved with the
number, so the placeholder reads as one coherent invented business again.

**Binding identity is still the better answer and is still not built.** The
catalog contains no bindings at all, so `site.identity.phone` in a catalog
section remains a new pattern in that package (RULE #1: ask first). The
difference is that the failure mode is no longer silent — an unedited
`(555) 123-4567` on a live page is visibly a placeholder, where `01233 000000`
was a number a customer would dial.

## Confirmed by

`silica-catalog` — 1144 tests green after the change. **Owed:** insert
"Enquiry form" again as Marisol and read the caption on the canvas.

## Rating effect

None recorded — the catalog palette has not been scored.
