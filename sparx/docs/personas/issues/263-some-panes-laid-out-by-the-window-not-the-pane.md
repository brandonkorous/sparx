# 263 — Some panes laid themselves out by the window's width, not the pane's

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · rating pass (panes at 360px and side by side)
**Surface:** social inbox, social composer, a product's trade prices, boards, the Piggles home and redirect import, sparx console and Piggles
**Filed:** 2026-10-13
**Fixed:** 2026-10-13
**Confirmed by:** sparx as Doty and Piggles as Rosalind (The Marrow Review), 2026-10-16
**Blocked on:** —

## What happened

A pane can be narrow in a wide window: three side by side on a desktop are each a
third of it. Almost every pane lays itself out by its own width (`@container`, rules
like `@xl:`). A few still used the window's width (`sm:`, `md:`, `lg:`), so they chose
the wrong layout whenever the pane and the window differed:

- the social inbox put its thread list and the open thread side by side in a narrow
  pane (window ≥1024px), squeezing both;
- the social composer did the same with its preview column;
- a product's trade prices put three boxes in a row in a pane too narrow for them;
- a board hid its description in a wide pane on a small window, and showed it squeezed
  in a narrow pane on a big one.

Counted on 2026-10-13: sparx 7 files, Piggles 10. The onboarding wizard, the consent box,
the top bar and the all-apps dialog are full-window, so the window's width is right
there.

## What should have happened

A pane's layout follows the pane.

## How to reproduce

1. On a wide window, open the social inbox in one of three side-by-side panes.

## Why it matters

Side-by-side panes are how the console is meant to be used. A pane that lays out for a
width it does not have is cramped exactly when the owner is working across several.

## Where it lives

Listed by the new guard; see the fix.

## The fix

Each window rule became the pane rule of about the same width: `sm:` (40rem) to
`@2xl:` (42rem), `md:` (48rem) to `@3xl:`, `lg:` (64rem) to `@5xl:`. Every one of these
panes sits under the pane's `@container`.

- sparx: `social/inbox.tsx`, `social/composer.tsx`, `commerce/product-trade-pricing.tsx`,
  `crm/dashboards.tsx`.
- Piggles: `home.tsx`, `crm/dashboards-toolbar.tsx`, `cms/redirects-import-preview.tsx`.
- Piggles debt, by the owner's choice for sweeps like this (2026-10-13): `social/inbox.tsx`
  (513 lines), `social/composer.tsx` (2118) and `commerce/product-trade-pricing.tsx`
  (1324) are over the 250-line rule and wait until each is split.

Guard: `scripts/check-pane-breakpoints.mjs` (`pnpm check:pane-breakpoints`, wired into
`.githooks/pre-push`). It fails on a window breakpoint anywhere in a console's
`surfaces/` or `components/` outside the full-window list (onboarding wizard, consent
box, top bar, all-apps dialog), on a debt entry that no longer offends, and when it scans
fewer than 100 files. Red at 7 files, then green over 1,681.

## Confirmed by

In part, sparx as Doty, 2026-10-16: "Monday numbers" in a wide pane on a desktop window
shows its description beside the board picker; in a 360px frame it folds away.
Then the other three, sparx as Doty, 2026-10-16, in a 2558px window. Dragging a tab
to a pane's edge did not split it in the browser tool, so the floating pane was made
narrow by its own right edge: a narrow pane in a wide window, the case that failed.

- **Social inbox.** Gillett has no social account (outside service) and no messages,
  so three test messages were added to him in the database, tagged and removed after
  (connection, page and 3 messages; 0 left). Pane 1544px: the list and the open
  thread side by side. Pane 788px: the list on top (772 × 303), the thread below
  (772 × 208), `flex-direction: column`, while the window is far past `lg`.
- **Social composer** (the same test connection): pane 788px, the form and the
  preview stacked (725 and 725 wide).
- **A product's trade prices** (Bosch Remanufactured Fuel Injector, "One business"):
  pane 788px, the three boxes in a row (233px each, past `@2xl`); pane 584px, one
  column (519px each).

The pane was put back to its old width after.

Then the three Piggles screens, as Rosalind (The Marrow Review), 2026-10-16, in the
same 2558px window. Her workspace is split in two, so the divider between the two
panes made the left pane narrow:

- **Home, "Start something".** Pane 1127px: the three buttons in a row (213, 208 and
  210px wide). Pane 788px: one column, each button 738px wide.
- **A customer dashboard's toolbar** ("Ad sales this season"). It had no description,
  so a test one was set in the database and removed after. Pane 1007px: the
  description shows (377px). Pane 784px: it is hidden. The rule reads the pane's
  inside width, under 768px at that size, so hidden is right.
- **Import old links.** Two test lines typed into the box, never imported, then
  cleared. Pane 1006px: each line a row (old address, new address, what happens).
  Pane 686px: each line a column.

The test tab was closed, the divider put back (1419 against 1420), and the description
set back to empty.

Not checked: the Piggles social inbox, composer and trade prices. They are still
listed as debt (see the fix), so they still follow the window.

## Rating effect

—
