# 777 — A letterhead could not belong to one business

**Status:** fixed and applied
**Severity:** high
**Found by:** P03 · Juniper Row · act 275
**Surface:** `billing_document_templates` — the print template a customer's copy is drawn on
**Filed:** 2026-09-22
**Applied:** 2026-09-24, by Brandon, with `prisma migrate deploy`

## What happened

Pressing **New template** on Juniper Row, with the business picker on "Juniper
Row", produced:

```
Could not save this template
This template could not be saved. It may be a temporary problem. Try again in a moment.
```

It is not a temporary problem, and it is not the console's.

## Why

`20261221000000_billing_documents_per_site` gave print templates a
`property_id`, so that a tenant running two unrelated businesses could give each
one its own letterhead. It then set out to remove the tenant-wide unique index
that had been in force since `20260806000000_invoicing_templates`, and wrote:

```sql
DROP INDEX IF EXISTS "billing_document_templates_one_default_per_tenant";
```

**That name has never existed.** The index is called
`billing_document_templates_tenant_default_unique`. `IF EXISTS` reported success
over a statement that removed nothing, and both indexes have been live together
ever since:

```
billing_document_templates_tenant_default_unique      UNIQUE (tenant_id)               WHERE is_default
billing_document_templates_one_default_per_property   UNIQUE (tenant_id, property_id)  WHERE is_default
```

Two UNIQUEs on the same rows means the STRICTER one decides. "One default per
site" has in practice been "one default for the whole account" the entire time —
the exact outcome the earlier migration was written to end.

The service had never read the column at all. `listOrSeed`, `create`,
`setDefault` and `getActivePublishedTree` were all tenant-wide, so even with the
index gone the tier would not have worked. The column, the new index, the Prisma
comment ("One default per SITE … per-tenant meant picking a letterhead for one
business silently re-branded the other's invoices") and the migration's own prose
all described a thing the code did not do.
[[feedback_a_fix_leaves_its_neighbour_behind]]

## Proof

Measured against the live database, through the console's own API, as Devi:

```
POST /v1/invoicing/templates  { name, propertyId: <Juniper Row> }   → 500
POST /v1/invoicing/templates  { name, propertyId: null }            → 201, isDefault false
```

The only difference is whether the new row is the first in its tier and therefore
asks to be that tier's default. The identical call succeeds where a default
already exists and fails where one has to be created.

The integration suite says the same thing:

```
Unique constraint failed
  billing-template-service.ts:193  tx.billingDocumentTemplate.create
5 of 6 assertions in billing-template-per-site.test.ts fail
```

## What was done

**The migration.** `20270515000000_a_letterhead_belongs_to_one_business` drops the
index by its real name. Nothing is backfilled: every existing row carries
`property_id` NULL (the shared tier), which is the correct reading of a template
authored when there was one business.

**The service learned the column.** `billingTemplateService` now takes the site
it is acting for on every read and write, with two tiers and one rule:

- a list scoped to a business shows ITS letterheads plus the shared ones, never
  another business's;
- the lazy seed lands in the SHARED tier and happens once per account, not once
  per site — seven sites would otherwise mint seven "Default"s, each claiming to
  be in force;
- promoting a letterhead stands down the previous default IN ITS OWN TIER only;
- `getActivePublishedTree` resolves the DOCUMENT'S site first, then the shared
  one. A site whose own default is unpublished gets the built-in renderer rather
  than falling through to the other business's paper, which is precisely how the
  wrong name reaches a demand for money.

**The render path carries the document's site, not the viewer's.** An invoice
raised by the trade counter prints on the trade counter's paper whichever site
its owner is looking at the console from — and the emailed copy and the PDF are
rendered by a worker with no viewer at all. `renderTenantInvoiceHtml` takes the
site; `documents.ts` reads it off the document row alongside the frozen issuer,
in the same query.

**A guard, so a misspelled drop cannot print success again.**
`scripts/check-migration-drops.mjs` fails a NEW migration whose
`DROP … IF EXISTS <name>` names something no migration up to that point creates.
It was proved red twice: once on this migration's own prose (which is how it
learned to strip SQL comments) and once on a one-letter typo in the real
statement.

## Two more the guard found

Scanning all 331 migrations turned up one other `IF EXISTS` drop naming something
that was never created:

```
20260902000000_inventory_unify_stock   DROP CONSTRAINT IF EXISTS inventory_source_links_location_id_fkey
```

Nothing exists under that name in the live database either, so unlike the
template index there is nothing it failed to remove. Left as it is: an applied
migration's body is checksummed on every deployed database and cannot be edited.
The guard only inspects migrations added against the base ref, for the same
reason `check-migration-order.mjs` does.

## Files

- `wizeworks/packages/db/prisma/migrations/20270515000000_a_letterhead_belongs_to_one_business/migration.sql` (new)
- `scripts/check-migration-drops.mjs` (new) + `package.json`
- `wizeworks/packages/crm/src/services/billing-template-service.ts`
- `wizeworks/packages/crm-schemas/src/invoicing.ts`
- `wizeworks/packages/crm/src/mcp/invoicing-tools.ts`
- `wizeworks/services/api-rest/src/routes/v1/invoicing/templates.ts`
- `wizeworks/services/api-rest/src/routes/v1/invoicing/documents.ts`
- `wizeworks/services/api-rest/src/lib/invoice-render.ts`
- `wizeworks/packages/crm/test/integration/billing-template-per-site.test.ts` (new)

## Applied

Brandon stopped the dev stack on 2026-09-24 and the migration went in through
`prisma migrate deploy`. `billing_document_templates` now carries exactly one
unique index, the per-site one:

```
billing_document_templates_one_default_per_property
billing_document_templates_pkey
billing_document_templates_tenant_id_idx
billing_document_templates_tenant_property_idx
```

`billing_document_templates_tenant_default_unique` is gone. The suite that could
not pass before now does, **6 of 6**, including the assertion this issue is
about: a site's own default and the shared default living side by side.

One of the six was red for a reason of its own, and it was the test's fault
rather than the code's. It read:

```ts
expect(fromTrade.map((t) => t.propertyId).sort()).toEqual([null, trade]);
```

`Array.sort()` compares values as text, a uuid is hexadecimal, and every
hexadecimal string sorts before the word `"null"`. So that assertion could never
have passed whatever the database did. It compares the pair as a set now.
