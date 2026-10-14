# 983 — Opening the link unsubscribed a reader, and Gmail's Unsubscribe button failed

**Status:** fixed
**Severity:** blocker
**Found by:** P09 · The Marrow Review · standing checks, "an unsubscribe link that works from a real send"
**Surface:** the unsubscribe page and the one-click Unsubscribe in mail apps; every business on both brands
**Filed:** 2026-10-11
**Fixed:** 2026-10-11
**Confirmed by:** P09, 2026-10-11, Alasdair Macleod's link
**Blocked on:** —

## What happened

Owen Pryce opened the Unsubscribe link in the Friday edition. Before he pressed anything,
the page said "You're unsubscribed. You will no longer receive marketing emails at this
address." It named no business and no address.

Then, as a mail app does: a one-click POST with `List-Unsubscribe=One-Click`, form
encoded. api-rest answered **415 Unsupported Media Type**.

## Why it matters

- Mail scanners (work mail filters, link checkers) open every link in an email. Opening
  must not unsubscribe, or readers are taken off lists they never left. RFC 8058 makes the
  GET safe and the POST the act for exactly this reason.
- Gmail, Apple Mail and Yahoo put their own Unsubscribe button beside the sender. It
  sends that form post, and every one failed, so a reader who pressed it stayed on the
  list. Gmail and Yahoo require that button to work for bulk senders.
- A reader on several lists could not tell which one, or which of their addresses.

## The fix

- `api-rest/src/routes/v1/public/email-unsubscribe.ts`: GET shows a page that ASKS
  ("Stop these emails?"), naming the business and the address, with one Unsubscribe
  button (a POST). POST unsubscribes and says so, by name. A form-encoded parser is added
  in this route's scope only, so mail apps' one-click posts are read. A link that cannot be
  read says so ("This link didn't work") and writes nothing.
- `api-rest/src/lib/unsubscribe-page.ts`: the three pages, escaped.

Tests: `email-unsubscribe.test.ts` (route, 4: open asks and writes nothing; a bad link
writes nothing; the button and the RFC 8058 post both unsubscribe), red with the old
GET-writes and with the parser removed (3 failed); `unsubscribe-page.test.ts` (3). Lint
clean.

## Confirmed by

P09 on screen, 2026-10-11: Alasdair Macleod's link opened "Stop these emails? You will no
longer get newsletters and offers from The Marrow Review at alasdair.macleod@example.net",
and nothing was written; pressing Unsubscribe read "You're unsubscribed" and his address
is on her do-not-email list. The RFC 8058 post (curl, form encoded) now answers 200. Clare
Whitlock was unsubscribed by that curl check, not by her own choice; recorded here.
