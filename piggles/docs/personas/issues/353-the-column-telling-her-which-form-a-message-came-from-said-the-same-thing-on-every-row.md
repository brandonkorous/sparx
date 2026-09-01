# 353 — The column telling her which form a message came from said the same thing on every row

**Status:** fixed (label); the naming gap behind it is raised, not closed
**Severity:** minor
**Found by:** P03 · Juniper Row · reading the message a shopper had just sent her, in Form replies
**Surface:** mypiggles › My Site › Form replies (list, filter, detail, CSV export)
**Filed:** 2026-08-31
**Fixed:** 2026-08-31
**Confirmed by:** her own inbox, read back off the screen after the change

## What happened

Marguerite's sizing question arrived in Devi's Form replies inbox, which has six
columns:

| From | **Form** | Site | What they sent | Received | Status |
| ---- | -------- | ---- | -------------- | -------- | ------ |

The Form column read **Untitled form**.

## Why that is not cosmetic

**It reads that way on every row, on every site, and always will.** The value comes
from `FormDefinition.config.name`, snapshotted at submit — and **no surface in the
console can set it.** Measured on the database: **0 of 4 stored submissions carry a
name**, and 0 of 1 form definitions.

So the column that exists to answer "which form did this come from" answered nothing,
for everyone, permanently. On Devi's site that is merely useless — she has one form. On
a business with an enquiry form, a quote request and a newsletter sign-up it is three
identical rows and no way to tell a $4,000 quote request from a mailing-list sign-up.

**The list has no Page column**, so there was nothing else to go on either.

## The answer was already on the row

`form_submissions.page_slug` is populated on **4 of 4** rows. The detail view already
renders it, one line below the Form row, through a helper called `pageLabel` that sits
**directly beneath `formLabel`** in the same file:

```ts
export function formLabel(submission: Pick<FormSubmission, 'formName' | 'formNodeId'>): string {
  if (submission.formName && submission.formName.trim() !== '') return submission.formName.trim();
  return 'Untitled form'; // ← never consults the page
}

export function pageLabel(pageSlug: string | null): string {
  return pageSlug && pageSlug.trim() !== '' ? `/${pageSlug}` : 'Home page';
}
```

Note `formLabel`'s `Pick` takes `formNodeId` and never uses it, and does not take
`pageSlug` at all. [[feedback_fetched_but_never_rendered]] again: the value was in the
component's hand and nothing drew it.

**The platform's own contract says it should have.** `forms-silica.ts`, describing
`SilicaFormConfig.name`:

> Empty ⇒ **the inbox falls back to the page.**

It did not.

## The fix, and why it is two functions rather than one

A naive fallback breaks the detail view, which prints Form and Page next to each other —
it would read `/contact · /contact · Juniper Row`. So the one helper is split by the
question it answers:

- **`formName(submission)`** — what the form is CALLED, or `null`. Used where the page
  is already on screen.
- **`formLabel(submission)`** — how to IDENTIFY it in a column that has one line: the
  name if it has one, else the page.

| Where                         | Before                                 | After                      |
| ----------------------------- | -------------------------------------- | -------------------------- |
| List, Form column             | Untitled form                          | **/contact**               |
| Filter picker                 | Untitled form (1)                      | **/contact (1)**           |
| Detail heading                | Untitled form · /contact · Juniper Row | **/contact · Juniper Row** |
| Detail "Where this came from" | Form: Untitled form<br>Page: /contact  | **Page: /contact**         |
| CSV export                    | Form,Untitled form                     | _(row omitted)_            |

The unnamed Form row is dropped rather than filled, in the two places the Page row sits
right under it — a column of "Untitled form" in a spreadsheet is a column of nothing.

**The filter picker needed a data change**, not just a display one: `submissionForms`
grouped by `formNodeId` and selected only `formName`, so the page was not in the
response at all. It now carries `pageSlug` via the same `_max`, which is exact rather
than arbitrary because a form node lives on exactly one page.

## What is NOT fixed, stated plainly

**Two forms on the same page still collide**, and the real answer to that is a name.
An owner cannot give a form a name: `SilicaFormConfig` carries `name`, `notify`,
`recipients`, `autoresponder` and the rest, `form-definition-service` and
`/v1/builder/forms` implement all of it, and **nothing in the console reaches any of
it.** The service's own comment assumed otherwise — it described a null name as
belonging to "a form whose settings panel was never opened", and there is no settings
panel. That comment is corrected; the missing surface is Brandon's call, not this run's.

## Not pinned by a test, and why

`formLabel` is pure and would take three lines to test. **`@piggles/console` declares no
`test` script and no vitest** — the same gap recorded in [346], and adding a test
framework to an app is a house-convention decision rather than a bug fix. The
api-rest integration suites are excluded under `CI=true`, so an assertion there would
never run in CI or in the pre-push guard, which is the [[feedback_structural_checks_go_blind]]
trap rather than a fix for it.

So this was verified the way the defect was found: on her own screen, reading the column
back after the change.

Recorded as a phase of its own in [FOLLOW_UPS.md](../../FOLLOW_UPS.md) #8 — nothing under
`piggles/` has a test suite at all, apps or packages.

## Confirmed by

Her inbox, read off the DOM: `Form: /contact`. Detail heading `/contact · Juniper Row`
with no duplicate row beneath. `@wizeworks/builder` 141 tests still passing; typecheck
clean on `@piggles/console` and `@wizeworks/builder`; eslint and prettier clean.

## Noticed, not acted on

The `form.submitted` event fired and her seeded **"Handle form submissions"** automation
started — the run row exists, `actions_total: 3` — but it is stuck at `cursor_index: 0`
because the event worker is not running in this environment (the same gap [341] records
for `commerce-indexer`). The message still reached her inbox, which is exactly what the
endpoint's header says it guarantees: _"ALWAYS store the submission row (the durable
inbox is the backbone)"_, with every side effect delegated. Worth re-testing once a
worker runs locally.

## Rating effect

Against `builder.forms` and `builder.submission`, both previously unrated.
