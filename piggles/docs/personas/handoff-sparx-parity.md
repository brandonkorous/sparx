# Handoff: carry the Piggles console's fixes into sparx

**Version:** 1.1
**Author:** Brandon Korous
**Last Updated:** 2026-09-29

A work handoff produced by the P03 persona run (act 308), for a separate agent.
The prompt below is self-contained: paste it, or point an agent at this file.
Issue numbers refer to [personas/issues/](issues/).

---

You are working in `G:\code\@wizeworks\sparx.works`, a pnpm monorepo holding two
consoles built on the same product shape:

- `piggles/apps/workbench` — the Piggles console (a small-business product)
- `sparx/apps/workbench` — the sparx workbench

They share `wizeworks/` (API, packages, database). Roughly 300 acts of
persona-driven testing have been done against the **Piggles** console, and the
fixes those acts produced were, repeatedly, made in that console only. Sparx is
behind as a result, and some of what it is behind on is real harm.

## The job

Carry the divergences listed below from Piggles into sparx, then add a check that
stops the gap re-opening.

**Definition of done:**

1. Every item in list **A** is mirrored into sparx, with its call site, and
   verified by the checks at the bottom.
2. Every item in list **B** is investigated, and then either mirrored the same
   way or written up as a deliberate difference with a real reason.
3. `scripts/check-console-parity.mjs` gains a `shapes` axis so a new divergence
   fails the build. Anything not carried across is pinned in a list that can only
   shrink.
4. Nothing in list **C** or **D** is touched. Those are real brand differences.

## Hard constraints, all non-negotiable

- **Never commit and never push.** Leave everything in the working tree and
  report the changed files. The user commits.
- **Never add a `Co-Authored-By` trailer** to anything.
- **Never run or restart `pnpm dev`.** The user owns the dev lifecycle; a second
  dev server collides with theirs. Ask them to restart if you need a reload.
- **Never run `pnpm install`.** It can crash their running stack.
- **Never run `prisma migrate`, `db push` or `prisma generate`** against the
  shared docker Postgres without explicit authorization. Author migrations as
  files only. None of this job should need a migration.
- **Never `git stash`.** Never `git checkout -- <file>` to undo your own edit:
  the working tree holds days of uncommitted work and restoring HEAD silently
  destroys it. Copy files to a scratch directory **before** a sweep and restore
  from that.
- **Never `turbo run typecheck`.** It runs out of memory. Typecheck per package
  (commands below), one at a time.
- **Never filter `.next/` out of `tsc` output.** A half-written `routes.d.ts` is
  a parse error, which means tsc checked nothing, and filtering it prints
  nothing, which reads as clean.
- **Never run `vitest` in `wizeworks/packages/search` without `CI=true`.**
- **Do not resize the browser window.** If you need to check a narrow width, set
  the host element's width in injected JS instead.
- Database reads are authorized: `docker exec sparx-postgres psql -U sparx_owner -d sparx`.
  The DB is on port 5544. Ports: sparx workbench 3011, piggles console 3022,
  tenant site 3004, account 3021, marketing 3020, api-rest 3100. **They may all
  be down; this job does not need them.**
- `getpiggles.com` and `mypiggles.com` are **live production**. Always localhost.

## House rules for the code you write

- **Build UI on `@wizeworks/silicaui-react`**, choosing `color × variant × size ×
shape` props. Tailwind utility classes for layout, spacing and positioning are
  fine. Anything else needs the user's approval, asked for up front.
- **`color="neutral"` requires the user's explicit approval, every time.** A
  COLORLESS control (no `color` prop at all) is fine and needs no asking. Work
  out what the thing MEANS first: destructive is `danger`, app-owned is `module`.
- **No `style={...}` prop**, ever, without authorization. That includes aliasing
  a CSS variable. Tailwind cannot compile an interpolated arbitrary value, so a
  dynamic value resolves to one of a fixed set of static classes.
- **No em-dashes** in user-facing copy or in your replies. Reword.
- **American spelling everywhere** — code, comments, copy. `color`, `behavior`,
  `gray`, `canceled`. One exception: the wire value `cancelled` is a stored
  status and must not be renamed.
- **No faded text** (`text-soft`, `/opacity`) on anything meant to be read.
- Match the surrounding file's comment density and idiom. These files carry long
  explanatory comments naming the harm a fix prevents. Write in that voice.
- **Copy the house layout before inventing one.** Open two shipped screens of
  the same kind first.

## The rule that matters most in this job

**Adding the field is not the fix.** Every item below is a field AND the thing
that reads it. A mirrored type with no call site is a field nobody draws, which
is the exact defect class most of these were filed for in the first place.

Read the Piggles side to see what consumes the field, then build the sparx
equivalent in sparx's own idiom. Sparx draws icons from `lucide-react`; Piggles
uses `<Icon glyph={faThing}>` from `@piggles/ui`. Do not copy imports blindly.

Second rule: **prove every new test red before believing it.** Break the thing
it guards, watch it fail, restore, watch it pass. Record how many tests reddened.
A test that cannot go red is not a test.

Third: **the issue numbers below are in the Piggles code comments. Read them, but
verify the behavior in sparx yourself.** Do not inherit a diagnosis or its
severity. Prefer a measurement to a reading.

## How the list was produced

For every exported `interface` declared in both consoles' `surfaces/` trees,
compare the field names. Paired by name AND relative path first, falling back to
name alone when exactly one unpaired declaration is left on each side (Piggles
split `commerce/data.ts` into six modules and re-exports them; sparx keeps one
file, so the paths differ for the order shapes).

Result at handoff: **1,219 pairs compared, 54 differing fields**, 0 files the
scanner could not read.

You will want that scanner to watch the count fall, and you need it for step 3
anyway. Build it as pure Node (the parity check promises no dependencies), and
make it **REFUSE loudly** on any interface member it cannot classify rather than
skip it — a scanner that silently drops what it does not understand reports green
over the divergence it was written to find. Two things will bite you:

- `Record<string, unknown>` holds a comma, so track `<` and `>` as depth or the
  member splits in half.
- `=>` in a function type is an arrow, not a closing angle bracket. Miss that and
  depth goes negative on every callback field, swallowing the members after it.

A working copy may still exist at
`C:\Users\brand\AppData\Local\Temp\claude\g--code--wizeworks-sparx-works\bcbd1eb0-022c-4da7-b727-a15e7953625f\scratchpad\extract-shapes-lib.mjs`
plus `measure-final.mjs` and `list-entries.mjs` beside it. That directory is
session-scoped, so copy anything you want to keep.

---

## List A: carry these. Each names its issue in the Piggles comment.

The file path is the same in both consoles unless noted.

| Shape.field                                                       | File                                                                              | Issue        | What it fixes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Slot.retired`                                                    | `commerce/product-variants/slots.ts` (sparx: `commerce/product-variant-slots.ts`) | **305, 306** | A slot holding a retired version read as EMPTY, so the grid offered "Set a price" pre-filled with a reserved code and the server refused it. The bulk fill worked around the clash by appending `-2`, which **put five brand-new codes with no stock on sale beside five retired ones holding the real codes and all the stock.** It is a LIST, not one value: a square can genuinely hold two, and showing the first let array order decide which price, code and stock count the owner saw. Start here. This is the worst one. |
| `MediaAsset.usage`                                                | `cms/media-admin.ts`                                                              | **381**      | `usage_count` is a column nothing ever wrote, and it fed the "Used in" line, **both delete guards** and the media garbage collector's eligibility test. The screen said "Not used anywhere yet" about a photo on a live product page, with Delete enabled beneath it, and the GC hard-deletes 30 days later. The fix counts references across the seven tables that hold them. Check whether sparx's delete guard has the same hole.                                                                                             |
| `Author.property_id` (+ `CreateAuthorInput`, `UpdateAuthorInput`) | `cms/authors-data.ts`                                                             | **387**      | A byline is a public persona attached to one publication. The column existed and nothing read it, so a magazine's masthead appeared in a clothing shop's picker. The server resolves the default from `x-sparx-property-id`; the field is what lets the editor say so and change it.                                                                                                                                                                                                                                             |
| `Booking.customer`                                                | `scheduling/bookings-data.ts`                                                     | **138**      | The list had only `customerId`, so it printed the words "A customer" beside a booking whose customer the database could name.                                                                                                                                                                                                                                                                                                                                                                                                    |
| `CustomerLite.phone`                                              | `scheduling/bookings-data.ts`                                                     | **111**      | The API has always returned it and nothing asked, so a booking could not show a phone number. Ring them when they are late.                                                                                                                                                                                                                                                                                                                                                                                                      |
| `Placement.slots`                                                 | `scheduling/calendar-grid.ts`                                                     | **148**      | How many 15-minute slots tall a block is, so the block can decide how much it can SAY. Three stacked lines need about fifty pixels; a half-hour booking is thirty-two. A block that always drew three **sliced the last two through the middle of the letters.**                                                                                                                                                                                                                                                                 |
| `GridColumn.closed`                                               | `scheduling/calendar-timegrid.tsx`                                                | **084**      | The hours nobody is open for, drawn behind the bookings, so a week with hours set does not look like a week with none.                                                                                                                                                                                                                                                                                                                                                                                                           |
| `SchedulingService.removedAt`                                     | `scheduling/setup-data.ts`                                                        | **145**      | Set only on a removed service. Every read but the list hides those.                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `ServicesQuery.includeRemoved`                                    | `scheduling/setup-data.ts`                                                        | 145 pair     | Show removed services so one can be put back. Without it there is no way back.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `StaffMember.bookable`                                            | `staff/data.ts`                                                                   | **120**      | `null` when Bookings is off, which is not "no" — so the pane draws **no switch** rather than an off one.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `Location.isSample`                                               | `inventory/locations-data.ts`                                                     | **174**      | Created by sample data rather than by the owner. Removing sample data deliberately leaves locations alone, so this outlives it and the list has to say so.                                                                                                                                                                                                                                                                                                                                                                       |
| `SampleDataCounts.warehouses`                                     | `sample-data/data.ts`                                                             | 174          | Durable sample locations, never counted in anything that says "removes".                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

## List B: same shape, no issue number. Verify, then mirror or write up.

Each of these exists in Piggles and not sparx. Read what consumes it on the
Piggles side, decide whether sparx has the same need, and then either build it or
record a real reason it does not apply. **"Sparx just doesn't have it" is not a
reason** — that is the gap written down and waved past.

| Shape.field                                                   | File                                                  | Note                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DesignedEmail.key`                                           | `email/broadcasts-data.ts`                            | **Check this one first, it may be serious.** Marks a built-in email that a single event sends (an order confirmation, an invoice reminder). Piggles uses it for `broadcastableEmails`, which stops a broadcast sending a transactional email. **`broadcastableEmails` exists in Piggles only.** Find out what stops sparx broadcasting an order confirmation to a whole mailing list. If nothing does, that is its own issue and a bad one. |
| `MediaAsset.altText`                                          | `cms/media.ts`                                        | What a screen reader reads out. Null when nobody wrote one, and **the caller must not substitute the filename.**                                                                                                                                                                                                                                                                                                                            |
| `PickedAsset.altText`                                         | `cms/media-picker.tsx`                                | Same rule at the picker: a filename is not a description.                                                                                                                                                                                                                                                                                                                                                                                   |
| `Taxonomy.all_sites_term_count`                               | `cms/taxonomy-data.ts`                                | Labels across every site: what a DELETE takes with it, since deleting the vocabulary cascades to all sites at once. The confirmation reads this; the list reads the per-site count. Check sparx's confirmation is not understating the loss.                                                                                                                                                                                                |
| `Customer.totalOrdered`                                       | `crm/customers-data.ts`                               | What their orders are WORTH, net of refunds. The half a shop taking manual payment lives on.                                                                                                                                                                                                                                                                                                                                                |
| `CalendarEvent.customerName`                                  | `scheduling/calendar-data.ts`                         | The guest name on the booking, else the linked customer's. Null when nobody was recorded, which is a real answer a block must not dress up.                                                                                                                                                                                                                                                                                                 |
| `BookingQuery.customerId`, `.from`, `.serviceId`, `.statusIn` | `scheduling/bookings-data.ts`                         | Four filters the API has always taken and sparx cannot ask for. Without `customerId` a person's record cannot show what they were ever booked for.                                                                                                                                                                                                                                                                                          |
| `StockQuery.outOfStockOnly`                                   | `inventory/data.ts`                                   | Only what has nothing left to sell. Disjoint from `lowStockOnly`. Same shape as the bug that started this (a filter the other console could not express).                                                                                                                                                                                                                                                                                   |
| `ValuationSummary.uncostedUnits`                              | `inventory/reports-data.ts`                           | On-hand units nothing ever costed. Counted server-side because from the client a total of zero cannot be told from no stock, and **a partly costed shop looks complete.**                                                                                                                                                                                                                                                                   |
| `EmailSettingsView.resolvedFrom`                              | `email/domains-data.ts`                               | The literal `From` header a send will carry, resolved server-side. Piggles added it after a newsletter went out signed by the software rather than the business.                                                                                                                                                                                                                                                                            |
| `CartRow.contact`, `CartDetail.contact`                       | `commerce/carts-data.ts`                              | Who abandoned the cart, so somebody can be contacted.                                                                                                                                                                                                                                                                                                                                                                                       |
| `WebhookSubscription.health`                                  | `cms/webhooks-data.ts`                                | Whether the subscription is actually delivering.                                                                                                                                                                                                                                                                                                                                                                                            |
| `Site.pageCount`                                              | `sites/data.ts`                                       | LIST only, so a caller can tell an empty site from a built one before offering to do something whole-site to it. **Undefined on the single-site read: absent means "not counted", never "empty".**                                                                                                                                                                                                                                          |
| `PieceUsage.blocking`                                         | `builder/saved-pieces-data.ts`                        | How many uses would REFUSE a delete, which is not the same as `total`: a piece placed by the current editor DETACHES.                                                                                                                                                                                                                                                                                                                       |
| `SubmissionFormRef.pageSlug`                                  | `builder/form-submissions-data.ts`                    | Which page the form sits on.                                                                                                                                                                                                                                                                                                                                                                                                                |
| `SettleExchangeBody.staffNote`                                | `commerce/returns-data.ts`                            | A note recorded when settling an exchange.                                                                                                                                                                                                                                                                                                                                                                                                  |
| `Variant.metadata`                                            | `commerce/products-data.ts`                           | The platform's own scratch space (`customFields` is the tenant's). **Read through a named helper, never by key at a call site.** Judge whether sparx reads any of it; a mirrored field nothing reads is dead weight.                                                                                                                                                                                                                        |
| `OrderPayment.metadata`                                       | `commerce/order-types.ts` (sparx: `commerce/data.ts`) | Same judgment.                                                                                                                                                                                                                                                                                                                                                                                                                              |

## List C: do NOT carry. Piggles-only features.

- `Product.deposit`, `Product.orderAheadDays`, `Product.dailyLimit` and the same
  three on `ProductPatch`; `VariantChoice.deposit`, `VariantChoice.orderAheadDays`;
  `Order.readyOn` (issue 026) — Piggles sells deposits and order-ahead notice.
  Sparx does not sell that capability.
- `ContentEntry.legal_kind`, `ContentEntry.legal_reviewed`,
  `ChecklistItem.stillGuessing`, `LegalChecklist.shipping` — the Piggles legal
  pages checklist.

## List D: do NOT carry. Two designs, both correct.

- `ObservedSource.label` and `LeadSourceRow.label` (sparx only). **Verified at
  handoff:** sparx labels the lead source server-side and renders `row.label`;
  Piggles renders `channelKeyLabel(row.source)` and resolves it client-side. Both
  print a friendly name, neither shows a raw code. Leave both alone.
- `ParsedRedirectRow` — Piggles has `message` + `state` in
  `cms/redirects-parse.ts`; sparx has `error` in `cms/redirects-data.ts`. Two
  designs of the same validation, at different paths.

Already fixed at handoff and deliberately absent from every list:
`CommissionOutcome.rateStartsOn` / `.earnedOn` (issue 871) and
`OrderQuery.countedOnly` (issue 865).

---

## Step 3: the guard

`scripts/check-console-parity.mjs` today compares `components/**`, `lib/**`,
routes and dependencies, and **does not compare shapes at all** — which is how
all of the above accumulated. Read its header first; it states its own two limits
plainly and you should keep that honesty.

Add a `shapes` axis using the scanner and pairing rule above. It already has the
two mechanisms you need, and they are different on purpose:

- `EXCEPTIONS` — divergences that are DECIDED, each with the decision. Its own
  comment: _"A reason that amounts to 'the other one just doesn't' is not a
  reason — it is the gap, written down and waved past."_ Lists C and D belong
  here. It already fails on a **stale** exception, so an entry that stops
  diverging must be deleted.
- The `SPARX_DEBT` pattern in `scripts/check-toolbar-primary.mjs` — real defects,
  pinned rather than argued to be fine, and the check fails both on a new offender
  and on a line that no longer offends, **so the list can only shrink.** Anything
  from lists A or B you do not carry belongs here, with the harm named and a date.

Prove the new axis can go red: add a field to one console's copy of a shape, watch
it fail, remove it, watch it pass. Say in your report how many entries the debt
list starts with, because that number is the thing that has to reach zero.

## Verifying

Run these from the repo root. **Run the guard loop on its own** — running it
beside anything that changes the working directory produced two false failures
during this investigation, and a check looking in the wrong place finds nothing,
which reads exactly like either "all clear" or "everything broken" depending on
how it reports.

```bash
# typecheck, ONE AT A TIME
cd sparx/apps/workbench   && NODE_OPTIONS="--max-old-space-size=6144" npx tsc --noEmit -p tsconfig.json
cd piggles/apps/workbench && NODE_OPTIONS="--max-old-space-size=6144" npx tsc --noEmit -p tsconfig.json
cd wizeworks/services/api-rest && NODE_OPTIONS="--max-old-space-size=6144" npx tsc --noEmit -p tsconfig.json

# tests (baseline at handoff: piggles 151 files / 1441, sparx 117 / 1114)
cd sparx/apps/workbench   && CI=true npx vitest run
cd piggles/apps/workbench && CI=true npx vitest run

# lint PER PACKAGE, on the files you touched
cd sparx/apps/workbench && npx eslint surfaces/path/to/file.ts

# formatting, from the root, on every file you touched
npx prettier --check <paths>     # then --write if it complains

# the ten guards, ALONE, from a fixed directory
R=$(pwd)
for g in em-dashes plain-words copy-key-sentences nav-vocabulary theme-opacity; do
  printf "%-26s " "check-$g"; (cd "$R" && node "$R/piggles/scripts/check-$g.mjs" >/dev/null 2>&1) && echo OK || echo FAIL
done
for g in american-spelling boundaries calendar-dates console-parity price-offers; do
  printf "%-26s " "check-$g"; (cd "$R" && node "$R/scripts/check-$g.mjs" >/dev/null 2>&1) && echo OK || echo FAIL
done
```

Known red at HEAD and **not yours**: `check:deletability:build`, one test in
`wizeworks/packages/silica-catalog/src/custom-colors.test.ts`.

## Reporting

Write the user a plain-language summary: what you carried, what you found while
carrying it, what you deliberately did not carry and why, the debt list's starting
count, and the changed files. Do not commit. If something in list A turns out not
to apply to sparx, say so with the evidence rather than mirroring it on faith.

If a fix turns out to need an api-rest change (a field the sparx console can ask
for but the server does not send for it), that is in scope. Add the endpoint
change and an integration test with it.

---

## Outcome (2026-09-29)

Done. Every item in lists A and B was carried into sparx with the screen that
reads it. Nothing was written up as "does not apply". `check:console-parity` now
has a `shapes` axis: 1,236 interfaces paired, 18 fields divergent, all 18 in
EXCEPTIONS (lists C and D), and `SHAPE_DEBT` starts at **0**. Proved red three
ways: a probe field on one console, a stale debt line, and a broken scanner
(the `=>` and `Record<string, unknown>` cases are pinned by `selfTest()` in
`scripts/lib/interface-shapes.mjs`).

What the carry found that the list did not say:

- **Broadcasts could send a built-in email to a whole list, in both consoles
  and over MCP.** Piggles only hid it in its picker; the server accepted it.
  `assertBroadcastableEmail` in `@wizeworks/email-platform` now refuses it on
  create, update, send and schedule.
- **`Booking.customer` never reached the wire.** `bookingView()` in api-rest
  rebuilt each row and dropped it, so Piggles' issue 138 fix never took effect.
- The calendar placed blocks on the viewer's clock, not the booking's; shut
  hours ignored season dates, shut the day after a midnight closure, and merged
  everyone's hours. Fixed in both consoles.
- sparx's blueprint pane promised pages were left alone while install replaces
  them; sparx wrote payment notes into a unique key and showed them nowhere;
  Piggles printed processor references as payment notes; Piggles' exchange note
  was typed and never sent. All fixed.
- A renamed option value stranded stopped versions in both consoles, and
  restoring a product's only version lost "Shown first". Fixed.

Left for a decision: the media garbage collector has no caller, so it has never
run. Its eligibility now uses the counted references, but switching it on starts
permanent deletion.
