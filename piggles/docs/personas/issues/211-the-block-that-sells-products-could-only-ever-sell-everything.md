# 211 — The block that sells products could only ever sell everything

**Status:** fixed and confirmed
**Severity:** major
**Found by:** P03 · Juniper Row · act 5
**Surface:** mypiggles › My Site › Page › the builder — any page with a Products block
**Filed:** 2026-08-25
**Fixed:** 2026-08-25
**Confirmed by:** P03 · Juniper Row · act 5, on her homepage

## What happened

Act 5's whole point is a homepage that sells **New in** — the two new pieces, the
group Devi built the shop around. In the builder's Add panel, one entry does
exactly that job and says so:

```
Products
A product listing — pick the source (all, featured, new, related, a category)
and grid or rail.                                                    [Products]
```

She dropped it in. Then she looked for where you pick the source. The Inspector,
with the listing selected:

```
Group
  Design | Settings

  Link straight to this part      ┌──────────────┐
  Name this layer                 ┌──────────────┐
  Lock in place                   ( )
```

An anchor name, a layer name, and a lock. Those three are on every node on the
page. **There is no source picker anywhere in the editor** — not on the repeat,
not on the section, not on the heading.

So the block does the one thing it does by default, forever: the whole catalog.
Her homepage could show all seven garments or nothing.

## Why it matters

This is the difference between a shop and a homepage. A homepage that lists
everything you sell in the order the database returned it is a category page
wearing a hat — no lead, no argument, nothing chosen. The reason to build one is
to say **here is what is new**, and that is the one thing this could not say.

It also silently broke the shape of the live page. The starter she is on has the
same block twice, and the second one is headed **Featured** over the identical
seven products, because "Featured" is a heading someone typed and not a source
anything reads. A section that promises curation and delivers the full catalog is
worse than no section: it teaches a shopper that the headings on this site do not
mean anything.

And it is not an obscure block. It is THE product block. Every business that
sells anything and builds a page reaches for it.

## Where it lives

Everything except the control exists.

The source is a real, typed, five-valued thing
([commerce.ts](../../../../wizeworks/packages/silica-catalog/src/commerce.ts)):

```ts
export type ProductsSource =
  | 'commerce.product' // the whole catalog
  | 'commerce.featured'
  | 'commerce.new'
  | 'commerce.related'
  | `commerce.category.${string}`; // ← a specific group, by handle
```

It is stored on the repeat node as `data = { kind: 'collection', ref }`. The
studio's operation vocabulary already has the op that writes it
([ops/types.ts](../../../../wizeworks/packages/studio/src/ops/types.ts)):

```ts
| { kind: 'node.setData'; id: string; value: DataBinding | undefined }
```

**Nothing in any inspector calls it.** Grepping every `.tsx` under the workbench
and the studio's React layer for `node.setData` returns no caller. The op is
reachable from nowhere.

Both the catalog entry and the block's own comments are written as though the
control is there:

```
// ONE configurable listing (docs/122). Drops a shop-all grid; the editor's
// data-source picker repoints it to Featured / New / Related / a Category…

// An author who repoints this block at `commerce.featured` is left with an
// invisible node, not a broken pager.
```

The engine, the type, the storage, the op and the storefront rendering were all
built. The last control was not, and because everything around it reads as
finished, nothing pointed at the gap. **The docs describing the picker are the
reason it stayed missing for so long: they read exactly like a description of
something that exists.**

## The fix

A **What this shows** panel in the Inspector, on any listing that carries a
product source, in her words rather than the type's:

```
What this shows
  ( ) Everything in your shop
  ( ) The ones you have featured
  ( ) Your newest
  ( ) One group of products    →  [ New in            ▾ ]
```

- The groups come from her own list, by name, with their product counts — so she
  picks **New in**, not `commerce.category.new-in`.
- **Related** is deliberately not offered here. It means "others from the same
  group as the product being viewed", which is only answerable on a product page;
  on a homepage it is a source that can never resolve. It appears only on a
  record template, where it is true.
- Changing the source is one undoable step like every other edit, and the canvas
  repaints against the real data, so she sees the two garments rather than a
  promise.
- The panel does not render at all on a node with no product source, so it never
  appears on a heading or a button.

## What it looked like once fixed

Her homepage, with the listing set to **New in**:

```
New in
The Ash Overshirt  $128.00        Linen Shirtdress  $145.00
```

Two garments, the two she wanted to lead with, chosen by name from a list.

## Rating effect

`My Site › Page` in [rating.md](../rating.md).
