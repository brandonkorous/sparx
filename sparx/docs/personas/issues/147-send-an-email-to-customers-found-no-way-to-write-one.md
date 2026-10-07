# 147 — "Send an email to customers" found no way to write one

**Status:** open
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 10 (one email to the fleets)
**Surface:** workbench › Search everything; Email › Broadcasts
**Filed:** 2026-10-06
**Fixed:** —
**Confirmed by:** —
**Blocked on:** —

## What happened

Doty wanted to write one email to his fleet customers. In Search everything:

- "email my fleet customers": 24 automations ("Welcome new customers", "Order confirmation: email", …), and no screen to write an email.
- "send an email to customers": two automations, the Contact page and a task.
- "newsletter": "Broadcasts" and "New broadcast".

The screen is called "Broadcasts". Its search words are newsletter, campaign, send, blast and marketing. "Email" is not one of them, and neither is "customers".

## What should have happened

What an owner types to write an email to his customers puts "New broadcast" first.

## Why it matters

The job is one of the first things a business does with an email module. He could only reach it by knowing the word "broadcast" or "newsletter".

## Where it lives

- `sparx/apps/workbench/lib/surfaces/catalog/email.ts`: `keywords` on `email.broadcasts.list`. Piggles: `piggles/apps/workbench/lib/surfaces/catalog/email.ts`.
- The owner-phrase test: `sparx/apps/workbench/components/launcher-owner-phrases.test.ts`.

## The fix

- `sparx/apps/workbench/lib/surfaces/catalog/email.ts`: Broadcasts answers to "email customers", "send an email", "write an email", "announcement" and "mailing". Its `+` and its list button say "Write an email" instead of "New broadcast" ("broadcast" is not an owner's word); a new one opens titled "New email".
- Piggles: the same search words in its catalog. Its button wording is left to its own brand words.
- Not covered: "email my fleet customers". "Fleet" names who gets the email, not the screen, and no screen word can honestly carry it; the audience is chosen inside the email.

Tests, proved red:

- `sparx/apps/workbench/components/launcher-owner-phrases.test.ts`: "send an email to customers" and "email my customers" put Broadcasts first; "write an email" puts the `+` first. Against the committed catalog, 3 fail.
- `piggles/apps/workbench/components/launcher-owner-phrases.test.ts`: the first two. Against its committed catalog, 2 fail.

## Confirmed by

Not yet on screen: the browser lost its tabs while the console recompiled. Tests only so far.

## Rating effect

—
