# 732 — Forty-three half-imports

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 259
**Surface:** both consoles — every file that reached for the safe money formatter
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** ESLint clean across both consoles
**Blocked on:** —

## What happened

Linting the currency work turned up six errors in files nothing had touched:

```
surfaces/commerce/discount-words.ts
  17:10  error  'formatAmount' is defined but never used.
```

## Why it matters

The `money-format.ts` sweep put one line at the top of every file that needed
either helper:

```ts
import { formatAmount, formatCentsAmount } from '../../lib/money-format';
```

Most files need one. `@typescript-eslint/no-unused-vars` is an **error** in this
repo, and `pnpm lint` is a pre-push step, so **the tree could not push**.

**MEASURED 2026-09-19: 43 files import both and call one.** Not six. Every one
of them a blocking error, spread across commerce, crm, b2b, inventory,
invoicing, scheduling, staff, partner, builder, dropship and finance, in both
consoles. An earlier pass fixed two of them by hand and left the shape standing.
[[feedback_a_fix_leaves_its_neighbour_behind]]

## What was done

One sweep, counting uses in CODE only — the names appear in comments and in the
module's own header, and neither is a call. It keeps the one that is used and
REFUSES loudly on a file that imports both and calls neither, rather than
guessing. [[feedback_codemod_diff_your_own_sweep]]

43 of 43 resolved to exactly one used name, so nothing was refused and nothing
was guessed.

## Files

- 16 files in `piggles/apps/workbench/surfaces/`
- 27 files in `sparx/apps/workbench/surfaces/`
- plus 5 unused silicaui imports left behind by the 730 edits

## Proof

`npx eslint surfaces components lib` is clean in both consoles. Both typechecks
clean, 1,010 and 880 tests pass.
