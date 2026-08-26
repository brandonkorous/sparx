# 237 — Nine groups, and the same three words beside every one

**Status:** fixed and confirmed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 8 — reading the list of groups
**Surface:** mypiggles › Customers › Groups of customers
**Filed:** 2026-08-25
**Fixed:** 2026-08-25
**Confirmed by:** P03 · Juniper Row · act 8 — nine rows, nine different sentences

## What happened

The Groups list has four columns: Name, People, **Rules**, State. Every row's Rules
cell said:

```
From activity
From activity
From activity
From activity
From activity
From activity
From activity
From activity
From activity
```

## What should have happened

The column says what each group selects. That is the only reason to have it.

## Why it matters

On its own this is a wasted column. What it actually cost was
[236](236-new-customers-meant-people-who-had-bought-recently.md): a built-in group
whose rule contradicted its own description sat in this list for as long as the
list existed, and the one column that would have shown the contradiction was
printing a fallback.

A value identical on every row is not a value. And this fallback is worse than a
blank, because "From activity" reads like a _statement about the group_ —
membership comes from what people do — rather than like a number that could not be
computed. Nothing looks broken, so nothing gets looked at.

## Where it lives

[segments-data.ts](../../../../piggles/apps/workbench/surfaces/crm/segments-data.ts):

```ts
export function ruleCount(rules: unknown): number {
  if (!rules || typeof rules !== 'object') return 0;
  const node = rules as { conditions?: unknown; rules?: unknown; all?: unknown; any?: unknown };
  const branch = node.conditions ?? node.rules ?? node.all ?? node.any;
  return Array.isArray(branch) ? branch.length : 0;
}
```

It looks for `conditions`, `rules`, `all` and `any`. **The stored tree has none of
them.** Its key is `children`:

```json
{ "kind": "and", "children": [{ "kind": "predicate", "field": "…", "op": "gte", "value": 1 }] }
```

So it returned 0 for every segment ever written, and `ruleSummary`'s
`if (count === 0) return 'From activity'` caught all of them. The four key names it
does check belong to no schema in this repo.

## The fix

Reading the tree properly is barely more work than counting it, so the column now
says what the rule is, composed from the same field and operator labels the builder
uses to author it — the first condition in full, then how many others ride with it.

Two details that matter for a shop owner reading it: an enum renders as its
**label**, not its stored value ("Relationship is Wholesale", never "is b2b"); and
the tree is flattened before the count, so a nested group reads "and 2 more" rather
than "or 1 more, and 1 more".

A hand-picked list has no rules to describe, so it says **Picked by hand**.

## What it looked like once fixed

```
At Risk                    Number of orders is at least 1, and 2 more
B2B Fleet                  Relationship is Wholesale, and 2 more
Early Access               Label includes early-access
High Value                 Total spent is at least 5000
New Customers              Days since last order is at most 30
Newsletter Subscribers     Subscribed to marketing is yes
Bought in the last 90 days Days since last order is at most 90
Email engaged              Emails opened (30 days) is at least 1, and 2 more
VIP customers              Total spent is at least 10000, and 2 more
```

Nine rows, nine different sentences — and the fifth one is
[236](236-new-customers-meant-people-who-had-bought-recently.md), now legible from
the list.

## Housekeeping done alongside

`segment-rules.ts` was 568 lines and this change touched it, so under RULE #0.5 it
was split by responsibility: the field vocabulary, the field map, the operator
vocabulary and the tree, plus the new summary. All five files are under the cap and
call sites are unchanged — the tree file re-exports the other two, which is the
idiom its header already described.

## Related

[236](236-new-customers-meant-people-who-had-bought-recently.md) is what this column
was hiding.

## Rating effect

`Customers › Groups` in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
