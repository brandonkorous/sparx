# 985 — Her campaign had no working unsubscribe, and never counted one

**Status:** fixed; the link and the count confirmed
**Severity:** blocker
**Found by:** P09 · The Marrow Review · act 10, after three readers unsubscribed (issue 983)
**Surface:** every campaign drawn once for all its readers (both consoles), the unsubscribe page, a campaign's Unsubscribed figure
**Filed:** 2026-10-11
**Fixed:** 2026-10-11
**Confirmed by:** P09 on screen, 2026-10-11 (each reader's own link; Unsubscribed 1)
**Blocked on:** seeing the List-Unsubscribe header on her next send

## What happened

Three of Rosalind's readers left her list from her Friday edition: Owen, Clare
and Alasdair. Her campaign still said **Unsubscribed 0**.

Reading why found the worse half. A campaign has two ways to be drawn:

- **Personalized** (it says each reader's name): drawn once per reader when it
  goes out. Its Unsubscribe link was each reader's own, and the mail headers
  carried it, so Gmail and Apple Mail showed their own Unsubscribe button.
- **Everything else**: drawn ONCE, when it is queued, and the same copy sent to
  every reader. Its Unsubscribe link was **`#`**, a link to nowhere, and there
  was no List-Unsubscribe header. A reader could not leave the list from it,
  and the mail apps had no button to offer.

A marketing email with no working way to unsubscribe breaks the US anti-spam
law (CAN-SPAM) and the UK's (PECR), and Gmail and Yahoo now require the one-click
header from bulk senders.

The figure: our own unsubscribe link wrote the do-not-email row and nothing
else. The campaign's Unsubscribed count reads `unsubscribed` events, and the
link never wrote one, so it read 0 whatever happened.

A third fault turned up while proving it. The headers were built and then thrown
away. `email-worker`'s raw schema had no `headers` field, so zod stripped them;
`SendableEmail` had no field to hold them; and neither Mailgun nor Postal wrote
one. `EmailSendPayload` even documented "Optional header bag (X-Tenant-Id,
List-Unsubscribe, etc.)" that nothing carried. So no campaign, personalized or
not, ever went out with the List-Unsubscribe header.

## Why

- `broadcast-service.ts` (email-platform) drew the render-once body with
  `compliance.unsubscribeUrl: '#'`, because one body cannot hold every reader's
  own link.
- `email-dispatch.ts` (api-rest) sent that body as drawn, with no headers.
- The unsubscribe token held only the business and the address, so the
  unsubscribe page could not know which campaign a reader came from.

## The fix

- `@wizeworks/email` exports `UNSUBSCRIBE_PLACEHOLDER`. The render-once body is
  drawn with it in place of `#`.
- `email-dispatch.ts` swaps the placeholder, in the HTML and the plain text, for
  each reader's own link at the moment it sends to that reader
  (`personalizeUnsubscribe`), and adds the List-Unsubscribe and
  List-Unsubscribe-Post headers.
- The token can carry the campaign:
  `base64url(tenant:email)~base64url(campaign).hmac`. It is signed, so a link
  cannot be edited to count against a campaign the reader never got. A token
  without a campaign, the older form, still works.
- Both ways of drawing a campaign put the campaign in the link.
- The headers now travel the whole way: `RawEmailSendPayload.headers`
  (events), `RawSendSchema.headers` in the worker (a header name must be a
  token and a value one line, so nothing can start a second header),
  `SendableEmail.headers`, Mailgun as `h:` fields, Postal in its headers. The
  console provider records them, and `pnpm dev:mail` prints the List-Unsubscribe
  line.
- The unsubscribe page (`email-unsubscribe.ts`), after the do-not-email row,
  writes one `unsubscribed` event for that reader on that campaign, looked up
  under the token's own business. A second press does not count twice. A count
  that fails is logged and the reader still leaves the list.

## Proof

- `src/lib/email-unsubscribe.test.ts` (api-rest), 5 cases: a token with a
  campaign round-trips; an edited campaign fails the signature; the older form
  still verifies; the placeholder is swapped in HTML and text with the headers
  added; a body with no placeholder is left alone.
- `email-unsubscribe.test.ts` (the route), 6 cases, including the campaign count
  and no second count.
- `render-silica-email.test.ts`: the render-once body carries the placeholder
  and never `#`. 7 pass.
- Red: each fix undone fails its test. api-rest lib tests pass, 413.
- Lint is clean in api-rest, email and email-platform. email and email-platform
  typecheck clean. The api-rest typecheck runs out of memory, so api-rest is not
  typechecked.
- `email-worker/src/__tests__/raw-headers.test.ts`, 3 cases: the schema keeps the
  headers; a value with a line break is refused; `handle` hands them to the
  provider. `mailgun.test.ts`: each header goes out as an `h:` field. Red: the
  worker without the field fails 1 of 3; Mailgun without the loop fails 1.
  Restored, email 288 and email-worker 93 pass; email and events typecheck clean.
  email-worker's typecheck fails only in `send-as.test.ts`, another session's
  work in progress (sparx 171).
- On screen, 2026-10-11. Rosalind designed a "Correction notice" with no name in
  it (which found issue 988), and sent it: "Send this to 37 people?", sent
  11:08 AM British Summer Time. All 37 copies are in the dev outbox. Each has
  that reader's own link, with the campaign signed into it, in the HTML and the
  text; no `#` and no placeholder is left. Jonah Feld opened his link, read
  "Stop these emails?", pressed Unsubscribe and read "You're unsubscribed". The
  campaign's How it did then read **Unsubscribed 1, Opted out from this**.
- Not yet seen: the header itself, because that send went out before the header
  fix. Her next campaign's copy in `pnpm dev:mail` should show an
  "unsubscribe header" line.
