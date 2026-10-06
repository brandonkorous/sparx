# 026 — Business details said he had no name, and suggested ours

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 2
**Surface:** workbench › Your business › Business details
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** re-ran P01 act 2 — Business name opens as "Gillett Diesel Service Inc.", hint "Bob's Barbers"; saved row matches
**Blocked on:** —

## What happened

Doty typed **Gillett Diesel Service Inc.** as the company name in setup. Business
details, the screen that says "This is what gets printed on invoices, receipts and
purchase orders", showed **Business name** empty, with the grey hint
**WizeWorks**, the name of the company that runs sparx. Its help line said the
name "may differ from your registered company name", and no such field exists.

## What should have happened

The box shows the name his invoices print. The hint is a neutral example.

## Why it matters

Invoices already printed "Gillett Diesel Service Inc." (documents fall back to the
company name), so the screen contradicted the documents. An owner seeing an empty
box types a second name, and a hint naming another real company reads as if that
is the expected answer.

## Where it lives

- `wizeworks/services/api-rest/src/routes/v1/tenant-business.ts`: the view
  returned `businessName: row?.businessName ?? null`, while
  `billing-document-stage-service.ts` prints `businessName ?? tenant.name`.
- `sparx/apps/workbench/surfaces/business-details.tsx`: `placeholder="WizeWorks"`
  and the "registered company name" line. Piggles fixed its own copy of the hint
  in its issue 321; sparx kept it.

## The fix

- The business-details read (GET and the PATCH response) returns
  `businessName ?? tenant.name`: the screen shows what documents print.
- Hint "Bob's Barbers"; help line "The name printed on your invoices, receipts and
  purchase orders."

## Confirmed by

> Re-ran P01 act 2: Business name "Gillett Diesel Service Inc.", not dirty. Filled
> Corporation; 14812 Heritagecrest Way, Bluffdale, UT 84065, United States;
> (801) 571-7780; contact@gillettdiesel.com; registered for sales tax; USD; time
> zone (see 027). Saved: "Business details saved". `tenant_businesses` row holds
> exactly those values, `business_name` = "Gillett Diesel Service Inc.".

Seen while confirming, not filed: after the API changed under the open form, the
pane showed "1 unsaved change" with nothing typed. Only reachable when the server
changes mid-edit; noted in the run log.

Checks: api-rest tsc 0; sparx workbench tsc 0; eslint 0; prettier clean.

## Rating effect

—
