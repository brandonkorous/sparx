# 246 — A report could not be opened from the keyboard

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · pane ratings (Customers › Build a report)
**Surface:** Customers › Build a report, sparx console and Piggles
**Filed:** 2026-10-13
**Fixed:** 2026-10-13
**Confirmed by:** sparx as Doty and Piggles as The Marrow Review, 2026-10-13
**Blocked on:** —

## What happened

Build a report lists the reports as cards: eight ready-made ones, and the business's own.
Opening one is the screen's main job. Each card is a `<Card onClick>`: it has no role, it
cannot take focus, and no key opens it. Tabbing through the screen goes from the search
box to the first card's copy button, past the report itself. A person who works from the
keyboard, or with a screen reader, can copy a report but never open one.

Every list row in the workbench does this with `tabIndex={0}`, `role="button"` and Enter
or Space (for example `b2b/accounts-list.tsx`). These cards did not.

## What should have happened

Tab reaches each report, and Enter or Space opens it, as on every other list.

## How to reproduce

1. Customers › Build a report.
2. Press Tab from the search box. Focus skips every report and lands on a copy button.

## Why it matters

The screen's main action is unreachable without a mouse.

## Where it lives

`surfaces/crm/reports-library.tsx` (sparx) and `surfaces/crm/reports-library-row.tsx`
(Piggles).

## The fix

The report card now takes `tabIndex={0}` and `role="button"`, and opens on Enter or Space,
the same as every list row. It returns early when the key event came from a button inside
the card (`event.target !== event.currentTarget`), so Enter on copy or delete does that
and nothing else. sparx `surfaces/crm/reports-library.tsx`; Piggles
`surfaces/crm/reports-library-row.tsx`.

Tests: `surfaces/crm/reports-library-keyboard.test.ts` in both consoles. Red (2 of 2) on
the old files, green on the new.

## Confirmed by

- sparx, Doty: from the report search box, Tab went to "New report", then on to the
  first card, "How far along your customers are" (`role="button"`). Enter opened it.
- Piggles, Rosalind: Tab from the line above the cards went to "New report", then to the
  first card. Enter opened it.

## Rating effect

Build a report, Ease: the main action works without a mouse.
