# Piggles tours — the curriculum

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-17

Every tour in the Piggles console, every step of every tour, and the rules a new
one is written under. The runtime already exists — [apps/workbench/lib/tour/](../../apps/workbench/lib/tour/) —
so this is a content specification, not a design proposal.

---

## 1. Why there has to be a lot of this

Piggles ships **every app enabled** ([CLAUDE.md](../../CLAUDE.md) RULE #2), so a
business that signed up an hour ago is looking at **15 apps and 210 screens**,
none of them bought, all of them working. sparx uses module activation as
progressive disclosure and Piggles cannot. The rail is full on the first morning.

That inverts the usual first-run problem. The usual one is an empty product and a
tour that sells you what you could build. Ours is a **full** product and a person
who cannot tell which of forty screens is the one they want. So every tour here
answers the same question — _which of these do I need, and what is it for_ —
and answers it by **walking rows in an app's panel**, not by pointing at buttons.

Row-walking is also the sturdier choice: a screen can be rebuilt without breaking
a step, and one file carries every anchor these tours depend on
([components/panel/nav-row.tsx](../../apps/workbench/components/panel/nav-row.tsx))
rather than fifteen apps' worth of controls.

## 2. The three tiers

| Tier                  | What it teaches                                                                          | How many | Offered?                                                               |
| --------------------- | ---------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------- |
| **1 — Welcome**       | the shell: where am I, what are all these, where does my work go, how do I find anything | 1        | auto, once, as an offer on the status strip                            |
| **2 — App tours**     | one app: what it is for, and its front-door screens                                      | 15       | auto, once, the first time that app's panel is opened                  |
| **3 — Feature tours** | one group of screens inside an app                                                       | 41       | **never auto-offered** — pulled from the wand beside the group heading |

**Tier 3 is pull-only, and that is the load-bearing decision.** Fifty-seven tours that
offer themselves is the nag the whole feature was shaped to avoid. Tier 1 and
tier 2 arrive on their own — sixteen offers, spread across the weeks somebody
takes to open sixteen apps. Everything below that waits to be asked for.

**Nothing is ever gated behind a tour.** A guide rings one thing at a time from
the status strip; nothing is dimmed, nothing is disabled, and every control on
screen keeps working — including the one being pointed at. The reasoning is in
[lib/tour/use-guide.ts](../../apps/workbench/lib/tour/use-guide.ts) and it is not
negotiable: a console whose premise is _you decide what is on screen_ cannot
explain itself by taking the screen away.

## 3. Coverage

All 210 nav rows are taught exactly once. A row is in exactly one tour.

| App           | Screens | App tour          | Feature tours | Steps | File                                                 |
| ------------- | ------- | ----------------- | ------------- | ----- | ---------------------------------------------------- |
| — (the shell) | —       | Welcome, 10 steps | —             | 10    | [00-welcome.md](00-welcome.md)                       |
| Home          | 18      | 7 steps           | 4             | 20    | [01-home.md](01-home.md)                             |
| My Site       | 11      | 8 steps           | 1             | 13    | [02-your-website.md](02-your-website.md)             |
| Content       | 10      | 4 steps           | 3             | 11    | [02-your-website.md](02-your-website.md)             |
| Get Found     | 10      | 4 steps           | 2             | 12    | [02-your-website.md](02-your-website.md)             |
| Sell          | 38      | 5 steps           | 8             | 47    | [03-sell.md](03-sell.md)                             |
| Stock         | 40      | 6 steps           | 8             | 47    | [04-stock-and-partners.md](04-stock-and-partners.md) |
| Partners      | 17      | 5 steps           | 3             | 20    | [04-stock-and-partners.md](04-stock-and-partners.md) |
| Customers     | 21      | 4 steps           | 5             | 27    | [05-who-you-deal-with.md](05-who-you-deal-with.md)   |
| Messages      | 9       | 6 steps           | 1             | 12    | [05-who-you-deal-with.md](05-who-you-deal-with.md)   |
| Bookings      | 10      | 4 steps           | 2             | 13    | [05-who-you-deal-with.md](05-who-you-deal-with.md)   |
| Invoices      | 3       | 4 steps           | 0             | 4     | [06-getting-paid.md](06-getting-paid.md)             |
| Money         | 12      | 5 steps           | 4             | 17    | [06-getting-paid.md](06-getting-paid.md)             |
| My Team       | 5       | 6 steps           | 0             | 6     | [07-running-the-place.md](07-running-the-place.md)   |
| Automations   | 3       | 4 steps           | 0             | 4     | [07-running-the-place.md](07-running-the-place.md)   |
| Connections   | 3       | 4 steps           | 0             | 4     | [07-running-the-place.md](07-running-the-place.md)   |

**57 tours, 267 steps.** The files follow the rail groups, as
[lib/tour/app-tours/](../../apps/workbench/lib/tour/app-tours/) does — with Sell
split out from Stock and Partners, because between them those three carry 114 of
the 267 steps and one file for the lot would be unreadable.

## 4. How a tour is written

**Shape.**

- **Tier 1** — 10 steps: one opening card with no anchor, eight chrome steps, one
  closing card.
- **Tier 2** — the app's **front-door rows** (the unsectioned rows at the top of
  its panel), the first of which carries the opening sentence, then an anchorless
  closing step. 4–8 steps.
- **Tier 3** — one step per row in one panel section, in panel order. A section of
  four or more rows gets an anchorless opening step first. 2–10 steps.

Three qualifications, each of which a page below states where it applies:

- **A section of a single row has no tour of its own**; that row joins its app
  tour, before the closing step.
- **An app whose front door is one row takes its smallest adjacent section too**,
  or the app tour would be two steps long. Get Found is the case.
- **Big apps get map steps.** In Sell, Stock, Partners, Customers, Money and Home,
  some app-tour steps ring the FIRST row of a group and describe the group rather
  than the row. That row's own step still lives in the group's tour — the map step
  is showing where the group starts, not teaching the screen. Without it a
  38-screen app has no shape, which is the actual problem.

The closing step hands off to the feature tours where there are any, and simply
closes where there are none (Invoices, My Team, Automations, Connections).

**Voice.** Plain, warm, and never cute. These are business owners, not users:
they have a shop or a studio or a round, and they are here to run it.

- No `workspace`, `module`, `surface`, `pane`, `entity`, `record type`, `CRM`,
  `SEO`, `CMS`. Say _screen_, _app_, _your business_. ([CLAUDE.md](../../CLAUDE.md) RULE #3.)
- A step is a **title and one or two real sentences**. No step numbering in the
  words — the chip already says `3 of 7`. No eyebrow, no kicker (root RULE #2).
- Titles are sentences about the job, not labels. "When the shelf disagrees with
  the screen", not "Stock counts".
- **Money, tax, payroll and deletion are plain and calm.** The mascot never
  appears beside somebody's takings, and neither does a joke.
- Never name a sparx product. sparx.market, sparx Pay and the sparx partner
  directory do not exist here, are hidden from this console, and must not be
  renamed into Piggles equivalents ([CLAUDE.md](../../CLAUDE.md), "A sparx PRODUCT
  is not a Piggles capability").

**Truth.** A step describes what the screen IS. It may describe behaviour only
where the behaviour is built — a tour is the one place in the product where a
sentence is read as a promise, and a promise about a screen that does not do that
yet is a support ticket with a nice font.

## 5. The anchor contract

A step's `anchor` is the value of a `data-guide` attribute somewhere on screen.
The runtime finds it, rings it, and scrolls it into view. A step whose anchor
never resolves simply has no ring — which is why every body is written to stand
on its own, and also why a wrong anchor is invisible in review and has to be
checked against the registry.

**Every nav row already carries one.** `nav-<surface.key>`, set on the row in
[components/panel/nav-row.tsx](../../apps/workbench/components/panel/nav-row.tsx).
**Every tier-2 and tier-3 step in this document that names an anchor names a row
that exists today** — no new attributes, no new components.

**The shell carries five**, in
[desktop-shell.tsx](../../apps/workbench/components/desktop-shell.tsx) and
[topbar.tsx](../../apps/workbench/components/topbar.tsx): `app-rail`, `app-panel`,
`workspace`, `business`, `search`. The welcome tour in
[00-welcome.md](00-welcome.md) needs **four more**, listed there.

**Only listed rows can be anchored.** A surface registered `listed: false` is
reachable from its parent but is not a row in any panel, so `nav-<key>` never
renders for it. Two existing steps break this rule — see §8.

## 6. Where the words sit

**The card follows the ring.** A step's text is anchored to the element it is
ringing, not parked in a fixed corner.

Today it is parked. `GuideChip` anchors the popover to its own trigger in the
status strip (`side="top" align="end"`), so every step in every tour renders in
the bottom-right corner — while the thing it is describing is a nav row about 900
pixels away on the left. You read a sentence, look away to find the ring, and look
back to press Next. Over a 9-step walk through Where it lives, that is eighteen
trips across the screen.

**That was not the design intent, and the argument in
[lib/tour/use-guide.ts](../../apps/workbench/lib/tour/use-guide.ts) does not
require it.** What that file argues against is a SPOTLIGHT — dimming the screen,
cutting a hole, trapping the keyboard until somebody presses Next. It is an
argument about **modality**, and it still holds completely: nothing dims, nothing
is disabled, every control keeps working including the ringed one. Position is a
separate question, and the two got run together. A 24rem card sitting beside the
row it names is not a spotlight; it is the words being where you are already
looking.

**The rules:**

- **The chip stays in the strip.** It is the persistent handle, the resume point,
  and where the offer lives before a guide starts. Only the card moves.
- **Anchored steps** put the card against the ringed element. **Anchorless steps**
  — the openings and handoffs — have nothing to sit beside and keep the strip
  position. That is the whole conditional.
- **Side is derived, not fixed.** A nav row lives in a 20rem panel on the left, so
  its card wants `side="right"` — over the workspace, never over the panel it is
  explaining. A topbar anchor wants `side="bottom"`. Let the positioner flip on
  collision from there.
- **It fixes the overlap in §8.** The card stops landing on the dock's floating
  controls, because it stops living in that corner.

**The one real cost, stated honestly:** the Back/Next buttons move each step, so
somebody cannot park the pointer and click through. That is worse than a card that
never moves — and better than today, where the buttons are both away from what you
are reading AND underneath another control.

### What silicaui gives us — landed 2026-08-18

`PopoverContent` had no anchor at 0.52: it rendered `Popover.Positioner` with
`side`, `align` and `sideOffset` only, so the popup could only ever sit against
its own trigger. **silicaui 0.55 fixes it**, and more generously than asked —
`PopoverContentProps` now extends a `PositioningProps` mixin:

```tsx
<PopoverContent anchor={ringedElement} side="right" sticky collisionBoundary={panel} />
```

- `anchor` — an element, a ref, a function returning either, or a virtual element
  (anything with `getBoundingClientRect()`). This is the one the guide needs.
- `sticky` — keeps the card glued to the row as it scrolls. Worth taking: a nav
  row can scroll under the card in a long panel.
- `collisionBoundary` / `collisionAvoidance` / `positionMethod` — for keeping the
  card inside the workspace rather than the viewport.

That is the RULE #1 ladder run to its end: no prop existed, it was not a token, so
it was a missing prop on a silica component and the fix went upstream. Nothing was
re-implemented at the call site, and no `GuidePopover` was added to
`@wizeworks/silica-corrections` — the fallback that would have been needed if the
release had been far off.

The bump was not free, and the cost is worth recording because the next one will
look the same. silicaui 0.55 also **moved Base UI packages**:
`@base-ui-components/react@1.0.0-rc.0` → `@base-ui/react@^1.7.0`, a rename as well
as a version. `@wizeworks/ui` still pinned the old name, so for one install the
tree held two Base UIs whose types would not unify, and its toast wrapper stopped
compiling. It now sits on `@base-ui/react` too, and the repo's only pnpm patch —
a Base UI toast `flushSync` fix — went with it, because 1.7.0 fixes that upstream.
Detail: [@wizeworks/ui CLAUDE.md](../../../wizeworks/packages/ui/CLAUDE.md).

**The wiring landed the same day.** `useGuideAnchor` now returns the ringed
element (it moved to [lib/tour/anchor.ts](../../apps/workbench/lib/tour/anchor.ts),
which also split `use-guide.ts` back under the 250-line rule), the chip hands it
to `PopoverContent` as `anchor`, and `guideSide()` derives the side from the
anchor's geometry rather than from a list of anchor names — the top bar is tested
before the left third, or the logo, which is in both, puts its card across the
business and site switchers. Steps with no anchor keep the strip position.

## 7. What has to be built

The runtime handles tiers 1 and 2 already. Tier 3 needs three things.

**A key space for tier-3 outcomes.** Tier-2 answers live in
`users.preferences.tour.modules`, whose keys are validated against the
`TOUR_MODULES` enum in
[wizeworks/services/api-rest/src/routes/v1/me.ts](../../../wizeworks/services/api-rest/src/routes/v1/me.ts).
That enum is **shared with sparx**, and 41 Piggles-shaped section keys do not
belong in it. Add a third branch instead:

```ts
// users.preferences.tour
features: z.record(z.string().regex(/^[a-z][a-z0-9_-]*\.[a-z][a-z0-9-]*$/).max(60), TourOutcome).optional(),
```

Free-form and brand-blind, so either console can key it however its own
navigation is shaped. The PATCH handler already deep-merges the `tour` branch and
its `modules` map one level down; `features` needs the same one-level merge, or
answering one feature tour erases every other.

Adding a key to `TOUR_MODULES` is separately still needed for **`home`** — the one
app with no tier-2 tour today. That is additive and safe (a key nothing writes
never exists); removing one is not.

**A launcher on each section heading.** The panel header already has the wand that
runs an app's tour ([components/panel/panel-header.tsx](../../apps/workbench/components/panel/panel-header.tsx));
the section heading in [components/panel/panel-sections.tsx](../../apps/workbench/components/panel/panel-sections.tsx)
needs the same control, shown on hover and focus, rendered only where a tour
exists so it is never a button that does nothing.

**A `GuideKey`-shaped id for a section.** `<app-id>.<section-slug>` — `sell.what-you-sell`,
`stock.where-it-lives`. Slugged from the **Piggles** heading, not the platform's,
because that is the heading a person clicked.

## 8. Defects found while writing this

All four are one-line fixes and all four are silent — a step with a dead anchor
rings nothing and reads as a design choice.

| Where                                                                             | Anchor                    | Problem                                                                                                                                                                                                                                            | Fix                                                                                                                       |
| --------------------------------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| [web.ts](../../apps/workbench/lib/tour/app-tours/web.ts) `site.preview`           | `nav-builder.preview`     | `builder.preview` is `listed: false` — it needs a document open, so it is never a row                                                                                                                                                              | re-point at `nav-builder.publish` and fold the preview sentence into it, per [02-your-website.md](02-your-website.md)     |
| [run.ts](../../apps/workbench/lib/tour/app-tours/run.ts) `automations.runs`       | `nav-automations.runs`    | `automations.runs` is `listed: false` — it is always scoped to one rule                                                                                                                                                                            | re-point at `nav-automations.reports` ("What has run")                                                                    |
| [money.ts](../../apps/workbench/lib/tour/app-tours/money.ts) `invoices.templates` | `nav-invoicing.templates` | the anchor is fine, but the screen behind it is a `stub()` placeholder — the step teaches a screen that is not built                                                                                                                               | keep the step, soften the copy to what the screen will do, or drop it until the screen lands                              |
| [first-run-guide.tsx](../../apps/workbench/lib/tour/first-run-guide.tsx)          | —                         | `launchWelcomeGuide()` is exported and **has no caller**. Somebody who says "no thanks" can never get the welcome tour back, though the comment and [docs/132](../../../docs/132-workbench-product-tour.md) §2 both say the account menu offers it | wire it into the account menu in [topbar.tsx](../../apps/workbench/components/topbar.tsx), beside "Your plan and billing" |

Two more worth a decision rather than a fix:

- ~~**The guide popover's buttons sit under the dock's floating controls.**~~
  **Fixed 2026-08-18.** A click meant for `Next` opened the Tidy up menu instead.
  Anchoring the card to the ring moved it out of that corner for most steps, but
  not for the anchorless ones, which still fall back there — so the card is now
  raised explicitly. The z-index has to land on the POSITIONER: Base UI portals
  the popup inside an absolutely-positioned wrapper and the popup itself is
  `position: static`, so a `z-` class on it is inert. One `:has()` rule in
  [lib/tour/guide.css](../../apps/workbench/lib/tour/guide.css) puts the wrapper at
  9500 — above the dock's `z-[9000]` tools, below the 10000 `app/globals.css`
  gives portalled overlays, so a dialog still wins. Verified by hit-testing the
  `Next` button rather than by looking at it.
- **There is no tour at all on the compact/mobile console.** `FirstRunGuide`,
  `AppGuideOffers` and `StatusBar` mount only in
  [desktop-shell.tsx](../../apps/workbench/components/desktop-shell.tsx). A
  business owner who first opens Piggles on a phone gets a full rail and no
  orientation. Out of scope for this document, but it should not stay unwritten.

## 9. Version bumping

`GUIDE_VERSION` in [lib/tour/types.ts](../../apps/workbench/lib/tour/types.ts) is
`1`. Landing this curriculum materially changes what tier 1 and tier 2 teach, so
it goes to **2** — an older answer stops counting and everybody is offered the new
walk once. Tier 3 is new and has no prior answers to invalidate.

Bump it again only when a tour changes what it TEACHES. Fixing a typo does not
earn re-offering a tour to every business on the platform.
