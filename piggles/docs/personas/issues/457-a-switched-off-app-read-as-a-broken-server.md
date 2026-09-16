# 457 — A switched-off app read as a broken server

**Status:** fixed
**Severity:** major
**Found by:** opening Broadcasts on a tenant whose Email module was off, while porting [456]
**Surface:** every pane in both consoles
**Filed:** 2026-09-09

## What was wrong

Open a pane whose module the account does not have and the console said:

> **Could not load your broadcasts**
> Something went wrong reaching the server. Anything already sent is unaffected —
> try again in a moment.
> **[ Try again ]**

Nothing had gone wrong. Nothing was unreachable. The account had Email switched
off, api-rest answered its module gate with a 404 exactly as designed, and the
console turned that into an accusation against the server plus a button that
could not work on the first press or the hundredth.

That is [[feedback_one_outcome_two_causes]] in its purest form: two causes with
different fixes wearing one screen, and the printed remedy pointing at the one
that cannot help.

## The fourth state

A pane's content had three shapes and each had one home — `PaneWaiting`,
`ListEmptyState`, `PaneLoadError`. A surface belonging to an inactive module is
none of them, so it fell into the third by default.

`PaneLoadError` could not have saved it either. `MODULE_DISABLED` _is_ a 404, so
even a pane that passed its error along would have read "that broadcast is no
longer here" — a deleted record, which is a different lie.

## Why the mount, and not 300 panes

There are 215 surfaces in one console and 99 in the other, and **166 of them
never passed their query error to `PaneLoadError` at all** — which is how this
reached "server unreachable" rather than even the missing-record wording. Asking
per-pane means 166 chances to have already forgotten.

It is also knowable EARLIER than the request. The shell already holds the module
list that builds the rail, so `SurfaceBody` — the one place a pane becomes a
surface — asks before anything is fetched:

```ts
if (!surfaceIsVisible(definition, reachable, known)) {
  return <SurfaceModuleOff definition={definition} />;
}
```

`surfaceIsVisible` is the predicate the rail and the command palette already
share. Its own comment asks for this: _"The rail and the command palette
disagreeing about what exists is a bug this file already exists to prevent
once."_ A third caller, not a third rule.

It returns true while the module list is still loading, so a slow shell shows the
surface rather than accusing somebody of switching it off.

## The gate that existed and failed open

`deep-link-resolve.ts` already had a module gate for exactly this — and it let me
straight through, which is how the pane opened at all. `gateSurface` answered
`'ok'` while the module list was loading, and on a cold arrival it always is:

```ts
const states = modules.states;
if (!states) return 'ok'; // ← the link opens; nothing ever re-asks
```

The file's own doc claims the opposite — _"Returns `nothing` while the gates are
still loading, so the caller simply tries again on the next attach rather than
deciding on incomplete facts."_ True of the SITE gate, never true of this one.
It now returns `'not-yet'` and the resolver waits; the arrival effect already
depends on the module list, so it re-runs the moment it lands. The `ModuleGate`
comment that said `null` is "treated as allow" was refreshed to match.

Both fixes are worth having. The deep-link gate stops the pane opening; the mount
is the last line and re-evaluates, which is what makes an ALREADY-OPEN pane
change over the moment somebody switches a module off in another window.

## The two brands do not say the same thing

sparx sells modules one at a time, so a switched-off module is a choice somebody
made and the way back is a button to Settings → Modules.

**Piggles is one plan with everything in it.** Its All apps dialog says so —
_"every one of them is included and working; this only decides which are on your
rail, and it never changes what you pay"_ — and `platform.settings.modules` is
hidden under this brand deliberately, because Piggles has no module pricing.
Measured before writing the copy: **0 of 8 Piggles businesses have a single
module off.**

So under Piggles this is not a setting anybody chose; it is an account missing
something it is entitled to. It says so, and offers no button — sending her to
All apps would move a rail preference and leave the pane exactly as broken.

The first draft got this wrong. It shipped a **Turn it back on** button pointing
at `platform.settings.modules` on both consoles; on Piggles that surface does not
exist, so the button opened `link-not-found`. Caught by clicking it.

## Where the code changed

- `{piggles,sparx}/apps/workbench/components/surface-module-off.tsx` (NEW)
- `{piggles,sparx}/apps/workbench/components/surface-mount.tsx` — the gate
- `{piggles,sparx}/apps/workbench/lib/workbench/deep-link-resolve.ts` — `not-yet`
- Tests: `{piggles,sparx}/…/lib/surfaces/module-gate.test.ts` (6 each),
  `{piggles,sparx}/…/lib/workbench/deep-link-gate.test.ts` (6 each)

## Verification

Driven on the sparx console. Two panes open on Email, module switched off from
the Modules screen in the same window, and the pane changed over live without a
reload:

> **Email is switched off**
> Nothing you made in Email is lost — it is hidden until you turn it back on.
> Everything else in your account is unaffected. **[ Turn it back on ]**

| removing                               | reddens                                       |
| -------------------------------------- | --------------------------------------------- |
| the loading guard in `moduleIsVisible` | 1 — "shows the surface rather than accusing…" |
| the unknown-module rule                | 1, and only that                              |
| `not-yet` in `gateSurface`             | 1 — `expected "nothing", received "open"`     |

piggles console 202 across 23 files, sparx console 127 across 15. Typecheck,
lint and prettier clean.

**The Piggles wording has not been seen on screen.** No Piggles business has a
module off, the brand offers no switch to create one, and the direct database
write that would have staged it was refused. It is typechecked and its predicate
is tested; the pixels are unconfirmed, and the sparx state above is the same
component.

## Rating effect

Not a pane — chrome shared by all of them. Recorded in the
[rating.md](../rating.md) preamble alongside the status bar and the menus.
