# 244 — On a phone, the "New" button hid in the menu

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · pane ratings (Customers › Build a report, at 360px and in a narrow pane)
**Surface:** 11 lists across both consoles (below)
**Filed:** 2026-10-13
**Fixed:** 2026-10-13
**Confirmed by:** sparx as Doty and Piggles as The Marrow Review, 2026-10-13
**Blocked on:** —

## What happened

Doty opened Build a report on a phone-width pane. The bar over the list showed one
thing: a ≡ menu. "New report", the button the screen exists for, was inside that menu,
next to "Copy a link to this". Nothing on the screen said it was there.

A pane bar has slots. `primary` always shows. `controls` and `refresh` fold into the ≡
menu when the pane is narrow. Build a report put "New report" in `refresh`, beside the
refresh icon. Every other list puts its New or Add button in `primary`.

The root check `scripts/check-toolbar-primary.mjs` exists to stop this, and it missed
it twice over: it read only the `controls` slot, never `refresh`, and it counted "Save",
"Create" and "Add …" as the buttons that must not fold, but not "New …".

With the check widened, it found 11 lists:

| Button          | Slot     | File                                 |
| --------------- | -------- | ------------------------------------ |
| New report      | refresh  | sparx `crm/reports-library.tsx`      |
| Add a report    | refresh  | sparx `crm/dashboards.tsx`           |
| New instruction | controls | sparx `ai/prompts-list.tsx`          |
| New campaign    | controls | sparx `funnels/campaigns.tsx`        |
| New shelf       | controls | sparx `inventory/bins-list.tsx`      |
| New supplier    | controls | sparx `inventory/suppliers-list.tsx` |
| New bootcamp    | controls | sparx `partner/bootcamps-list.tsx`   |
| New post        | controls | sparx `social/calendar.tsx`          |
| New post        | controls | sparx `social/queue.tsx`             |
| New report      | controls | Piggles `crm/reports-library.tsx`    |
| New shelf       | controls | Piggles `inventory/bins-list.tsx`    |

## What should have happened

The New button shows at every width, in `primary`, as on every other list.

## How to reproduce

1. Open Customers › Build a report in a pane under 672px wide (or on a phone).
2. Look for "New report". It is only inside the ≡ menu.

## Why it matters

On a phone the owner sees a list and no way to add to it. The control they came for is
behind a tap they have no reason to expect.

## Where it lives

The eleven files above, and `scripts/check-toolbar-primary.mjs`.

## The fix

The New or Add button moved to `primary` in all eleven lists. Any `controls` slot left
empty was removed.

The check is the single point of change: `scripts/check-toolbar-primary.mjs` now also reads
the `refresh` slot, and counts a list's own "New …" button as one that must not fold (on
buttons in a folding slot only; as a `label:` value it is often the one object a
`primary` button and an empty state share, which gave five false alarms in the first
cut). It went red with 11 lists, and is green now: "1399 files across 2 consoles … except
18 pinned in SPARX_DEBT."

Two Piggles files were over the size rule and were split: `crm/reports-library.tsx`
(its surface function was 173 lines) and `inventory/bins-list.tsx` (477 lines).

## Confirmed by

- sparx Build a report at 519px (light and dark) and 360px: "New report" in the bar, not
  in the menu.
- sparx at 360px: Suppliers ("+" with its label hidden by `ActionLabel`), Campaigns ("New
  campaign"), Posts ("New post"), and a new board "Monday numbers" ("Add a report").
- Piggles, in a narrow pane: Build a report ("New report") and Shelves ("New shelf").

## Rating effect

Ease on all eleven lists at phone width: the create button is on screen.
