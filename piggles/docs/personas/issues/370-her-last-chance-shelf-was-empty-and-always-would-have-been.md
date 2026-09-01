# 370 — Her "Last chance" shelf was empty, and always would have been

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · walking her own shop as a customer
**Surface:** juniper-row.piggles.site › Collections › Last chance
**Filed:** 2026-09-01
**Fixed:** 2026-09-01
**Confirmed by:** the shelf itself, as a customer, on juniper-row

## What happened

Devi's Collections page shows seven shelves, each with a photograph and a line
in her own voice. One of them is:

> **Last chance**
> The sizes that are nearly gone. I make a handful of each and do not cut them
> again.

A customer clicks it and gets:

> **Nothing in this collection yet**
> This collection is empty at the moment. There is more in the shop.

Meanwhile The Ash Overshirt in XS Bone is at zero, under a reorder point of 2,
and her console says so on its own screen: **"Warns at 2 · Nothing left to
sell."** The shelf whose entire purpose is "the sizes that are nearly gone" did
not contain the size that was gone.

It is the only rule-driven shelf she has, and the only empty one. The other six
are manual lists and all have products in them.

## Why it happened

Three faults in a row, each of which alone is enough to empty the shelf.

### 1. Setting a reorder point never recomputed the flag it feeds

`Last chance` compiles to one predicate, `inventory low_stock`, which maps to
the denormalized `Product.lowStock` column. That column is maintained by
`syncProductInStock`, and the function is correct: `lowStock = inStock &&
levels.some(isLowStock)`.

It is only ever CALLED from paths where stock moved — `applyMovement` and the
reservation paths. But the reorder point is the other half of `isLowStock`:

```ts
level.reorderPoint !== null &&
  level.onHand - level.allocated - level.safetyBuffer - unsellable <= level.reorderPoint;
```

so setting or lowering it can make a level low **without a single unit moving**.
`setReorderPolicy` upserted the value, wrote an audit log, and returned. The flag
stayed as it was, and every product in Juniper Row read `low_stock = false`
including the one that qualified.

The same hole was in `setSafetyBufferOnTx`, which subtracts from both `isLowStock`
and `isOutOfStock`: raising a buffer can take a product from sellable to sold out
with no movement either.

### 2. Inventory events never reprojected rule-driven collections

Membership for a rules collection is materialized into `CollectionProduct` by the
commerce-indexer. It reprojected on `product.created` / `product.updated` only:

```ts
if (event.type === 'product.created' || event.type === 'product.updated') {
```

with the reasoning that "variant pings tend to be identity-preserving on the
product face". That is true of title, price and tags. It is exactly wrong for two
fields: **`inStock` and `lowStock` are product-face columns, they are rule
predicates (`in_stock`, `out_of_stock`, `low_stock`), and an inventory event is
the only thing that ever changes them.**

So this is not only about reorder points. A shop could sell its last unit and
leave an `out_of_stock` shelf empty, or drop below its threshold and leave a
"Last chance" shelf empty, until somebody happened to edit the product for an
unrelated reason.

### 3. Nothing downstream was ever told

`setReorderPolicy` published no event at all. Every other `inventory.low` in the
system comes off a movement in the ledger. So even with the flag fixed, nothing
would have run the projection, nor the reorder automation that also triggers on
`inventory.low` — an owner who sets a threshold their stock is already under gets
silence from a feature whose whole job is to speak up.

### 4. And the events never got that far anyway

Fixing the first three did not fill the shelf. The event published, the indexer
acked it, and nothing happened — which is how the real fault came out, and it is
bigger than this collection.

The indexer's catalog branch opened by reading the product off the payload:

```ts
const productId = stringProp(event.data, 'productId');
if (!productId) {
  logger.warn({ type: event.type }, 'event missing productId/collectionId; skipping');
  return { outcome: 'skipped' };
}
```

**Nine of the event types it lists do not carry one.** Stock is counted per
variant per warehouse, so all three `inventory.*` events are variant-keyed
(`{ variantId, warehouseId, … }`), and six `variant.*` writes publish only
`{ variantId, change }` — `sku`, `isDefault`, `optionValues`, archive, restore.
Only the `product.*` pair carried a `productId`, and only the `product.*` pair
ever did anything.

Everything about it looked healthy. The `switch` listed all nine cases. The
consumer acked every message with zero pending. The log line said `skipping`,
which reads like a decision rather than a failure. So the arm went on being
counted as working, while:

- selling the last unit left the product in the search index as in stock,
- renaming a SKU left the old one findable and the new one not,
- archiving a variant left it in the index,
- a listed product's market card never refreshed on a stock change, though the
  comment beside that call says in as many words that it does, and
- **no rule-driven collection ever reprojected on a stock change**, which is the
  one a customer of Juniper Row could see.

A missing field renders identically to a correct one, and the consumer that
needed it reported success while doing nothing.

## The fix

- **`setReorderPolicy` and `setSafetyBufferOnTx` now call `syncProductInStock`**
  inside their own transaction. Both change an input to `isLowStock` without
  moving stock, which is precisely the case the movement-triggered resync cannot
  see.
- **`setReorderPolicy` publishes `inventory.low`** after the commit, under the
  same condition the ledger uses (`available <= reorderPoint`), so the two agree
  about what low means. After the commit, never inside it, per `events.ts`.
- **The indexer resolves the product from the variant** when the payload names no
  product, via a new `productIdForVariant` in `@wizeworks/commerce`. The variant
  is the thing that changed; the product is the thing that gets indexed, and
  something has to bridge the two.

  Resolving on the CONSUMER rather than adding `productId` to the payload is
  deliberate. `emitStockEvents` runs on every movement of every checkout line and
  does not have the product in hand, so putting the lookup there buys the same
  answer at hot-path prices. It also would not help the events already on the
  stream, which the indexer is built to replay. And a half-measure would be worse
  than either: `productId` present from one publisher and absent from another is
  exactly the shape of this bug.

- **The indexer reprojects rule collections on inventory events too** — but
  narrowly. A product write can change any rule field, so it re-runs every rule as
  before. An inventory write can only change two, so it re-runs only the
  collections that ask about stock, via a new
  `projectInventoryCollectionRulesForTenant`. For most tenants that is none, and
  it is never all of them, which answers the cost objection the original guard was
  there for.

## Confirming it

Walked as a customer, on her real shop. `/collections/last-chance` reads **1
product** and shows The Ash Overshirt under her own line, "The sizes that are
nearly gone."

Each link in the chain measured separately, by pressing Save on her own **Change
how this is managed** form:

| Link in the chain          | Evidence                                                    |
| -------------------------- | ----------------------------------------------------------- |
| The flag resyncs on a save | `low_stock` went `f` → `t` for The Ash Overshirt            |
| The event is published     | `seq 26353 subject=sparx.inventory.low` on the live stream  |
| The indexer receives it    | `commerce-indexer ack_floor: 26353, pending: 0`             |
| The variant resolves       | the same save, after the fix, wrote the membership row      |
| Membership is written      | a `commerce_collection_products` row, `added_by = 'rule'`   |
| The search index follows   | the product's doc now carries the Last chance collection id |
| A customer can see it      | the shelf renders the product                               |

The fourth row is the one worth keeping. The same event, at the same sequence, on
the same account, produced nothing before the resolver and the membership row
after it. That is the measurement that turned "the reprojection guard was too
narrow" into "the branch never ran at all".

**Fifteen routing tests** on the indexer, which had none. Nine go red against the
old router, including every variant-keyed payload shape the publishers actually
send.

**Nine more** on `low-stock.ts`, which held the one definition five surfaces used
to disagree about and also had no test — including the case that reads wrong at a
glance and drives this whole issue: **zero on hand with a reorder point is BOTH
low and out.** It is tempting to assume "low" means "some left"; it does not, and
it must not, because a size that has just run out is exactly what a last-chance
shelf and a reorder alert are both for.

## Still open

- **An empty rules collection is still listed on the Collections index**, with a
  photograph and confident copy, and a customer who clicks it lands in an empty
  room. Even with the rules fixed, "nothing is nearly gone this week" is a real
  and correct state for this shelf. Whether an empty shelf should be hidden from
  the index, or shown with different words, is a separate design question and a
  separate issue.
- **`inventory.low` uses `onHand - allocated`** in both the ledger and now here,
  while `isLowStock` subtracts the safety buffer and unsellable stock as well. The
  two definitions disagree at the margin. Left alone deliberately: matching the
  ledger's existing condition was the smaller change, and one canonical predicate
  for the event is its own piece of work.
- **The public webhook contract has the same gap.** `inventory.low` and
  `inventory.adjusted` are offered as tenant webhook topics, and a subscriber
  receives a `variantId` with no product. An outside integrator cannot resolve
  that without a second API call, which is worth fixing in the payload even though
  the internal consumer is better served resolving it itself. Not this issue.
