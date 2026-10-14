# 162 — A contact-form message could only be answered outside sparx

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 10 (a customer message answered)
**Surface:** workbench › Site › Form submissions › a submission; Messages › Inbox
**Filed:** 2026-10-08
**Fixed:** 2026-10-08
**Confirmed by:** P01 on screen, 2026-10-08 (sparx)
**Blocked on:** —

## What happened

Doty went to answer his customers' messages. Messages › Inbox said "No conversations
yet" and spoke only of the chat box. The four messages his customers sent through the
site's contact form on October 1 (Seamus O'Malley, Lars Høgberg twice, Renée
Castañeda), all still "New", were under Site › Form submissions, and nothing in
Messages pointed there.

Opening Lars's "Do you have a reman HE351VE in stock for a 2013 RAM 6.7L?" offered no
Reply. The only way to answer was the address chip, a `mailto:` link: it opens Doty's
own mail program, and the answer is not kept anywhere in sparx.

All three senders are already Gillett customers, under the same email addresses. The
submissions are linked to none of them (`customer_id` is empty on all four), and the
page never shows a customer even when one is linked: the field is fetched and never
drawn.

## What should have happened

A message from a known customer leads to that customer, and Doty can answer it from
sparx so the answer is kept on their record. sparx already has that answer: the
customer page's "Email" (Send an email), which sends through Gillett's sending address
and files the message on the customer's timeline. The inbox Doty checks for messages
tells him when contact-form messages are waiting.

## How to reproduce

1. As Doty, open Messages. "No conversations yet."
2. Site › Form submissions › Lars Høgberg. No Reply; the address is `mailto:`.
3. Every time.

## Why it matters

A customer's question sits where the owner does not look, and the one way to answer it
leaves no record. Doty's story names it: customers "message me with questions", and "I
also remember every customer".

## Where it lives

- `sparx/apps/workbench/surfaces/builder/submission-detail.tsx`, `IdentityCard`: the
  `mailto:` chip; `customerId` (on `form-submissions-data.ts`) never used.
- `wizeworks/services/api-rest/src/routes/v1/forms.ts`, `GET /v1/forms/submissions/:id`:
  returns the row only.
- `sparx/apps/workbench/surfaces/chat/inbox.tsx`: chat only.
- `sparx/apps/workbench/surfaces/crm/engagement-composer.tsx`: the existing Note /
  Email / Log a call composer (`POST /v1/crm/engagement/emails`).
- Piggles: the same `mailto:` chip in its `submission-detail.tsx`, and the same
  chat-only inbox.

## Fix

- `customerService.findByEmail` (`wizeworks/packages/crm/src/services/customer-service.ts`):
  the customer with this address on the message's site, else in the site-less tier
  (where fleet contacts made through a wholesale account live). The same two reads the
  chat panel makes (`lib/chat/customer-context.ts`), read only: a typed address is a
  hint, not proof, so it is never written as a link.
- `GET /v1/forms/submissions/:id` returns `customer` (`id`, `name`, `email`, `match`:
  `record` when the submission is linked, `email` when the address matched), or null
  without CRM or a match.
- Both consoles, `submission-detail.tsx`: an "Answer {name}" card under what they sent,
  in the CRM color, with the customer page's own composer (Note, Email, Log a call;
  Email leads, via a new `lead` prop on `EngagementComposer`) and "Open {name}". An
  email sent there goes out from the business and is filed on the customer's timeline.
  The address chip (`mailto:`) stays for a sender nobody knows.
- Both consoles, Messages › Inbox: "N messages from your contact form are waiting",
  with "Open form messages", whenever there are new ones.

No automated test: the match is two database reads, proved on screen below, and the
screens are composition of existing parts. Lint clean in api-rest and both consoles.
Typecheck not run this time (Brandon: leave it for now).

## Confirmed by

P01 on screen, 2026-10-08 (sparx): Messages › Inbox read "3 messages from your contact
form are waiting"; "Open form messages" opened Form submissions. Lars Høgberg's
message showed "Answer Lars Høgberg", "lars.hogberg@hogbergdiesel.test belongs to your
customer Lars Høgberg." Email › subject "Reman HE351VE for your 2013 RAM 6.7L", sent:
"Email sent". In the database: an `email.sent` activity on Lars's record at 04:57:30,
and the provider's `accepted` row for lars.hogberg@hogbergdiesel.test the same second.

Not checked on screen: the Piggles console.

## Rating effect

—
