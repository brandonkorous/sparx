# 819 — What has been happening was written in event names

**Status:** fixed (two rows wait on a migration)
**Severity:** copy (96 of 509 sentences) + correctness (a first-load message that was false)
**Found by:** P03 · Juniper Row · act 281
**Surface:** mypiggles + sparx workbench — `platform.pulse`, and `api-rest`'s `/v1/activity`
**Filed:** 2026-09-25
**Fixed:** 2026-09-25
**Confirmed by:** seen on screen as Devi, before and after
**Blocked on:** Brandon, for migration `20270519000000` (5 rows renamed, 2 removed)

## What her own activity list said

```
Configuration template created (How to build Silk twill scarf)
Fitment product set (Silk twill scarf)
Workflow restored (Commission weave)
Stage reordered (Commission weave)              ×2
Template seeded (Default)
Document snapshot frozen
Line added
B2b ar created (INV-000012)
```

Not one of those is a sentence Devi would say, and two of them are not English.

## The argument that had been read as a budget

`activity-language.ts` turns `audit_logs.action` into a sentence by convention,
with an OVERRIDE table for the ones the convention gets wrong. Its header made a
good case for the mechanism:

> There are ~294 distinct ones today and new ones ship continuously, so this
> CANNOT be a hand-written table of 294 entries.

True, and the convention is what makes it true. But the table had **18 entries**
and the header called it "deliberately short", which turned an argument about the
SHAPE of the mechanism into a budget on its CONTENTS. Those are different things:
the convention is what keeps the table from having to be complete; it is not a
reason to leave a sentence wrong once somebody has read it.

Rendering all **509** actions the scan can see, **96** came out unreadable. Four
kinds, each a claim about the convention rather than a matter of taste:

| | what the convention printed |
| --- | --- |
| **an abbreviation or a run-together word** | `B2b ar created` · `Bom created` · `Accountcredit takenback` · `Variant uoms set` · `Sla policy created` · `Giftcard issued` |
| **a developer's verb for something done on your behalf** | `Template seeded` · `Pipeline bootstrapped` · `Emails provisioned` · `Pages starter backfilled` · `Layout upserted` · `Return dispositioned` |
| **no subject left once the module is dropped** | `Line added` · `Stage reordered` · `Definition created` · `Document snapshot frozen` |
| **two actions on one sentence** | see below |

"Accountcredit takenback" is the one to sit with. It is not jargon, it is not a
term of art: it is two words with the space taken out and a third that is not a
word, printed at a business owner, in a list of what has happened to her money.

## Four collisions, and two that mattered

| the sentence | what it covered |
| --- | --- |
| Subscription created | `commerce.subscription.created` **and** `webhook.subscription.created` |
| Collection created | a group of products **and** a folder of photos |
| Settings updated | `crm.settings.updated` **and** `email.settings.updated` |
| Member removed | the tenant's own Team screen **and** a WizeWorks operator |

The first is a customer's repeat order and a developer's callback under one name.
The last is worse than it looks: an operator row carries **no actor name** (the
feed shows a name only for staff), so the sentence is the only place a tenant can
be told that support did this to their teammate, and it did not say.
[[feedback_one_outcome_two_causes]]

The other duplicates were left alone on purpose and are listed in the guard with
their reason: `inventory.adjusted` and `commerce.inventory.adjusted` ARE one
event audited by two modules, and a shared sentence is right when the thing is
shared.

## The console had no vocabulary for this, and it has one for everything else

The feed's sentences arrive composed by the API in sparx's words. Every other
place that happens, Piggles renames at the boundary: `vocabulary.ts` for screen
names, `channels.ts` for where a sale came from, `report-field-words.ts` for the
report builder's fields (issue 816, four days ago). The feed had none, so the one
screen that narrates the whole business spoke the platform's language.

`lib/console/activity-words.ts` is the fourth of those, applied in
`useActivity` — the single point where the feed enters this console, rather than
at the two places that draw a row.

| the API says | Piggles says |
| --- | --- |
| Fitment product set | What a product fits was set |
| Configuration template created | Build-your-own set up |
| Segment created | Group of customers created |
| Pipeline bootstrapped | A starter process set up |
| Deal stage changed | Deal moved to another step |
| Bill of materials created | Recipe created |
| Variant created | Version created |
| Order fulfillment created | Order handed over |
| Warehouse created | Location added |
| Broadcast sent | Email campaign sent |

Two of those need their reasoning written down.

**"Order fulfillment created" → "Order handed over".** "Fulfilled" is the single
word `order-tone.ts` exists to keep off this console's screens — issue 818 quotes
its header: _it reads as "finished" to everyone who has not worked in commerce,
when it means the opposite_. The order rows say **On the way** and **Ready to
collect**, and "handed over" is true of both.

**`invoicing.document.*` → "Invoice or quote".** One action covers both, because
underneath they are one billing document and the workflow slug that tells them
apart is not on the audit row. `document-words.ts` picks the right single noun on
a screen that has the document in its hand; a feed row does not. My first pass
wrote "Invoice moved to another step" and the screen then said it about
**Q-000017**, which is exactly the mistake that file was written to stop. The
number beside it says which.

## The pane said something false every time it opened

Before any data arrived, both lists on Pulse read:

> Nothing older to show. Step back to Newer for the most recent notifications.

That branch is about having stepped BACK in time, and it was not gated on having
done so — it was simply the `items.length === 0` case, which is also what loading
looks like. So the first thing this pane ever said, on every open, was that there
was nothing older, from the newest window, about a list that had not loaded.
[[feedback_never_present_absence_as_measurement]]

Both now need `cursors.length > 0`, and while loading they draw rows in the real
shape so nothing reflows when the real ones land.

## Three smaller things on the same screen

**Five identical rows reading "Importe… 28d ago Finished".** The jobs rail is
narrow by design and `JobCard` put the label, the time and the badge on one line
with the label truncating, so it got about 55px. The label is the only part that
says WHAT ran. It wraps now, and the time and badge drop under it when there is
no room for both.

**"Everything you, your team and your customers have done."** Devi has no team.
Three sentences on this pane assumed one; all three read better without it, and
the new one covers a sole trader and a shop of twelve alike: *"Everything that
has happened in your business, newest first."*

**One screen, two words for one thing.** Chasing "version" as the Piggles word
for a variant turned up `product-options-words.ts`, which says version eight
times and then sends you to **the Variants tab**:

> 5 versions stay on sale with no choice attached. Retire the ones you do not
> want on the Variants tab.

The tab label was the only place the old word survived, on the one screen where
getting it wrong destroys prices. It reads **Versions** now, and so do the nine
rendered sentences that point at it.

## Two rows nobody could fix from the code

Devi's ONE unread notice, the single thing under "Addressed to you personally":

> **is out of stock**
> Customers cannot buy this until it is back in stock.

The title in the database is literally `is out of stock`, and `entity_id` is
NULL. It was composed from `'{{product.title}} is out of stock'` before
`notify.ts` learned to refuse a title with an unresolved placeholder — which it
now does, and records which path came back empty. The writer is fixed; the rows
are not, because **a notification is not a template**. It is a sentence composed
once and then stored, so a fix to the composer does nothing for what it already
wrote. Same shape as issue 815.

Every row in the table is one of two mistakes:

| | rows |
| --- | --- |
| notifications in total | 7 |
| `The <brand> team replied to your feedback` | 5 |
| `inventory.depleted`, no subject, no link | 2 |

The five name a brand resolved before the per-tenant lookup existed (issue 128),
so a Piggles account holder was told **"The sparx team"** replied, inside the
Piggles console, about a message they sent from inside Piggles. The writer no
longer names a brand at all: a notice is only ever read inside its own brand's
console, so the brand is already on the screen around it, and **a sentence that
cannot name the wrong brand is a stronger guard than a lookup that must not
fail.** [[feedback_a_copy_edit_breaks_identity_lookups]]

Migration `20270519000000` repairs the five and deletes the two. Deleting rather
than repairing, because `entity_id` is NULL: the fact the notice existed to carry
is gone, and an unreadable warning takes up the one slot marked "addressed to you
personally" while being impossible to act on. Bounded to rows that are all of:
that kind, no link, and a title not starting with a capital — which is what an
unresolved leading placeholder leaves behind.

Dry run, rolled back:

```
NOTICE:  notifications: 5 reply notice(s) unbranded, 2 subjectless stock notice(s) removed
```

It wraps a tenant loop, like the other three waiting: `notifications` is FORCE
RLS and `sparx_owner` is a non-superuser in production, where a plain UPDATE sees
zero rows and reports success.

## Both guards went red on their first run, without being asked

`activity-reads-plainly.test.ts` found **`invoicing.b2b_ar.updated`** and
**`.voided`**, which my own sweep had missed. Widening its scan then found
`commerce.markup.recompute_*` and the `member.*` collision above. Four real
findings before it was ever deliberately broken.

`activity-words.test.ts` found two keys I had invented — `commerce.collection
.renamed` and `email.broadcast.updated` — neither of which any service writes.
`vocabulary.ts` carries a warning in its own header about exactly that trap: it
held an entry for `builder.studio` for months after the key stopped existing,
renaming nothing while reading as a screen this brand had named.

Proved red deliberately as well: removing `webhook.subscription.created` reddens
the collision test naming both actions; removing `invoicing.document
.snapshot_frozen` reddens the jargon test naming the word.

**The scan is honest about being partial.** It reads any dotted literal on a line
mentioning `action:` or `audit`, which catches the ternary form and the
positional-argument form but not `` `mcp.${toolName}` ``. Measured against a
database holding 354 distinct actions: the scan sees 464, and 82 of the
database's are outside it. That is written into the test rather than left to be
discovered. The five the Piggles map needs and the scan cannot see are listed
explicitly, with the query that found them, and the test asserts each one is
STILL invisible so an entry that becomes greppable gets removed rather than
rotting. [[feedback_structural_checks_go_blind]]

## Files

- `wizeworks/services/api-rest/src/lib/activity-language.ts` — 18 overrides → 148
- `wizeworks/services/api-rest/src/lib/activity-reads-plainly.test.ts` — NEW, 7 tests
- `wizeworks/services/api-rest/src/routes/internal/operator-feedback.ts`
- `piggles/apps/workbench/lib/console/activity-words.ts` — NEW
- `piggles/apps/workbench/lib/console/activity-words.test.ts` — NEW, 5 tests
- `piggles/apps/workbench/lib/api/activity.ts` — the one boundary
- `piggles/apps/workbench/lib/console/copy.ts`
- `piggles/apps/workbench/surfaces/pulse/{activity-feed,needs-you,job-card}.tsx`
- `piggles/apps/workbench/surfaces/commerce/{product-tabs,product-add-fields,product-pricing,products-data}.tsx`
- `piggles/apps/workbench/surfaces/commerce/product-options-words.ts`
- `piggles/apps/workbench/surfaces/commerce/product-variants/use-variants-tab.ts`
- `wizeworks/packages/db/prisma/migrations/20270519000000_a_notice_that_names_the_wrong_brand_or_no_product_at_all/`

## Noted, not fixed

**179 seeded automations still carry the em dash their source dropped.**
`Estimate approved — advance task`, `Invoice overdue (30 days — final notice)`,
`Notify — out of stock` and 21 more names, across every tenant. The source has
already been reworded and declares the old name in `previousNames`, and
`upsertSystemAutomation` adopts and renames a row found under a former name — so
the mechanism is correct and in place. It has simply never run here: there is no
reconcile tick on a development machine. Worth confirming the reconcile actually
runs in production before assuming these are already gone there, because if it
does not, 179 rows are carrying a house-rule violation with a fix that thinks it
has shipped.
