# 174 — A warehouse in Ohio she never opened

**Status:** open — rescoped: the rows are intentional, telling them apart is not solved
**Severity:** major
**Found by:** P03 · Juniper Row · act 3
**Surface:** mypiggles › Stock › Locations
**Filed:** 2026-08-23
**Fixed:** —
**Confirmed by:** —

## What happened

Devi runs a small clothing label. Her stock is in one room. Opening **Stock →
Locations** for the first time, she found two places she had never created:

```
Location             Kind             Where              State
Fulfillment Center   Your own place   Columbus, OH, US   In use
FC-1

Main Warehouse       Your own place   US                 In use
MAIN
```

She has no connection to Columbus, Ohio.

**Main Warehouse is fine and deliberate.** It is bootstrapped when the stock
module is switched on, it writes an audit entry saying so, and it seeds its
address from the business details the owner filled in at signup, specifically so
carrier rates work out of the box. That is documented behavior with a reason.

**Fulfillment Center is not.** It came from the apparel industry pack:

```
10:50:01.894   tenant.industry.installed   {"industry": "apparel", "installed": 0, "skipped": 0}
10:50:03.793   Fulfillment Center created  ← no audit entry at all
```

Two seconds after the install, with a hardcoded city, and nothing in the audit
log to say who made it or why. Practice data is not the culprit and was checked
first: that pane reads "Not loaded", and its three loads all happened later, at
10:55.

## What should have happened

An industry pack that creates a location says so before it does it, and writes an
audit line when it does. And it does not invent a city — a location with no
address is honest; a location in Columbus is a claim about her business that is
untrue.

Best of all, an apparel pack does not create a second location at all. One place
is the right answer for almost every shop that installs it, and `Main Warehouse`
already exists by the time the pack runs.

## How to reproduce

Not re-run from a clean tenant — established from the audit trail on Juniper Row
plus the same pair appearing on `Threadline`, the other apparel tenant. Every
other tenant in the database that has `Fulfillment Center` also has apparel.

To confirm from scratch: create a tenant, turn on Stock, install the **apparel**
industry, then open Stock → Locations.

## Why it matters

A location is not decoration. It is the **ship-from address**, so it decides
which carrier rates a shopper is quoted at checkout, and it is one of two answers
in every stock count's "Where are you counting?" — a question Devi has to answer
correctly, first time, before she can count anything.

So a phantom location does three things: it puts a false address in the path of
real shipping quotes, it makes a two-option question out of a one-option fact,
and it gives an owner a record she cannot explain in her own account. The last
one is the quiet damage. "I did not make this and I do not know what else I did
not make" is not a state a business owner should ever be in.

There is a smaller, sharper problem in the same line. The audit entry reports:

```
"installed": 0, "skipped": 0
```

while a row was in fact created. Whatever the pack counts, it is not counting
what it did. Anyone reading that line later — including whoever investigates this
issue — would conclude the install was a no-op. See
[[feedback_never_present_absence_as_measurement]]; the same shape shows up in
[[175]].

## Where it lives

`Main Warehouse` is `bootstrapDefaultWarehouse` in
[warehouses.ts](../../../../wizeworks/packages/inventory/src/services/warehouses.ts),
which is correct and should be left alone — its comment block explains the
address-seeding and cites BUG-010.

The `Fulfillment Center` is not from there and was not traced further. The audit
timestamp pins it to the apparel industry install, and the fix has to start with
what that pack is meant to contain, which is a decision rather than a lookup.

## The fix

Not made. `Blocked on: decision` — what an industry pack is allowed to create.

Locations are the case that surfaced, but the question is bigger than locations:
an industry pack that silently writes rows an owner did not ask for, and does not
audit them, will be found again on a different table. The three sub-questions:

1. **Should apparel create a second location at all?** (Probably not.)
2. **If a pack creates records, does it say so first?** An install that lists
   what it is about to add, and lets her uncheck the parts she does not want, is
   a different feature from the one that exists.
3. **Does every pack-created row get an audit line?** This one is not a decision,
   it is a gap — and it is what made this issue take a database query to answer
   instead of a glance.

Whatever is decided, the `installed: 0` count needs to become true independently.

## Confirmed by

—

## Decision — 2026-08-24, Brandon

**The seeded location is deliberate, so it stays.**

A trade pack seeds operating data on purpose, so somebody opening a platform this
large has something real to navigate instead of an empty console and no idea what
the screen is for. The Fulfillment Center is an example to look at, not a mistake
to clean up, and "an apparel pack should not create a second location at all"
above is answered: it should.

**Three of the findings survive that, because none of them is about whether to
seed.** They are about a seeded row being indistinguishable from one she made:

1. **It is not labelled a sample.** This is the one that makes the other two
   smaller — a row that says `Sample` is obviously illustrative, and a sample
   address in Columbus stops being a claim about her business the moment the row
   admits what it is. The marker (`isSampleRow`) and the badge are built; they
   need confirming on this screen.
2. **It wrote no audit entry.** `Main Warehouse` writes one and this does not, so
   the audit log disagrees with itself about seeded rows. "I did not make this
   and I cannot find out who did" is the complaint, and labelling fixes the first
   half of it, not the second.
3. **The audit line reports `"installed": 0, "skipped": 0`** having installed
   something. A counter that says zero after doing work is the same failure this
   run keeps finding — a green report over an unmeasured thing — and it is wrong
   independently of anything above.

Rescoped to those three. The rows are not the defect; being unable to tell them
apart from her own is.

## Rating effect

`Stock › Locations` — recorded in [rating.md](../rating.md).
