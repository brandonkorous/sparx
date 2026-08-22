# 085 — Her price list had two of everything, at two different prices

**Status:** open
**Severity:** major
**Found by:** P02 · Halo & Hem · act 4
**Surface:** mypiggles › Bookings › Services, and the public booking page
**Filed:** 2026-08-21
**Fixed:** —
**Confirmed by:** —
**Blocked on:** scope — the two seeders that collide are both shared with sparx

## What happened

Nia opened Services to add her ten. She found **eighteen already there**, and
four of them were the same service twice:

| On screen                                 | Length | Price       |
| ----------------------------------------- | ------ | ----------- |
| Balayage                                  | 3 hr   | **$220.00** |
| Balayage                                  | 3 hr   | **$240.00** |
| Full Color                                | 2 hr   | **$135.00** |
| Full colour                               | 2 hr   | **$160.00** |
| Manicure                                  | 45 min | $40.00      |
| Manicure                                  | 45 min | $40.00      |
| Men's Cut / Men's cut                     | 30 min | two rows    |
| Women's Cut & Style / Women's cut & style | 1 hr   | two rows    |

Every one of them is marked **Bookable**, so this is what a client is offered.
Somebody booking a full head of colour at Halo & Hem picks between $135 and
$160 for the same three hours, and whichever they pick, Nia charges her own
price and looks like she is inventing it at the chair.

She also has a **Deep-Tissue Massage** and a **Signature Facial** on a price list
for a two-chair hair salon.

## Where the two of everything comes from

Two seeders run at signup and neither knows about the other:

| Source                      | Rows | Spelling      | Marked as a sample? |
| --------------------------- | ---- | ------------- | ------------------- |
| the trade's **sample pack** | 7    | US ("Color")  | yes                 |
| the **blueprint** she chose | 11   | UK ("colour") | **no**              |

Read back from her tenant, `settings.sample` is `true` on exactly seven of the
eighteen. The other eleven came from `sparx-salon-editorial`'s `scheduling.json`
and carry no marker at all.

They are near-duplicates because both are a salon menu written independently —
right down to the apostrophes: `Men's Cut` from one and `Men’s cut` from the
other.

## Two consequences, and the second is worse

1. **"Remove sample data" only removes seven of the eighteen.** Practice data
   offers "Deletes every sample record", and it means it — but eleven of her
   duplicates are not sample records, they are blueprint content, so they stay.
   She clears the samples and still has a duplicated price list.

2. **The Practice data pane never says services or people are involved at all.**
   Its tiles read Products 6, Orders 10, Customers 7, Invoices 12,
   **Bookings 7**, and fifteen more — with no Services tile and no People tile.
   Clear removes sample scheduling services and staff regardless.

   In fairness the CONFIRM dialog is honest about the total — "the 6 products,
   10 orders, 7 customers and **112 more records**" — so nothing is deleted that
   the person was not warned about in the aggregate. It is the tiles that
   under-report, and the tiles are what she reads before she decides.

## What should have happened

One menu. A tenant who picks a salon blueprint should not also be given a second
salon's menu at different prices — and whichever mechanism wins, everything it
creates should be clearable by the screen that offers to clear it, and counted by
the screen that says what it will clear.

## How to reproduce

Every time, on any trade whose sample pack and chosen blueprint cover the same
module.

1. Sign up, trade **Beauty & salon**, look **Salon (Editorial)**.
2. Bookings › Setting it up › **Services**.

Eighteen rows, four duplicated pairs, two prices for Balayage.

**The same collision, in People and equipment.** Ten people and rooms for a
two-chair salon, one of them called simply "Stylist". Clearing the samples took
six of them and left four — Ava Bennett, Maya Cole, Noor Rahim and "Stylist" —
because those four are the blueprint's and carry no marker, the exact mirror of
the services.

That mattered more than clutter: three of the four carry the skill `colour`, so
when Nia said her highlights need a colourist the screen answered **"Ava Bennett,
Nia Okafor and Noor Rahim can take this booking"** — two people who do not work
at Halo & Hem, offered to her clients. She deleted them one at a time.

## Where it lives

`POST /internal/tenant/furnish` applies the industry sample pack and the
blueprint in one call —
[piggles/apps/account/lib/furnish.ts](../../../apps/account/lib/furnish.ts) sends
both `industry` and `blueprintKey` and the platform honours both. The pack lives
in `wizeworks/packages/db/src/sample-data/packs`, the menu in
`marketplace-catalog/blueprints/sparx-salon-editorial/scheduling.json`.

The count gap is `wizeworks/packages/db/src/sample-data/engine/summarize.ts`,
which counts `booking` rows joined to a sample service but never counts the
`schedulingService` or `schedulingResource` rows themselves — while
`markers.ts` explicitly lists `settings.sample = true` on scheduling
services/resources as a Clear marker. Cleared, never counted.

## The fix, not made here

Both halves are `wizeworks/**`, shared with sparx, and one is a product decision:

- **Which seeder owns a module.** The honest rule is that a blueprint, when it
  brings its own content for a module, replaces the sample pack for that module
  rather than stacking on it. That is a change to furnish's ordering and a
  decision about precedence, not a bug fix.
- **Counting what Clear clears.** Two `count` calls in `summarize.ts`, plus two
  tiles. Small, but the same shared package.

Piggles' own side of it — sending both keys in one call — is deliberate and
right: she picked a trade and she picked a look, and both answers should be
honoured. It is the platform's job to reconcile them.

## What Nia did instead

Deleted the eleven that were not hers, one at a time, and built her own ten.
Recorded in act 4.

## Confirmed by

—
