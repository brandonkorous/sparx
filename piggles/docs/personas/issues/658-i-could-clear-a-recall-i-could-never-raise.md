# 658 — I could clear a recall I could never raise

**Status:** fixed
**Severity:** high
**Found by:** P03 · Juniper Row · act 232
**Surface:** Stock — Batches and serial numbers, one batch, one item's stock
**Filed:** 2026-09-18
**Fixed:** 2026-09-18
**Confirmed by:** P03 · Juniper Row · act 232 (a batch booked in, recalled, seen on the stock screen, and cleared)

## What she found

Devi opened **Batches and serial numbers**. Both halves were empty, and both
empty states are good ones. The batch half says:

> A batch appears here when you book in a delivery and record its batch code, so
> you can later trace exactly which run a customer got, **and find every unit if
> a run turns out to be bad.**

So she made one turn out to be bad. She booked in the rest of PO-000002 with the
batch code **FT-8871-B**, which worked exactly as promised, and then went looking
for the way to say a run had gone wrong.

There was none. Not on the batch, not on the list, not on the item, not anywhere
in either console.

## What WAS there

A **Clear recall** button. A red banner with a reason in it. A **Recalled /
Recall pending / Recall cleared** filter on the batch list, three states deep.

`POST /v1/inventory/recalls` exists, is documented, is role-guarded, and writes
an audit entry. `resolveFefoLot` excludes a recalled batch outright, with a
paragraph explaining why ranking it last would not do. The whole capability was
finished except for the one control that starts it.

The only caller was the MCP tool. A business owner who does not use an AI client
had no route to it at all, and the platform proves it:

| lot batches | tenants | actively recalled | put there by a person |
| ----------: | ------: | ----------------: | --------------------: |
|          21 |       8 |             **2** |                 **0** |

Both of those two came from the seed. [[feedback_screen_over_a_function_nobody_calls]]

## Three more things were untrue while nobody could get there

### The input promised an email that nothing sends

```ts
notifyCustomers: z.boolean().default(true),
```

Parsed, defaulted to **true**, and read by nothing. There is no recall event in
the catalog and no template behind one. Every caller was told customers were
being contacted; none ever were.

It is gone rather than left making the promise, and the dialog now says the
opposite out loud — **"Nobody is emailed: telling customers is yours to do"** —
because the obvious assumption is the other one.
[[feedback_a_promise_in_copy_is_a_contract]]

### The function's own docstring described a mechanism that cannot exist

> "Mark every unsold serial in the named lots as recalled…"

It never did, and it could not: `SerialUnitStatus` is
`in_stock | reserved | sold | returned | scrapped | lost` and has no such value.
A recall has always been a fact about the BATCH. The docstring now says so, and
an integration test pins it, red-proved by making the recall scrap the units it
claimed to mark.

The same sentence had reached the screen. The clear-recall dialog said **"Units
already marked recalled keep that history"** — in the dialog where somebody
decides whether a safety problem is over.

### The screen that says how many you can sell did not know

With FT-8871-B recalled, the item's stock pane, one click away, read:

> **60** to sell · **60** on the shelf

Two of that sixty must not leave the building. Nothing said so. The recall was in
the batch, the ledger and the audit log, and it never reached the place the
decision gets made. [[feedback_fetched_but_never_rendered]]

## What it does now

- **Recall** sits in the batch pane's header, in danger red, whenever no recall
  is open. It opens a dialog because a recall needs a sentence and a confirm box
  cannot collect one.
- The dialog states the consequences in the terms a person is thinking in, none
  of which are guessable from the word "recall": a location that picks by expiry
  date stops handing the batch out, the mark stays until somebody clears it, the
  units already sold are named, and nobody is emailed.
- The reason is required, kept for good, and introduced as **"what the next
  person reads to find out what happened. Write it for them."**
- The item's stock pane carries a red band above its own running-low banding,
  naming the batch code and saying plainly that **nothing has been held back** —
  because it has not. Saying "these are blocked" would be the comfortable
  sentence and the false one. [[feedback_never_present_absence_as_measurement]]
- A sold unit in the roster names **the order it left on** and opens it.
  `soldOnOrderItemId` was on every row, typed and commented in the console
  (_"where this unit went"_), and drawn by nothing: a recall could say how many
  units were gone and never who had them, which is the entire question a recall
  asks. It is now resolved to the order's number and id, in one query per page.

## Driven end to end

```
GR-000004   PO-000002 · 2 units · batch FT-8871-B      → batch created
FT-8871-B   Recall · "the lacquer on this run flakes off"
              → badge Recalled, audit inventory.lot.recalled, recalled_at stamped
              → item stock pane: "A batch of this is recalled: FT-8871-B"
            Clear recall
              → badge Tracked, green "a past recall … has been cleared"
              → the red band is gone, the Recall button is back
```

## Two more, found on the way

**A double full stop.** The banner read _"Do not put any of it on a belt.**..**
Raised 3 minutes ago."_ The field asks for a sentence and then punished anyone
who wrote one. `endsSentence()` ends somebody's own words with exactly one full
stop, and leaves a question mark or an exclamation mark alone, because replacing
one would edit what she wrote.

**A plural-only sentence around a count.** _"…with the order each one left on"_
is fine for six units and wrong for one. Caught by
`provenance-copy.test.ts`, which already existed for exactly this, on three call
sites at once. The sentence is now one tested helper used by all three, so the
dialog, the toast and the banner cannot drift apart about what a recall reached.

## Still open

A recall does not stop a FIFO location selling the stock, only a FEFO one. That
is not a defect in the recall: stock is counted per (item × location) and a batch
is traceability sitting alongside it, so blocking a FIFO pick would mean making
every pick lot-aware. The band says exactly this rather than implying otherwise.

**Nothing on this platform can create a serial number.** `POST
/v1/inventory/serials` exists and the only caller is the MCP tool; there are
**0 serial units across every tenant**. So the Serials half of that surface, the
roster, the per-unit status dropdown and the scrapped/lost confirm have never
held a row, and the new order link has nothing to link yet. Same shape as this
issue, one layer down, and a separate pass.

## Files

- `piggles|sparx/apps/workbench/surfaces/inventory/{lot-detail.tsx,lots-data.ts,stock-item.tsx}`
- `piggles|sparx/apps/workbench/surfaces/inventory/stock-recalled-band.tsx` (new)
- `piggles|sparx/apps/workbench/surfaces/inventory/lots-words.test.ts` (new)
- `wizeworks/packages/inventory/src/services/{lots,lot-management}.ts`
- `wizeworks/packages/commerce-schemas/src/inventory.ts`
- `wizeworks/packages/inventory/test/integration/lots.test.ts`
