# 883 — The two wholesale buyers had no business

**Status:** fixed
**Severity:** **moderate** — the column headed "Company" was blank for exactly
the customers who have one, and the search box promised to find them by it and
could not. Three people from the same shop, side by side, and the only one
showing the shop was the one who does not buy for it
**Found by:** P03 · act 314, sweeping her 41 customers by data weight
**Surface:** mypiggles › Customers › the list, and its search box
**Filed:** 2026-09-30
**Fixed:** 2026-09-30
**Confirmed by:** 5 tests, each rule proved red on a plausible wrong version
including the tempting one; and her own list, before and after

## What she saw

Searching "Loom" in Customers returned three people from Loom and Larder:

```
Tamsin Vale      [Wholesale]    Company  —
Priya Nandakumar                Company  Loom & Larder
Orla Beaumont    [Wholesale]    Company  —
```

Tamsin and Orla are the two who place her wholesale orders. Priya is a retail
shopper who happened to type her employer into a checkout box.

And on Tamsin's own pane, at the same moment:

> **Wholesale customer**
> Loom and Larder

The detail knew. The list did not. Same fact, same console, two answers.

## Measured

```
customers on the platform                                    765
  · linked to a real Company record                           11
  · linked, and showing a dash in the Company column           4      across 3 tenants
  · carrying a typed company name                            631
```

4 of the 11 customers who have a real business read as having none. Small in
rows, and it is 36% of every customer the field was built for.

## Two facts, one column

The schema is deliberate about this and says so:

```
// The employer they TYPED, which is not the same fact as `companyId` below
// (docs/144 §11). A guest checkout writes this and nothing else; a contact
// imported from a spreadsheet has it and no company record; and the two
// routinely disagree, because people write "Acme" and the record says "Acme
// Industrial Supply Ltd". Keeping both is what lets the company be OFFERED
// rather than guessed.
```

That is right, and the fix does not touch it. What was wrong is that the list
read one of the two and a business owner reading a column headed **Company**
is not asking which internal field holds the answer.

A wholesale buyer usually has the LINK and no typed name, because nobody made
them type one — they were attached to the account. So the field that exists for
business customers was the field business customers never had.

## Why the list could not simply include the relation

`Customer.company` is a Prisma **computed field** that shadows the relation of
the same name. @wizeworks/db's client documents it, with the measurement:

```
company read directly   { companyName: 'Loom and Larder' }
relation via customer   { companyId: '9b6d…', company: null }
same join in raw SQL    [{ company_name: 'Loom and Larder' }]
```

Ask Prisma for the relation and it hands back the typed string instead,
silently, with no error. The comment also records what that already cost:

> _"Two screens were built on that join and neither had ever rendered a business
> name: the order detail's 'Wholesale customer' line and the wholesale approvals
> queue (issue 751). Both now fetch the business under a name of its own."_

**This was the third screen.** The fix for 751 established the pattern
(`accountsFor` in order-service: a second query keyed by id, attached as
`b2bAccount`) and the customers list never moved onto it.
[[feedback_a_fix_leaves_its_neighbour_behind]]

Seven other places already do it right — `b2b/quotes.ts`, `b2b/reports.ts`,
`b2b/approval.ts`, `billing-document-service.ts`, `ticket-service.ts` and both
halves of `universal-projection.ts`. The list called Customers was the holdout.

## What it does now

1. **`customerService.list` attaches the linked business** as `b2bAccount`, the
   same key and shape the order screens already publish, fetched in one extra
   query keyed by id for the whole page.
2. **The search matches it.** `{ company: { companyName: { contains: term } } }`
   alongside name, typed company and email — the same clause `b2b/quotes.ts`
   and `billing-document-service.ts` already use.
3. **The column shows the typed name first, the linked one when there is none.**
   No row that showed something changes; rows showing a dash now show the truth.
4. Both consoles.

## Proved

**5 tests**, and the fixture is built so a wrong version cannot pass: the
business is named **Thornbury Haberdashery** and the customer's address is
`buyer@example.test`, sharing not one word with it. On the real database the
pair are `tamsin@loomandlarder.com` at "Loom and Larder", where a search for the
business finds them through the email domain **by luck** — a fixture like that
would go green with the fix removed. [[feedback_a_test_that_cannot_go_red]]

```
drop the search clause              →  "finds somebody by the business they are linked to"
never attach the business           →  "carries the linked business onto the row the list draws"
merge the linked name INTO `company` →  "carries the linked business onto the row the list draws"
```

The third is the one worth having. Folding the two fields together is the
obvious fix, it makes the column look right, and it destroys the distinction
the schema exists to keep — the platform would be inventing a sentence the
customer never said.

**Checks:** `@wizeworks/crm` 67 files / 602 tests. Typecheck 0 on
`@wizeworks/crm`, api-rest and both consoles. `check:shadowed` green (16 selects
of a computed name, none under the model that shadows it). ESLint and prettier
clean.

**On her own list:** Tamsin Vale now reads **Loom and Larder** where she read a
dash, beside the Wholesale badge that was the only clue she had one.

## Files

- `wizeworks/packages/crm/src/services/customer-service.ts`
- `wizeworks/packages/crm/test/integration/customer-keeps-its-business.test.ts` (new)
- `piggles/apps/workbench/surfaces/crm/customers-list.tsx`
- `sparx/apps/workbench/surfaces/crm/customers-list.tsx`
- `piggles/apps/workbench/surfaces/crm/customers-data.ts`
- `sparx/apps/workbench/surfaces/crm/customers-data.ts`

## Measured and correctly NOT filed

**The Score panel.** `score` is `0` on all 41 of her customers and on 770 of 770
platform-wide, and `scored_at` is set on only 6 of those 770 — a stored default
on every row, which is the shape that usually means a screen is drawing an
absence as a measurement. It is not. The pane says:

> **You haven't said what makes a customer worth chasing**
> Scoring puts a number on every record from rules you write (how much they have
> spent, how recently they replied, whatever matters to you) so the list can be
> sorted by who to call first. **Until you set it up, everybody sits at zero.**
> [Set up scoring]

It names the zero, explains why it is zero, and offers the way out. The list
guards the same value with `row.score > 0` so no badge is drawn either. This is
the rule working. [[feedback_never_present_absence_as_measurement]]

## The thing to remember

**When one fact has two storage shapes, the screen owes the reader the fact, not
the shape it happened to be stored in.** Nothing here was null by mistake: every
row was exactly as intended, the column rendered exactly what it was given, and
the answer on screen was still wrong.

The measurement that finds it is not "is this column populated" — it was, for
631 of 765. It is **"who has the OTHER shape, and what does the screen say about
them?"** Count the rows that use the less common path, then go and look at those
rows specifically. They are where a screen built for the common path tells the
truth to nobody.
