# 656 — I could not move 58 buckles that are on my shelf

**Status:** fixed
**Severity:** high
**Found by:** P03 · Juniper Row · act 231
**Surface:** Stock — Moving stock, Shelves; Invoices — the product picker
**Filed:** 2026-09-18
**Fixed:** 2026-09-18
**Confirmed by:** P03 · Juniper Row · act 231 (a transfer built, refused, fixed, sent and received)

## What she did

Devi opened **Moving stock** to send some stock to her Fulfillment Center,
pressed **New transfer**, chose both locations, pressed **Add item** and typed
the name of a thing on her shelf.

> **No product matches that.**

She has **58 of them**. They are at Main Warehouse. They have a barcode. She had
printed a label for one an hour earlier.

## Four things were wrong, and they compound

### 1. "Not for sale yet" was being shown as "does not exist"

The picker asked for `status: 'active'`. **Brass belt hardware, antique** is a
draft, so it was filtered out — and the sentence a person got back said the item
was not in her catalog.

A transfer moves PHYSICAL stock between two of the tenant's own buildings.
Whether a customer can buy it has no bearing on whether a box can go in a van.
[[feedback_one_outcome_two_causes]]

Drafts are in the list now, labeled **"· not for sale yet"** so a person is told
why the row reads differently rather than left to wonder.

### 2. It was the catalog of whichever WEBSITE was open

`x-sparx-property-id` rides on every request, so without asking otherwise the
picker was the product list of the site in the switcher.

| Juniper Row                 |        |
| :-------------------------- | -----: |
| products                    | **34** |
| visible on the primary site | **10** |
| reachable in this picker    | **10** |

`inventory_warehouses` and `inventory_transfers` have **no property column at
all**. One building holds one pile of boxes for the whole business. The other 24
products were unmovable and unmentioned, and the day one of them has stock, "No
product matches that" becomes a lie about a box on a shelf. It now reads across
every site the account may see, through the platform's own checked
`property=all`. [[feedback_site_is_the_business]]

### 3. The first 100, filtered in the browser

The Combobox filters `items` in the browser, so anything not fetched can never be
typed for — and a shop's 101st product did not exist as far as this screen was
concerned, reported in the same sentence it uses for a typo. It fetches the
endpoint's maximum now and compares `total` against what came back, so a short
list SAYS it is short instead of quietly answering "no such product".

The invoicing picker had the same cap and did say so, but its advice was
**"refine your search"** — which searches the same truncated hundred. A remedy
that is printed has to be a remedy that is available; it now names the one that
works.

### 4. The refusal printed a UUID

Devi typed 100 into a box beside an item she has 58 of. Nothing said so. She
added the line, saved the transfer, pressed **Send it**, confirmed a dialog, and
got:

> Variant 4fc1c2e4-ee74-4f65-a5ad-4533c63e3cf5 out of stock (requested 100,
> available 58)

Four steps, a confirm dialog, and the only part of the exchange she could not
read. The stock WAS protected, which is the important half. The message is now:

> Not enough Brass belt hardware, antique (BRASS-BELT-1). This asks for 100 and
> 58 are available.

and the number arrives where the decision is made, under the quantity box:
**"58 available at Main Warehouse."** Over it, the warning reads
**"58 available at Main Warehouse — A transfer this big cannot be sent, and it
will be refused when you try."** Where stock is spoken for by orders, it says
that too, because `available` is what dispatch checks and it is not `onHand`.

A missing level row says **"Nothing has ever been counted at Fulfillment
Center"**, not zero. [[feedback_never_present_absence_as_measurement]]

## Then it stranded the stock

With a sane quantity the transfer sent. At the far end, **Mark received**:

> This location has no default shelf, so there is nowhere to record the stock.
> Turn bins off for it, or add one.

A good sentence, arriving after the stock had left. Twelve units were in transit
to a place that could not take them, and the only way out was to cancel the whole
transfer.

**Every warehouse on this platform with shelves turned on was in that state:**

| warehouses with shelves on | with a default shelf |
| -------------------------: | -------------------: |
|                      **5** |                **0** |

Five tenants, none of them able to receive anything anywhere they had turned
shelves on. Not an edge somebody contrived: what happens the first time anyone
turns shelves on.

The same check now runs at **send**, using the real routing rather than a second
copy of its rules, so nothing leaves a shelf it cannot land off:

> There is nowhere to put Brass belt hardware, antique (BRASS-BELT-1) at
> Fulfillment Center when it arrives. That location uses shelves and none of them
> can take it, so add a default shelf there, or turn shelves off for it. **Nothing
> has been sent.**

Driven on screen: the transfer stayed a draft, 58 stayed at Main Warehouse, 0 in
transit.

## And the remedy it named did not exist

"Add a default shelf there." The Shelves screen had no such field. Neither did
`CreateBinInput`, `UpdateBinInput`, or any endpoint. The concept is in the
database and is load-bearing for every put-away, and nothing anywhere could set
it. The only reachable remedy was the other one: turn the feature off.

So it exists now, end to end:

- `isDefault` on the create and update inputs, with **exactly one per location**
  enforced in the same transaction, and the LAST one cannot be turned off.
- A shelf's editor carries **"Put things here when nobody says which shelf"**.
- A location's first shelf becomes its default unless told otherwise, because
  somebody adding their first shelf has not yet been asked a question they could
  answer.
- The Shelves list leads with **"Nothing can be booked in at Fulfillment
  Center"** when a location uses shelves and none is the default, and names the
  switch to turn on.
- Every row shows **"Where things land"** on the one that is. `isDefault` was on
  every row already and no row drew it, so five identical-looking shelves gave a
  person no way to tell which one a delivery goes to — or to notice that none of
  them was it. [[feedback_fetched_but_never_rendered]]

## What is good here, and was already good

Worth recording, because the pane is strong and the defects above are all at its
edges:

- Two of the same location is caught the instant it is chosen: **"Pick two
  different locations — A transfer moves stock between two places, so the from
  and to cannot be the same one."**
- A tenant with one location gets **"You need two locations to move stock
  between"**, not an empty picker.
- Receiving fewer than were sent shows a **1 short** badge and says what happens:
  **"The missing units are written off as lost in transit. They leave your total
  stock, since they left the source but never reached the destination."**
- Cancelling says where the stock goes back to, and the record stays.
- Closing the tab with a half-made line asks first.

## Driven end to end

```
TRF-000002  Main Warehouse (MAIN) → Fulfillment Center (FC-1)
  refused at send   (no default shelf)   → still draft, 58 at MAIN, 0 in transit
  RECV marked "where things land"
  sent              → In transit
  received          → "1 of 1 arrived"
```

```
FC-1 / RECV   on_hand 1
MAIN          on_hand 57
IN-TRANSIT    on_hand 0
```

## Files

- `piggles|sparx/apps/workbench/surfaces/inventory/{transfers-data.ts,transfer-detail.tsx,bins-list.tsx,bin-detail.tsx}`
- `piggles|sparx/apps/workbench/surfaces/invoicing/product-picker.tsx`
- `wizeworks/packages/inventory/src/errors.ts`, `src/services/{bins,bin-routing,internal,movements,reservations,inventory-transfer-lifecycle}.ts`
- `wizeworks/packages/commerce/src/errors.ts`
- `wizeworks/packages/commerce-schemas/src/inventory.ts`
- `wizeworks/packages/inventory/test/integration/transfers.test.ts`
