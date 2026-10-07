# 116 — A support request could only name the first 100 customers

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 7 (Dana's turbo request)
**Surface:** workbench › CRM › Requests › a request › Who asked (both consoles)
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

"Who asked" on a support request was a plain dropdown filled from one page of customers (`useCustomers({})`, 100 rows). The deal form had already replaced the same dropdown with a search ("Searches every customer. The list it replaced held the first 100, so a business with more could not link the rest."). The request form was left behind.

Gillett has 36 customers on file, so it worked here. Any business past 100 customers could never name customer 101 onward on a request.

## What should have happened

Any customer can be found and named, by name, email or company.

## Why it matters

A request with nobody on it does not show on the customer's page or their company's Requests, and its reply cannot go to them.

## The fix

`surfaces/crm/ticket-detail.tsx`, both consoles: "Who asked" is the same `CustomerPicker` the deal and invoice forms use; the 100-row list and its query are gone. The customer preset from a customer page or a company page ([112]) still fills it.

Test: the picker is the shared one already covered by `customer-picker-data.test.ts`; the preset is covered by `new-request-params.test.ts` ([112]).

## Confirmed by

On screen, 2026-10-06, as Doty: Salt Lake County › Add a request opened "Open a support request" with Dana Whitcomb-Nguyen shown in the search picker with her company and email. "Unit 34 turbo whines after the Cheetah install", High, labels warranty and turbo, opened as Request #1 with its clock (first reply by Oct 7, 9:02 AM; sorted out by Oct 8, 1:02 PM) and was assigned to Doty.

## Rating effect

—
