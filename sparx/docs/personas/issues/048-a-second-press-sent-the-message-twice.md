# 048 — A second press on Send put the same message in his inbox twice

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 2 (the customer side)
**Surface:** tenant site › any silica contact form (here: /contact)
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** re-ran as a customer: Renée Castañeda sent one message and pressed Send again; the boxes had emptied, and `form_submissions` holds one row for her
**Blocked on:** —

## What happened

As Lars Høgberg (a dealer, made up), I sent "Do you have a reman HE351VE in stock
for a 2013 RAM 6.7L? We'll send the core back." The page said "Thank you. Your
message is with us and we will get back to you." under a form still holding every
word, with Send still active. A second press 6 s later stored a second, identical
message. Doty's Form submissions list shows both.

## What should have happened

Once sent, a message cannot be sent again by accident.

## Where it lives

`wizeworks/apps/site/components/silica-behaviors.tsx`, the `contact` action: the
silica `form` behavior settles to success and re-enables Send; nothing cleared the
form, and the endpoint has no duplicate guard.

## The fix

The contact handler resets the form after a successful send, so the required
fields stop a repeat until a new message is written. Not in the silica `form`
behavior, which also runs add-to-cart, where a buy box keeps its choices. The
older page format's form already replaced itself with a thank-you.

Checks: site tsc 0.

## Also seen (fine)

- Seamus O'Malley's and Høgberg's names stored with the apostrophe and the ø.
- His Form submissions screen lists each message as **New**; an email to his
  account address was accepted 45 s after the first message. Its wording is in
  the dev log: **not checked** (act 8).

## Rating effect

—
