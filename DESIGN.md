# sparx design language

**Version:** 2.2
**Author:** Brandon Korous
**Last Updated:** 2026-07-31

## Scope: one system

This governs **every surface sparx owns** — `apps/workbench`, `apps/web`, `apps/market`, and
`apps/admin` / `apps/b2b-portal` when they are built. Console and marketing are **not two systems.**
They are one platform, one brand, one component library, one palette.

All of them import the same [`@sparx/brand/theme.css`](packages/brand/src/theme.css) and register
the same colors through the same `@plugin '@wizeworks/silicaui'`. The **only** sanctioned variance is
a **token override**, and there is currently exactly one in the whole platform:

```css
/* apps/web/app/globals.css — softer corners on marketing surfaces. */
@theme {
  --radius-box: 1.5rem; /* brand default is 0.5rem */
}
```

That is the model. **Variance is a token, never a fork of the language.** If a surface needs to
differ, it overrides a token in its own `globals.css` and everything downstream re-shapes from one
edit. It does not get its own rules, its own doc, or its own palette.

**The one real boundary is ownership, not app.** `apps/site` + `packages/surface-compile` render
**tenant** sites: `--st-*` tokens, `.st-c-*` classes, `@sparx/site-ui`, per-tenant themeable. That is
a different system because it wears **someone else's brand** — not because marketing and console are
different. Rules here do not cross that line; see §7.2.

---

## The contract: silicaui owns the design

> **silicaui is the design system. Feature code chooses; it does not paint.**

**The promise this buys:** change `--color-primary` once and every button, badge, tab, link and
focus ring across the workbench, web and market follows. Change `--radius-field` and every input and
button re-shapes. Add a hover treatment to `.btn` and every button on the platform gets it — with no
hunting, no sweep, no migration PR.

**That propagation is the entire reason silicaui exists, and it holds only where nothing downstream
has painted over it.** Every local override is a place the change stops — and a place someone has to
find later.

| Layer                          | Owns                      | Examples                                                                                                        |
| ------------------------------ | ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `@sparx/brand/theme.css`       | the **values**            | every hex, light + dark; `--radius-box/field/selector`; the 18 module hues                                      |
| `@wizeworks/silicaui` (plugin) | the **appearance**        | fill, ink, border, radius, hover/focus/active/disabled, loading, `soft`/`outline`/`ghost`/`dash`, sizes, shapes |
| `@wizeworks/silicaui-react`    | **behavior + a11y**       | Base UI selection state, roving focus, portals, moving indicators                                               |
| `@sparx/ui`                    | sparx **compositions**    | the shell, `PageHeader`, `ListToolbar`, `Stat`, `statusTone`                                                    |
| **your feature code**          | the **decision + layout** | which `color × variant × size × shape` — and Tailwind for layout, spacing, sizing, positioning                  |

**Feature code owns no appearance at all.** Its entire color job is picking the right prop, which is
what §2 is for. Everything else on this page exists to make that pick obvious — not to give you
things to hand-build.

### The one test

> **If someone changes a token or a component tomorrow, does this screen follow — with zero edits
> here?**

If the answer is no, you have painted something you shouldn't have. Each of these stops propagation
dead, and each is a future hunt:

- `style={{ … }}` — banned outright, no exceptions without approval
- a hardcoded hex
- a background fill paired with a foreground color on a control (you have rebuilt `<Button>`)
- hand-rolled `hover:` / `focus:` / `disabled:` classes
- a bespoke `<span>` dressed up as a badge
- a text color written onto a component (§3.1)
- re-declaring radius as a t-shirt scale instead of by role (`rounded-field` / `-box` / `-selector`)

### When silica's default is genuinely wrong, fix it upstream

**This is not "never improve."** It is "improve in the one place that propagates." The ladder, in
order:

1. **Is there a prop?** `color × variant × size × shape`. Almost always yes — check
   `get_component` before assuming there isn't.
2. **Is it a value?** Change the token in `@sparx/brand/theme.css`. One edit, whole platform, light
   and dark together.
3. **Is it a missing variant or component?** Add it to silicaui, or add a composition to
   `@sparx/ui`. Now every future surface gets it for free.
4. **Only then** — with Brandon's approval — a local exception, documented as debt at the call site.

**A local override is not a fix. It is a deferred fix, and everyone else pays the interest.** The
receipt is `<TabsTab className="text-base-content">`, now at 5+ call sites (§3.1). One question asked
of silica once would have cost a single edit. Instead it is five, and a sixth is being written
somewhere right now.

---

The rest of this document exists because of one recurring, shipped failure: **surfaces come out
grey.** Tabs neutral, badges neutral, buttons neutral, and a screen full of information wearing
exactly one color. That is a _choosing_ failure, not a painting failure — which is why the fix is
this document and not more CSS.

But the goal here isn't "add color to grey screens." It is this:

> **Color is not applied to a design. Color is how the design says what it means.**

A filled tab says _you are here_ faster than a label can be read. A solid red button says _this one
is the point_ before the eye reaches the word. A blue badge says _a person did this_ without a
sentence explaining it. Used that way, color is not decoration on top of an interface — it is
**structure**, doing work that would otherwise fall to prose and boxes.

The test that follows from it, and the one this whole document is really about: **when the color is
right, the explanation becomes redundant.** §5 is a real before/after of exactly that.

---

## 0. The law

> **Neutral is not the default. Neutral has to be earned.**

Same shape as the pane-vs-modal rule in [apps/workbench/CLAUDE.md](apps/workbench/CLAUDE.md) — the
cheap option is not the free option. `color="neutral"` is a **decision**, and like a modal it must
clear a named test (§3). If you cannot name which test it clears, it is the wrong color.

### 0.1 Why grey keeps happening — read this before you argue with §2

The rulebook is **a list of prohibitions**, and grey is the only thing that satisfies all of them at
once:

| Rule                                                               | Pushes toward                   |
| ------------------------------------------------------------------ | ------------------------------- |
| RULE #2 — no eyebrows, no editorial formatting                     | remove the colored label        |
| RULE #3 — soft/muted is a deliberate signal                        | remove the tint                 |
| No gradients                                                       | remove the fill                 |
| No shadows                                                         | remove the elevation            |
| No decoration — "the only banned use of color is decoration"       | remove the color                |
| "A single-module working surface keeps its cards neutral entirely" | remove the hue                  |
| No re-skinning a control                                           | don't touch the control's color |

Follow every one to the letter and you land on monochrome. **Not one rule in the set ever required
color to be present.** So the risk-free output — the one that will never be cited as a violation —
is grey, and that is what keeps getting built.

Grey is not neutral-in-the-sense-of-safe. **A screen where everything is the same color is a screen
that says nothing.** It is a design failure with the same weight as a gradient hero, and it gets
called out with the same force.

### 0.2 The second reason: the tooling shows you 8 of 27 colors

`SilicaColor` is:

```ts
type SilicaColor =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | (string & {});
```

That `(string & {})` means **TypeScript will never catch a wrong color and never suggest a right
one.** Autocomplete surfaces eight names. The platform has **twenty-seven** (§1), and the eighteen
module hues — the ones that carry identity, the whole point of the system — are invisible to the
editor. So the working palette collapses to the autocomplete list, in which `neutral` is the one
entry that feels like it can't be wrong.

**It can be wrong. It usually is.** Open §1 and pick from the real list.

---

## 1. The palette

Materialized from [packages/brand/src/theme.css](packages/brand/src/theme.css) so you never have to
open it to build on-system.

### 1.1 Semantic colors — 10

| Color       | Light       | Dark        | What it means. Not what it looks like.                                                                             |
| ----------- | ----------- | ----------- | ------------------------------------------------------------------------------------------------------------------ |
| `primary`   | `#e04631`   | `#e04631`   | sparx ember. The brand, and **the affirmative action** — the button that does the thing this surface exists to do. |
| `secondary` | `#0c1433`   | `#36d2ff`   | Deep navy / cyan. The second voice: a supporting action, an alternate path.                                        |
| `accent`    | `#36d2ff`   | `#4fe0ff`   | Bright cyan. Draws the eye to one thing. Rationed — one per surface.                                               |
| `neutral`   | `#282e39`   | `#323844`   | See §3. Four legitimate uses; everything else is a bug.                                                            |
| `info`      | `#147ea3`   | `#38bdf8`   | "Here is a fact you need." Private, safe, reversible things live here.                                             |
| `success`   | `#16865a`   | `#22c55e`   | "This is done / live / healthy."                                                                                   |
| `warning`   | `#f2b84b`   | `#fbbf24`   | "This has scope beyond where you're standing." Not an error — a consequence.                                       |
| `error`     | `#b42318`   | `#ef4444`   | "Something is broken." A report, past tense.                                                                       |
| `danger`    | `#b42318`   | `#ef4444`   | The `statusTone()` vocabulary. "This action destroys or publishes." Future tense.                                  |
| `module`    | _repointed_ | _repointed_ | The active module's hue. Resolved from the nearest `data-module` ancestor.                                         |

`error` vs `danger` share a hex and differ in tense: **`error` describes, `danger` warns.** A failed
job is `error`. The button that would delete it is `danger`.

### 1.2 Module hues — 18 identities

| Module      | Hue              |     | Module        | Hue               |     | Module       | Hue                                   |
| ----------- | ---------------- | --- | ------------- | ----------------- | --- | ------------ | ------------------------------------- |
| `builder`   | `#4f46e5` indigo |     | `inventory`   | `#f59e0b` amber   |     | `seo`        | `#eab308` yellow                      |
| `commerce`  | `#f97316` orange |     | `chat`        | `#7c3aed` violet  |     | `social`     | `#2563eb` blue                        |
| `cms`       | `#14b8a6` teal   |     | `scheduling`  | `#e11d48` rose    |     | `finance`    | `#16a34a` green                       |
| `crm`       | `#06b6d4` cyan   |     | `automations` | `#c026d3` fuchsia |     | `partner`    | `#6d28d9` violet-700                  |
| `email`     | `#0ea5e9` sky    |     | `ai`          | `#db2777` pink    |     | `storefront` | `#4f46e5` _(legacy alias of builder)_ |
| `b2b`       | `#475569` slate  |     | `dropship`    | `#10b981` emerald |     | `platform`   | → `primary`                           |
| `invoicing` | `#4d7c0f` lime   |     |               |                   |     |              |                                       |

**That is 27 colors.** The builder History rail that prompted this document used **two**.

### 1.3 Footgun: registration drifts per app, and unregistered colors render grey

`color="…"` accepts any string (§0.2). If the app's `@plugin` block never registered that name, the
class was never emitted — you get an **unstyled** element, which reads as grey. Silently. Current
state:

| App              | `module` bridge | Module hues registered | Notes                                     |
| ---------------- | --------------- | ---------------------- | ----------------------------------------- |
| `apps/workbench` | ✅              | 15                     |                                           |
| `apps/web`       | ✅              | 15 (identical list)    | `--radius-box: 1.5rem`                    |
| `apps/market`    | ❌ **missing**  | 6                      | `color="module"` renders **nothing** here |

Two consequences to hold:

- **`color="module-finance"`, `-partner`, `-platform`, `-storefront` never work anywhere.** They are
  valid `ModuleScope` identities but are in no app's `@plugin` list.
- **`color="module"` would be dead in `apps/market`** — the bridge name itself is unregistered there.
  Currently latent, not a live bug: market uses no module colours at all today. It becomes real the
  first time someone adds one, and it will fail silently, so register `module` there before you do.

**So prefer the scope, not the literal:**

```tsx
// Works for all 19 identities wherever data-module rules apply. Preferred.
<ModuleScope module="finance">
  <Badge color="module" variant="soft">
    Paid
  </Badge>
</ModuleScope>
```

Reach for `color="module-x"` only for a one-off badge naming a _different_ module inside a scoped
subtree, and only from the 15 — and never in `apps/market`.

### 1.4 Focus rings: use `focus-ring`, never a hand-built one

The plugin emits colour utilities for **`bg-`, `text-` and `border-` only.** There is no
`ring-<color>`, `outline-<color>`, `fill-`, `stroke-` or `divide-<color>`, and the apps deliberately
do **not** bridge colours into Tailwind's own `@theme` namespace — colour is owned entirely by the
silica plugin. So a branded ring could only be spelled `ring-[var(--color-primary)]`, and it was, at
**43 call sites**.

That is now one class, defined once in [packages/brand/src/theme.css](packages/brand/src/theme.css)
and inherited by every sparx app:

```tsx
// NEVER — four tokens of recipe, repeated per call site, none of it propagating.
className =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2';

// ALWAYS
className = 'focus-ring'; // primary — the default
className = 'focus-ring-success'; // the control is itself a success affordance
className = 'focus-ring-danger'; // …or a destructive one
className = 'focus-ring-within'; // a CONTAINER that rings when a child focuses
```

Two implementation notes worth keeping:

- It uses **`outline`**, not a box-shadow ring, and reads `--focus-width` / `--focus-offset` —
  because that is silica's own focus idiom (`outline: var(--focus-width, 2px) solid <accent>`).
  Matching it beats inventing a parallel mechanism, and `outline` never fights a component's own
  `box-shadow`.
- It is **plain CSS, not `@utility`** — Tailwind v4 does not pick up `@utility` from an `@import`ed
  file (verified with the CLI: the class is simply never emitted). Ordinary rules survive the
  import, which is what lets all four apps share one definition.

Still open upstream: silicaui emitting **3 of ~12** colour-utility prefixes is a real gap for every
consumer, worth filing as the full set. Note it would _not_ have collapsed those 43 sites — you'd
have written `ring-primary` 43 times instead. Only the shared class achieves single-point-of-change.

---

## 2. Every colored element answers exactly one question

Before you type a `color=`, decide which of three axes the element is on. They are **orthogonal** —
an element sits on one, never two.

| Axis            | The question               | Answer from                                                                                     |
| --------------- | -------------------------- | ----------------------------------------------------------------------------------------------- |
| **Identity**    | _What is this a thing of?_ | Module hue — `ModuleScope` + `color="module"`                                                   |
| **State**       | _What condition is it in?_ | `success` `warning` `error` `info` (`statusTone`)                                               |
| **Consequence** | _What happens if I click?_ | `primary` do it · `danger` destroys/publishes · `secondary` alternate · ghost-`neutral` dismiss |

Then apply the rule all of this is really about:

> ### If an element distinguishes A from B, its color carries the distinction.
>
> Two badges that mean different things and render the same grey are **not neutral — they are
> wrong**. The color is asserting "these are the same," and that assertion is false.

Test it by covering the text. If you can no longer tell the rows apart, the color was doing no work,
and every one of those elements was a missed signal.

### 2.1 Per-element defaults

| Element                          | Default                                                                                                               | Never                                               |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Status / lifecycle badge         | `<Badge color={statusTone(s)} variant="soft">`                                                                        | `neutral`, `outline`, a hand-rolled `<span>`        |
| Kind / type / author badge       | the module hue of what it names                                                                                       | one grey pill for all kinds                         |
| Tab strip                        | `<Tabs color>` — see §2.2                                                                                             | leaving the default when tabs differ in consequence |
| The surface's own primary action | `primary`, or `module` on a module-owned surface                                                                      | `neutral`                                           |
| Destructive / publishing action  | `danger`, **solid**                                                                                                   | `outline` (it understates)                          |
| Cancel / dismiss                 | `neutral` `variant="ghost"` or `outline`                                                                              | a second colored button                             |
| Callout / alert                  | semantic by definition — `info` `warning` `danger` `success`                                                          | `neutral`                                           |
| Icon                             | nothing — it inherits. Inside a control it takes that control's resolved fg; in bare layout, the text color around it | hand-painting an icon inside a control (§3.1)       |
| Empty state                      | the module hue of what would go there                                                                                 | grey                                                |
| Metric / KPI value               | the hue of what it measures                                                                                           | grey                                                |

### 2.2 Tabs — selection is a filled shape, not an underline

`<Tabs variant>` is `underline` | `boxed` | `pills`. **The default underline is the weakest possible
selection signal**: two identically-inked labels with a 2px rule under one of them. It asks the eye
to read before it can answer "where am I?"

**When knowing the active tab matters at a glance, use a filled variant** (`pills` / `boxed`) so the
selection is one saturated shape against a light track. See §5.1 — this single change is most of the
difference between the two History rails.

```tsx
// Weak — which one is active is a hairline away from invisible.
<Tabs value={tab} onValueChange={setTab}>

// Strong — the active tab is a solid pill; peripheral vision answers it.
<Tabs variant="pills" color="info" value={tab} onValueChange={setTab}>
```

`<Tabs color>` defaults to `primary`, which is right when tabs are peers (Design · Settings ·
History — same surface, same stakes). **It is wrong when the tabs differ in consequence.** If one
tab's actions touch a draft and the other's touch the live public site, that difference is the most
important thing on the panel and must be visible _before_ the click. Split the color per tab, or
carry it on the panel.

### 2.3 The headline rule

**If every row says it, it cannot be the headline.** Before you assign a colour, check that the
biggest element in a repeating row is the thing that _differs_ between rows. A list where every item
leads with the same words has thrown away its own hierarchy — and no amount of colour fixes that,
because the repeated label is exactly what shouldn't be emphasised.

Demote the repeat to a small coloured badge; promote the distinguishing value (a time, a name, an
amount) to full weight. Worked through in §5.1 move 3.

---

## 3. Neutral's four legitimate homes

Neutral is earned by clearing **one** of these. Nothing else qualifies.

1. **The chassis.** Page/pane background, card surface, borders, dividers, table rules. These are
   `base-100` / `base-200` / `base-300` — _the surface scale_, not `color="neutral"`. The chassis is
   supposed to disappear.
2. **Bare prose you author yourself.** A `<p>` or `<span>` you wrote in your own layout. Prose is
   read, not scanned; it does not need a hue. (And per RULE #3 it never gets a faded one.) **This
   does not mean writing `text-base-content` — see §3.1.**
3. **The dismiss half of a decision pair.** Cancel beside a colored confirm. Neutral here _is_ the
   signal: it says "this one is the way out."
4. **A genuinely untyped value.** A raw count with no state, no owner, no kind. Rare. If you can name
   what the number is _of_, it has an identity and §2 applies.

Anything else: **if you typed `color="neutral"`, either change it or write the reason in a comment on
that line.** A neutral you can't justify in one sentence is the bug this document is about.

### 3.1 "Ink" is not `text-base-content` — components resolve their own

**Do not read this document as saying readable text gets `text-base-content`.** For almost
everything on screen that would be wrong, and on a component it is a **RULE #1 re-skin**.

Silica's whole design is that **a color class sets variables and the component paints itself from
them.** From the `button` definition:

> _"A color class (`.btn-primary`, …) **only sets CSS variables** (`--btn-bg`, `--btn-fg`,
> `--btn-accent`). It renders nothing itself. `.btn` and the style classes read those variables to
> paint the button."_

So a component's foreground is already resolved from its `color × variant`, per component
(`--btn-fg`, `--tabs-accent-content`, the badge equivalents), and it stays correct on a solid fill,
a soft tint, an outline, and inside a dark theme island. Writing a text color on top of that
overrides the one thing that knew the answer:

```tsx
// NEVER — base-content is near-black. On an Ember fill this is the unreadable case,
// and it is exactly the fill+foreground fingerprint RULE #1 bans.
<Button color="primary" className="text-base-content">Save</Button>

// ALWAYS — btn-primary sets --btn-fg to --color-primary-content (white). Nothing to write.
<Button color="primary">Save</Button>
```

**And for bare prose, you usually write nothing at all.** `globals.css` sets
`color: var(--color-base-content)` on `body`, so it **inherits**. A `text-base-content` utility is
normally redundant — noise that reads as a decision when nothing was decided.

**When you DO write a text color** it is because you are deliberately coloring bare text —
`text-module`, `text-success`, `text-<hue>` on a metric, a count, an inline signal. That is §2 doing
its job. `text-base-content` earns its place only where the inherited value is genuinely not the one
you want (text on a hand-built surface that re-points the cascade).

**The habit to stop:** `<TabsTab className="text-base-content">` appears at **5+ call sites** across
the workbench, copied forward with a comment about silica's resting tab ink being faded. The
motivation is right (RULE #3 — a label you must read before clicking must not be faded); the fix is
wrong. `.tabs-tab` resolves resting vs `[data-active]` ink from `--tabs-accent` /
`--tabs-accent-content`, and `<Tabs color>` re-points them for the whole set. **Set the color on
`<Tabs>`; do not hand-paint the tab.** If a resting tab still reads too faint after that, it is a
silica-level issue to raise — not something to patch per call site.

_(Related known trap, from silica's own tabs note: Base UI marks the active tab `[data-active]`, not
`data-selected`. Rules written against the wrong attribute silently no-op the text-color while the
indicator still moves — which looks exactly like "silica's tab ink is broken" and invites this
override.)_

---

## 4. The ship gate

Before a surface is done, look at it and count. Any **yes** is a fail.

- [ ] Is every color-bearing element on this screen the same color?
- [ ] Are there ≥3 badges, all identical, that don't all mean the same thing?
- [ ] Does a code comment explain a distinction the color doesn't make? _(§5 — this is the tell.)_
- [ ] Is the surface's primary action neutral?
- [ ] Is a destructive or publishing action `outline` rather than solid `danger`?
- [ ] Did I use only the 8 autocomplete colors when an identity was available? _(§0.2)_
- [ ] Is a module-owned surface wearing no module hue anywhere?
- [ ] Did I use a color this app never registered? _(§1.3 — renders grey, silently.)_
- [ ] Did I write a text color on a silica component instead of setting its `color` prop? _(§3.1.)_
- [ ] **If a token or a component changed tomorrow, would this screen fail to follow?** _(The
      Contract. Any hand-painted appearance — a hex, a fill+fg, a hover: class, a styled `<span>` —
      is a yes.)_
- [ ] Did I patch a silica default at the call site instead of fixing it in silica or the token?
- [ ] In a repeating row, is the largest element the thing that's **identical** across rows? _(§2.3.)_
- [ ] Is the selected tab distinguishable only by a hairline? _(§2.2 — use a filled variant.)_
- [ ] Is the action this surface exists for an `outline` or `ghost` button? _(§5.1 move 2.)_
- [ ] **Did adding colour let me delete any words?** If not, I probably decorated rather than
      designed. _(§5.2.)_
- [ ] Would this screen be indistinguishable from a different module's screen in a screenshot?

That last one is the summary of all of them.

---

## 5. Worked example — the builder History rail

The real surface, at
[apps/workbench/surfaces/builder/studio/version-history.tsx](apps/workbench/surfaces/builder/studio/version-history.tsx).
Its header comment is unusually clear about the design intent:

> _"They are separate TABS rather than one merged list… the only thing distinguishing 'changes my
> copy' from 'changes my live website' would be a badge — which is not enough weight for an action a
> customer can see. **The tab is the wall.**"_

The file then paints both sides of that wall identically. Eleven color-bearing elements; **two**
colors; the panel's central distinction — _private draft_ vs _live public site_ — carried by nothing
but the words.

**This is the canonical failure. The comment names a distinction the color refuses to make.**

| Element                                   | Was                 | Should be                   | Why                                                                                                                                                                                                                    |
| ----------------------------------------- | ------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tab "Your drafts"                         | default             | `info`                      | Private, reversible, your copy.                                                                                                                                                                                        |
| Tab "Published"                           | default             | `warning`                   | Scope beyond this pane. This is the wall.                                                                                                                                                                              |
| "You saved"                               | `neutral` soft      | `info` soft                 | An actor — the operator.                                                                                                                                                                                               |
| "Assistant saved"                         | `module` soft       | `module-ai` soft            | The AI hue exists (`#db2777`) and is registered. The studio sets no `ModuleScope`, so bare `module` inherits **builder indigo** — the surface's own hue. The one non-neutral badge on the panel distinguished nothing. |
| "Restored"                                | `neutral` soft      | `warning` soft              | A recovery event, not a routine save.                                                                                                                                                                                  |
| "Published"                               | `neutral` soft      | `success` soft              | It went live.                                                                                                                                                                                                          |
| "Rolled back"                             | `neutral` soft      | `warning` soft              | A live-site intervention.                                                                                                                                                                                              |
| "Current"                                 | `success` soft      | `success` soft ✓            | Already correct — the one element on the panel that was.                                                                                                                                                               |
| "Live now"                                | `success` soft      | `success` **solid**         | The strongest state here: the public is looking at this one.                                                                                                                                                           |
| "Restore" button                          | `outline neutral`   | `primary`                   | Safe, private, reversible — and the entire reason the panel exists. It should not look like the timid option.                                                                                                          |
| "Put back live"                           | `outline danger`    | `danger` **solid**          | Hue was right; weight was not. The only control in the editor that changes what visitors see with no publish step.                                                                                                     |
| Row border                                | `base-300`          | unchanged ✓                 | Chassis — §3 (1).                                                                                                                                                                                                      |
| Timestamp `<span>`                        | `text-base-content` | drop the class              | Bare prose in the author's own `<li>` — it already inherits from `body`. Harmless but redundant; §3.1.                                                                                                                 |
| `<TabsTab className="text-base-content">` | hand-painted        | drop it; set `<Tabs color>` | The override that spread to 5+ call sites. §3.1.                                                                                                                                                                       |

Two colors → six. Nothing was added to the screen; the color started telling the truth the comments
already knew.

### 5.1 What actually changed — the six moves

The rebuilt panel is the reference for this whole document. Comparing it to the original is the
fastest way to understand what "use color to design" means, because **almost nothing was added.**
The same four rows, the same words, the same data. What changed is that color started carrying
meaning that text was carrying alone — and once it did, the layout could get simpler and the copy
shorter.

**1. Selection is a filled shape, not an underline.**
Before: two identically-inked labels in a grey track with a hairline under the active one. You had
to _read_ to know where you were. After: the active tab is a **solid filled pill** — one saturated
shape against a light track. Which tab you are on is now answered by peripheral vision. A 2px rule
under faded text is not a state signal; a filled shape is.

**2. The primary action is solid and colored.**
Before: `outline neutral`, small, tucked under the text — the visual weight of a "maybe don't."
After: a **solid `primary` button**, right-aligned, unmissable. Restore is the entire reason this
panel exists. An action that timid reads as discouraged, and users believe the styling over the
label.

**3. Lead with what differs, not with what repeats.**
The sharpest fix, and it isn't a color fix. Every row said **"You saved"** first, at the top, in the
largest element — the one thing identical across all four rows was the headline. Meanwhile the
timestamp, the _only_ thing distinguishing one row from another, sat second in small text.
After: **the time is the headline** (`11:10 PM · 7 pages`, full weight), and the repeated label
demotes to a small `info` badge beneath it. **If every row says it, it cannot be the headline.**

**4. Group and rule — don't box.**
Before: four bordered cards, each spending four borders to say "I am separate," on rows that are
homogeneous by nature. After: a **`Yesterday` date header** and hairline-separated rows. Structure
went _up_ (there is now a scannable time hierarchy) while chrome went _down_.

**5. Give the eye two columns.**
Identity left, action right. Times scan down one edge, actions down the other. Before, the button
sat inline under the text, so there was no column to scan — every row had to be parsed individually.

**6. Absolute time beats relative time once rows are grouped.**
`3 hours ago · 3 hours ago · 3 hours ago` distinguishes nothing — three rows, one string. `10:25 PM
· 10:24 PM · 10:07 PM` under a `Yesterday` header is precise, sortable at a glance, and shows the
10:24→10:25 pair as the rapid-fire saves they were.

### 5.2 The principle to take from it

> **Color that is doing its job lets you delete things.**

The rebuilt panel dropped an entire intro sentence (_"Go back to how things were — either your
working copy, or what your visitors see"_ — the two tabs already say that) and tightened the
remaining line from 19 words to 12. It needed less prose because **the filled tab, the blue badge and
the red button were saying it instead** — instantly, and without being read.

That is the test of designing _with_ color rather than decorating _in_ it: **when the color is right,
the explanation becomes redundant.** If adding color to a screen didn't let you remove any words,
you probably decorated it.

The inverse is the failure this document opens with. A grey screen has no signal, so every
distinction has to be spelled out in text — which is why the original needed an intro sentence, a
19-word disclaimer, and a label on every row repeating what the tab above already said.

---

## 6. Named failure patterns

Use these names in review.

- **Grey consensus** — every prohibition satisfied, nothing communicated. §0.1.
- **Meaning without hue** — the comments explain a distinction the color doesn't make. §5.
- **Semantic under-reach** — only `success` and `error` in play while `info`, `warning`, `accent`,
  `secondary` and 18 identities go unused. §0.2.
- **Tint-ban overreach** — reading "cards stay neutral on a working surface" as "the _surface_ is
  neutral." The rule is about **card backgrounds**. Badges, tabs, buttons, icons and metrics on that
  surface are untouched by it — see §7.3.
- **Silent registration miss** — `color="module-finance"` anywhere, or `color="module"` in
  `apps/market`: typechecks, renders unstyled, reads grey. §1.3.
- **Hand-painted ink** — writing `text-base-content` (or any text color) onto a silica component
  instead of setting its `color`. The component already resolved its foreground from
  `color × variant`; the override is a RULE #1 re-skin and breaks on fills, tints and dark islands.
  §3.1.
- **Call-site patch** — fixing a silica default where you found it instead of where it lives. Costs
  one edit today and N forever, and the next person cannot tell your patch from a deliberate choice.
  Climb the ladder in the Contract instead.
- **Propagation break** — any hand-painted appearance (a hex, a fill+fg, a `hover:` class, a `<span>`
  dressed as a badge). The screen looks right today and silently stops tracking the theme. This is
  the failure the whole system was built to prevent.
- **Repeated headline** — every row in a list leading with the same words, at the largest size, while
  the value that actually distinguishes the rows sits below it in small text. §2.3.
- **Hairline selection** — an active tab (or step, or segment) marked only by a 2px underline between
  two identically-inked labels. State you have to read is state you haven't signalled. §2.2.
- **Timid primary** — the action a surface exists for rendered `outline` or `ghost`. Users believe
  the styling over the label; understating it reads as "maybe don't." §5.1.
- **Decorated, not designed** — colour was added and nothing could be deleted. If the explanatory
  sentence is still doing the work, the colour isn't. §5.2.
- **Forked language** — inventing a separate rule set for "marketing" or "the console." There is one
  system; variance is a token override. See Scope.

---

## 7. Corrections to existing rules

**7.1 — `apps/dashboard/DESIGN.md` does not exist.** `apps/dashboard` was removed. The root
[CLAUDE.md](CLAUDE.md) cited that path as binding for detail surfaces, color-follows-functionality
and the 16px floor, and five brain nodes under `docs/brain/design/` listed it under `sources:`.
**The design language has been a dead link.** This file replaces it, platform-wide.

**7.2 — [[two-design-systems]] is split on the wrong axis.** It divides the world into
_"Dashboard / admin"_ vs _"Site"_, which silently leaves `apps/web` and `apps/market` in neither —
and that gap is what licensed "marketing is a different system, give it its own doc." **The axis is
ownership, not app type:** everything wearing the **sparx** brand (workbench, web, market, admin,
b2b-portal) is one system; `apps/site` + `surface-compile` is the other because it wears the
**tenant's** brand. The node has been corrected.

**7.3 — the "editor" clause is narrowed.** `docs/brain/design/color-follows-functionality.md` says a
single-module working surface — _"create/edit form, wizard, editor"_ — keeps its cards neutral. Read
literally, the builder studio is an editor, and that clause licensed §5. It is scoped to what it was
always about: **`<Card>` background tint only.** It does not reach badges, tabs, buttons, icons,
alerts or metrics, and it never meant "this surface is monochrome."

**7.4 — a neutral pill is a defect, not a deduction.**
`docs/brain/design/status-is-its-own-axis.md` calls a neutral status pill "a review deduction." It is
a **defect**, at the same severity as a hardcoded hex: both throw away the token system's one job,
which is making state legible without reading.

**7.5 — tone resolvers are per-domain, and that is CORRECT.** An earlier draft of this section
claimed `statusTone()` had no workbench implementation and that tones were being hand-picked. That
was wrong. `apps/workbench` has **~25 domain-specific resolvers** — `quoteTone`, `refundTone`,
`fulfillmentTone`, `varianceTone`, `agingBucketTone`, `marginTone`, `noShowTone`, `seoTone`,
`bucketTone`, … — each mapping its own vocabulary to a tone, and each consumed as
`<Badge color={tone(x)} variant="soft">`.

**Do not consolidate these into one `statusTone`.** A refund status and an inventory aging bucket
have genuinely different vocabularies; one shared mapping would either lose cases or grow a union of
every domain in the platform. The rule §2 actually asks for is "**state resolves through a helper,
never a hue picked inline at the JSX site**" — and a per-domain helper satisfies it completely.

The generic `statusTone()` in `@sparx/ui` remains the right default for ordinary
draft/published/archived lifecycles. Reach for a local one when the domain has its own vocabulary.

---

## 8. Related

[CLAUDE.md](CLAUDE.md) RULES #1–#4 · [apps/workbench/CLAUDE.md](apps/workbench/CLAUDE.md) (pane vs
modal) · [docs/brain/design.md](docs/brain/design.md) ·
[docs/35-ui-variant-system.md](docs/35-ui-variant-system.md) ·
[packages/brand/src/theme.css](packages/brand/src/theme.css) ·
[packages/ui/CLAUDE.md](packages/ui/CLAUDE.md)
