# 025 — The link printed its own address where the phone number belonged

**Status:** fixed
**Severity:** major
**Found by:** P01 · Thistle & Rye · act 7 — the moment [024](024-she-typed-her-phone-number-in-and-the-page-kept-the-fake-one.md) was fixed
**Surface:** mypiggles › My Site › Page — the canvas, any node with an attribute binding
**Filed:** 2026-08-20
**Fixed:** 2026-08-20
**Confirmed by:** P01 · act 7, on the screen

## What happened

With her real details finally resolving, the Contact page read:

> **Call us** tel:01632960118
> **Email us** mailto:hello@thistleandrye.co

The link was printing its own `href` as its words.

## Why it happened

A starter Contact page binds the pair the way you would expect: the `<a>` binds
`site.identity.phoneHref` **into the `href` attribute**, and the span inside it
holds the number as words bound to `site.identity.phone`.

```json
{ "kind": "element", "tag": "a",
  "data": { "kind": "value", "ref": "site.identity.phoneHref", "attr": "href" },
  "children": [ { … the number … } ] }
```

The canvas ignored `attr` entirely:

```ts
const bound = boundText(ctx, node);
if (bound !== undefined) return createElement(tag, props, bound);
```

`boundText` passed `node.data.attr` to the resolver and then used the answer as
the element's TEXT — discarding the children. So an attribute binding became the
visible words, on the canvas only; the live site has always used `bindAttr` and
draws it correctly.

**It had never been seen because it could not fire.** `phoneHref` resolved to
nothing until [024](024-she-typed-her-phone-number-in-and-the-page-kept-the-fake-one.md)
was fixed twenty minutes earlier, and an unresolved binding leaves the words
alone. One defect was hiding the other.

## How to reproduce

1. Fill in a phone number under **Your site → How customers reach you**.
2. Open the Contact page in the builder.
3. The link reads `tel:…` instead of the number.

## Why it matters

It is what an owner sees on her own page, and it makes the editor look wrong
about content that is in fact correct — the published page would have been fine.
Any tree binding an attribute is affected: a picture bound to `src`, a link bound
to `href`, a button bound to a target.

## The fix

The two are now separate paths, which is what the schema always meant:

```ts
/** A binding that names an ATTRIBUTE is not text and never was. */
function boundText(ctx, node) {
  if (node.data?.kind !== 'value' || node.data.attr) return undefined;
  return ctx.host.resolveBinding?.(node.data.ref);
}

/** The attribute a binding fills, when it names one. */
function boundAttr(ctx, node) { … }
```

`renderElement` applies the attribute (through the same `ATTR_ALIASES` map every
other attribute goes through) and then renders the children as normal.

## Where the fix lives

- `wizeworks/packages/studio/src/react/canvas/render-node.tsx` — `boundText`, `boundAttr`
- `wizeworks/packages/studio/src/react/canvas/bound-attr.test.ts` — 5 tests over the
  rule: names an attribute → fills it and leaves the words; names none → replaces
  the words; resolves to nothing → leaves both alone
