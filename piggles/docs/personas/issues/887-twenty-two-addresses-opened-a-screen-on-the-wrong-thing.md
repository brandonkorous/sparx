# 887 — Twenty-two addresses opened a screen on the wrong thing

**Status:** fixed
**Severity:** **moderate** — a plausible address crashed the panel it opened,
with a Try again that could never work, on a console that otherwise handles a
missing record kindly. Reached by a link somebody wrote or shortened, not by
clicking
**Found by:** P03 · act 315, while trying to open Supplier performance by
guessing its address
**Surface:** every detail pane in both consoles; proved on Suppliers and
Customers
**Filed:** 2026-09-30
**Fixed:** 2026-09-30
**Confirmed by:** 5 tests, proved red three ways including the tempting
over-fix; and the two panes, before and after

## What happened

I went to open Supplier performance and typed what its name suggests:

```
/inventory/suppliers/scorecards
```

The tab said **Supplier**, and the panel said:

```
⚠  This panel ran into a problem
   Nothing else in your workspace was affected. Try loading it again.
   [ Try again ]
```

Try again never worked. It cannot: the panel is being handed the same thing
every time.

## The chain

```
/inventory/suppliers/scorecards
  → matches /inventory/suppliers/:id       with id = "scorecards"
  → opens the SUPPLIER pane
  → fetches /v1/inventory/suppliers/scorecards
  → which is a REAL endpoint: the supplier league table
  → 200 OK, with a body that is not a supplier
  → supplier.name.trim()   →   Cannot read properties of undefined
```

Every link in that chain is behaving as written. The address table accepts any
non-empty segment where a record id goes; the REST API keeps sub-resources in
the same place a record id goes; and the pane trusts a 200.

**A supplier that does not exist has always been handled properly.** Opening a
made-up id shows a drawing of the Piggles pig and

> **This supplier no longer exists**
> It may have been removed. Its past orders are unaffected.

which is exactly right. It was only a 200 of the wrong SHAPE that fell through
the floor, because nothing on that path is an error.

## Measured

Every console route ending in `/:id`, against every literal path the REST API
serves under the same collection:

```
console detail routes ending in /:id                     87
addresses that open a detail pane on a 200 of the
  wrong shape                                            22
```

The list is not obscure. It is the names of real screens:

```
/crm/customers/top          /crm/tasks/today         /crm/tasks/overdue
/crm/customers/duplicates   /crm/customers/inactive  /crm/deals/forecast
/inventory/lots/expiring    /content/entries         /analytics/dashboards
/inventory/suppliers/scorecards   /scheduling/bookings/calendar   … 11 more
```

`/crm/customers/top` was proved to crash the same way.

## What it does now

A parameter that NAMES A RECORD has to look like one: a uuid, the literal `new`,
or any sixteen-character machine-minted token, so the rule survives ids changing
format. The longest of the twenty-two words that must not match is
`variant-lookup`, at fourteen.

Nothing else is constrained. The address table is already disciplined about
this: anything that is not a record id gets a parameter of its own — `:slug`,
`:key`, `:objectKey`, `:name`, `:number` — and every pane behind an `:id` treats
it as a row the server minted.

All twenty-two now land on the screen the console already had for this:

> **That link doesn't open anything**
> There is nothing at "/crm/customers/top". The link may have been cut short on
> its way to you (they sometimes break traveling through a chat or an email) so
> it is worth asking for it again.

which is the truth. There is no such screen.

## Proved

**5 tests**, and three wrong versions:

```
accept any segment as an id (the original)   →  2 fail
uuid only, no `new`                          →  1 fail
constrain EVERY parameter, not record ones   →  2 fail
```

The third is the one worth having. Requiring a shape everywhere is the one-word
version of this fix, it closes the same hole, and it breaks `/crm/records/vehicle/…`
and every other address built on a slug — addresses that carry a word ON PURPOSE.
[[feedback_a_test_that_cannot_go_red]]

The second matters because `new` is how every create form is addressed, and it is
not a uuid.

The fifth test holds the whole table rather than the routes anybody remembered:
it walks all 87 detail routes against a list of the colliding words and asserts
that none of them ever arrives as an id.

**One thing the fix exposed.** Ten of the table's own tests were written with
ids like `o1`, `p1`, `entry-1` and `sample-id`, which are not what the platform
mints. They were asserting a contract nobody intended. They now use real record
ids, and the fixture helper mints one for any parameter that names a record and
leaves the rest as words.

**Checks:** `@wizeworks/links` 2 files / 65 tests, `check:routes` green (346
surfaces addressed, 819 `open()` calls resolving), piggles console 169 files /
1577 tests (2 failing in `surfaces/migration/column-guess.test.ts`, another
agent's in-progress file), sparx workbench 138 / 1259 all green. Typecheck 0.
ESLint and prettier clean.

## Files

- `wizeworks/packages/links/src/resolve.ts`
- `wizeworks/packages/links/src/index.ts`
- `wizeworks/packages/links/test/routes.test.ts`

## Measured and correctly NOT filed

**The Price column on Supplier performance.** It reads **0.0%** for Fairfield
Trims, on the same morning their invoice FT-INV-2291 was flagged **$13.92 more
than the goods justify** two panes away. That looks like a contradiction and is
not one: the scorecard compares what was BOOKED IN against the agreed price, and
the bill check compares what was INVOICED against it. Fairfield delivered at
$3.60 and billed at $3.84, so both numbers are true about their own document.
The scorecard's own header says what it measures and what it deliberately does
not. Teaching it to read invoices as well would be a new measurement, not a
correction. [[feedback_verify_capability_in_code_not_docs]]

## The thing to remember

**Two systems can each be correct and still add up to a crash.** The address
table says "anything can be an id". The REST API says "a collection may have
named sub-resources". Neither is wrong. Put them together and a word becomes an
id, an id becomes a request, and a request comes back 200 with the wrong thing
in it.

The measurement that finds it is not "does this URL work" — the ones people click
all do. It is **"what else lives in the space this parameter can swallow?"** List
every literal path the API serves under a collection, then try each one as an id.
It took one query and it found twenty-two.
