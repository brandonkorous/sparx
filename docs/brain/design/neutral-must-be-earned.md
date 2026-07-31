---
title: Neutral must be earned
node: design
type: rule
status: active
applies-to: [platform]
sources:
  - DESIGN.md
  - CLAUDE.md
  - packages/brand/src/theme.css
---

**A screen where everything is the same color is a design failure**, at the same severity as a
gradient hero. `color="neutral"` is a decision, not a default — it must clear one of four tests, the
same way a modal must clear the pane test.

**The four earned uses:** the chassis (backgrounds, borders, dividers — which are `base-*`, not
`neutral`) · bare prose you authored yourself · the dismiss half of a decision pair · a genuinely
untyped value. Nothing else. If you typed `neutral` and can't name the test, change it or comment
the reason.

**"Ink" is NOT `text-base-content`.** A silica color class only sets CSS variables (`--btn-fg`,
`--tabs-accent-content`, …) and the component paints itself from them — so its foreground is already
resolved from `color × variant` and stays right on fills, soft tints, outlines and dark islands.
Writing a text color on a component overrides the one thing that knew the answer, and it is a
**RULE #1 re-skin**. For bare prose you usually write nothing at all: `body` sets
`color: var(--color-base-content)`, so it inherits. Write a text color only to deliberately color
bare text (`text-module`, `text-success`). Live example of the habit:
`<TabsTab className="text-base-content">` at 5+ workbench call sites — the fix is `<Tabs color>`,
not hand-painting the tab.

**The operative rule:** if an element distinguishes A from B, its color carries the distinction. Two
badges that mean different things and render the same grey are **wrong, not safe** — the color is
asserting "these are the same." Cover the text; if you can't tell the rows apart, the color was
doing no work.

**Why:** every other rule in the system is a *prohibition* — no eyebrows, no gradients, no shadows,
no soft ink, no decoration, no tint on working surfaces. Monochrome is the single output that
satisfies all of them at once, and nothing anywhere required color to be *present*. So grey is what
gets built, because grey is never cited as a violation. This node is the requirement that was
missing.

**Second cause — the tooling.** `SilicaColor` is `… | (string & {})`, so TypeScript catches nothing
and suggests nothing. Autocomplete shows **8** colors; the workbench registers **27** (10 semantic +
18 module identities, minus the unregistered). The 18 hues that carry identity are invisible to the
editor, so the working palette collapses to the autocomplete list — in which `neutral` is the one
entry that feels un-wrong.

**Footgun — registration drifts per app, and an unregistered color renders grey, silently.**
`color="module-finance"` / `-partner` / `-platform` / `-storefront` are valid `ModuleScope`
identities but are in **no** app's `@plugin` list. And `apps/market` never registers the `module`
bridge at all, so bare `color="module"` is dead there. `workbench` and `web` register an identical
15. Prefer `<ModuleScope module="…">` + `color="module"` over the literal.

**Scope:** all sparx-owned surfaces — `apps/workbench`, `apps/web`, `apps/market`, `apps/admin`,
`apps/b2b-portal`. Console and marketing are ONE system; the only platform-wide variance is
`apps/web`'s `--radius-box: 1.5rem`. See [[two-design-systems]]. Tenant sites (`apps/site`) are the
other system and are not governed here.

## The positive form: colour IS the design

> **Colour is not applied to a design. Colour is how the design says what it means.**

The goal is not "add hue to grey screens." A filled tab says _you are here_ faster than a label can
be read; a solid button says _this is the point_ before the eye reaches the word; a blue badge says
_a person did this_ without a sentence. Used that way colour is **structure**, doing work that
otherwise falls to prose and boxes.

**The test:** _when the colour is right, the explanation becomes redundant._ The rebuilt builder
History rail dropped a whole intro sentence and cut its disclaimer from 19 words to 12 — the filled
tab, the blue badge and the red button were saying it instead. **If adding colour didn't let you
delete any words, you decorated rather than designed.**

Three moves that carried most of that rebuild, all in `DESIGN.md` §5.1:

1. **Selection is a filled shape, not an underline** — `<Tabs variant="pills">`, not the 2px default.
2. **The primary action is solid and coloured** — an `outline` button on the action a surface exists
   for reads as "maybe don't."
3. **If every row says it, it cannot be the headline** — lead with what _differs_ (the timestamp),
   demote the repeat ("You saved") to a small badge. Not a colour fix, but the sharpest one.

**How to apply:** before typing a `color=`, name the axis — **identity** (module hue) · **state**
(`statusTone`) · **consequence** (`primary` / `danger` / dismiss). One axis per element. Then run
the ship gate in `DESIGN.md` §4.

Related: [[color-follows-functionality]], [[status-is-its-own-axis]], [[tokens-are-truth]]
