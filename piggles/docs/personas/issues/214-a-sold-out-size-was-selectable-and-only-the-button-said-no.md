# 214 — A sold-out size was selectable, and only the button said no

**Status:** fixed and confirmed
**Severity:** major
**Found by:** P03 · Juniper Row · act 6
**Surface:** the tenant's website — every product page with more than one version
**Filed:** 2026-08-25
**Fixed:** 2026-08-25
**Confirmed by:** P03 · Juniper Row · act 6, as a shopper, on screen

## What happened

Devi counted the Ash Overshirt in XS · Bone down to zero — she had sold the last
one — and the console was clear about what that meant:

```
Nothing left to sell
Your website shows it as sold out and will not take an order for it. It comes
back on sale by itself the moment you count some in.
```

On the product page, that version did say so:

```
Choose yours
  XS · Clay   XS · Slate   XS · Bone, sold out
  S · Clay    S · Slate    S · Bone    M · Clay
  …
```

And it was **selectable**. Clicking it filled the radio like any other. The
Add to cart button did not change, did not disable, did not so much as reword.
Only after pressing it did anything happen:

```
                    [ Add to cart ]
Sorry, this item just sold out.
```

## What should have happened

Act 6 asks for this in as many words: buying a version with no stock must be
**impossible, not merely discouraged**.

## Why it matters

The hard guard held — the server refused, no line was added, nothing oversold.
This is about the twenty seconds before that.

A shopper who wants XS · Bone reads "sold out", picks it anyway (people do; the
radio invited it), presses the one button on the screen, and gets a red line
telling them the thing they were already told. On a fifteen-version garment the
words are four characters from the end of a label in a wall of fourteen other
labels, and the control — the part of the screen a person actually operates —
said yes.

**The words were in the label the whole time. The control simply did not act on
them.** Everything needed to prevent this was already resolved, already published
to the page, and already printed; nothing was missing but the consequence. This
run keeps finding values a screen already holds and does not use — and this is the
sharper version of it, because here the value WAS shown and still changed nothing.

There is a second, quieter wrong in the sentence. **"Just sold out" describes a
race** — it sold out between the page loading and the click. It did not. The page
had known since it was drawn, and had printed the fact. Telling somebody a thing
changed under them, when it did not, is a small lie in the same family as
[206](206-checkout-said-shipping-was-free-before-it-knew-where-to-send-it.md)'s
"Free": accurate about the code, false about the world.

## Where it lives

[commerce.ts](../../../../wizeworks/packages/silica-catalog/src/commerce.ts),
`versionPicker`. Every version got the same radio:

```ts
el('input', 'radio', {
  attrs: { type: 'radio', name: 'variantId', required: 'required' },
});
```

and [silica-data.ts](../../../../wizeworks/apps/site/lib/silica-data.ts) put the
stock fact into the label and nowhere else:

```ts
if (!variant.inStock) parts.push('sold out');
return { id: variant.id, label: parts.join(', ') };
```

The buy box does have a sold-out state, and it is correct — `soldOut` swaps the
whole form for a notice. But it is deliberately whole-product: since
[190](190-nobody-could-choose-a-size-or-a-colour.md) gave the page a picker, one
gone size must not take the buy box down with it, and the code says so:

> ANY variant, not the default one … one sold-out size must not take the whole buy
> box down with it — each version says "sold out" in the picker instead.

Right decision, and it stopped one step short: saying so was made to stand in for
doing something about it.

## The fix

**A version that is gone renders a disabled radio.** The picker now authors two
branches per version and the engine drops whichever does not apply: the buyable
one binds its `value` to the variant id as before, and the sold-out one is
`disabled`, struck through, and **binds nothing at all** — a control that can
never post has no id to carry, which is exactly what frees its one binding slot
for the condition.

That makes it impossible rather than discouraged, and it makes the existing
sentence true again: with the option unpickable, "Sorry, this item just sold out"
can now only reach a shopper in the race it describes. The message did not need
rewording; it needed to stop being reachable by other means.

**The first cut was wrong, and the screen caught it.** I followed this file's own
"absent rather than false" convention and left `soldOut` off the in-stock
versions, gating the buyable branch on the ref being MISSING. An absent ref is
not false to the engine — it is **UNKNOWN**, which keeps the node and stops
resolving the bindings underneath it. The page came back with fourteen bare
radios and no words beside any of them:

```
Choose yours
  ○  ○  ○   XS · Bone, sold out
  ○  ○  ○  ○
```

The types were happy. The convention was real, and it is right everywhere the
condition governs a subtree with nothing else bound inside it — which is every
other use of it in that file. Inside a repeat, over an item whose label is bound,
it is the opposite of what you want. **`soldOut` is now published on every
version, false included**, and a test pins it there.

## What it looked like once fixed

```
Choose yours
  XS · Clay   XS · Slate   X̶S̶ ̶·̶ ̶B̶o̶n̶e̶,̶ ̶s̶o̶l̶d̶ ̶o̶u̶t̶
  S · Clay    S · Slate    S · Bone    M · Clay
  M · Slate   M · Bone     L · Clay    L · Slate
  L · Bone    XL · Clay    XL · Slate  XL · Bone
```

Fifteen versions, fourteen pickable, one struck through and inert. Clicking XS ·
Bone selects nothing; the size is still listed, because a maker whose whole
product page says "when a size goes it does not come back" needs the gone one to
be visible rather than quietly absent.

Devi's customer then bought M · Clay in the ordinary way and the order went
through — **O-000004**.

## What is NOT covered, and why it is worth knowing

The picker is code-authored and **stamped into a page when a tenant edits it**, so
this fix reaches every property rendering the code product template and does not
reach one that has saved its own. Twelve stamped `commerce.product` pages exist
today and **not one of them contains a picker at all** — they predate
[190](190-nobody-could-choose-a-size-or-a-colour.md), so those shops are still
selling a single fixed version. That is a separate and larger finding than this
one; it is recorded here rather than fixed here, because it is about how a
code-template fix reaches a stamped tree, which is the same question
[212](212-her-homepage-was-live-and-the-editor-said-it-did-not-exist.md) asked and
answered for pages.

## Rating effect

None — the storefront is not rated in [rating.md](../rating.md), which covers
console panes. Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
