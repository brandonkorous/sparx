# 508 — "Search everything" cannot find an order, a delivery or a supplier

**Status:** copy fixed and proven; **the gap itself needs a decision**
**Severity:** major
**Found by:** Devi, looking for the delivery she had just booked in
**Surface:** the ⌘K palette, and the universal search index
**Filed:** 2026-09-14

## What she saw

She had just booked GR-000003 and wanted it back. She typed its number into the
box at the top of the console, the one headed **"Search everything"**:

> Nothing matches that. Try a different word.
> Nothing in your **orders**, customers or products matches "GR-000003".

Then PO-000002. Then "Fairfield". Then LINEN-NAT-200, a code printed on her own
stock list. Every one of them: nothing.

## What is actually searched

The universal index carries exactly twenty kinds of record:

```
b2b_account  billing_document  bundle    category  cms_entry  cms_page
collection   deal              discount  gift_card media      pipeline
product      return            review    segment   site       subscription
task         warehouse
```

plus customers and sales orders from the rich collections.

**Nothing from purchasing is in it.** No orders to suppliers, no deliveries, no
suppliers, no stock levels, no counts, no transfers, no supplier bills. The whole
module she has spent three acts working in is invisible to the one search box in
the product.

## Why the sentence made it worse

"Nothing in your **orders** … matches PO-000002" is read by an owner as _your
orders do not contain it_. Her orders do contain it. It was never searched:
"orders" there means orders from CUSTOMERS, and she had typed an order to a
SUPPLIER. She has no way to tell those two readings apart, so the honest
conclusion available to her is that the record is gone.

That is the house's one-outcome-two-causes shape wearing a single word.

## What changed now

The sentence says what it looked through, and names what it did not:

> Nothing in your products, customers or sales matches "PO-000002". **Orders to
> suppliers, deliveries and supplier records are not searchable yet.**

Proven on screen. It no longer lets her conclude a record has vanished, and it
tells her to go to Stock instead of searching again.

## The sparx console was a step further back

Both consoles run the same `useRecordSearch` in their launcher. Only Piggles had
a `RecordSearchNote`, so in sparx the record half **said nothing at all**.

That is the defect the Piggles version was written to fix, still shipping next
door. Typing a word the business has never heard of returns a list of SCREENS
whose text happens to contain the letters, and because the list is not empty the
empty state never fires either. The only reading available is that the record is
in there somewhere.

Reproduced on the sparx workbench with "problem", which matches three screens
(Your feedback, Send feedback, Site checks) and no records. Before: silence.
After:

> Nothing in your products, customers or sales orders matches "problem".
> Purchase orders, receipts and supplier records are not searchable yet.

In sparx's own vocabulary, which calls them purchase orders and receipts where
Piggles says orders to suppliers and deliveries. Proven on screen in both.

## What still needs deciding

Making purchasing searchable means adding universal projectors for
PurchaseOrder, GoodsReceipt, Supplier, SupplierBill, SupplierReturn,
InventoryTransfer and InventoryCount, following the twenty that already exist in
`packages/commerce/src/universal-projection.ts`, then a reindex.

That is not a bug fix. It adds documents to the search index for every tenant,
which is ongoing storage and indexing cost, so it is a call to make deliberately
rather than something to slip in behind a copy change.

## Not a defect: the empty index in dev

Separately, the index is empty locally — 4 documents in `entities`, 6 products,
5 customers, 5 orders, across all 113 tenants. `sparx-nats` reports **unhealthy**,
and search indexing is event-driven, so nothing has been projected. That is the
local environment, not the product, and it is why even "Shirtdress" found
nothing. The scope finding above is from reading the projector registry, not from
the empty index.

---

## 2026-09-15 — the other half: purchasing is searchable now

The note above was the honest half of a fix. This is the rest of it.

### What was missing

The universal index registered twenty kinds of record and **none from
purchasing**. So the numbers a warehouse actually uses to refer to its own
paperwork — the purchase order number, the delivery number, the supplier's
invoice number — found nothing at all.

### What changed

**Seven projectors** in `wizeworks/packages/commerce/src/universal-projection.ts`,
built on `warehouseProjector`'s shape:

| entity               | title                | subtitle | also findable by                     |
| -------------------- | -------------------- | -------- | ------------------------------------ |
| `supplier`           | name                 | code     | contact, email, phone, city          |
| `purchase_order`     | number               | supplier | supplier code, location, reference   |
| `goods_receipt`      | number               | supplier | **the order number**, location, note |
| `supplier_bill`      | their invoice number | supplier | order number, status                 |
| `supplier_return`    | number               | supplier | **RMA number**, reason               |
| `inventory_transfer` | number               | "A to B" | both locations, note                 |
| `inventory_count`    | number               | location | zone, type, status                   |

The `keywords` field is where this earns its keep: a delivery is looked for by
the supplier or the order it came from at least as often as by its own number,
so every document carries the names and numbers AROUND it.

**Seven `entity` tags** in `wizeworks/packages/links/src/routes.ts`, which is
what turns a hit back into a pane. Without one, `launcher-entries` drops the hit
silently — the failure would have looked exactly like the projectors not working.

**Live indexing at every write.** A projector alone only makes a record findable
after the next rebuild, which is the "absent behaves like fine" shape: it looks
identical to a working index until somebody searches for what they just made.

### The seam

`indexInventoryEntityOnCommit` in `wizeworks/packages/inventory/src/events.ts`,
queued through `afterCommit`: it fires when the OUTERMOST transaction commits
and is discarded on rollback, so nothing announces an order that was undone.
Called beside the audit write, which is the one thing every write in these
services already does and the one place that already names the record.

### Two things a blind sweep would have got wrong

**`purchase-order-approvals.ts` has a shared `audit()` helper, and three of its
five callers pass an approval RULE id under `entityType: 'PurchaseOrder'`.**
Putting the index call in the helper would have projected three rules as orders.
The call went on the two sites that pass a real order id instead.

**Booking a delivery in changes the ORDER too.** It moves toward `partial` or
`received`, and the order's document carries that status, so re-projecting only
the receipt would leave the order describing itself as still outstanding until
somebody edited it again. Both are re-projected.

### One my first sweep missed, caught by testing

Changing an order's expected date does not go through `updatePurchaseOrder` at
all — it is `POST /purchase-orders/:id/reschedule` in
`purchase-order-lifecycle.ts`, which my anchor list did not include. Found by
doing it on screen and watching nothing arrive. That file has its own `audit()`
helper covering all five transitions, so it is one line; the same check turned
up `count-schedules.ts`, where a schedule that raises a count creates a real
document nobody would have indexed.

`purchase-order-shared.ts` and `custom-fields.ts` write to these tables too and
are deliberately NOT instrumented: totals and custom-field values are not in the
projection, so re-projecting for them would be work with no output.

### Proven on screen

Devi changed one order's expected date, and searched:

> **Orders to suppliers** — PO-000002 · Fairfield Trims
> **Orders** — #O-000002 · Tessa Wren · fulfilled
> 2 records matched. The rest are screens.

Then, after the backfill, typing a supplier's name:

> **Suppliers** — Ashcombe Mills · ASHCOMBE
> **Customers** — Wren Ashcombe
> **Supplier invoices** — AM-2231, AM-2198, AM-2214 · all Ashcombe Mills
> **Deliveries** — GR-000002, GR-000001 · Ashcombe Mills
> **Orders to suppliers** — PO-000001 · Ashcombe Mills
> **Gift cards** — QM44-2DTN-6HM4-6RA9 · Nadia Ashcombe
> 9 records matched. The rest are screens.

Every invoice and delivery there matched on the SUPPLIER's name, not its own
number. Clicking GR-000001 opened the delivery.

Indexed for Juniper Row after the rebuild: 4 supplier invoices, 4 stock checks,
3 deliveries, 2 suppliers, 2 orders to suppliers. No returns or transfers,
because she has none.

### The note's own copy, twice wrong

It used to read "Nothing in your products, customers or sales matches…", which
told an owner her ORDERS did not contain a number that was never searched. It
was corrected to name purchasing as not searchable, which this change has now
made false in the other direction. **It no longer lists anything**: a list of
what was searched is a promise that goes stale every time the index grows.

> Nothing in your records matches “X”. Everything below is a screen.

### Required at release

**Run the `reindex-search` ops task after this ships.** A new projector makes a
kind of record searchable from that release onward and leaves every record that
already exists invisible, because nothing in the past raises an event. The task
already exists for exactly this shape and its comment now names this case.
