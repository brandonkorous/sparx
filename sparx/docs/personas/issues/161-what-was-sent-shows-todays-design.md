# 161 — "What was sent" shows today's design, not what went out

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 10 (one email to the fleets)
**Surface:** workbench › Email › Broadcasts › a sent broadcast › "What was sent"
**Filed:** 2026-10-08
**Fixed:** 2026-10-08
**Confirmed by:** P01 on screen, 2026-10-08
**Blocked on:** —

## What happened

"Fleet winter readiness, November 2026" went to 6 fleet customers on October 8. Its
page has a box titled "What was sent", which says "The email as it arrived, shown for
one person out of the audience." The workbench's own note on that box says it "is the
only record of what went out, because the design it was built from can be edited
afterwards".

It is not. The box asks the server for a preview, and the server draws the design
"Fleet winter readiness, November 2026" as it is published today. If Doty edits that
design and publishes it again (to reuse it for December, say), the sent broadcast's
"What was sent" shows the December email as the one that went to the fleets in
October.

## What should have happened

A sent broadcast shows the version of the design that was live when it went out.
sparx keeps every published version of an email (`builder_email_versions`, one row per
publish, append-only, for restore), so the version that went out is on record.

## How to reproduce

1. As Doty, Email › Broadcasts › "Fleet winter readiness, November 2026" (sent).
2. Site › Email designs › "Fleet winter readiness, November 2026": change the headline,
   publish.
3. Back to the broadcast: "What was sent" shows the new headline. Every time.

Not driven on screen: step 2 would change a real sent email's design. Read from the
route: `GET /v1/email/broadcasts/:id/preview` calls `emailService.getPublishedById`,
which returns the current published document, for a sent broadcast as for a draft.

## Why it matters

It says something false about the past. An owner checking what a customer was told
(a price, a date, a promise) reads the wrong email under a heading that says it is the
right one.

## Where it lives

- `wizeworks/services/api-rest/src/routes/v1/email/broadcasts.ts`,
  `GET /v1/email/broadcasts/:id/preview`: `getPublishedById` with no regard to `sentAt`.
- `wizeworks/packages/builder/src/services/email-version-service.ts`: the versions.
- `sparx/apps/workbench/surfaces/email/broadcast-detail.tsx`: the box and its sentence.
- Piggles has the same box over the same route; the route fix covers both.

## Fix

- `emailService.getPublishedAsOf(ctx, id, at)` and its pure core `publishedAsOf`
  (`wizeworks/packages/builder/src/services/email-service.ts`): nothing published
  since the send means today's published email is what went out; published since
  means the newest kept version at or before the send; published since with no
  version kept from before means null.
- `GET /v1/email/broadcasts/:id/preview`: a sent broadcast uses it, and null answers
  `sent-version-not-kept` rather than showing today's email as the sent one.
- The person it is shown for: a sent broadcast is drawn for the first recipient its
  send queue marked sent (`broadcastService.sentRecipient`, from `scheduled_sends`,
  which carries the customer), not for whoever is in the audience today.
- Both consoles: the box reads "What was sent" / "The design as it was when this went
  out, shown for one person it went to." once sent, and "What will be sent" / "The
  email as it will arrive, shown for one person out of the audience." before. The
  same review screen shows scheduled broadcasts, which it called "What was sent" too.
  The not-kept case has its own sentence.

Test, proved red: `email-published-as-of.test.ts` (4). With the old behavior (always
today's published email), the two "published again since" cases fail. Green now.
Typecheck and lint clean in builder, email-platform, api-rest and both consoles.

Found on the way, and fixed: `email_events.customer_id` was empty on all 81 of
Gillett's delivery events. email-worker's `accepted` row and the delivery webhook both
read a `customer_id` send tag, and no sender ever set it. The send queue knows each
recipient's customer, so its sends now carry the tag (`sendVariables` in
`wizeworks/services/api-rest/src/lib/email-dispatch.ts`). That covers every broadcast
and every automation email. Test, proved red: `email-dispatch-variables.test.ts` (3;
with the tag left off, 2 fail).

Still without the tag: emails published straight to `email.send` instead of through
the queue. Four of those reach a customer (invoice mail, CRM engagement mail,
signature requests, shopper sign-in codes); the rest go to staff or suppliers. No
screen reads `email_events.customer_id` today (the engagement joins go by message id),
so nothing an owner sees changes either way.

## Confirmed by

P01 on screen, 2026-10-08: "Fleet winter readiness, November 2026" › "What was sent"
reads "The design as it was when this went out, shown for one person it went to.",
"Shown to seamus.omalley@omalleyranch.test" (the first person it went to), and the
email opens "Hi Seamus,". Not driven on screen: republishing the design to watch the
box keep the October version, since that would change Doty's real sent email's design.

## Rating effect

—
