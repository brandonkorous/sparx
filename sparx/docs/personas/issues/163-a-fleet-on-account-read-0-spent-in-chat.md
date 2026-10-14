# 163 — A fleet on account read "$0.00 spent" in chat

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 10 (a customer message answered)
**Surface:** workbench › Messages › a conversation (the customer panel); same in Piggles
**Filed:** 2026-10-08
**Fixed:** 2026-10-08
**Confirmed by:** P01 on screen, 2026-10-08 (sparx)
**Blocked on:** —

## What happened

Renée Castañeda (Wasatch Front Utility Contractors) started a chat. The panel above it
read "5 orders · $0.00 spent", directly above her orders of $1,380.65, $1,208.00 and
$15.20.

## What should have happened

What her orders come to, and what she has paid. She is on Net 30 and has paid nothing
yet, so "$0.00" is true of the money, and reads as "she has bought nothing".

## How to reproduce

1. As Renée, signed in on the site, start a chat.
2. As Doty, open it in Messages. Every time, for anybody who pays on account or on
   collection.

## Why it matters

A fleet worth $7,357.45 in orders looks like a stranger with no history, at the moment
Doty decides how to answer them.

## Where it lives

- `wizeworks/services/api-rest/src/lib/chat/customer-context.ts`: sent only
  `lifetimeValue` (`customers.total_spent`, money received).
- `sparx/apps/workbench/surfaces/chat/thread.tsx`, and Piggles': labeled it "spent".
- The customer page fixed this same thing in persona issue 113 (`totalOrdered`, "Their
  orders come to" beside "Paid for orders"); the chat panel was left behind.

## Fix

The chat context also sends `orderedValue` (`customers.total_ordered`). The panel in
both consoles reads "5 orders · $7,357.45 ordered · $0.00 paid, $7,357.45 still to come"
(the ordered figure only when there are orders; the "still to come" only when money is
owed). Copy and one more column read; no automated test. Lint clean; typecheck not
run (Brandon: leave it for now).

## Confirmed by

P01 on screen, 2026-10-08 (sparx): Messages › Renée Castañeda's new chat read "5
orders · $7,357.45 ordered · $0.00 paid, $7,357.45 still to come · Last ordered 2d
ago", above her last three orders ($1,380.65, $1,208.00, $15.20).

Not checked on screen: the Piggles console.

## Rating effect

—
