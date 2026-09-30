# 695 — The rule was enforced on half the platform

**Status:** partly fixed — the check now covers both consoles; 21 existing breaches are pinned
**Severity:** major
**Found by:** P03 · Juniper Row · act 243, as a side effect of [693](693-the-only-thing-on-the-menu-with-no-name.md)
**Surface:** sparx — every pane toolbar
**Filed:** 2026-09-19
**Fixed:** 2026-09-19 (the check; one of the 22 call sites)
**Confirmed by:** the check, proved red on both of its failure modes
**Blocked on:** —

## What happened

Fixing the unnamed cancel button in the run pane meant reading `PaneToolbar`. Its
header carries a rule in capitals:

> **THE HARD RULE: A COMMIT ACTION IS ALWAYS `primary`**
> Save, Create, Publish, Send — anything that commits what a person just did —
> goes in `primary` and nowhere else. `controls` RELOCATES, and a Save moved into
> a popover is the one control they came to press, hidden behind a tap they have
> no reason to expect. **The failure is invisible at the width anyone develops at.**
> Enforced by `piggles/scripts/check-toolbar-primary.mjs`, in the pre-push guard.

That paragraph appears, word for word, in **both** consoles' copies of the file.

The check computed its scan root from its own location:

```js
const SURFACES = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'apps',
  'workbench',
  'surfaces'
);
```

It lives in `piggles/scripts/`. So it could only ever see `piggles/apps/workbench`.
`sparx/apps/workbench/components/pane-toolbar.tsx` says it is enforced by a
script that cannot see it.

## The measurement

Pointed at sparx, unchanged otherwise:

```
22 surfaces put a commit action in a RELOCATABLE toolbar slot
   9 of them a plain  Save
     others: Save draft · Save changes · Send it · Send to the warehouse ·
             Publish ×2 · Add a customer · Add a category · Add a list ·
             Add what it fits · Add a repeating cost
```

Nine Save buttons that fold into a popover below 672px, in the console whose own
file says that must never happen.

## Why it stayed hidden

Three things had to line up, and they did:

1. The check passed, every time, on every push.
2. The rule was written down, in the right file, in capitals.
3. The failure is invisible at desktop width, which is where it is developed.

[[feedback_structural_checks_go_blind]] says a check that hard-codes a path is one
refactor away from scanning NOTHING and printing green. This is the variant that
is harder to notice: it scanned **half**, and printed green. The denominator was
never printed, so there was no number to look wrong.

The check now prints it: `1189 files across 2 consoles`.

## What was changed

- `TREES` is explicit and asserted to exist; the root is resolved from the repo,
  not counted in `..`s. Scanning zero files is now a failure.
- The scan covers both consoles.
- `check:piggles-toolbars` renamed `check:toolbars`, because the old name was part
  of how this hid.
- Both `pane-toolbar.tsx` headers now say the check scans both, and say that it
  did not until today.
- `sparx/.../finance/categories.tsx` fixed: **Add a category** lifted from
  `controls` to `primary`, mirroring the piggles twin exactly.

## The 21 that were pinned, and why they were not fixed

They are in `SPARX_DEBT`, a named and dated list in the check. The check fails on
any offender NOT on that list, in either console, and **also** fails when a listed
file stops offending and the line is left behind — so the list can only shrink,
and cannot rot into a list of things that used to be true.

They were not fixed in this pass because each is a layout-entangled lift: the
commit button sits inside `{canEdit ? (<>…</>) : null}` inside a
`<div className="ml-auto flex flex-wrap …">`, and moving it changes how the bar
lays out. This session could not open the sparx console to look at the result —
its tenants have no data for these panes and signing in is not something it may
do — and **a Save toolbar broken by a blind refactor is worse than one that
folds.** [[feedback_codemod_diff_your_own_sweep]]

Each one has a compliant piggles twin, so the reference for every fix already
exists. That is the note for whoever picks them up.

## Proved red

Both failure modes, restoring after each:

```
stale entry           (1, '1 file(s) in SPARX_DEBT no longer offend. Delete them from the')
new piggles offender  (1, '1 surface(s) put a commit action in a RELOCATABLE toolbar slot.')
restored              (0, 'check:toolbars - 1189 files across 2 consoles; …')
```

[[feedback_a_test_that_cannot_go_red]]
