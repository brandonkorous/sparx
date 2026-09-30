# 747 — The Wholesale badge was grey, because the color it named does not exist

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 267
**Surface:** mypiggles + sparx workbench — every screen showing a contact's relationship
**Filed:** 2026-09-20
**Fixed:** 2026-09-20
**Confirmed by:** P03, on the till and in the Customers list
**Blocked on:** —

## What it looked like

Having given the till's picker a **Wholesale** mark in
[746](746-the-till-calls-a-shopper-by-her-employers-name.md), the rows came back
like this:

```
Orla Beaumont   [Wholesale]     <- grey
Tamsin Vale     [Wholesale]     <- grey
Priya Nandakumar
```

Grey, on a screen whose whole job is telling those two apart from the third. The
badge was already grey in the Customers list and had been since it was written.

## Why

`customerTypeMeta` answers what a relationship is called and what color it
wears:

```ts
case 'b2b':
  return { label: 'Wholesale', color: 'b2b', … };
case 'retail':
  return { label: 'Individual', color: 'commerce', … };
```

Neither name is registered. The app's own plugin block registers **39 colors**
in piggles and 28 in sparx, and the module hues are all spelled with a prefix:

```css
@plugin '@wizeworks/silicaui' {
  colors: primary, secondary, accent, neutral, …, module-commerce, module-b2b, …;
}
```

Silica emits one class per registered name. `color="b2b"` becomes `badge-b2b`,
no such class exists, and the component falls back to its default. Nothing
throws, nothing logs, the badge renders — it just renders grey.
[[feedback_absent_behaves_like_fine]]

**And the compiler cannot see it.** `SilicaColor` is `… | (string & {})`, so
every string is assignable and the editor offers about eight of the real names.
A typo, a stale name and a module hue missing its prefix are all the same to
TypeScript. RULE #4 calls this out in its own words: "Pick from the real list,
not the one the editor offers."

## What it cost

Two badges that mean opposite things rendered identically. `Individual` and
`Wholesale` were the same grey — which is RULE #4's exact complaint, arrived at
without anybody choosing grey once.

## What was done

**The two names got their prefix**, `module-b2b` and `module-commerce`, so both
badges wear their module's hue in both consoles.

**`AxisMeta.color` now says what it is**, because a plain `string` is what let
this through and the type cannot be narrowed — silica's own union accepts
anything.

**`check:colors` reads the registered list out of each app's CSS** and fails on
any literal that is not in it. It is wired into `pre-push`, and it scans both
consoles with each app's OWN list, since a name legal in piggles is not
automatically legal in sparx.

**MEASURED 2026-09-20:** 7,218 color literals across 2,626 files. Exactly two
per console named a color that does not exist, both of them in this one
function — so the console is otherwise clean, and the one place that drifted is
the one that labels who gets agreed prices.

## What this check can and cannot see

Two unambiguous shapes: `color="x"` on a JSX element and `color: 'x'` in an
object literal. It cannot see a name assembled at runtime (`` `module-${slug}` ``),
which is the sanctioned way to write a dynamic hue and is deliberately out of
scope. A literal that is not a silica color goes in `ALLOWED` with its reason
rather than being guessed at. `ALLOWED` is empty today.
[[feedback_codemod_diff_your_own_sweep]]

## Files

- `piggles/apps/workbench/surfaces/crm/customer-display.ts` — the two names
- `sparx/apps/workbench/surfaces/crm/customers-data.ts` — the same two
- `scripts/check-color-names.mjs` — new
- `package.json`, `.githooks/pre-push` — wired

## Proof

The check was proved red by putting `color: 'b2b'` back: **1 offender**, named
with its file and line and the reason. Green again on restore, with the
denominator printed rather than a bare tick.
[[feedback_structural_checks_go_blind]]

On screen: the Wholesale badge now carries the b2b hue on the till's picker and
in the Customers list, in both themes.
