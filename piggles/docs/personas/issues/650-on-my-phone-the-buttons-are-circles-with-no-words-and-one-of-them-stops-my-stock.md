# 650 — On my phone the buttons are circles with no words, and one of them stops my stock

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 225
**Surface:** both consoles, 26 files — toolbars on inventory, staff, commerce and the email editor
**Filed:** 2026-09-18
**Fixed:** 2026-09-18

## What happened

A control is written like this all over both consoles:

```tsx
<Button onClick={togglePaused}>
  <Icon glyph={faPause} className="size-4" aria-hidden />
  <span className="hidden @lg:inline">Pause</span>
</Button>
```

`hidden` is `display: none`. A hidden element is not merely unpainted — it is
**removed from the accessibility tree**. The icon beside it is `aria-hidden`
deliberately, because an icon is decoration.

So below that width the button has **no name at all**. A screen reader announces
"button". A sighted phone user gets a glyph.

On the stock source screen, three sit in a row:

| what it does | what a phone shows |
| :----------- | :----------------- |
| Turn on      | ▶                  |
| Pause        | ⏸                  |
| Sync now     | ⟳                  |

One of those stops a business's stock feed. None of them says so.

## Measured

2026-09-18, across `sparx/apps/workbench` and `piggles/apps/workbench`:

|                                               |        |
| :-------------------------------------------- | -----: |
| labels written as `hidden @X:inline`          | **87** |
| of those, on a control with some other name   |     52 |
| of those, on a control with **no other name** | **35** |

The 35 are all `<Button>` or `<Badge>`, in 26 files.

## The fix

**`ActionLabel`**, in each console's `components/action-label.tsx`. It swaps
`hidden` for `sr-only` / `not-sr-only`:

```tsx
<Button onClick={togglePaused}>
  <Icon glyph={faPause} className="size-4" aria-hidden />
  <ActionLabel>Pause</ActionLabel>
</Button>
```

`sr-only` parks the text off-screen while **leaving it in the tree**.
`not-sr-only` brings it back at the width that has room. The name is never gone,
only unpainted.

Two details worth naming:

- **The breakpoint map is written out, not built from the prop.** Tailwind reads
  source text, so `` `sr-only @${at}:not-sr-only` `` is a class that never gets
  generated.
- **It goes on a `<span>` inside the control, never on the control.**
  `not-sr-only` resets `padding` and `margin` to zero, which argues with `.btn`'s
  own padding — `skip-to-workspace.tsx` already found that the hard way and says
  so in its comment. A span has no padding to lose.

## What this does NOT license

`pane-toolbar-actions.tsx` makes a stronger argument that still stands: two
different actions rendered as two identical glyphs are ambiguous **to a sighted
person too**, and an accessible name does nothing for them. Those belong in the
overflow popover wearing their labels as rows.

`ActionLabel` is for controls that legitimately shrink, and for making the rest
correct today rather than after a thirty-file restructure.

## Guard

**`check:action-labels`** (`scripts/check-action-labels.mjs`), wired to
`pnpm check:action-labels` and the pre-push hook. Today: **52 width-dependent
labels, all named, 1,449 files scanned.**

It checks the call sites AND the component they all rest on. Without the second
half, somebody "simplifying" `ActionLabel` back to `hidden` breaks all 35 at once
and every call site still reads as fixed — this check included, because it would
only ever have looked at the call sites.

Proved red five ways:

1. Put one label back the old way → names the file, the line, the control and
   the fix.
2. Point a scan root at a path that does not exist → exits 1 rather than
   scanning less than it claims. [[feedback_structural_checks_go_blind]]
3. Revert a label but add an `aria-label` → **stays quiet**. A guard that cannot
   tell the two apart would be a guard nobody could leave switched on.
4. Change one breakpoint in the component back to `hidden` → names it.
5. Rewrite the component's class map as `` `sr-only @${from}:not-sr-only` `` →
   names it. Tailwind reads source TEXT, so an interpolated class is one that
   never gets generated: the component would compile, render, and put no class on
   the span at all.

**The component assertion did not work the first time.** It reused the call-site
pattern, which requires `className="…"`, and the component holds its classes as
bare strings in a map — so breaking the component left the check green. Found by
trying to break it, which is the only way that kind of hole ever shows up.
[[feedback_a_test_that_cannot_go_red]]

### It took three passes to count correctly, and that is the story

The first scan walked back to the nearest tag from a hand-written LIST of
component names. It reported `<ToggleGroupItem aria-label="Show the board">` as
nameless, because `ToggleGroupItem` was not on the list. **44 reported, 5 of them
wrong.**

The second used INDENTATION instead — prettier guarantees it, and there is no
name list to fall out of date. Better, but it reported a button that says
"Create" on a phone, because the short form sits on the NEXT line:

```tsx
<span className="hidden @md:inline">Set this build up</span>
<span className="@md:hidden">Create</span>
```

and it reported a `<Badge>` whose whole element is hidden on purpose, with a
comment saying why. **39 reported, 4 of them wrong.**

The third counts a name as present if there is an `aria-label`, a `title`, a
wrapping `Tooltip`, a paired short form, OR the class on the control itself.
**35, and every one verified by opening the file.**

Each wrong count would have caused a real edit: the sweep deletes the span it
replaces, so sweeping the "Create" case would have removed a working short label
from a phone. The rule that caught all three was the same one every time —
**open the file and look.** [[feedback_dont_argue_without_proof]]

### And the sweep broke fifteen files before it worked

The codemod inserted its import after "the last line starting with `import`".
In a file ending on a multi-line `import {\n  a,\n} from './x';`, that line is
the FIRST line of the statement, so the import landed between the braces. Fifteen
syntax errors, caught by `tsc`, not by the script.

Both surface trees were restored from a copy taken before the sweep, the
insertion changed to find the end of the STATEMENT, and the sweep re-run.
Removals diffed against that copy afterwards: **35 lines removed, all of them the
labels; nothing else touched.** [[feedback_codemod_diff_your_own_sweep]]
[[feedback_never_git_checkout_to_undo]]

## Verification

- `tsc` clean on both consoles.
- `eslint` clean on all 28 changed files.
- Tests: sparx **711**, piggles **837**, both unchanged.
- `check:action-labels` ✓, and red on demand.

Not verified on screen: the console's dev server is down for an unrelated reason
(see the session notes), so the narrow-width rendering has not been looked at.
The change is a CSS class swap on 35 spans with no layout side effects — an
absolutely positioned `sr-only` child is not a flex item, so it contributes no
width and no gap — but it has not been seen.
