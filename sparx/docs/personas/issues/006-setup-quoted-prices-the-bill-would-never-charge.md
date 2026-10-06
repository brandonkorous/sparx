# 006 — Setup quoted prices the bill would never charge

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 1
**Surface:** workbench › first-run setup › Your story menus, and the module rules behind the plan
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** re-ran P01 act 1 — menus and plan agree; Finance reads "Included with Commerce & B2B · Fleet"
**Blocked on:** —

## What happened

Two wrong prices in setup, both about modules that come free with Commerce or B2B.

1. With Commerce and B2B already in Doty's story, the menu offered **always know
   what's in stock — Inventory · +$29**. He picked it and the plan beside it said
   **Inventory: Included**, total unchanged. The menu quoted $29 for something
   that costs nothing.
2. The server's billing rules make **Finance** free with Commerce or B2B too
   (`BUNDLED_FREE` in `@wizeworks/modules`). The workbench keeps its own copy of
   those rules for the browser, and the copy had only Invoicing and Inventory. So
   anywhere setup priced Finance it would have said $29 a month for a module the
   bill charges $0 for.

## What should have happened

Every price on the setup screen is the price the bill will charge.

## Why it matters

Wrong money on the screen where a business decides what to buy. A $29 that is
not real makes the plan look more expensive than it is, and the next screen
contradicting it makes neither number believable.

## Where it lives

- `surfaces/onboarding/story/story-menus.tsx` `ClauseOption`: priced from
  `on[cl.mod]` alone, blind to "free because Commerce is on".
- `lib/onboarding/modules.ts` `BUNDLED_FREE`: a hand copy of the server graph,
  missing `finance`. The server graph imports the database client, so the browser
  cannot import it directly.

## The fix

- The menu prices through `moduleBilled` / `moduleLock`, the same functions the
  plan uses, so the two cannot disagree: "included", "free", or "+$N".
- `finance: ['commerce', 'b2b']` added to the workbench copy.
- New guard `scripts/check-module-graph.mjs` (`pnpm check:module-graph`), wired
  into the pre-push hook and CI: it reads `BUNDLED_FREE` and `REQUIRES` from the
  server package and from the workbench copy and fails on any difference. Proved
  red by deleting the `finance` line from the copy (exit 1, prints both maps),
  green restored.
- Piggles checked: it has no price rules in setup (one flat price), so nothing to
  mirror there.

Follow-up worth doing when `pnpm install` can run: give `@wizeworks/modules` a
pure, database-free `graph` subpath and import it in the workbench, so there is no
copy to guard at all.

## Confirmed by

> Re-ran P01 act 1 in step-by-step: Invoicing, Inventory and Finance all read
> "Included with … Commerce … B2B · Fleet"; the story menus read "included" for
> them and "+$29" / "+$49" only for real add-ons; plan total $440 matches the
> hand sum against `MODULE_MONTHLY_CENTS`.

## Rating effect

Recorded with the first-run setup row.
