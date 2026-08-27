# 123 — Workbench: the Multi-Window Operator App

Version: 1.4.0
Author: Brandon Korous
Last Updated: 2026-08-26

## Purpose

`sparx/apps/workbench` (workbench.sparx.works, dev port 3011) is a ground-up second
staff app that reimagines the dashboard as a **VS Code-style workbench**:
dockable panes, splittable groups, drag-to-rearrange tabs, and tab tear-off
into real browser windows on a second monitor. It is built entirely on
silicaui (`@wizeworks/silicaui-react` + the Tailwind plugin) and
`@sparx/brand/theme.css`, shares the dashboard's Better Auth session and
api-rest, and never iframes or reuses dashboard UI.

The organizing idea: **the operator arranges the work, not the app**. The
dashboard decides that an invoice editor and its preview share a screen; the
workbench publishes the editor's draft to a shared store and lets the operator
put the preview anywhere — beside it, behind it, on another monitor, or
nowhere.

## Architecture

### One application, addressable panes

The workbench is a single APPLICATION, not a stack of pages — but every pane has
an address. `/commerce/orders/8f2…?site=savory-donuts` opens that order **on top
of** the operator's existing layout; it never replaces it, and the arrangement
itself is never in the URL. The address bar tracks the **focused pane** so that
refreshing, pressing back, and copying the URL all do what everyone already
expects, without the layout leaking into a string.

`@wizeworks/links` is the one address table — pure data, importable from a Node
service, a server component and the browser alike — mapping a readable path ⇄ a
surface key ⇄ an indexed entity type. Universal search, the notification bell,
every emailed link and both copy-link controls resolve through it, and
`scripts/check-surface-routes.mjs` fails the build if a surface has no address or
an address names no surface. Arrival, the site gate and the failure states live
in `lib/workbench/deep-link.ts`; the full rationale is [[workbench-addresses]] in
the brain.

### Panes are descriptors, layout is dockview's

A pane is `{surface, params}` — e.g. `invoicing.invoice.edit {id}` — resolved
against a surface registry (`lib/surfaces/registry`), and it is exactly what an
address decodes to. dockview owns layout
(grid, tab strips, splitters, popouts); the `WorkbenchController` owns meaning
(which surface each pane shows, dirty guards, the active descriptor). The
persisted layout is therefore two halves — dockview's opaque `grid` blob plus
the controller's `panes` map — written to localStorage keyed **per site**
(`sparx-workbench-layout:<propertyId>`, `lib/workbench/persistence.ts`).

### Browser-only data layer via a token-vending BFF

api-rest authenticates staff by exactly one credential: a Bearer HS256 JWT
signed with `SPARX_INTERNAL_JWT_SECRET`. The dashboard sidesteps this by
calling api-rest only from the server; the workbench renders panes in the
browser and cannot. `app/api/token/route.ts` is the trust boundary: it
authenticates the same-origin session cookie, then mints a 10-minute JWT whose
`tid` is stamped server-side — the browser can never choose its tenant.
`lib/api/token.ts` caches one token per window and refreshes at 80% of life;
`lib/api/client.ts` wraps `SparxClient` and attaches `x-sparx-property-id` on
every call. Server-rendered HTML artifacts (invoice print views) can't ride a
plain `<a target="_blank">` because of that same Bearer requirement —
`lib/api/html-artifact.ts` opens the tab synchronously (popup blockers), then
fetches with the token and points the tab at a blob URL.

### Per-site workspaces (Model A)

A site is a workspace, like a VS Code window per project. Each site keeps its
own complete pane layout; switching sites saves the current grid, sets the
`sparx_active_property` cookie, and reloads. Entities never dangle across
sites — an invoice pane from site A cannot survive into site B, because site
B's workspace is a different persisted layout entirely. api-rest validates the
cookie under RLS and fails closed to the tenant's primary property.

### Panes coordinate through shared state, never through layout

`lib/drafts.ts` is the pane-to-pane bus: the invoice editor publishes its
unsaved draft; the preview subscribes. Neither knows the other exists. Within
one window the in-memory map suffices (dockview popouts share the module by
reference); a BroadcastChannel mirrors traffic for independently-opened tabs.

### Tab tear-off and the multi-window portal problem

dockview popouts load `/popout` and **portal** the group's DOM into the child
window while the React tree stays in the main window — so panes share the
query cache, controller, and providers by reference, and no state syncs across
windows. Browsers can't detect a tab dragged outside the window, so tear-off
is an explicit control: `GroupActions` (`lib/dock/group-actions.tsx`) renders
at the right of every tab strip — "move to its own window" in the grid,
"bring back" in a popout.

The portal consequence: Base UI overlays default to `document.body`, which is
the **main** window's body even for a popout-hosted trigger. silicaui grew
`PortalContainerProvider` for exactly this (silicaui-react ≥ 0.27), and
`lib/dock/window-boundary.tsx` feeds it the pane's actual `ownerDocument.body`
(tracked live across moves via dockview's location events). Each pane also
mounts its own `ToastProvider` + `ImperativeAlertDialogProvider` inside the
boundary so outcomes announce in the acting window. The provider structure is
identical docked and detached — a shape change on tear-off would remount the
surface and wipe unsaved state.

## Open panes are cheap; mounted panes are not

The workbench promises "arrange it once, it stays arranged", and that promise was
**unbounded**. Panes accumulate — that is the point of the app — and nothing ever
let one go. An operator reached **134 saved panes**, at which point opening the
workbench mounted 134 surfaces, fired well over a hundred API calls in one
breath, and killed the browser tab. Every route was affected rather than just the
one holding the panes, because the arrangement is restored before anything
renders, which also puts the in-app reset control on the far side of the crash.

Two things caused it, and both are worth knowing before adding anything per-pane.

**dockview mounts every panel up front.** Its `onlyWhenVisible` renderer — the
default, and what this dock uses — decides where a panel's element SITS, not
whether React mounts it; `ReactPanelContentPart.init()` runs at panel creation.
So the renderer name is misleading for our purposes and gives us nothing here.

**Per-pane costs multiply by a number nobody bounds.** Each tab ran its own
1.5-second `setInterval` asking whether its pane was dirty. The comment defending
it said one call per pane per tick is nothing, which is true of one tab and false
of a hundred and thirty-four.

### The three rules now in force

1. **One poll, not one per tab** (`lib/workbench/dirty.tsx`). A single timer walks
   every guard once per tick and hands out the answer; it runs only while
   something is subscribed. The status bar reads the SAME tick, which is also
   what stops the bar's count and the tabs' dots from disagreeing.
2. **A pane mounts the first time it is looked at** (`lib/dock/pane-liveness.ts`).
   A restored pane nobody opened was never opened. The first visibility read is
   deferred by a timeout, because a layout restore creates every panel before it
   arranges the groups — read synchronously, `isVisible` is briefly true for
   panes about to become background tabs.
3. **A hidden, clean pane unmounts after five minutes, and at most twelve stay
   mounted.** The tab, title and position never move; looking at the pane builds
   it back. Five minutes is the query client's `gcTime` — past it a woken pane
   refetches anyway, so the memory had already stopped being worth anything.

**Unsaved work is an absolute veto**, checked at the moment of sleeping rather
than when the timer was set. Nothing visible is ever unmounted either, however
many panes are on screen. What is NOT preserved: scroll position and any view
state a surface keeps in local state rather than in its pane params — waking is a
fresh mount. That is the same bargain a browser makes when it discards a
background tab.

There is deliberately **no visible "asleep" state** — no dimming, no badge. Waking
is a frame, the tab strip already carries title, module hue and the dirty dot, and
a fourth state would be vocabulary about an implementation detail nobody can act
on. Dimming would be wrong twice over: a faded tab reads as "not meant to be
read" (DESIGN.md), and these are meant to be read and clicked. A pane that
genuinely cannot come back — its record deleted — is a different thing and does
show itself.

Piggles' console carries all three rules identically; it is the same dock with
the same failure.

## Pane or modal?

**A pane is the default. A modal has to earn it.**

This is a structural rule, not a taste call. The workbench has an unsaved-work
safety net — `hasUnsavedWork()` guards site switches, `usePaneDirty` puts the
dot on the tab, layout persists per site — and **a modal is invisible to every
part of it**. Modal state evaporates on reload, on site switch, and on tear-off,
and can never show a dirty indicator because it has no tab to show one on. A
modal is the one place in this app where work can be silently lost. Everything
below follows from that.

A modal must clear all four:

1. **Nothing to lose** — abandoning it costs at most retyping a couple of fields.
2. **No durable thing you would return to** — if `ctx.open('…', {id})` would make
   sense afterwards, the creator should have BEEN that pane.
3. **Nothing else needs to be on screen** — a modal blocks the workbench. That is
   its function and its cost.
4. **Seconds, not minutes** — freezing a multi-window operator app for a long
   form is hostile.

And then a fifth test, which **both shapes** must pass:

5. **It must not break their context** — whatever this is, opening it leaves the
   operator where they were.

The first four are hurdles a MODAL has to clear; this one is the only test that
can rule a PANE out, and it is the reason it exists. A pane is not automatically
the safe choice. `controller.open(…)` with the default `target: 'tab'` opens in
the focused group, which **hides the very thing the operator was looking at** —
for a cross-cutting action invoked from the toolbar, that is a worse
interruption than a modal, because it also leaves a tab to clean up afterwards.
On compact there is no `beside` at all, so a pane there is a full-screen
takeover.

So: a pane that would displace what someone is working on fails, exactly as a
modal that blocks what they need to see fails. If a thing is invoked from the
chrome rather than from a place, and it is over in seconds, the shape that
respects context is usually the dialog.

The corollary worth stating, because it is what makes the feedback dialog
defensible: **capturing context beats keeping it on screen.** The compose dialog
attaches the pane, module, record and site automatically and shows them back
(`buildFeedbackContext`), so nobody needs the broken screen still visible while
they describe it. Solve "I can't see it" by carrying the answer forward, not by
reserving half the layout.

**The test that settles create-vs-modal: does create have the same shape as
edit?** A site has a name, a handle, module scope, domains — so the create form
IS the manage form, one surface in two states (`{id:'new'}` → `{id}`). A create
modal there means writing that form twice and keeping both in sync forever. An
invitation has an email and a role, there is no invitation surface, and revoke
lives on the roster row — nothing to return to, so: modal.

From the outside both look like "a form for making a new thing". The difference
is not the form, it is what survives it: one produces something with an address,
the other produces a sent email.

**The one exemption.** `line-editor-modal.tsx` is 386 lines and fails test 4
outright, yet it is right — because it is a different shape: a nested editor for
part of **the pane's own draft**. It commits to the invoice draft, never to the
server, so the PANE stays dirty on its behalf and the safety net still covers it.
Stated precisely: _a modal may hold real work only when its result lands in a
dirty-tracked pane rather than on the server._ That is what makes the line editor
safe and a "create site" modal unsafe — the latter has no pane to be dirty for it.

Confirms (`useImperativeAlertDialog`) sit outside this entirely: a decision, not
a form.

| Surface             | Shape | Why                                            |
| ------------------- | ----- | ---------------------------------------------- |
| Create site         | pane  | becomes the manage pane; durable, addressable  |
| Invite teammate     | modal | two fields, no invite surface, fire-and-forget |
| Compose feedback    | modal | chrome action; context captured, not displayed |
| Feedback thread     | pane  | a conversation you return to; deep-linkable    |
| Record payment      | modal | one amount against a known balance             |
| Invoice line editor | modal | nested editor over the pane's own draft        |

## Surface patterns (established on invoicing, the gold-standard module)

- **Lifecycle in the pane header** — one stage control (soft button, colored
  by `stageTone`) that IS the document's position and its moves; entering a
  stage with entry effects (number/snapshot/lock) gets a confirm that names
  each effect in plain words. Void is a stage, not a button.
- **Read-only derives from the stage's `locksEditing`**, not from status.
  Payments stay active on locked documents — a finalized invoice is exactly
  the one getting paid.
- **Status is money truth**: derived server-side from recorded payments, never
  from the stage. The Payments section (ledger + record dialog defaulting to
  the balance) is what settles a document.
- **Capability-gated overflow menu** — items appear only when they can work
  (payment link when balance > 0, convert-to-order when committed, delete when
  draft); print/save-as-PDF is always present so the menu is never empty.
- **History renders only when a frozen record exists** — each snapshot row
  shows the stage label _as captured_ and opens the frozen print view.
- **Decimal coercion at every fetch boundary** (`normalizeDocument`) — Prisma
  Decimal serializes to JSON as a string, and money sorted as strings puts
  $100 above $9.
- **Container queries everywhere** — pane width and viewport width are
  unrelated, so all responsive behavior in a pane is `@container`-based.

## Deployment

Standard web-app wiring, one deliberate override:

- `sparx/apps/workbench/Dockerfile` — standalone Next build; the filtered install
  copies the 15-package `@wizeworks/auth` transitive closure.
- `k8s/apps/workbench.yaml` — 1 replica (browser-rendered; the pod serves only
  the shell + BFF), and a **per-pod `BETTER_AUTH_URL=https://workbench.sparx.works`**
  overriding the ConfigMap's shared `app.sparx.works` value — without it every
  sign-in 403s as cross-origin.
- Caddy host block + Cloudflare A record (`workbench`) + `PLATFORM_HOSTNAMES`
  entry (on-demand TLS) + build/deploy/cleanup workflow entries.

## Open items

- silicaui-react 0.27 publish + catalog bump activates the multi-window
  overlay fix (the workbench shim resolves it dynamically; no code change).
- Pane surfaces beyond invoicing (commerce, CRM, content) follow the invoicing
  patterns above.
- **Addressing state INSIDE a surface** — which tab of a product, which section
  of a settings pane. `?tab=` is reserved for it (`TAB_PARAM` in `@wizeworks/links`)
  and the query-parameter passthrough already carries it to `ctx.params`; what is
  left is teaching each detail surface to read it, which is a sweep across ~131
  surfaces and its own pass.
