# 929 — Her parcels left from a place with no address

**Status:** fixed (act 325)
**Severity:** major
**Found by:** P03 · Juniper Row · act 325, re-scoring Stock › Locations
**Surface:** mypiggles › Stock › Locations, one location (both consoles), and the postage messages on Shipping and label buying
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P03 · Juniper Row · act 325, Main Warehouse saying its online orders ship from it, taking the business address in one press, and the list marking it
**Blocked on:** —

## What happened

Devi opened Main Warehouse. Its address was "US" and nothing else. The pane said
the address is "Used on paperwork, and by couriers" and marked the postal code
optional. That was all.

Main Warehouse is the place every one of her parcels leaves from. Postage is
priced from its address and labels are printed with it. A courier cannot do
either without a street, a town and a postal code, so on her account no live
postage price could ever be shown and no label could be bought. Nothing on the
location said so, and nothing on the list said which location mattered.

How it got that way: the location is made when Stock is switched on, and it
copies the business address only if one exists then. Devi typed hers into
Business details on September 8. Main Warehouse was made on August 23, so it
kept "US". **57 of the 58 `MAIN` locations in the database have no full
address.** Business details had hers the whole time.

Three more came out with it.

1. **She could not choose where orders ship from.** The setting
   (`defaultForChannel`) existed on the server and had no control in either
   console.
2. **With no location named, the choice was random.** `resolveDefaultWarehouseId`
   ended in `candidates[0]` of an unordered query. Close Main Warehouse and her
   parcels would leave from whichever row came first, which could be the sample
   pack's place in Columbus, Ohio, and nothing could say which.
3. **The message she would get said "missing line1, postalCode".** Column names,
   and "Finish it under Inventory → Warehouses", a screen neither console has.
   Shipping shows it when a courier is connected, and buying a label shows it
   when the label is refused.

## The fix

- **Online orders** (both consoles), a section before the address:
  - On the place parcels leave from: "Your online orders ship from here.
    Couriers price postage from this address, and postage labels are printed
    with it." When it lacks what a courier needs: "Couriers cannot price postage
    from here yet. It still needs a street address, a town or city and a postal
    code." It names only what is missing.
  - On any other place of her own or a partner's: **Ship online orders from
    here**, saying which place stops being the one ("Main Warehouse stops being
    the place they ship from").
  - Closing the place parcels leave from says they move to another location.
  - Not shown to a business that does not sell, or for a supplier's place or a
    place on paper only.
- **Is it at your business address?** (both consoles): when a place of her own
  lacks what a courier needs and Business details has an address, it offers it
  in one line with **Use this address**. It fills the fields; Save saves. It is
  not offered to a place that names a different town, so the sample place in
  Columbus does not get Portland.
- **Postal code** loses "(optional)" on the place parcels leave from.
- **The list** marks that place **Ships online orders**, in selling's color,
  and **Address too short for couriers** beside it while it lacks a street, a
  town or a postal code, so it is seen before anyone opens the place.
- **One place per channel** (`warehouses.ts`): naming a place for a channel takes
  it off every other place in the same save, with an audit line for each.
- **A settled fallback** (`channel-default.ts`): a named place first, else the
  oldest place of her own or a partner's that no sample pack added, else the
  oldest other. The list's badge and the postage code read the same rule.
- **The postage messages** name the location and the missing parts in the
  form's words, and point to Locations.
- **See what is here** and **See its shelves** (both consoles), beside the
  location's code: open Stock and Shelves filtered to this place. The list said
  "484 units · no shelves" and nothing led to either, though both screens have
  always filtered by location. The line under the name says "484 units · no
  shelves" too: a single location read now counts, as the list always did. This
  was the location pane's gap in the rating since act 253.

## Not changed

- The location is still not given her address behind her back. Where parcels
  leave from may not be where the business is registered, so it is offered, not
  copied.
- The allocator that picks which shelf an order's stock comes from already
  preferred the named place, and is untouched.

## Proof

- `channel-default.test.ts`: six cases, including the same answer whatever order
  the rows arrive in. Red when the ordering and the sample rule are removed.
- `ship-from.test.ts` (inventory, against the database): the oldest place ships
  when none is named, on the list and in the resolver alike; naming another moves
  it and leaves the old one. Red when the one-place rule is removed.
- `shipping-request-resolver.test.ts`: the sentence, never a column name. Red on
  the old message.
- `location-ship-from.test.ts` (both consoles): what a courier still needs, the
  list's flag, and when the business address is offered. Red when the postal
  code is not asked for (on the form, and on the list), and when the offer
  ignores a complete address.
- On screen, as Devi: Main Warehouse read the two sentences above; **Use this
  address** filled 1184 SE Ash St, Portland, OR 97214; the warning and the offer
  went; Save stored it; the list read "Main Warehouse · Ships online orders ·
  Portland, OR, US". On Fulfillment Center (Sample), ticking **Ship online orders
  from here** named Main Warehouse and showed "It still needs a street address
  and a postal code". Unticked, nothing saved. **See what is here** on Main
  Warehouse opened Stock with Main Warehouse chosen: 74 items. **See its
  shelves** on Fulfillment Center opened Shelves on it: 5 shelves.
- The list's flag was not seen on screen: by then Main Warehouse had its full
  address. It is tested.
- The sparx console's half is typechecked and tested, not driven.
