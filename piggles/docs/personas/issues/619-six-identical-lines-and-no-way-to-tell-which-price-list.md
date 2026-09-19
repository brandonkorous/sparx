# 619 — Six identical lines and no way to tell which price list

**Status:** fixed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 207
**Surface:** mypiggles › Signing in and security › Recent account activity (and
every entity timeline)
**Filed:** 2026-09-17
**Fixed:** 2026-09-17
**Confirmed by:** P03 · Juniper Row · act 207 (seen on screen, before and after)

## What happened

> **Recent account activity**
> A record of the things people have done in your account, newest first.
>
> | Updated | Price list updated · Devi Raman · 4 hours ago |
> | Updated | Price list updated · Devi Raman · 4 hours ago |
> | Updated | Price list updated · Devi Raman · 4 hours ago |
> | Updated | Price list updated · Devi Raman · 4 hours ago |
> | Updated | Price list updated · Devi Raman · 4 hours ago |
> | Updated | Price list updated · Devi Raman · 4 hours ago |

Six identical lines. I cannot tell whether that is one price list six times or
six different ones. Two rows further down, a purchase order says
**(PO-000002)** and a supplier bill says **(AM-2231)**, so the screen clearly
CAN name a record. It just does not name mine.

The card's own comment states the job it was failing:

> it arrives already turned into sentences with real names attached, which is
> what a business owner needs to answer **"did someone change my prices, and
> who?"**

Prices are the literal example, and prices were the anonymous rows.

## Why it happened

`subjectFromDiff` reads the name out of the **diff**:

```ts
for (const field of ['name', 'title', 'label', 'orderNumber', 'number', 'email', 'slug']) {
```

So whether a row can be identified is an accident of which fields the writer
happened to record.

| writer         | diff                             | reads as  |
| :------------- | :------------------------------- | :-------- |
| purchase order | `{after: {number: 'PO-000002'}}` | named     |
| price list     | `{after: {status: 'draft'}}`     | anonymous |

Measured across the whole audit table:

```
Variant      404 rows,  404 with no name in the diff
Customer     126 rows,  126
Order         18 rows,   18
PriceList     21 rows,   21
```

Most of the log was anonymous.

**And the identifier was on the row the entire time.** `audit_logs.entity_id`
sits right beside `entity_type`, the route already selects both, and nothing
looked at them ([[feedback_fetched_but_never_rendered]]).

## The fix

New `lib/activity-subjects.ts`: a map from `entity_type` to how that record is
read aloud, resolved **one query per kind on the page** — the same batching the
route already does for the person who did it, never one query per row.

**62 entity types** covered, from `audit_logs` itself rather than from a guess
about what is in there.

Three things it is deliberate about:

- **The record's current name wins over the diff's copy.** The diff can hold the
  value the change itself replaced.
- **Some records genuinely have no name.** A `Cart`, a `CheckoutSession`, a
  `TaxZone`, an `InventoryLevel`, a `SiteVersion`, an `OrderFulfillment`, a
  `VariantImage`. They stay unnamed. Inventing one (an id, a row number) would
  be a placeholder printed as an answer, which is [618](618-my-security-screen-said-a-device-signed-in-from-nowhere.md)
  on the same screen.
- **A failed lookup loses one kind, not the feed.** A deleted record or an
  absent table leaves that kind unnamed. Activity with no names beats no
  activity.

Some are assembled rather than read:

| kind          | reads as                                         |
| :------------ | :----------------------------------------------- |
| Customer      | first + last name, falling back to the address   |
| Variant       | the SKU, falling back to the title               |
| media_asset   | the filename she uploaded, not the storage key   |
| content_entry | the slug, because the headline lives in its JSON |
| Ticket        | the subject, because its number is an integer    |

## Guard

`activity-subjects.test.ts`, **13 tests**.

The map's 62 entries are checked by the **compiler**, not the test: every
delegate and every selected column is the generated Prisma client's, so a wrong
model or a renamed field does not compile. That is the right guard for a table
too long to hold in a head, and it caught nothing on the first run because the
mapping was read off the schema rather than typed from memory.

What the test covers is what the compiler cannot:

```ts
it('asks once per kind, not once per row', …)       // 50 rows → 1 query
it('does not print a blank name as a name', …)      // "Ellen " is worse than the email
it('loses one kind rather than the whole feed when a lookup throws', …)
it('leaves a kind that has no name alone rather than inventing one', …)
```

## Not changed

**Six "Price list updated" rows where nothing actually changed.** All six carry
`{"after": {"status": "draft"}, "before": {"status": "draft"}}` — an update that
updated nothing. Naming the record makes them legible; it does not stop the
writer recording a no-op. Measured tenant-wide: 89 of 126 `Customer` rows and 18
of 164 `Product` rows are the same shape. That is a change to the audit WRITERS
across many modules, and one this issue has not established is wrong: a diff may
record only a slice of the fields, so before == after can mean "something else
changed" rather than "nothing did". It wants its own measurement.

## Still open

The no-op audit rows above.
