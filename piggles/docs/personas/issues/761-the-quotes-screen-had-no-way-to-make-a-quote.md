# 761 — The Quotes screen had no way to make a quote

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 270
**Surface:** mypiggles + sparx workbench — `b2b.quotes.list`
**Filed:** 2026-09-21
**Fixed:** 2026-09-21
**Confirmed by:** P03, on screen, by pricing one up and finding it afterwards
**Blocked on:** —

## What happened

A shop rings and asks what forty tees would cost. That is the ordinary way a
quote starts in a wholesale business. She opened Quotes:

```
                          [ ⟳ ]  [ 🔗 ]

                         No quotes yet

     When a business asks what a job or a bulk order would cost,
     the request shows up here for you to price up and send back.
```

Two icon buttons, refresh and copy-a-link. Nothing to press, and a sentence
telling her to wait for something to arrive.

She can only wait. There is no way in from this screen at all.

## MEASURED, before the fix

The two rows either side of Quotes in the same Trade section:

| screen             | way in from the screen |
| ------------------ | ---------------------- |
| Wholesale orders   | **Enter an order**     |
| **Quotes**         | —                      |
| Wholesale invoices | **Raise an invoice**   |

Both neighbours got theirs in issue 748, whose registry comment reads: "A shop
that phones one through had nowhere to go before this." The row between them
was left exactly as it was. [[feedback_a_fix_leaves_its_neighbour_behind]]

## Why: the door existed, on another screen, unsigned

A quote IS a `BillingDocument` on the system `b2b-quotes` workflow, and the
invoicing editor is the screen that prices one. So the capability was there the
whole time. The only route to it:

**Invoices → New invoice → Document type → change the dropdown to "B2B Quotes".**

That asks a business owner to already know that a quote is secretly an invoice,
which is a fact about the database and not about her trade. The Quotes screen,
the one place she would look, pointed at nothing. [[feedback_fetched_but_never_rendered]]

The empty state was also only half true. It described a trade customer asking
through their account on the website, which does work — the portal's RFQ form
posts to `/v1/public/b2b/portal/:accountId/quotes`. It did not mention the other
half, which is her pricing one up herself, because that half had no button.

## What was done

**A door, where she looks for one.** The Quotes screen gets a `Price up a quote`
button in its toolbar AND in its empty state, hoisted to one action object so
the two cannot drift into different words. It opens the invoicing editor with
`workflow: b2b-quotes`, and the registry row carries the same, so the nav rail's
`+` works too.

**The editor takes the kind as a parameter.** `invoicing.invoice.edit` reads
`params.workflow` (a workflow SLUG, so a tenant renaming the workflow does not
break the door), preselects it once the workflows load, and moves the dirty
baseline with it — seeding a field without moving the baseline is how issue 507
comes back, and a pane that asks to confirm losing work nobody typed is worse
than no preselect at all.

**The tab says what was pressed.** "New quote", not "New invoice". Same editor,
same registry row, different errand — the rule issue 743 set for the till.

**The empty state says both ways in**, because both happen.

## Files

- `piggles/apps/workbench/lib/surfaces/catalog/b2b.ts`, `sparx/…` — `createSurface` + `createParams` + `createLabel`
- `piggles/apps/workbench/lib/surfaces/catalog/invoicing.ts`, `sparx/…` — the title follows the kind
- `piggles/apps/workbench/surfaces/b2b/quotes-list.tsx`, `sparx/…` — the button, and `ListEmptyState`
- `piggles/apps/workbench/surfaces/invoicing/invoice-editor.tsx`, `sparx/…` — the `workflow` param
- `piggles/apps/workbench/surfaces/invoicing/document-words.ts`, `sparx/…` — new

## Proof

Read on screen 2026-09-21, doing the thing that could not be done:

Quotes → **Price up a quote** → a pane titled **New quote**, Document type
already reading **B2B Quotes**, Save greyed out because nothing has been typed.
Tamsin Vale of Loom and Larder, forty medium white tees at $25.20 trade, good
until 31 October. Saved as **Q-000016**. A second, **Q-000017**, for twelve
Marlow Knits at $504.00.

Both consoles carry the fix. sparx had the identical gap — same registry row,
same empty state, same missing button.

Scored in both themes and at 360px. At 360 the pane keeps its button and its
picture; the list drops to Quote + Standing, which is the house pattern across
145 list surfaces and is recorded as its own observation rather than changed
here for one list.
