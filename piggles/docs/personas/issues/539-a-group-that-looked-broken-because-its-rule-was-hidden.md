# 539 — A group that looked broken because its rule was hidden

**Status:** fixed and proven
**Severity:** medium
**Found by:** Devi, wondering why six of her nine groups were empty
**Surface:** `piggles|sparx/apps/workbench/surfaces/crm/segment-summary.ts`, `segments-list.tsx`
**Filed:** 2026-09-16

## What she saw

Customers → Groups of customers:

> | Name        | People         | Rules                                      |
> | ----------- | -------------- | ------------------------------------------ |
> | **At Risk** | No members yet | Number of orders is at least 1, and 2 more |

She has six customers who have ordered. The line says the group is "everyone who
has ever bought from you". The count beside it says zero. Read together, that is
a broken platform.

It is not broken. "At Risk" is **has ordered AND has not ordered for ninety
days**, and every one of her customers bought within the week. The single
condition that explains the zero was one of the two the line hid.

## Why

```ts
/** The first is the useful half — it is usually what the group was named
 *  after — and the count says whether there is more to open. */
const head = describeLeaf(first, custom);
return rest.length === 0 ? head : `${head}, and ${String(rest.length)} more`;
```

That comment is a claim about the data. Checked against the groups the platform
actually seeds, it holds for three of five and fails on the two where it matters:

| group         | what it is named for | what the line showed              |
| ------------- | -------------------- | --------------------------------- |
| **At Risk**   | ninety days idle     | `Number of orders is at least 1`  |
| B2B Fleet     | fleet size           | `Relationship is Wholesale`       |
| VIP           | high spend           | `Total spent is at least 10000` ✓ |
| High Value    | high spend           | ✓ (one rule)                      |
| Email engaged | opens and clicks     | ✓                                 |

Naming a group after its first rule is a guess. Printing its rules is not.

## The second bug in the same function

```ts
if (node.kind === 'not') return leaves(node.child);
```

The negation was **dropped in silence**. A group built on "not subscribed"
rendered as `Subscribed to marketing is yes` — the exact opposite of the group,
in a sentence with nothing to suggest a word was missing.

## The third bug, in the other console

sparx never got the fix this file was written for. Its column still ran:

```ts
const count = ruleCount(segment.rules);
if (count === 0) return 'From activity';
```

`ruleCount` looks for `conditions` / `rules` / `all` / `any`. **The stored tree
has none of those — its key is `children`** — so it returned 0 for every segment
ever written, and every row read "From activity". That is the original defect
this module was created to fix, still shipping in the other console.
[[feedback_a_fix_leaves_its_neighbour_behind]], for the third time this run.

## Fixed

`describeRule` now walks the tree and prints it with its connectors, bracketing a
nested group of the other kind so the grouping survives the flattening:

> **At Risk** — Number of orders is at least 1, Days since last order is at least 90, and Do not send marketing is no
>
> **Email engaged** — (Emails opened (30 days) is at least 1 or Emails clicked (30 days) is at least 1) and Subscribed to marketing is yes

"A and B" for two, "A, B, and C" for more, the way it would be said out loud.
`not (…)` is spelled out. Past four conditions it falls back to the old count,
because at that point it stops being a sentence; nothing the platform seeds comes
close.

The module and its list wiring are now in **both** consoles, and sparx's
`ruleCount` was deleted rather than left as a trap for the next caller.

## Guards

`segment-summary.test.ts`, both consoles, 7 each. **3 go red** against the
behavior that shipped: the hidden conditions, the lost brackets, and the dropped
`not`.

## Not filed

Six of nine groups being empty is mostly correct. "High Value" is spend ≥ $5,000
and "VIP" is ≥ $10,000, on a shop whose best customer has spent $180; they are
seeded for a larger business, and they are honest. Whether those are the right
defaults for a small shop is a separate question about seeds, not a defect here.

## Files

- `piggles|sparx/apps/workbench/surfaces/crm/segment-summary.ts` + `.test.ts`
- `sparx/apps/workbench/surfaces/crm/segments-list.tsx`, `segments-data.ts`
