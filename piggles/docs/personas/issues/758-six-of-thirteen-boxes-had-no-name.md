# 758 — Six of the thirteen boxes on her customer's record had no name

**Status:** fixed, one upstream ask left
**Severity:** major
**Found by:** P03 · Juniper Row · act 268
**Surface:** both consoles — every form with a sized control
**Filed:** 2026-09-20
**Fixed:** 2026-09-20
**Confirmed by:** P03, measured in the DOM before and after
**Blocked on:** the TagInput half, which is silicaui's

## What happened

Loom and Larder's own record, on the terms she buys on:

```
Discount
[ 0              ] %
```

The word above the box is a `<FieldLabel>`. It is not attached to the box.

**MEASURED in the DOM, 2026-09-20: 6 of 13 controls on that one screen had no
accessible name at all** — no `aria-label`, no `aria-labelledby`, no
`<label for>`. The only clue left is a placeholder, and a placeholder disappears
the moment she types into it.
[[feedback_the_empty_control_is_the_untested_one]]

## Why: a div for sizing

Base UI wires a label to its control by id, and only when the control is the
DIRECT child of `<FieldControl render={…}>`:

```tsx
<FieldControl render={<Input … />} />                                  // id set, label attached
<FieldControl render={<div className="max-w-40"><Input … /></div>} />  // nothing at all
```

The wrapper is there to make the box narrow. Nothing warns, nothing fails, and
the screen looks identical. The two controls on the very same form that DID
carry an `aria-label` were fine, which is why nobody had noticed the other two.
[[feedback_absent_behaves_like_fine]]

**33 controls across both consoles**, on credit limits, discounts, gift card
amounts, deal likelihood, a supplier's markup and every date field the CMS
builds from a schema.

## What was done

Two shapes, two fixes, and one is better than the other:

**14 flattened.** Where the wrapper was only sizing around one control, the class
moved onto the control and the wrapper went:

```tsx
<FieldControl render={<Input className="max-w-[16rem]" … />} />
```

That restores the Field's own wiring and leaves no second copy of the label to
drift out of step with the first.
[[feedback_silicaui_single_point_of_change]]

**17 named.** Where the wrapper holds something else too (a `%` or a `$` beside
the box), it has to stay, so the control carries its own `aria-label` matching
the label above. Two of those have a computed label, so the name is computed the
same way rather than written out twice.

**2 were already named** by `NumberField`'s own `label` prop, which silica
documents as exactly that. They were left alone.

**`check:field-names`** reads every `render={…}` in both consoles and fails on a
wrapped control with no name. It is wired into `pre-push`.

## The upstream half

`TagInput` puts `aria-label` on its own root `<div class="tag-input">` and not on
the `<input>` inside it. MEASURED on the same screen: the Labels box carries
`aria-label="Labels"` in the source, and the input a person types into has no
name at all. The div is not focusable, so the name never reaches anybody.

That is silicaui's to fix (`@wizeworks/silicaui-react` 0.56.0, an external
package), and it affects **8 call sites** across the two consoles. Recorded here
rather than worked around, because a workaround at 8 call sites is 8 more places
to unpick when the component is fixed.

## Files

- 19 surfaces across `piggles/apps/workbench` and `sparx/apps/workbench`
- `scripts/check-field-names.mjs` — new
- `package.json`, `.githooks/pre-push` — wired

## Proof

**Before and after, in the DOM of one screen:** 6 unnamed of 13, then 1 unnamed
of 13, and that one is the TagInput above. The other three the check now reports
as nameless are hidden helper inputs with `tabindex="-1"`, which is correct.

The codemod was **diffed against a copy taken before it ran**, not against the
working tree, because the tree already held 500 changed files. That diff found a
real bug in my own sweep: on a control written as ONE line, the new attribute
landed after the closing `/>` and became stray text in the JSX. ESLint caught it
too, but the diff is what made it findable rather than puzzling.
[[feedback_codemod_diff_your_own_sweep]]

`check:field-names` proved red two ways: the Discount name taken back off (names
the file and line), and a scan root renamed (refuses rather than passing over
nothing). It prints 87 wrapped controls of 1,518 render props across 1,472 files
rather than a bare tick. [[feedback_structural_checks_go_blind]]
