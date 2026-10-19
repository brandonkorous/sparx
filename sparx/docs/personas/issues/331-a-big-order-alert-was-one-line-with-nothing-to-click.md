# 331 — A big-order alert was one line with nothing to click

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 9, the owner's side of a stranger's order
**Surface:** Doty's inbox: the "High-value order", "Return requested" and "Running low" alerts, on every business; `wizeworks/packages/automation-actions`, `wizeworks/packages/email-sends`, `wizeworks/services/api-rest`
**Filed:** 2026-10-18
**Fixed:** 2026-10-18
**Confirmed by:** sparx as a stranger and as Doty (Gillett Diesel Service), 2026-10-18
**Blocked on:** —

## What happened

A stranger paid $640.96. Doty's email said "High-value order: O-000034 · $640.96" in the subject, and the body said the same line again. Nothing named who bought it, and there was nothing to click. To act on it, she had to open the console and search for the number.

## What should have happened

The alert says who and how much, and opens the order in one click.

## How to reproduce

1. Pay for an order of $500 or more on a selling site.
2. Read the owner's "High-value order" email.

## Why it matters

An alert exists to save the owner a trip. One she has to look up by hand is a notice, not a shortcut.

## Where it lives

- `wizeworks/packages/automation-actions/src/email.ts` (`recordLinkFor`, `email.send_internal`), `seeds/commerce.ts`.
- `wizeworks/packages/email-sends/src/index.ts` (`RecordLink` on a raw body).
- `wizeworks/services/api-rest/src/lib/record-link.ts` (new: `addRecordLink`, `withLinkLine`), `email-dispatch.ts`.

## The fix

- **The record.** A staff alert now says which record it is about: the return, else the order, the stock item, the deal or the customer, from the trigger's own fields.
- **The link.** The dispatcher turns that into "Open the order" on the business's own console (`appLink` with the tenant's brand), as a link in the HTML and a line in the text. Only the dispatcher knows the console's address; the alert code does not. An alert with no HTML gets its text as the first paragraph, so the link is never alone.
- **The words.** "Dana Whitcomb (dana.whitcomb.buyer@example.com) paid $640.96 for order O-000035." A return: "… asked to send back something from order O-000013 and would like a refund." Low stock: "… is down to 3 on hand."
- **Every business gets it.** The seed changed, and the platform's own seed sync replaces any rule a business never edited (`system-seed-sync.ts`, rule 3). Run for Gillett: all three rules took the new words.

Tests: `automation-actions` `record-link.test.ts` (4: an order, a return before its order, a stock item by its own parameter, none); api-rest `record-link.test.ts` (3: the line added under a text-only alert, an alert's own HTML kept and escaped, text escaped). automation-actions 23 files / 148 + 4. Not checked: the automation-actions and api-rest `tsc` (out of memory on this machine).

## Confirmed by

2026-10-18. A second stranger order, O-000035, paid in a headless browser with Stripe's test card. Doty's email: "Dana Whitcomb (dana.whitcomb.buyer@example.com) paid $640.96 for order O-000035." with "Open the order: http://localhost:3011/commerce/orders/814a45a8-…". The link opened O-000035 in the console.

## Rating effect

None to the scores.
