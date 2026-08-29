# 321 — The box for her own business name suggested another company's

**Status:** fixed
**Severity:** copy
**Found by:** P03 · Juniper Row · confirming [320] from the Business details screen
**Surface:** mypiggles › Home › Your business › Business details
**Filed:** 2026-08-29
**Fixed:** 2026-08-29
**Confirmed by:** reopened Business details as Devi — the field is an empty box with no company in it

## What happened

Opening **Business details** — the record that says who Devi's business is on
every invoice and receipt she issues — the first field on the screen reads:

> **Business name**
> `WizeWorks`
> The name customers know you by. It may differ from your registered company
> name.

The grey text is a placeholder, not a saved value; the field is genuinely empty.
But the word sitting in the box where her business name goes is the name of the
company that sells her the software.

## What should have happened

The box for her business name suggests her business, or nothing at all. It does
not name a different company — least of all the one billing her.

## How to reproduce

Every time, on any Piggles tenant.

1. ⌘K → "business details" → open **Business details**.
2. Look at the first field.

## Why it matters

**She is being asked what her business is called, and shown someone else's
answer.** The description under the field says "The name customers know you by",
so a reader is being told, in the same breath, that the name customers know her
by is WizeWorks. It is not; her customers know her as Juniper Row.

**This screen is the one where a wrong name costs money.** The panel's own
description says it: _"This is what gets printed on invoices, receipts and
purchase orders."_ A placeholder is not saved, so nothing is actually printed
wrong today — but of every field in the console, this is the one where the
operator's name is worst placed.

**It is the same defect as [317], one layer in.** That one was refusals about her
own web address naming another company's domain. This is her own business name
suggesting another company's name. The pattern is copy written from the
platform's point of view surviving into a screen the tenant operates.

Filed `copy` rather than `major`: nothing is false about a record, no job is
blocked, and no money moves. It is the wrong word in the wrong place.

## Where it lives

[piggles/apps/workbench/surfaces/business-details-columns.tsx](../../../../piggles/apps/workbench/surfaces/business-details-columns.tsx)
line 36:

```tsx
<TextField
  label="Business name"
  value={form.businessName}
  onChange={set('businessName')}
  placeholder="WizeWorks"
  ...
```

It came from the worked example in the sibling file's header comment
([business-details.tsx](../../../../piggles/apps/workbench/surfaces/business-details.tsx)),
which explains the trading-name / registered-name / site-name distinction using
_"a business is `WizeWorks`, registered as `WizeWorks LLC`, and it may run a site
called `sparx`"_. That example names the platform operator and a sparx product,
which is two boundary crossings in one sentence in a Piggles file, and somebody
lifted its first noun into the field.

**Checked for siblings.** Every other mention of `WizeWorks` under
`piggles/apps/workbench` and `piggles/packages` is a code comment, and every
mention under `piggles/apps/web` is the real legal entity where it belongs — the
terms, the data-processing agreement, and the footer's `© WizeWorks LLC`. This
placeholder is the only one that renders as chrome on a tenant's own screen.

## The fix

**Not done yet.**

## Confirmed by

—

## Rating effect

To be recorded against `Your business › Business details` once the pane is
scored — it had not been opened before this run.
