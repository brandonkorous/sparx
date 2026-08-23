# 170 — Every product has to be told what a size is, all over again

**Status:** open
**Severity:** minor
**Found by:** P03 · Juniper Row · act 2
**Surface:** mypiggles › Sell — the whole app
**Blocked on:** decision — a shared option library is a feature, and it is Brandon's call whether Piggles has one
**Filed:** 2026-08-23
**Fixed:** —
**Confirmed by:** —

## What happened

Act 2 asks a single question: can size and color be set up once, before a
catalogue is typed? Devi looked for it the way an owner would.

| Where she looked                    | What was there                                                                                      |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| The search bar — "sizes and colors" | One collection called New in. No screen.                                                            |
| The search bar — "size"             | _"Nothing matches that. Try a different word."_                                                     |
| The search bar — "options"          | Build-your-own options · Repeat order options · Build-your-own · Selling settings. None of them it. |
| **Sell → Selling settings**         | Currency, checkout, stock notes, failed repeat payments. Nothing about how a product is sold.       |
| **Sell → Kinds of product**         | Close, and not it — attributes like fabric and care, not the axes a shopper picks along.            |
| **Sell → Build-your-own**           | The configurator. A different idea.                                                                 |
| A product → **Options**             | Here. Per product, from scratch, every time.                                                        |

So the answer is no. Sizes belong to a product, and the next product starts with
an empty box saying **Size** in grey.

For Juniper Row that is **XS · S · M · L · XL** typed five times over — the same
five words, in the same order, on five products, with nothing checking that the
fifth product's "XL" is spelled the same as the first's.

## What should have happened

Set it up once, reach for it after. Something like "Size (XS, S, M, L, XL) — used
on 4 products" offered on the Options tab, so the second product is a pick rather
than a retype.

That is the shape sparx's own docs already imply, and it is the shape a shop
owner expects: a size chart is a property of the SHOP, not of one shirt.

## How to reproduce

Every time.

1. Console → **Sell** → any product → **Options** → **Add a choice**.
2. There is no way to reuse a choice from another product, and nowhere in the
   app that lists the ones already defined.

## Why it matters

Bounded, and it should be said plainly: the job CAN be done, five times, and
Devi's own run will do it. Filed as minor for that reason.

What it costs is not typing, it is CONSISTENCY. Five hand-typed lists drift —
"XL" and "X-Large", "Slate" and "slate" — and the drift shows up on the shop as
two filters that should be one, in reports as two rows, and in a search for
everything in a large. Nothing in the software can notice, because as far as it
knows those are two unrelated products' private words.

It also compounds with **[168]**: the retyping is the thing 168 made bearable,
not the thing it removed.

## Where it lives

The data model, not a screen. `commerce_product_options` and
`commerce_product_option_values` hang off a product id, and the endpoint the
Options tab commits to (`POST …/variants/options`) replaces one product's lattice.
There is no tenant-level option anywhere to point at, so this is not a missing
button.

Worth noting what IS there: `Kinds of product` (`commerce_product_types`) is
already a tenant-level, reusable, platform-seeded vocabulary attached to
products — the same shape this wants, for descriptive attributes rather than
sellable axes. If a shared option library is built, that is the pattern to
follow rather than invent.

## The fix

Not made. `Blocked on: decision`.

Two things make this Brandon's rather than mine. It is a **feature** — a new
tenant-level entity, its own screen, a picker on the Options tab, and a decision
about what happens when the shared list changes under products already using it
(rename Slate everywhere, or only here?). And Piggles' answer may legitimately be
"no": piggles RULE #1 says simplification comes from defaults and progressive
disclosure, and one honest option is a **starter set per trade** — apparel
products opening with Size and Colour already filled in from the trade she picked
at signup — which gets most of the benefit without a second thing to manage.

What it would take, either way: a tenant-scoped option list, a migration, the
picker, and a rule for what a shared edit does to products already on it.

## Confirmed by

—

## Rating effect

`Sell › Product › Options` — the gap is recorded in [rating.md](../rating.md).
