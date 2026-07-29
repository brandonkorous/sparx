# silicaui feature request — per-item links inside email `collection` scopes

Version: 1.1
Author: Brandon Korous
Last Updated: 2026-07-29
For: the silicaui-builder team (email schema)
Observed on: `@wizeworks/silicaui-builder@0.34.2` (`/email` entrypoint)

> **RESOLVED in `@wizeworks/silicaui-builder@0.38.0`** — shipped as **Option 1** below: a
> `LinkNode` (`kind: "link"`) that holds a per-item-bindable `href` and wraps content
> children. It projects by DISTRIBUTING the anchor onto each child (image → `<a><img>`,
> text → wrapped `<a>`) rather than one block-level `<a>`, so it's Outlook-safe — the exact
> tradeoff this request called out. sparx now builds a clickable product rail on it
> (`productRail` in `silica-email-kit.ts`). The rest of this doc is kept as the original
> request for the record.

## Summary

In silicaui's **email** schema, dynamic content inside a `collection` scope can bind
per-item **text** and per-item **image sources**, but it **cannot bind a per-item link
(`href`)**. As a result, a repeated product/article card — the backbone of a
recommendation rail, a "new arrivals" grid, or a cross-sell block — cannot make each item
link to its own URL. Only a single, static, section-level button works.

We hit this building module-aware cross-sell into sparx's transactional + marketing
emails. We shipped a callout (`heading + one "Shop the collection" button`) as the
functional fallback, but a real product rail (each thumbnail deep-linking to its own PDP)
is blocked on this gap.

## Why it matters

Clickable, individually-linked product/content cards in a repeated collection are
table-stakes for commerce and content email:

- "Recommended for you" / "You might also like" after a purchase
- "New arrivals" / "Back in stock" rails
- "More to read" article grids from a CMS collection

In every case each card must deep-link to _its own_ record (`/products/<handle>`,
`/blog/<slug>`), not to a shared landing page. Without per-item links, an email rail is
either a wall of unclickable images or a single CTA that dumps everyone on the homepage —
neither is acceptable for a production email product.

## Root cause (as we understand the schema)

A repeated card lives inside a node whose `data` marker is a `collection` bind; silica
repeats that node's children once per item, and a child resolves its bound field against
`scope.item`. Each node carries **exactly one** dynamic-content marker:

```ts
// BaseNode (email)
interface BaseNode {
  id: string;
  ord?: string;
  data?: { kind: 'value' | 'collection'; ref: string; attr?: string };
}
```

`attr` picks _which_ attribute the single `ref` fills (default = the node kind's primary
field). So a node can bind **one** attribute per item. For an image card that needs both
its `src` and its `href` bound per item, one marker is not enough:

```ts
interface ImageNode extends BaseNode {
  kind: 'image';
  src: string; // bindable via data (default attr)
  alt: string;
  href?: string; // exists, but a second per-item bind can't coexist with src
  width: number;
  align: Align;
}
```

Binding `data:{kind:'value', ref:'imageUrl'}` fills `src`; there is no second marker left
to fill `href` from `item.url`. Binding `data:{kind:'value', ref:'url', attr:'href'}`
instead fills `href` but leaves `src` unbound. **You can bind the image or its link, never
both.**

The email content-node set is `text | image | button | divider | spacer | social | html |
video`, plus the containers `section | columns | column`. None of the containers carries
an `href`, and `button` renders as a button (not an image/text card), so there is no way
to wrap a card's children in a per-item link the way the **site** engine does (its link-box
wraps an image and binds `href` per item — which is exactly why clickable product cards
work on the storefront but not in email).

Token interpolation doesn't rescue it either: silica natively interpolates `{{tokens}}`
only in text + button labels (with item scope), while `href`/`src` tokens are resolved by
a separate **root-scoped**, post-projection pass — so a literal `href="{{item.url}}"` on a
repeated node resolves against the root, not the current item, and comes back empty.

## What we'd like

Any one of the following would unblock a real email product rail. Listed in our order of
preference:

### Option 1 (preferred) — a link-wrapper node for email

Add a container node that carries an `href` and wraps children, e.g.:

```ts
interface LinkBoxNode extends BaseNode {
  kind: 'link';
  href: string; // bindable per item: data:{kind:'value', ref:'url', attr:'href'}
  children: ContentNode[]; // e.g. an image + a title + a price
  // block-level; projects to <a> around the card's table cell / stacked content
}
```

This mirrors the site engine's link box, composes with the existing image/text nodes, and
unlocks **any** clickable repeated content (products, articles, categories) — not just
products. Smallest conceptual addition to the model (one node, one bindable attr).

### Option 2 — multiple bindings per node

Let a node carry more than one marker, e.g. `data?: Binding | Binding[]`, so a single
`ImageNode` could bind both `src` (from `item.imageUrl`) and `href` (from `item.url`). More
flexible, but a broader change to the binding model and every consumer of `node.data`.

### Option 3 — a first-class "card" content node

A higher-level `card` node with bindable `image`, `heading`, `subtext`, and `href`. Least
composable, but turnkey for the common product/article-card case.

## Acceptance (what "done" looks like for us)

Inside a `collection` bound to a product source, an author can build a card where:

- the image binds `item.imageUrl` (→ `src`),
- the title binds `item.title`, the price binds `item.priceLabel`,
- the whole card (or the image) links to `item.url` — **each item to its own URL**,

and `toEmailHtml` projects it to table-based, client-safe email markup with the correct
per-row `href` inlined. Renders correctly in Gmail / Apple Mail / Outlook, and stacks on
mobile.

## Notes / constraints on our side

- We're on the `/email` entrypoint and project via `toEmailHtml` + `resolveEmailTree` with
  a host `resolveBinding` / `resolveCollection` (sparx's binding spine). A new node kind
  needs a projector branch in `toEmailHtml` and a resolvable `attr:'href'` path — both of
  which our host already supports for other attrs.
- Everything else we need already works: per-item **text** (`data:{kind:'value', ref}`)
  and per-item **image `src`** resolve correctly against `scope.item` today. This request is
  narrowly about the missing per-item **link**.
