# 052 — The invoice asked a baker for her cost and a markup

**Status:** fixed
**Severity:** major (her selling price was recorded as her cost, at a false 0% margin)
**Found by:** P01 · Thistle & Rye · act 10 — the first line of the month-end invoice
**Surface:** mypiggles › Invoices › Add a line
**Filed:** 2026-08-21 · **Fixed:** 2026-08-21
**Confirmed by:** P01 · act 10 — picking the cardamom buns filled **Unit price $16.00**

## What happened

Marisol added a line, searched her own catalogue, picked **Country sourdough,
whole loaf** — a product she had already priced at $8.50. The description filled
in. The money box stayed empty, and it was labelled:

> **Cost** \*

with **Markup**, **Method** and **Markup %** underneath it, and a derived read-out:

> Unit price **$8.50** · **0% margin** · 0% markup

She typed $8.50 — her SELLING price — into a box called Cost, because it was the
only box that would take a number. The saved line now says her cost is $8.50 and
she makes nothing.

## Why it matters

Two separate harms.

**She is asked a question she cannot answer.** A baker does not have a per-loaf
cost. Flour, water, salt, time, gas, the mixer — nobody costs a sourdough that
way, and being made to before she can bill anyone is a wall in front of the most
routine thing in the module. "Cost" also means the opposite of what she needs it
to mean: to a business owner, cost is what SHE paid.

**The false number is recorded and reported.** `costCents` is the cost basis
behind Money › **Did you make money** › _What you kept_ and _By job_. Every
wholesale line she raises will say she made zero. That is not a blank report she
would distrust — it is a confident, wrong one. Every line on the saved invoice
carried a **0% margin** badge she never asked for and cannot make go away.

## Why it happened

Not a design decision — an interaction nobody joined up.

The default line type, and the one preselected in the Type box, is keyed `part`
and **named "Product"**, with `pricingMode: 'markup'`. That is a trades model: a
garage buying a part, marking it up, billing the customer. Perfectly right for a
garage; it is simply what a bakery is shown first.

And the product picker **already carried the price**. Its own comment says so —
_"Pointing at one seeds the description and unit price from the catalog"_ — but
the handler ended:

```ts
if (!markupMode) setUnitPrice(pick.unitPrice);
```

so in markup mode, which is the default, **the price was discarded.** The answer
was in the function, and thrown away one line before it was used.

Meanwhile every tenant is already seeded with a `catalog` line type, whose whole
purpose is a catalogue item that carries its own price.

## The fix

**Attaching a catalogue product moves the line onto catalogue pricing.** The
product carries its own price; that is what the mode is for. If no catalogue type
is configured the operator's chosen type is left alone and the price is seeded
wherever the mode can hold one — in markup mode it cannot, because unit price is
derived there and writing it would be overwritten on the next keystroke.

Nothing about the markup model changes. A business that genuinely prices by
markup types a cost and a markup exactly as before; it just stops being the
question a bakery is asked about her own bread.

## Confirmed

Picked **Cardamom buns, box of six** from the catalogue:

|                            | before              | after                    |
| -------------------------- | ------------------- | ------------------------ |
| Type                       | Product             | **Catalog item**         |
| money field                | **Cost** \* — empty | **Unit price** — `16.00` |
| Cost                       | —                   | optional, empty          |
| Markup / Method / Markup % | three controls      | gone                     |
| badge on the saved line    | `0% margin`         | —                        |

Her price, from her catalogue, without being asked what a loaf costs her.
