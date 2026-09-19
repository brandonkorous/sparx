# 589 — The heading counts, and then the sentence underneath forgets

**Status:** fixed and proven red
**Severity:** medium
**Found by:** Devi, on Stock → Counting schedules, then everywhere
**Surface:** 20 warning bands across `piggles|sparx/apps/workbench/surfaces/`
**Filed:** 2026-09-16
**Family:** [[feedback_non_technical_audience]] · [[feedback_a_fix_leaves_its_neighbour_behind]]

## What she saw

On Counting schedules, one schedule due:

> **1 schedule is due**
> Tonight's run will create **their** counts.

The heading counted. The sentence under it did not. That looked like a one-off,
so I scanned for the shape and it was not.

## Measured

A source scan of every `<Alert>` in both consoles, for one shape: a **title that
counts** (`plural(...)` or a `=== 1 ?`) above a **body carrying a bare plural
pronoun** with no conditional of its own.

**19 in each console.** Every title was careful. Every one of them used
`plural()`. The sentence underneath threw it away.

| At one, it read                                                                                           | Where                 |
| --------------------------------------------------------------------------------------------------------- | --------------------- |
| "1 shipment was due and **have** not arrived"                                                             | Deliveries on the way |
| "1 commitment is past the date you gave. **These customers were** told a date..."                         | Waiting for stock     |
| "1 item is sharing a barcode. **These codes were** left off the scan list." + "Sort **them** out"         | Barcodes              |
| "1 batch is already past **their** date. **These are** excluded from picking..."                          | Expiring stock        |
| "1 open order has no expected date. **They** cannot appear here..."                                       | Overdue deliveries    |
| "Searching your shop won't find one of your products. **They are** on your site..." + "Put **them** back" | Products              |
| "1 unit sold with no cost recorded. **They are** not in the total below..."                               | Whose stock           |
| "1 row did not save. **They are** still here with what you typed."                                        | Edit a lot at once    |

**A small business is the one that lands on 1.** That is exactly the reader this
console is written for.

Two were broken in the **title** itself, past any body:

- "1 shipment **was** due and **have** not arrived"
- "1 batch is already past **their** date"

## The fix

**20 bands, both consoles, 40 edits.** Almost none of them is a conditional.
Number-neutral wording reads at least as well and, unlike a ternary, cannot come
back the next time somebody edits the sentence:

| Was                                                                           | Now                                                                                          |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| "They are listed below rather than left out"                                  | "Listed below rather than left out"                                                          |
| "Those units are counted but not valued"                                      | "That stock is counted but not valued"                                                       |
| "These codes were left off the scan list"                                     | "Any code shared this way is left off the scan list"                                         |
| "They are still here with what you typed"                                     | "Still here, with what you typed"                                                            |
| "These customers were told a date..."                                         | "Each was promised a date..."                                                                |
| "They cannot appear here, because nothing says when they should have arrived" | "An order with no date cannot appear here, because nothing says when it should have arrived" |
| "1 shipment was due and have not arrived"                                     | "1 shipment is overdue"                                                                      |
| "1 batch is already past their date"                                          | "1 batch is already out of date"                                                             |

Two buttons were counting wrong too, and take a conditional because a button has
no room to be neutral: **"Sort it out"** and **"Put it back"**.

## Proven

**`counted-title-plural-body.test.ts`**, both consoles.

The matcher self-test earned itself immediately. My first pattern was
case-sensitive, so `\b(they|them|their|these|those)\b` matched nothing beginning
a sentence, which is where almost all of them were:

```
× finds the shape it is looking for
    expected false to be true
    at: new RegExp(PLURAL_WORD).test('These codes were left off the scan list.')
```

Without that assertion the guard would have reported the tree clean over five
real bands. That is issue 583 exactly, in a different disguise, one week later.

Putting two back:

```
+     "said": "These",  "where": "inventory/expiring-stock.tsx:263",
+     "said": "They",   "where": "inventory/expiring-stock.tsx:280",
```

It also asserts **two denominators** (more than 150 `.tsx` files, more than 60
alert bands), so a scan whose root moved fails rather than passing on nothing.

### The allowlist, and why it has one

Five bands are correct as they stand, and each carries its reason in the file:

| Band                 | Why it stays                                                     |
| -------------------- | ---------------------------------------------------------------- |
| Waiting for stock    | "them" is a person, and singular they is correct English for one |
| Timesheets           | same: "Open their record and add a rate"                         |
| Picking walk         | the count is of LINES; one line still holds several units        |
| Supplier performance | "those" is the four measures, and there are always four          |
| Cost to keep         | "these figures" is the three stats above the band, never one     |

Keyed by file **and** by a phrase from the body, so a new band added to one of
those files is not excused by an old decision. That is the usual way an allowlist
goes blind, and it is worth the extra field to avoid.

|                 |                         |
| --------------- | ----------------------- |
| piggles console | **487 pass** (59 files) |
| sparx console   | **389 pass** (50 files) |
| typecheck       | both exit 0             |
| console parity  | PASS (0 divergent)      |
| lint / prettier | clean                   |

## Still open

The guard reads `<Alert>` blocks only. The same shape can live in an
`EmptyState`, a toast or a plain paragraph, and those are not covered. Widening
it means deciding what counts as "a title" outside an Alert, which is a real
design question and is not answered here.
