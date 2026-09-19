# 588 — Five screens tell me to set a cost, and none of them says where

**Status:** fixed and proven on screen
**Severity:** medium
**Found by:** Devi, on Stock → Cost vs plan
**Surface:** `piggles|sparx/apps/workbench/surfaces/inventory/set-costs-action.tsx` + 5 panes
**Filed:** 2026-09-16
**Family:** [[feedback_one_outcome_two_causes]] · [[feedback_a_promise_in_copy_is_a_contract]]

## What she saw

Five screens tell her the same thing, carefully, in a warning band:

| Screen                  | What it says                                                                  |
| ----------------------- | ----------------------------------------------------------------------------- |
| Cost vs plan            | "Set a cost on the product, or on its stock at a location"                    |
| Cost to keep            | "68 items have no cost price"                                                 |
| Not selling             | "Set what you pay for those items and they will be counted in"                |
| What matters most       | "Set what you paid for them and they will take their real place"              |
| Stock versus your books | "375 units counted onto the shelf with nothing recorded about what they cost" |

Every one of them names the remedy. **Not one of them gives her a way to do it.**

Meanwhile a screen exists that does exactly that: **What your stock cost you**.
Every unpriced item, biggest holding first, with a cost box on each row, and its
own sentence saying so:

> 68 things on your shelves, 375 units in all, have never had a cost recorded...
> The biggest holdings are first, so filling in the top few fixes most of the
> number.

## The claim that was not kept

The catalog entry for that screen says, in its own comment:

```ts
// Listed, because the person who needs it will not know to look for it: it is
// reached from the figures that admit the gap AND from the launcher.
key: 'inventory.costing.uncosted',
```

Measured. Two screens open it, and neither is one of the five:

```
surfaces/inventory/reports-uncosted.tsx:52   ctx.open('inventory.costing.uncosted', ...)
surfaces/inventory/counts-list.tsx:220       ctx.open('inventory.costing.uncosted', ...)
```

The design was written down, half built, and the half that mattered most is the
half where a person is actually stopped. This is
[[feedback_verify_capability_in_code_not_docs]] with the doc inside the source
file it describes.

## Why it matters more than it looks

This is the same $968 that made issue 585. Cost vs plan now correctly says
**"Nothing here had a plan to compare against"** instead of inventing an
overspend. It is honest, and it is a dead end: the reader is told her report
cannot be produced and left on the page. 105 of Devi's 108 products have no
planned cost, so this is the state she is in every time she opens it.

## The fix

One component, `SetCostsAction`, rendered by all five.

```tsx
<SetCostsAction
  onOpen={() => {
    ctx.open(SET_COSTS_SURFACE, {}, { target: 'tab' });
  }}
/>
```

One component rather than five buttons, so the words and the route stay in step,
and the sixth screen to admit the gap gets the same way out. It copies the
wording already used by the one place that got this right, the counts list:
**"Put in what they cost"**, with the same coin icon.

A new tab rather than a replace, because the reader is coming back to the figure
they were reading.

`planning-holding.tsx` had no `ctx` at all — it is the one surface in the group
that never took one — so it gained the parameter and threads it to its panel.
The reconciliation is a table rather than a band, so the action sits in its own
alert directly under the table, shown only when a line actually came back
unpriceable.

**Now**, verified in the browser end to end: Cost vs plan shows **Put in what
they cost** in the warning band; clicking it opens "What your stock cost you"
with The Ash Overshirt at the top, 7 units, $128.00, and an empty cost box.

## Proven

Not by a unit test. The property here is "a screen that names a remedy offers
it", and the honest check was walking it.

| Pane                    | Band today                                 | Button  |
| ----------------------- | ------------------------------------------ | ------- |
| Cost vs plan            | "98 units have nothing to compare against" | **yes** |
| Cost to keep            | "68 items have no cost price"              | **yes** |
| What matters most       | "69 items have no cost price"              | **yes** |
| Stock versus your books | "Some of this stock has never been costed" | **yes** |
| Not selling             | _no band_ — nothing is idle today          | n/a     |

Four of the five are verified on screen, and the button on Cost vs plan was
clicked through: it opens "What your stock cost you" with The Ash Overshirt at
the top, 7 units, $128.00, and an empty cost box.

**Not selling has no instance today.** Its band renders only when a slow-moving
item also has no cost price, and Juniper Row's pane reads "Everything is moving".
So the fifth is fixed on the same reasoning rather than on a sighting, and is
recorded here as unverified rather than claimed.

|                 |                    |
| --------------- | ------------------ |
| piggles console | **483 pass**       |
| sparx console   | **385 pass**       |
| typecheck       | both exit 0        |
| console parity  | PASS (0 divergent) |
| lint / prettier | clean              |

## Still open

The catalog comment's other half is now true, so it stays. But a claim like it,
sitting in a comment beside a `key`, is not checkable by anything, and this is at
least the second time one has been found stale this run. A guard that reads every
"reached from" claim against the call graph would be worth having and is not
built.
