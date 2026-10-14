# 976 — Sign-ups and contact messages went nowhere

**Status:** fixed (standing checks)
**Severity:** blocker
**Found by:** P09 · The Marrow Review · standing checks (the reader's side)
**Surface:** every tenant website built from a catalog design: the newsletter sign-up and the Contact page form
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P09 (sign-up); Wildroot Flowers, P-neighbour (contact form)
**Blocked on:** —

## What happened

As a reader with no account, on her mill piece, the footer offered "The Friday letter".
The reader typed an address and pressed **Subscribe**. The form said **"Submitted."**.
Nobody was added to her list.

The design's Contact page form did the same. Wildroot Flowers' contact page said
"Submitted." to every visitor, and its inbox held **no messages, ever**.

## Why

A site form names its job, and the site's `SilicaBehaviors` does the job. It knew
`email-signup`, `newsletter`, `signup`, `contact`, the quote request and add to cart.
The catalog designs name their forms differently:

- the newsletter sign-up is **`subscribe`** (47 designs, including Longform Literary);
- the Contact page form is **`submit`** (196 designs, including the Piggles starter).

An unknown name fell through and returned, so the form settled to success. The server
also refused a contact form not named `contact`. Live pages with the dead contact form
today: Halo & Hem, Juniper Row, Juniper Row Mending, Wildroot Flowers, WizeWorks and
one more.

## The fix

- `apps/site/lib/form-actions.ts` (new): every name a sign-up form goes by (now with
  `subscribe`), every name a contact form goes by (now with `submit`), and the list of
  everything the site does.
- `silica-behaviors.tsx`: uses those lists. A form whose job the site cannot do now
  says **"Sorry, this form is not working yet, so nothing was sent. Please get in touch
  another way."** instead of a false thank-you. The sign-up says **"Thank you. You are
  on the list."** and the contact form **"Thank you. Your message has been sent."**,
  unless the owner wrote her own words.
- `builder-schemas/src/forms-silica.ts`: `CONTACT_FORM_ACTIONS` (`contact`, `submit`),
  which the server checks a submission against. No stored page needed changing.

## Proof

- `form-actions.test.ts` reads every design in `marketplace-catalog` and fails on any
  form action the site does not handle. Without `subscribe` it names
  "subscribe: sparx-artist-media and 46 more"; without `submit`,
  "submit: piggles-starter and 195 more". It also holds the site's contact names equal
  to the server's. `forms-silica.test.ts` accepts a `submit` form (red on the old
  rule). Site 437 and builder-schemas 383 tests pass; both type-check and lint clean.
- On screen, signed out: Clare Whitlock subscribed on the mill piece, read "Thank you.
  You are on the list.", and is in Rosalind's customers with marketing consent from
  "signup". Two visitors wrote to Wildroot Flowers from its Contact page; its inbox
  went from 0 to 2, and the second read "Thank you. Your message has been sent."
