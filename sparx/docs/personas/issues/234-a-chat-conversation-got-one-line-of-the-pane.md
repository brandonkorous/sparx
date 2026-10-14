# 234 — A chat conversation got one line of its own pane

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · pane ratings (Chat › Renée Castañeda)
**Surface:** a conversation in Chat (the inbox thread), sparx console, every width
**Filed:** 2026-10-13
**Fixed:** 2026-10-13
**Confirmed by:** P01, 2026-10-13, Renée's conversation in Doty's workbench (light, dark, 360px)
**Blocked on:** —

## What happened

Doty opened Renée's conversation. The pane showed her card (name, email, phone, 16
orders, $11,412.73 ordered, her last three orders), the "Assigned to" picker and the
reply box. The conversation itself, the thing the pane is for, got a strip one message
line high between them, with its own scroll bar. On a phone the messages were nearly
invisible.

The column gives the customer card all the height it wants first; the messages get
what is left.

## What should have happened

The messages take most of the pane. The customer card is useful, but it gives way:
it is capped and scrolls inside itself when the pane is short.

## How to reproduce

1. Chat › open a conversation with a known customer (one with orders).
2. At an ordinary laptop height, the message list is one line tall.

## Why it matters

Answering a customer means reading what they wrote. A reply typed under a one-line
window is a reply to something Doty could not see.

## Where it lives

`sparx/apps/workbench/surfaces/chat/thread.tsx`: the body column holds `ContextCard`
(no height limit), the assignment row, the message list (`flex-1 min-h-0`, so it can
shrink to nothing) and the composer.

## The fix

The conversation keeps the room; the card gives way.

- Sparx, `surfaces/chat/thread.tsx`: the customer card is capped at 30% of the pane and
  scrolls inside itself; the message list has a floor (`min-h-48`) it never shrinks
  below; the body column scrolls as a whole only when the pane is too short for the
  card, that floor and the reply box together, so the reply box is never cut off.
- Piggles had the same layout in a 714-line `thread.tsx`. To change it there the file
  was split, code moved unchanged, each file under 250 lines and each function under 50:
  `thread-context-card.tsx` (the card and the last orders), `thread-messages.tsx`,
  `thread-composer.tsx`, `thread-moves.ts` (assign, resolve, reopen, spam),
  `thread-toolbar.tsx`, `thread-states.tsx` (none asked for, loading, not loadable), and
  `thread.tsx` itself, now 154 lines. The same three layout changes are in it.

Tests, red first: `thread-room.test.ts` in both consoles (sparx 3, red on the old file;
Piggles 3). Chat tests: sparx 36, Piggles 42 pass. Lint clean. Typecheck not run.

## Confirmed by

P01, 2026-10-13, Renée's conversation: at desktop width both messages, the reply box,
Quick replies and Send are in view in light and dark; at 360px the card is capped, the
message reads in full, and the reply box is reached by scrolling the pane. Before, the
messages were one line.

Piggles, as The Marrow Review (no conversations of its own): the inbox loads after the
split, and a conversation address that does not exist opens on "That conversation is no
longer here". The thread with messages is not checked on screen in Piggles.

## Rating effect

—
