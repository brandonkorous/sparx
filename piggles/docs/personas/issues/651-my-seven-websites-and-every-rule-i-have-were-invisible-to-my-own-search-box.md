# 651 — My seven websites and every rule I have were invisible to my own search box

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 226
**Surface:** the console's search box (⌘K) — the record half of it
**Filed:** 2026-09-18
**Fixed:** 2026-09-18
**Confirmed by:** P03 · Juniper Row · act 226 (both kinds appeared, and the hit opened the record)

## What happened

Straight after [649](649-i-typed-the-name-of-the-thing-on-my-screen-and-it-said-i-had-nothing-like-it.md)
was confirmed working, I built an automation from the sequence editor, turned it
on, and typed its exact name into the search box:

> **Add people to Welcome series**

The box found the sequence and not the rule. Then I typed the name of one of her
websites:

> **lookbook**

> Nothing in your records matches "lookbook". Everything below is a screen.

She has a site called **Juniper Row Lookbook**.

## Measured

Typesense was holding both, correctly:

|                                      |        |
| :----------------------------------- | -----: |
| her automations in the index         | **57** |
| her websites in the index            |  **7** |
| of those 64, findable in the console |  **0** |

Every other part was right. The projector built the document, the write-time
signal fired, the route binding existed. The record was in the index and the box
said she had nothing like it.

## The cause

`/v1/search/all` filters documents to the tenant's **enabled modules**, so a
switched-off module's stale rows never surface. That makes the `module` field on
a search document load-bearing — and two projectors named a module that is not a
module:

| record       | module written | what it should be         | hidden |
| :----------- | :------------- | :------------------------ | -----: |
| `site`       | `sitebuilder`  | `builder` (the real slug) |      7 |
| `automation` | `automations`  | there IS no such slug     |     57 |

The second is not a typo. Automations are a **platform capability** with no
module at all, and the REST route says so in its own header:

> Automations are a PLATFORM CAPABILITY, not a gated module (docs/81 §3): there
> is no `automations` slug

I wrote `module: 'automations'` while editing that very file to add the indexing
calls. [[feedback_a_fix_leaves_its_neighbour_behind]]

A module nobody can enable matches nothing. Forever. Silently. And the failure
renders as the ordinary empty result, which is the same sentence 649 exists to
make honest. [[feedback_absent_behaves_like_fine]]

## The fix

- **`PLATFORM_MODULE`** in `@wizeworks/search`'s projector contract — the one
  reserved word for records belonging to no module. It is deliberately not a
  `ModuleSlug`: it can never be enabled, disabled, billed or required, and
  `isModuleEnabled` would answer false for it.
- **The route lets it through** rather than looking it up. A caller narrowing to
  one module still gets exactly that module; platform records are not smuggled in.
- **`site` now writes `builder`.**

It lives in `@wizeworks/search` rather than `@wizeworks/modules` because
`commerce-indexer` already depends on the first and not the second, and a new
dependency edge costs a Dockerfile COPY for a string constant.

## The fix failed the first time, and that is the important part

I changed `siteProjector.module` from `'sitebuilder'` to `'builder'`, ran a full
reindex, and all seven documents came back still saying `sitebuilder`.

There are **two** `module` values per projector:

```ts
const siteProjector: EntityProjector = {
  entityType: 'site',
  module: 'builder',          // ← the one I changed. NOTHING READS IT.
  project: () => ({
    entity_type: 'site',
    module: 'sitebuilder',    // ← the one Typesense stores and filters on
    …
```

`EntityProjector.module` has **zero consumers**. I checked after the reindex
disagreed with me, not before. So the "fix" edited a field that does nothing
while the document three lines below went on shipping the old value — and the
projector's own declaration read correct the whole time, including to the guard I
had just written to catch this class of bug.

Caught only by reading the document Typesense actually held.
[[feedback_verify_capability_in_code_not_docs]]

One more projector disagreed with itself the same way: `warehouse` declared
`commerce` while shipping `inventory`, left behind when warehouses moved modules.
Harmless, because nothing reads it — which is exactly what makes it the line the
next person edits believing they have changed something. Both now say `inventory`.

## Guard

`check:search-entities` gains a **fourth** thing that has to line up, and it
checks the value that ships:

1. a projector exists,
2. something signals the index when one is WRITTEN,
3. a route binding exists so the hit opens,
4. **the document's `module` is a real slug or `PLATFORM_MODULE`, and the
   projector's declaration agrees with it.**

Proved red four ways:

1. `site` document back to `sitebuilder` → names it, and asks **"Did you mean
   'builder'?"**
2. `automation` back to `'automations'` → names it, and points at
   `PLATFORM_MODULE` because no slug is close.
3. **Declaration and document disagree while both are valid slugs** → names both
   and says which one is read. This is the case that fooled me.
4. The slug list moved out of reach → exits 1 rather than comparing every
   projector against a list it cannot read.
   [[feedback_structural_checks_go_blind]]

## Confirming it

End to end, as Devi, through the real stack:

1. Reindexed her account: `sitebuilder` gone, **builder=7, platform=57**, all 309
   documents on a module a tenant can have.
2. Typed `lookbook` → a **Sites** group appeared with **Juniper Row Lookbook**.
3. Typed `Add people to Welcome` → an **Automations** group with the rule made
   minutes earlier.
4. Clicked it. It opened the rule, showing **On**.

## Also recorded, not fixed

**The only way a business owner can rebuild her search index is a button on the
products list, and only when PRODUCTS are unfindable.** Her sites and her
automations were unfindable for as long as this defect existed and nothing
anywhere offered her the remedy. The reindex that fixed this had to be run for
her.
