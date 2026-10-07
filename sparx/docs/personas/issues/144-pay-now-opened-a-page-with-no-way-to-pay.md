# 144 — "Pay now" opened a page with no way to pay

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 10 (reading Renée's overdue reminder)
**Surface:** the reminder and overdue emails ("Remind before a wholesale invoice is due", "Invoice reminder", the 7, 14 and 30-day notices); site › account › trade account › Invoices
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01, 2026-10-06
**Blocked on:** —

## What happened

Renée's overdue reminder for 4459 has one button: "Pay now". It opens her trade account's invoice list. That page lists each invoice with its status, amount and "Print or save as PDF". Nothing on it takes a payment, for any business: the site has no way to pay an invoice. Gillett also takes no card payments at all.

A customer who is not a trade account fares worse: the button opens their account home, which has no invoices on it.

The email that sends the invoice in the first place does this right: its button opens the invoice itself, and it never says "Pay".

## What should have happened

The button says what it does: it opens the invoice they are being reminded about, as the first email does. With no page to open, there is no button. The words around it already say to pay.

## Why it matters

A buyer chasing a late bill clicks "Pay now" and finds no way to pay. The email promises something the site does not do.

## Where it lives

- `wizeworks/packages/builder-schemas/src/default-emails-silica.ts` and `default-emails.ts`: `button('Pay now' | 'Pay invoice', '{{invoice.payUrl}}')` in five templates.
- `wizeworks/services/api-rest/src/lib/email-data.ts`, `resolveInvoice`: `payUrl` is the invoice LIST for a trade account, the account home for anyone else.
- The page the first email links to: `documentViewPath` in `@wizeworks/crm`.

## For Brandon

Paying an invoice online from the email is new capability. sparx can make a card payment link for one invoice (Invoicing › a document › payment link, by hand), but no email carries one and the site has no pay page. Not built here.

## The fix

- `builder-schemas/src/default-emails-silica.ts`: the five reminders end with `seeYourInvoice()`, a "See your invoice" button to `{{invoice.viewUrl}}`, in a block that drops when there is no such page. The legacy trees in `default-emails.ts` match.
- `builder-schemas/src/binding.ts`, `email-tokens.ts`: the email field picker offers "Invoice link" (`viewUrl`) and no longer offers "Pay link".
- `api-rest/src/lib/email-data.ts`: `invoice.viewUrl` is the invoice's own page (`documentViewPath`, the page the first email links to), empty for anyone but a trade account. `payUrl` keeps resolving as before for an email a business wrote with it.
- `builder/src/services/email-default-refresh.ts` and `email-default-history.json`: the five outgoing bodies recorded, so every untouched copy is refreshed to the new one and an edited copy is left alone. Gillett's five copies were refreshed when the API restarted.

Tests, proved red:

- `builder-schemas/src/invoice-reminder-button.test.ts` (10): each of the five has no "Pay now", no `payUrl`, and exactly one button, "See your invoice", gated on `invoice.viewUrl`. Against the old templates all 10 fail.
- `api-rest/test/integration/email-data.test.ts`, "links a trade invoice to its own page, and a retail one to nothing". With `viewUrl` empty it fails.

## Confirmed by

On screen, 2026-10-06: Renée's 4459 reminder, rebuilt with the sending code, ends "See your invoice <…/account/b2b/8aa59a36-…/documents/c2a50228-…>". Signed in as Renée on Gillett's site, that address opens Invoice 4459: "Overdue", Wasatch Front's billing address, $2,119.60 balance due, his Net 30 words and the note, with "Print or save as PDF".

## Rating effect

—
