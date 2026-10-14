# 980 — Dev email could only be read in a terminal

**Status:** fixed
**Severity:** major
**Found by:** P09 · The Marrow Review · act 10 (confirming her address before the send)
**Surface:** dev tooling: every email sent in dev (both consoles, the sites, the account app)
**Filed:** 2026-10-11
**Fixed:** 2026-10-11
**Confirmed by:** P09, 2026-10-11, her confirm link
**Blocked on:** —

## What happened

Rosalind's address was never confirmed, so Piggles refuses to send her newsletter to a
list. The confirm link went out ("A new link is on its way"), but dev has no real email:
the console provider only printed the email to the event worker's terminal, which a
test run driving the screens cannot read, and kept the last one in that process's memory.
No table holds the body (`email_events` records "accepted" only). So she could not
confirm her address, and nothing behind the confirmation could be tested: the real
newsletter send, unsubscribing from it, invites, resets.

## The fix

- `wizeworks/packages/email/src/providers/dev-outbox.ts` `writeDevOutbox`: every
  console send is also written to `.dev-outbox/` at the repo root (found by walking up
  to `pnpm-workspace.yaml`; `SPARX_DEV_OUTBOX` overrides), as `.json` with its `links`
  and as `.html`. The `.json` keeps the reply-to address and the relay domain too, so an
  email that says "reply to this" can be checked against where a reply goes. Never in
  production; never in a test run unless the test names a
  folder; a failed write never fails the send; the folder keeps the newest 500.
- `providers/console.ts` calls it after the log line.
- `scripts/dev-mail.mjs`, `pnpm dev:mail [address part] [--last] [--count N]`: the
  newest emails with their links, or just the newest link.
- `.dev-outbox/` is in `.gitignore`. Both persona guides say how to read it.

Test `src/__tests__/dev-outbox.test.ts`, 3 pass; the first went red with the write taken
out of the console provider. Email package: 280 tests, lint and typecheck clean; the
suite wrote nothing to the real folder.

## Confirmed by

P09, 2026-10-11, with dev running: the band's link sent "Confirm your piggles email" from
the event worker; `pnpm dev:mail rosalind` listed it at 08:10:37 UTC with its link and
its `.html`; opening the link confirmed her address (`email_verified` true) and the page
read "Your email address is confirmed." One send, one file.
