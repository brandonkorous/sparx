# 174 — A warehouse in Ohio she never opened

**Status:** fixed and confirmed — all three findings
**Severity:** major
**Found by:** P03 · Juniper Row · act 3
**Surface:** mypiggles › Stock › Locations
**Filed:** 2026-08-23
**Fixed:** 2026-08-24 — the audit trail on both sides now names what it did
**Confirmed by:** P03 · Juniper Row · 2026-08-24

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

## What was built — 2026-08-24

Findings 2 and 3 are code, and both are done. Finding 1 is on screen and still
needs a look.

### Finding 3 — the counter that said zero

`installIndustryStarter` sorts every preset into **three** buckets — installed,
already-present, skipped — and the audit row recorded the first and the last. So
apparel, whose fifteen presets were all already there, wrote:

```
"installed": 0, "skipped": 0
```

which is byte-identical to a starter that found every module switched off, and to
one that declares no presets at all. Read months later next to an unexplained
location, that line says "this install did nothing" — and it sent the reader
looking in the wrong system, which is exactly what happened here.

The row now carries all three counts **and names the presets in each**, because
"what did this put in my account" is answered by a list and a number answers
nothing. The payload is a pure exported function (`industryAuditPayload`) so the
shape is assertable without a database — the defect was in the shape, not in the
write — and three tests pin it, including one that the three outcomes must not
serialize alike. All three were confirmed to go **red** against the old two-bucket
shape before being trusted green.

### Finding 2 — the audit entry that was not written

Half of this was already closed: `recordSampleData` writes
`tenant.sample_data.loaded` with the per-slice counts, and its own comment cites
this Fulfillment Center.

**The other half was still open, and it was the half about locations.**
`SampleDataCounts` had no `warehouses` field, so the row itemised 559 records
across seventeen kinds and said nothing at all about the one thing the owner was
asking about. An audit entry that answers everybody except the person reading it
is not an answer.

- `SampleDataCounts.warehouses` counts sample locations, incremented only on a
  genuine **create** — the engine asks before the upsert, because the upsert
  cannot say which branch it took and a tenant reinstalling a pack has not gained
  a place.
- **`countsTotal` deliberately excludes it.** That total means "rows Remove takes
  away", and locations are durable config Remove leaves standing. Folding them in
  would have made the confirmation promise to remove a place it will not touch.
- The Practice data screen shows locations in their own group under the removable
  ones, with a line saying they stay and where to delete one. `COUNT_LABELS` is
  the removable list; `DURABLE_COUNT_LABELS` is the kept one, and nothing that
  says "removes" reads the second.

### Where it lives

| File                                     | What changed                                  |
| ---------------------------------------- | --------------------------------------------- |
| `api-rest/lib/industry-starters.ts`      | `industryAuditPayload` — three buckets, named |
| `api-rest/lib/industry-starters.test.ts` | three guards, each proven red first           |
| `db/sample-data/types.ts`                | `SampleDataCounts.warehouses`                 |
| `db/sample-data/engine/inventory.ts`     | counts a location only when it creates one    |
| `db/sample-data/engine/summarize.ts`     | counts them; `countsTotal` excludes them      |
| `console › sample-data/data.ts`          | `DURABLE_COUNT_LABELS`                        |
| `console › sample-data/counts-grid.tsx`  | the two groups + what Remove does with each   |

## What was owed at that point

**Finding 1 — the `Sample` badge on Stock › Locations.** Owed then, done since:
the backfill and the on-screen confirmation are both below.

**Neither of the two fixes above is visible on Juniper Row's existing rows.** The
audit entries were written at install time and are not rewritten; what is fixed is
what the next install and the next practice-data load record. Confirming them
means a fresh tenant, not this one.

## Finding 1, walked as Devi — 2026-08-24

**Stock › Locations still looks exactly as she filed it.**

```
Fulfillment Center   FC-1   Your own place   Columbus, OH, US   In use
Main Warehouse       MAIN   Your own place   US                 In use
```

No `Sample` badge. And the reason is worse than "not done yet".

### The label is built correctly and cannot reach the rows it was built for

The machinery is complete and right, end to end:

- `warehouses.ts` returns `isSample: isSampleRow(w.metadata)`;
- `locations-list-table.tsx` renders `<Badge color="info" variant="soft">Sample</Badge>`
  beside the name, with `info` chosen deliberately — an origin, not a fault.

What is missing is the marker on the row, and the marker is set **on create only**:

```ts
// Marked on CREATE only. Clear deliberately LEAVES warehouses behind …
// Not set on `update`: a tenant whose own location happens to share a code
// keeps its own.
metadata: withSampleMeta(),
```

That decision is correct in itself. Its consequence is not:

```
marked sample locations in the whole database : 0
Fulfillment Centers in the whole database     : 2
inventory_warehouses total                    : 79
```

Devi's Fulfillment Center carries `metadata = {}`, because it was seeded before
the marker existed. **And it can never acquire one.** The pack declares that
location under code `FC-1`, so a future practice-data load upserts onto the row
that is already there, takes the `update` branch, and by design does not stamp
it. The row is permanently unlabelled.

So finding 1 as it stands fixes the problem for locations nobody has yet, and
does nothing at all for the two rows that caused the issue to be filed. It cannot
even be confirmed on Juniper Row — loading practice data there would reuse the
unmarked row rather than mint a marked one.

### What that means for the fix

A **backfill** is the missing half, and it is small and well-bounded: two rows
today, identified precisely rather than by guesswork — a warehouse whose
`(tenant, code)` matches a code declared by that tenant's own industry pack, that
carries no `metadata.sample`, and that the tenant has not renamed away from the
pack's name. Anything failing one of those tests is left alone, which is the same
never-narrow caution the write side already shows.

Without it, "a row that says `Sample` is obviously illustrative" — the sentence
the whole rescope rests on — is true only of a database nobody has yet.

### What that meant at the time

Both of these were owed when the walk-through was written, and both were done the
same day — see the next section.

## Finding 1 — backfilled and confirmed, 2026-08-24

`20270417000000_a_seeded_location_admits_what_it_is`. Devi's Locations list now
reads:

```
Fulfillment Center  [Sample]   FC-1   Your own place   Columbus, OH, US   In use
Main Warehouse                 MAIN   Your own place   US                 In use
```

The badge is on the pack's row and NOT on hers, which is the whole distinction
the rescope asked for. The Columbus address stops being a claim about her
business the moment the row admits where it came from.

### It was thirteen rows, not two

The walk-through found the two Fulfillment Centers. The database had more:

| code     | name                        | rows |
| -------- | --------------------------- | ---- |
| FC-1     | Fulfillment Center          | 2    |
| ROAST    | Roastery & Pantry           | 2    |
| STUDIO   | Studio Stockroom            | 2    |
| EAST-3PL | East Coast Fulfillment      | 2    |
| COOLER   | Shop Cooler                 | 1    |
| DRYSTORE | Dry Store                   | 1    |
| DC1      | Central Distribution Center | 1    |
| DC2-3PL  | Southeast 3PL               | 1    |
| WEST-3PL | West Coast 3PL              | 1    |

Thirteen unexplained locations across eight businesses, every one of them
permanently unlabellable before this.

### How a row is identified, and the one it deliberately will not touch

Four fields must match a pack's declaration exactly — **code, name, city and
region**. A business could plausibly have a "Dry Store" and plausibly code it
`DRYSTORE`; what it will not also do is put it in Asheville, NC. All 13
candidates matched their pack's tuple exactly and there were no near-misses to
adjudicate.

**`MAIN` is excluded and stays excluded.** `bootstrapDefaultWarehouse` seeds
`MAIN` / `Main Warehouse` from the owner's own business address and audits it —
that row is hers, and the issue says so. Three packs also declare code `MAIN`, so
on those tenants the two are indistinguishable after the fact. Labelling an
ambiguous row "Sample" would put a false sentence on her screen about the one
location the platform set up FOR her, which is worse than the problem being
fixed. Verified after applying: **13 marked, 0 of the 51 `MAIN` rows touched.**

### One thing found and not fixed

The **electronics** pack declares its warehouse as code `MAIN` under the name
`Fulfillment Center`. On an electronics tenant the pack therefore upserts onto the
bootstrap's `MAIN` row and **renames her Main Warehouse to "Fulfillment Center"**.
That is a write-side bug, not a labelling one, and it is untouched here.
