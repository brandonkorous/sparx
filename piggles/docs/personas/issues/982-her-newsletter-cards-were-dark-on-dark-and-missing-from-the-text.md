# 982 — Her newsletter's article cards were dark on dark, and missing from the text copy

**Status:** fixed
**Severity:** major
**Found by:** P09 · The Marrow Review · act 10, the campaign preview and the real send
**Surface:** every email with a "Latest …" block (or any picture/title linked as a group); both consoles; every reader
**Filed:** 2026-10-11
**Fixed:** 2026-10-11
**Confirmed by:** P09, 2026-10-11, the sent campaign's preview in dark
**Blocked on:** —

## What happened

In the campaign preview (console in dark), the three pieces under "Hello there." were
near-black text on a black email: "A correction to 'The last mill on the Nene'", "Who
pays when the malting barley fails" and "Price, weather, war". Any reader whose mail app
honors dark mode got the same.

The real send (40 readers, read from the dev outbox, [980](980-dev-email-could-only-be-read-in-a-terminal.md))
had a second fault: the plain-text copy went from "Three pieces from the week: a mill, a
malting contract, and a supplier who feeds a city." straight to "Read the whole archive".
The three pieces were not in it at all.

## Why

A card is a `link` node (one destination for a picture, a title and a summary, issue
965). Two walkers in `wizeworks/packages/email/src/silica` never learned that node:

- `brand-colors.ts` `walkChild` repainted text in columns but not inside a link, so the
  card's words kept the email kit's fixed `#18181b` instead of her ink `#0f0d0c`, and
  the dark-mode rules (which swap her own colors by value) never matched them.
- `to-text.ts` `nodeText` had no `link` case, so a link and everything in it wrote
  nothing.

## The fix

- `brand-colors.ts`: a link's content is repainted like a column's.
- `to-text.ts`: a link writes its words, then `<url>`, as a button does.

Test `src/silica/__tests__/links-in-emails.test.ts`, built from the kit's own
`contentCards`: the card's title and summary take the brand's ink; the text copy holds
both and the link. Each went red with its fix taken out. Email package 282 pass; lint and
typecheck clean.

## Confirmed by

P09 on screen, 2026-10-11, the sent "Friday edition, 10 October" › What was sent, console
in dark: all three titles and summaries read light on dark. The text copy is checked on
her next send.
