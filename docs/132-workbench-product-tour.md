# 132 — Workbench Product Tour (first-run feature walkthrough)

**Version:** 0.3
**Author:** Brandon Korous
**Last Updated:** 2026-07-22

A short, guided **feature walkthrough** that runs the first time a user reaches the
workbench, spotlighting the parts of the app and the mental models a brand-new,
non-technical owner needs to get around. This is the "coach-mark tour," distinct
from onboarding.

**Two tiers.** The tour is delivered in two independent layers:

- **Tier 1 — the welcome tour.** One always-shown orientation that runs once after
  onboarding: the toolbar, the rail, the dock, search, favorites, feedback. It
  _shows the person around_ — including where each enabled tool lives on the rail —
  and never grows as more tools are turned on. Auto-starts once; replay from the
  account menu. (Sections 1–5 are this tier.)
- **Tier 2 — the per-module deep tours.** One short, **opt-in** walk per tool,
  **offered on first open** via a dismissible card and pointing at the tool's _real
  controls_. The learner drives their own depth. Additive — tier 1 is untouched by
  it. (Section 6 is this tier.)

> **Not onboarding.** Onboarding ([116-story-onboarding.md](116-story-onboarding.md),
> [15-merchant-onboarding-prd.md](15-merchant-onboarding-prd.md)) sets the business
> up and **gates the whole shell until `finishedAt` is stamped**. The product tour
> runs **after** that — the shell is live, real, and populated, and the tour teaches
> the person how to _operate_ it. Onboarding answers "what is your business"; the
> tour answers "here's how this app works."

---

## 1. Goal & principles

**Goal:** in under two minutes, a first-time owner understands the five things that
make the rest of the app legible — sites, modules, search, panes, and where help
is — and knows what to do next. Not a feature dump; an orientation.

Binding principles (these are house rules, not preferences):

- **Written for non-technical business owners.** Zero technical vocabulary. No
  "surface," "pane," "module registry," "entity." Say _screen_, _tool_, _business_.
  Any unavoidable term is defined inline. (Root `CLAUDE.md`; the audience rule.)
- **Body copy floor is 16px**, full-ink. Tour text is content meant to be read — it
  never uses faded/`soft` ink or sub-16 type to look "subtle."
- **No eyebrows, no editorial chrome.** A step is a title + a sentence or two. No
  "STEP 1 / 3" kicker label above the title — the built-in progress dot carries that.
- **Silica-themed popover, no shadow, no gradient.** The popover is a real silica
  surface: `--color-base-100` on `--color-base-content`, separated by a border +
  base-tone (never a drop shadow), `--radius-box` corners, and its buttons are
  **real `btn` controls** (see §5). It must be indistinguishable from native chrome.
- **Skippable, always.** A visible "Skip the tour" on every step. Skipping is a
  first-class outcome, recorded like completion — we never re-nag someone who opted
  out.
- **Resumable, never trapped.** Closing mid-tour saves the position; it does not
  count as completion. Re-entry offers to pick up or restart.
- **Module-aware.** Only steps for **modules the tenant has enabled** are shown — a
  CMS-only publisher never sees a "your sales" step. Gate on the same module flags
  the shell already reads; never spotlight a tool that isn't there.
- **Responsive.** The compact/mobile shell has a different layout, so it gets its
  own trimmed step set (or a graceful "tour is best on a larger screen, here's the
  short version"). Never point an arrow at a desktop-only element on a phone.
- **Never spotlight what isn't mounted.** Panes are lazy and can be torn off into
  separate windows. A step that targets something _inside_ a pane must open and
  focus that pane first, then wait for mount (see §6). v1 stays on always-present
  chrome to avoid this; deep, in-tool steps are a v2 concern.

---

## 2. Trigger, persistence & re-entry

**Trigger.** The tour auto-starts once, on the first shell load where **both**:

1. `isOnboardingFinished(onboarding)` is true (the shell is past the setup gate —
   [lib/onboarding/entry.ts](../apps/workbench/lib/onboarding/entry.ts)), and
2. the user has no recorded tour outcome for the current tour `version`.

It mounts in the **desktop shell path** (and the compact path with its own set) —
never during onboarding, never over the first-run gate.

**Persistence — no new table.** Tour state rides the existing per-user
`users.preferences` JSON blob via the **merge-patch** endpoint that already exists:
`PATCH /v1/me/preferences` ([wizeworks/services/api-rest/src/routes/v1/me.ts](../services/api-rest/src/routes/v1/me.ts))
preserves keys it doesn't own, so we add a `tour` key alongside the view defaults
and notification prefs already living there. **No migration, no new endpoint.**

Shape:

```jsonc
// users.preferences.tour
{
  "welcome": {
    "status": "completed", // "completed" | "skipped" | "in-progress"
    "version": 1, // bump to re-offer after a material tour change
    "lastStepId": "search", // for resume
    "at": "2026-07-22T18:04:11.000Z",
  },
}
```

The api-rest `PreferencesPatch` schema + `parsePreferences` gain a `tour` branch;
the merge-onto-whole-blob behavior is already correct, so the write is a one-key
patch. A client hook (`useTourState` / `useCompleteTour`) reads/writes it through
the same react-query `['me','preferences']` spine as favorites/recents.

**Re-entry.** The tour is also launchable on demand from a "Take the tour" /
"Get started" affordance (candidate home: the account menu's help cluster, next to
"Your feedback" — the slot we deliberately reserved for exactly this). On-demand
launch always restarts from step 1; auto-trigger resumes from `lastStepId`.

**Version bumping.** `version` lets us re-offer the tour after we materially change
what it teaches, without a schema change — a completed v1 doesn't suppress v2.

---

## 3. The curriculum

Ordered. Each step names its **anchor** (a stable `data-tour` attribute — §4, never
a silica class), the **concept** it teaches, and **draft copy** (title + body, in
sparx voice — tune freely). Phase marks v1 (core shell orientation) vs later.

### Phase 1 — core shell orientation (always shown)

1. **Welcome** · anchor: _centered, no target_ · **Phase 1**
   - **Title:** Welcome to your workbench
   - **Body:** This is where you run your business — your site, your customers, your
     sales, all in one place. Here's a one-minute tour of how to get around. You can
     leave any time and pick it back up later.

2. **Your business, up top** · anchor: `workspace` (the workspace/site cluster) · **Phase 1**
   - **Concept:** what "workspace" and "site" mean, plainly.
   - **Title:** This is your business
   - **Body:** Your business name sits up here so you always know where you are.

3. **Each site is a business** · anchor: `site-switcher` (the Globe dropdown) · **Phase 1**
   - **Concept:** THE mental model. A site is the business a customer deals with;
     switching a site swaps the entire identity — name, look, customers. Highest-value
     step; most common source of confusion. (See the "site is the business" rule.)
   - **Title:** Run more than one business?
   - **Body:** Each business you run gets its own site — its own name, look, and
     customers. Switch between them here, and everything on screen follows. Your work
     stays saved separately for each one, so they never mix.

4. **Find anything, fast** · anchor: `search` (the ⌘K search button) · **Phase 1**
   - **Concept:** search is the fastest path to anything; teach the shortcut kindly.
   - **Title:** Find anything, fast
   - **Body:** Looking for a product, a customer, an order, or any screen? Click here
     — or press Ctrl-K (⌘K on a Mac) — and start typing. It's the quickest way around.

5. **Your tools live here** · anchor: `module-rail` (the left rail) · **Phase 1**
   - **Concept:** the rail is where capabilities live; only enabled ones show.
   - **Title:** Your tools live on this rail
   - **Body:** Everything sparx can do — your website, sales, customers, email — is a
     tool on this rail. You'll only see the ones you've turned on. Click any to open it.

6. **Your work opens here** · anchor: `dock` (the pane area) · **Phase 1**
   - **Concept:** work opens as screens that stack side by side and stay put per
     business; unsaved work is protected.
   - **Title:** Your work opens here
   - **Body:** Screens open in this space and stack side by side, so you can keep an
     eye on more than one thing. They stay exactly as you left them for each business —
     and if you have unsaved changes, we'll always ask before anything is lost.

7. **Pin what you use most** · anchor: `favorite-star` (the star button) · **Phase 1**
   - **Title:** Keep your favorites close
   - **Body:** Tap the star on any screen to pin it to the top of search, so the things
     you do every day are always one click away.

8. **Tell us anything** · anchor: `feedback` (the feedback button) · **Phase 1**
   - **Concept:** feedback is its own toolbar control — a warm "we're listening," not a
     sales pitch.
   - **Title:** Tell us anything
   - **Body:** Have an idea, a question, or something that isn't working? Send it here —
     a real person reads every message, and it goes straight to the team building sparx.

9. **The account menu** · anchor: `account-menu` (the avatar) · **Phase 1 (finale)**
   - **Concept:** where the account + the replay-the-tour shortcut live; the warm close.
   - **Title:** We're right here
   - **Body:** This is your account — your details, sign out, and a shortcut to replay
     this tour any time. That's the whole tour. Enjoy your workbench!

> The two closing steps run after any Phase-2 module steps, so the account menu is
> always the final card.

### Phase 2 — module first-steps (built; shown per enabled module)

Each enabled module contributes ONE step that **highlights its own rail icon** (in
the module's hue) and names the first thing to do with that tool. It is deliberately
**rail-highlight, not open-the-tool**: the tour never opens a pane. Reasoning — opening
4–5 module panes into the dock during a tour clutters the workspace and would need
cleanup logic that fights the unsaved-work net (§6). Pointing at the rail icon teaches
_where the tool lives_ and _what to do first_ without hijacking the dock, and the icon
is always present so there's nothing to orchestrate.

**Gating is by presence, not a flag lookup.** The rail already renders only the
enabled, visible modules, so a module step is included **iff its rail icon
(`[data-tour="module-<slug>"]`) is on screen** at launch — `buildTourSteps()` in
[steps.ts](../apps/workbench/lib/tour/steps.ts) filters on exactly that. Steps run
after the core shell steps and before the closing card; order is the `MODULE_STEP_DEFS`
order below.

| Module       | Title                | First move named in the copy  |
| ------------ | -------------------- | ----------------------------- |
| `builder`    | Build your website   | design + publish your site    |
| `commerce`   | Sell your products   | add a product                 |
| `crm`        | Know your customers  | add a customer                |
| `cms`        | Publish your content | write your first post         |
| `email`      | Email your customers | send your first message       |
| `scheduling` | Take bookings        | set up services + hours       |
| `b2b`        | Sell wholesale       | set up accounts + price lists |

Each step wears its module hue automatically (the `data-tour-module` → `--color-module`
map in §5 covers all seven), so the Spark mark and the primary button light up in the
tool's color. Adding a module = one row in `MODULE_STEP_DEFS` + its hue mapping in
`tour.css`.

---

## 4. Anchor convention

Steps target **`data-tour="<id>"`** attributes, never silica class names.

Why: silica's plugin classes (`.btn`, `.navbar-start`, …) churn with the library and
appear many times per screen — anchoring to them is brittle and ambiguous. A
dedicated `data-tour` attribute is a stable, single-purpose handle that survives
restyles and refactors. The v1 anchors and their homes:

| `data-tour`     | Element                           | File                                                                    |
| --------------- | --------------------------------- | ----------------------------------------------------------------------- |
| `workspace`     | workspace/site name cluster       | [toolbar.tsx](../apps/workbench/components/toolbar.tsx)                 |
| `site-switcher` | the Globe site-switcher trigger   | toolbar.tsx                                                             |
| `search`        | the ⌘K "Search everything" button | toolbar.tsx                                                             |
| `favorite-star` | the star (favorite this screen)   | toolbar.tsx                                                             |
| `feedback`      | the feedback button               | toolbar.tsx                                                             |
| `account-menu`  | the account/avatar trigger        | toolbar.tsx                                                             |
| `module-rail`   | the left module rail              | [rail.tsx](../apps/workbench/components/rail.tsx)                       |
| `module-<slug>` | each module's rail icon (Phase 2) | rail.tsx (`SidebarItem` in `visibleNav.map`)                            |
| `dock`          | the pane/dock area (`<main>`)     | [workbench-shell.tsx](../apps/workbench/components/workbench-shell.tsx) |

Tier-2 anchors sit on the **real controls inside a surface** — the first place the
convention is applied outside the shell chrome:

| `data-tour`               | Element (the tool's first action) | Surface file                                 |
| ------------------------- | --------------------------------- | -------------------------------------------- |
| `commerce-add-product`    | "Add a product"                   | `surfaces/commerce/products-list.tsx`        |
| `cms-new`                 | "New" (write content)             | `surfaces/cms/content-list.tsx`              |
| `crm-add-customer`        | "Add a customer"                  | `surfaces/crm/customers-list.tsx`            |
| `scheduling-take-booking` | "Take a booking"                  | `surfaces/scheduling/bookings-list.tsx`      |
| `b2b-add-account`         | "Add a trade account"             | `surfaces/b2b/accounts-list.tsx`             |
| `builder-preview`         | "Preview"                         | `surfaces/builder/studio/studio-surface.tsx` |
| `builder-save`            | "Save"                            | `surfaces/builder/studio/studio-surface.tsx` |

Adding a step means adding its `data-tour` handle to the target and a row here.

---

## 5. Theming (silica-native, no new dependency)

The runtime is **driver.js**, already in the monorepo lockfile. It is skinned two
ways so the popover is a real silica surface:

1. **CSS on silica tokens.** driver.js renders `.driver-popover*` nodes; a small
   `tour.css` restyles them against brand tokens — `--color-base-100` surface,
   `--color-base-content` ink, `--radius-box` corners, a `--color-base-300` hairline
   border **instead of the default drop shadow** (shadows are banned as a device),
   and the overlay backdrop tuned to the base ramp. Buttons get `--radius-field`.
2. **Buttons painted from tokens.** The silica `.btn`/`.btn-primary` plugin classes
   can NOT be used here: driver's own `.driver-popover-footer button` rule is
   specificity `(0,1,1)` and out-specifies silica's single-class `.btn-primary`
   `(0,1,0)`, so it repaints the button white no matter what classes we add. Instead
   `tour.css` paints the silica look directly at higher specificity — Next/Done gets
   `--color-primary` (or the step's `--color-module`), Back is a `--color-base-200`
   ghost, all from the same tokens the plugin uses, so it stays theme- and
   module-aware. (This is skinning third-party chrome, same as the popover surface —
   not re-skinning a silica control.)

Module tint: a step may declare a `module` so its primary button and accent wear that
module's hue (via the `--color-module` bridge the shell already uses) — e.g. the
"build your site" step reads Builder indigo.

What we intentionally give up by staying on driver.js: rendering arbitrary silica
**React** components _inside_ a step (embedded live inputs, video). Coach-marks don't
need it, and avoiding it keeps us off a heavier, React-state-driven library that
fights the imperative "open pane → wait → highlight" flow. (react-joyride v3 is the
fallback the day a step genuinely needs React-in-popover — see the evaluation notes.)

---

## 6. Tier-2 — the per-module deep tours

The welcome tour (tiers 1) shows a person _around_. Tier 2 teaches one _tool_ at a
time — what it's for and the very first move — and does it on the learner's terms.
It is **additive**: tier 1's step set and behaviour are untouched.

### 6.1 Offer, don't auto-run

The first time an owner lands in a tool that has a deep tour, a small **dismissible
card** rises in the bottom-right corner, in that tool's hue, with Sparky:

> **New to Selling?** Take a quick tour — about a minute, and you can stop any time.
> **[Show me] [No thanks]**

This is the deliberate middle path between "auto-run a tour the instant a tool opens"
(intrusive — people open a tool to _do_ a thing) and "hide it behind a menu nobody
finds." The offer is **contextual** (it appears exactly where the learning applies)
AND **chosen** (nothing runs until they click). Answered once — **Show me** or **No
thanks** or the × — it never appears again. The tour stays replayable forever from the
module panel's compass (`launchModuleTour`).

The card is shell-level (`module-tour-offers.tsx`, mounted beside `FirstRunTour`),
watches the focused pane's module via the controller, and settles ~600 ms before
offering so it never flickers during navigation. It only shows once the **welcome tour
is settled**, so the two never stack.

### 6.2 Real controls, via orchestration (the §6-deferred path, now shipped)

Earlier this section was the design for a FUTURE "open-the-tool" step; tier 2 **is**
that path, built. A deep-tour step points at a tool's real control — the actual "Add a
product" button, not a rail icon — and when that control lives on a **different
surface** than the one open (Selling's create button is on _Products_, not the _Orders_
landing; Scheduling's is on _Bookings_, not the _Calendar_), the step carries an
`open` and the runtime **opens that surface, waits for the anchor, then highlights**:

```
step.open → controller.open(surface, params)   // re-focuses if already open — never duplicates
          → waitForAnchor('[data-tour=…]')      // rAF poll, ~4 s cap → centered fallback
          → driver highlights the real button
```

driver.js's imperative `onNextClick`/`onPrevClick` hooks make this controllable: the
runtime takes over Next/Back, completes the open+wait, then `moveNext()`. Every
anchored step carries its `open` (even when the control is on the landing surface) so a
**replay** works when that surface is closed — the controller's built-in dedupe makes it
a no-op when it's already open. The three original cost concerns are handled:

- **Dock clutter** — the controller re-focuses rather than piling up panes; a tour opens
  at most the one or two surfaces its steps name.
- **Torn-off windows** — an anchor popped into another document isn't found; the step
  lands on the centered fallback rather than hanging (the ~4 s cap).
- **Compact shell** — tier 2 is desktop-only for now, like tier 1 (see §8).

### 6.3 Which modules, and the content

`module-tours.ts` holds one `ModuleTour` per module, DATA + copy only (like `steps.ts`).
`TOURABLE_MODULES` is the source of truth for which tools offer one. Shipped:
**Selling, Site, Content, Customers, Scheduling, Wholesale** — each a centered intro
step in the module hue plus one or two steps on real controls.

**Email is deliberately absent**: its surfaces are still placeholders, so there is no
real control to anchor to. It gets a tour the day its screens are built — add it to
`MODULE_TOURS` and nothing else changes.

### 6.4 Persistence (`tour.modules`)

Same `users.preferences` blob, no new table. The `tour` branch gains a `modules` map
keyed by slug; a present entry (any status — `completed`, `skipped`, or `dismissed`)
means "already offered." Because the welcome outcome and the per-module outcomes are
written by independent flows, the PATCH handler **deep-merges** `tour` (and its
`modules` one level deeper) — a shallow overlay would drop whichever branch the current
patch doesn't carry. Absent module key = never entered that tool.

---

## 7. File map (built)

- `sparx/apps/workbench/lib/tour/types.ts` — the `TourStep` shape + persisted-state types.
- `sparx/apps/workbench/lib/tour/steps.ts` — the curriculum: `CORE_STEPS`, `CLOSING_STEP`,
  `MODULE_STEP_DEFS`, and `buildTourSteps()` (composes + gates on rail presence).
- `sparx/apps/workbench/lib/tour/use-tour.ts` — the themed driver.js wrapper (`onPopoverRender`,
  module tint, art slot) + the tier-2 `ensureStep` orchestration hook (open surface →
  wait → advance).
- `sparx/apps/workbench/lib/tour/first-run-tour.tsx` — tier-1 trigger + resume + persistence +
  the brand-art portal; exports `launchTour()` for the account-menu replay.
- `sparx/apps/workbench/lib/tour/module-tours.ts` — tier-2 content: one `ModuleTour` per tool,
  `TOURABLE_MODULES`, `getModuleTour`, `isTourableModule` (re-exports `moduleLabel`).
- `sparx/apps/workbench/lib/tour/module-tour-offers.tsx` — the tier-2 driver: the first-open
  offer card, the orchestrated run + outcome recording, the art portal; exports
  `launchModuleTour()` for the module-panel replay. Mounted beside `FirstRunTour`.
- `sparx/apps/workbench/lib/tour/data.ts` — `useTourPrefs` / `useSaveTourOutcome` (tier 1) /
  `useSaveModuleTourOutcome` (tier 2, `tour.modules[slug]`).
- `sparx/apps/workbench/lib/tour/tour.css` — the silica skin + hero layout + motion + hue map +
  the offer-card rise.
- toolbar.tsx / rail.tsx / workbench-shell.tsx — the tier-1 `data-tour` anchors + mount.
- module-panel.tsx — the compass "Take the `<tool>` tour" replay affordance.
- `surfaces/{commerce,cms,crm,scheduling,b2b,builder}/…` — the tier-2 `data-tour` anchors
  on real CTAs (see §4 table).
- `wizeworks/services/api-rest/src/routes/v1/me.ts` — `TourPrefs` (`welcome` + `modules`) +
  `parsePreferences` + the `tour` **deep-merge** in the PATCH handler.
- `sparx/apps/workbench/package.json` — `driver.js` dependency.

---

## 8. Decisions (resolved) + open threads

Resolved:

- **Replay home** → tier 1 in the account menu's help cluster; tier 2 on each module
  panel's compass. ✅
- **Auto-start delay** → tier 1 a short (~800 ms) settle after paint; tier 2 offer
  settles ~600 ms after a module is focused. ✅
- **Phase-2 (tier-1) shape** → rail-highlight, one step per enabled module. ✅
- **Per-module content depth** → shipped as **tier 2**: a first-open offer card + an
  opt-in deep tour pointing at real controls, orchestrating across surfaces where the
  control lives elsewhere (§6). This is the "open-the-tool" path, now built. ✅
- **Module enablement gate** → tier 2 uses `TOURABLE_MODULES` (a tour exists) plus the
  offer only firing on a focused, real surface; email is excluded until its screens
  are built. ✅

Open threads:

- **Compact shell** — both tiers mount desktop-only. The compact shell needs its own
  trimmed sets (or a "best on a larger screen" fallback); tier 2's floating card +
  pane orchestration in particular assume the desktop dock.
- **`version` bump discipline** — when copy changes materially, bump `TOUR_VERSION` so
  the tour re-offers (both tiers key off it); a pure wording tweak doesn't need it.
- **Deeper module walks** — each tier-2 tour is intentionally 2–3 steps (intro + first
  move). A richer per-tool walk (e.g. Selling: product → order → fulfilment) is a
  future opt-in, same machinery.
