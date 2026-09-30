# 749 — The till cannot find a jumper by its size, or by the code on its box

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 267
**Surface:** mypiggles workbench — Take a sale (`commerce.sale.new`), "What they had"
**Filed:** 2026-09-20
**Fixed:** 2026-09-20
**Confirmed by:** P03, taking a wholesale order for a specific size
**Blocked on:** —

## What happened

Loom and Larder wanted the **Marlow Knit, XL, Moss** — the one they have a
signed price on. Typed into "Search what you sell":

```
Marlow                 8 rows to read through
Marlow Knit XL         Nothing you sell is called "Marlow Knit XL".
MARLOW-KNIT-XL-MOSS    Nothing you sell is called "MARLOW-KNIT-XL-MOSS".
```

The rows it draws look like this:

```
Marlow Knit
XL · Moss                                    $96.00
```

The version is on the row. The code is in the row's data. The box read neither.

```ts
.filter((item) => term === '' || item.name.toLowerCase().includes(term))
```

## How much of the catalog that is

**MEASURED 2026-09-20, all 43 tenants:**

```
sellable versions                                   2,384
of those, sharing their product's name              2,030    (85%)
Juniper Row: 109 versions, 87 sharing a name        (80%)
```

For **85% of everything anybody sells here**, the version IS the identity, and
it was the part the box refused to read. A maker with four sizes in two colors
had to know that eight rows would come back and read them.

## The dangerous half is the sentence

> Nothing you sell is called "Marlow Knit XL". **Add it by hand below.**

That is an invitation to type in, as a one-off with a price she makes up,
something she already sells at a price a shop has **agreed in writing**. Issue
[737](737-the-till-charges-list-price.md) closed the front door on that; this was
the side door, and it was the screen's own suggestion.
[[feedback_one_outcome_two_causes]]

## What was done

**`sale-sellable-search.ts`** — the row's whole identity is the haystack: name,
version and code. Every WORD of what was typed has to land somewhere, so
"Marlow Knit XL" narrows instead of failing and "moss marlow" works too. Nobody
at a counter types a catalog string in catalog order, and that is the same rule
the server's own contact search already uses.

**The sentence stopped suggesting the wrong thing:**

> Nothing you sell matches "Marlow cushion". Try fewer words, or the code off
> the box. If it really is a one-off, write it in below.

Writing a one-off in is still right and still there. It is no longer what she is
told to do when the search simply did not look.

## What was NOT changed

**The cap of twelve rows stays.** A box that lists the whole catalog is not a
search. With the version searchable, twelve is now reached far less often.

**The list still shows catalog prices**, which is the open item carried from
737: the number she clicks is not the number that lands for a wholesale buyer.
The line puts it right the moment it is added, and the picker still does not.

## Files

- `piggles/apps/workbench/surfaces/commerce/sale-sellable-search.ts` — new
- `piggles/apps/workbench/surfaces/commerce/sale-sellable-search.test.ts` — new
- `piggles/apps/workbench/surfaces/commerce/sale-lines.tsx` — the box

## Not in sparx

sparx has no till — no `commerce.sale.*` surface — so this box exists once. See
[748](748-a-shop-phones-an-order-and-there-is-nowhere-to-type-it.md) for what
sparx is missing instead. [[feedback_verify_capability_in_code_not_docs]]

## Proof

Fourteen tests, proved red by narrowing the haystack back to the name alone:
**5 of 14 failed** — the size, the code, the word order, the case, and the
appointment found by its length. Two more read the pane rather than the
function, because a perfect matcher nothing calls is the shape this console has
shipped before. [[feedback_screen_over_a_function_nobody_calls]]
