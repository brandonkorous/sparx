# 085 — Her price list had two of everything, at two different prices

**Status:** fixed (act 324 the count, act 325 the two menus)
**Severity:** major
**Found by:** P02 · Halo & Hem · act 4
**Surface:** mypiggles › Bookings › Services, and the public booking page
**Filed:** 2026-08-21
**Fixed:** 2026-10-06
**Confirmed by:** 2 database tests with the real Salon (Editorial) design and the salon pack, each proven red
**Blocked on:** —

## What happened

Nia opened Services to add her ten. She found **eighteen already there**, and
four of them were the same service twice:

| On screen                                 | Length | Price       |
| ----------------------------------------- | ------ | ----------- |
| Balayage                                  | 3 hr   | **$220.00** |
| Balayage                                  | 3 hr   | **$240.00** |
| Full Color                                | 2 hr   | **$135.00** |
| Full color                                | 2 hr   | **$160.00** |
| Manicure                                  | 45 min | $40.00      |
| Manicure                                  | 45 min | $40.00      |
| Men's Cut / Men's cut                     | 30 min | two rows    |
| Women's Cut & Style / Women's cut & style | 1 hr   | two rows    |

Every one of them is marked **Bookable**, so this is what a client is offered.
Somebody booking a full head of color at Halo & Hem picks between $135 and
$160 for the same three hours, and whichever they pick, Nia charges her own
price and looks like she is inventing it at the chair.

She also has a **Deep-Tissue Massage** and a **Signature Facial** on a price list
for a two-chair hair salon.

## Where the two of everything comes from

Two seeders run at signup and neither knows about the other:

| Source                      | Rows | Spelling     | Marked as a sample? |
| --------------------------- | ---- | ------------ | ------------------- |
| the trade's **sample pack** | 7    | US ("Color") | yes                 |
| the **blueprint** she chose | 11   | UK ("color") | **no**              |

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

That mattered more than clutter: three of the four carry the skill `color`, so
when Nia said her highlights need a colorist the screen answered **"Ava Bennett,
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

## Act 324

**The count is fixed.** Practice data now counts the sample services and the
people and equipment it removes, by the same `settings.sample` marker Clear
deletes them by, and both consoles show them as **Services** and **People and
equipment** tiles. The seed counts them as it makes them. The removable total
includes them. 1 console test; dropping the two tiles reddens it.

**The two menus are not.** "Shared with sparx" was never a reason to wait. The
real question is what a new salon sees on day one, and every answer changes it:

- Skip the pack's services when the design brings its own, and the pack's
  sample bookings go too, because each one is made against a pack service. A
  salon then opens to an empty diary, or to the engine's fallback services,
  which is the duplicate menu again.
- Point the pack's bookings at the design's services instead, and Clear can no
  longer find them: a sample booking is recognized by its service's sample
  marker, and the design's services carry none.
- Mark the design's services as sample too, and Remove would delete a menu the
  owner may have priced and kept.

The way through is probably the second, with a sample marker on the booking
itself so Clear finds it without asking the service. That changes the
sample-data engine's markers and Clear (`markers.ts`, `clear.ts`), and both hold
another session's work in progress now, so it waits for that to land.

## Act 325

The sample-data engine's other work landed, and the choice turned out not to be
one. Issue 098 had already decided the design's booking content is examples: it
installs only when practice data is on. It was just never marked as practice
data, which is why Clear left Ava, Maya and Noor behind.

- **One menu.** The practice pack brings services and people only to a business
  that has none. One that has a menu, the design's or its own, gets its practice
  bookings on that menu with those people (`engine/scheduling.ts`). None lands
  on a person already booked: each is checked against the database's own
  no-double-booking rule and left out if it would clash.
- **The design's examples are practice data.** The services and people the
  design MAKES carry `settings.sample`; ones it reuses by name are the owner's and
  are never marked (`installSchedulingSlice`).
- **A booking carries its own mark.** `source = 'sample'`. Older practice
  bookings are found by their practice customer, which every one had, so no
  backfill is needed (`engine/practice-bookings.ts`).
- **Remove never takes a real booking.** It used to delete every booking on a
  practice service, a real client's included, and a practice stylist on a real
  booking made the whole Remove fail. Now it takes practice bookings only, and
  keeps any practice service or person a real booking, series, waiting list or
  meeting link uses: that one is the owner's now. The count shown before Remove
  uses the same rule.
- **A reload keeps the menu.** "Load practice data" clears its old rows first;
  that first step now keeps the services and people, so a reload books onto the
  same menu instead of deleting the design's and bringing the trade's.

Left over: the design's booking rules and place have no column to hold a mark,
so Remove leaves them. Filed as
[920](920-removing-practice-data-left-the-designs-booking-rules-behind.md).

**Proof.** `sample-salon-design-one-menu.test.ts` installs the real Salon
(Editorial) design with practice data and loads the salon pack: 7 services (the
design's, not 7 + 11), 3 people, all marked, every practice booking on the
design's menu; Remove leaves 0 services, 0 people, 0 bookings. Red on the old
installer (0 of 3 people marked). `sample-scheduling-one-menu.test.ts`: a
business with its own service and stylist gets no second menu, the practice
booking that wanted her booked stylist stands down, and Remove leaves her
service, stylist and real booking; a business with the pack's menu keeps it on
reload, and Remove keeps the practice service and stylist a real client was
booked with, and that booking. All 3 red on the old engine. The related
database suites (design locations, design untouched, practice support, resource
site scope) pass.

## What Nia did instead

Deleted the eleven that were not hers, one at a time, and built her own ten.
Recorded in act 4.

## Confirmed by

—
