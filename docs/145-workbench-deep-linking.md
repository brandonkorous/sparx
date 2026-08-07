# 145 — Workbench: deep linking

Version: 2.0.0
Author: Brandon Korous
Last Updated: 2026-08-06

> **Status: SHIPPED (2026-08-06).** Every phase below is built. The durable
> knowledge now lives in the brain at
> [architecture/workbench-addresses](brain/architecture/workbench-addresses.md);
> this document is retained as the reasoning and the build record, and can be
> absorbed and deleted per the brain's authoring contract.
>
> Two counts here were revised while building: the registry holds **233**
> surfaces, not 217 (the original grep dropped hyphenated keys), and the shipped
> table has **234** rows — the extra is the unresolved-link pane itself.

## Purpose

Make a workbench URL a real address: one that **opens a pane**, not a page. Someone
pastes `https://app.sparx.works/commerce/orders/8f2…?site=savory-donuts` into a
Teams chat, a colleague clicks it, and that order opens in their workbench — on
the right business, on a phone or a desk, signed in or not yet, without
disturbing whatever else they had arranged.

The workbench is an MDI: the URL must never try to describe the layout. It
describes **one destination**, which arrives as a pane on top of what is already
there. That is the whole idea, and every decision below follows from it.

## Where we are now

Deep linking is half-built, and the half that exists is the right half — the
pane descriptor is already the serialization boundary for layout, cross-window
transfer, and links ([lib/surfaces/descriptor.ts](../apps/workbench/lib/surfaces/descriptor.ts)).

What works: `?open=<surface>?<k>=<v>`, repeatable, consumed after layout restore
in [lib/dock/dock.tsx](../apps/workbench/lib/dock/dock.tsx); four hand-written
friendly paths that translate into it via
[lib/surface-redirect.ts](../apps/workbench/lib/surface-redirect.ts).

What does not:

1. **Compact never consumes a link.** `consumeDeepLink` lives inside the dock's
   `onReady`; [mobile-stack.tsx](../apps/workbench/components/mobile-stack.tsx)
   hydrates and stops. Below 64rem every deep link opens nothing — i.e. every
   link opened from a phone's mail app.
2. **A logged-out link is lost.** [app/page.tsx](../apps/workbench/app/page.tsx)
   does a bare `redirect('/sign-in')` with no `callbackURL`. Only the four
   friendly paths survive a cold click; the raw `?open=` form every backend
   emitter builds does not — and cold is the normal case for emailed links.
3. **social-worker emits links nothing reads.**
   [services/social-worker/src/notify.ts](../services/social-worker/src/notify.ts)
   builds `/?surface=social.composer&id=…`. The workbench reads `open=`. Those
   emails land on a bare shell.
4. **No link carries the site.** Layouts and records are per-site; a descriptor
   has no site dimension. A link to Site B's order clicked on Site A opens a pane
   that 404s.
5. **Nobody can make a link.** No copy-link affordance anywhere across 217
   surfaces, and the address bar always reads `/` — so the universal instinct
   (copy the URL, paste it to someone) produces a link to nothing.
6. **Emitters hardcode surface keys.** `surface-redirect.ts` says they must not;
   `finance.subscription` is already baked into api-rest's billing route. Rename
   a surface and links in already-sent mail die.
7. **Every failure is silent.** Unknown surface key, disabled module,
   unreachable module, deleted record: the link opens nothing and says nothing.
8. **The capture is racy.** `capturedDeepLinks` retires on a 5-second timer, but
   the dock only mounts once the site key resolves — a slow first visit retires
   the intent before `onReady` runs.

Two partial entity→surface tables exist and disagree:
[record-routes.ts](../apps/workbench/lib/surfaces/record-routes.ts) covers 24
entity types for universal search; `destinationFor()` in
[components/notifications/format.tsx](../apps/workbench/components/notifications/format.tsx)
covers exactly one for notifications. Neither is reachable from a service.

## The shape of the answer

**One pure-data route table, shared by everyone; the workbench resolves it; the
URL names the focused pane and nothing else.**

### 1. `@sparx/links` — the single table

A new package with zero dependencies and no React, so api-rest, the workers,
`@sparx/email` and the workbench browser bundle can all import it.

```ts
export interface AppRoute {
  /** Canonical, readable, and what buildPath emits. */
  readonly path: string; // '/commerce/orders/:id'
  /** The workbench surface key it resolves to. */
  readonly surface: string; // 'commerce.order.detail'
  /** Universal-search / notification entity_type, where one exists. */
  readonly entity?: string; // 'order'
  /** Legacy paths that still resolve here. Never emitted. */
  readonly aliases?: readonly string[];
}
```

Plus `matchPath()`, `buildPath()`, `routeForEntity()`, and a `linkTo()` helper
that prefixes an origin and appends `?site=`.

This one table replaces `RECORD_ROUTES`, `destinationFor()`, the four redirect
route files, and every hardcoded surface key in a service. Search, notifications,
email and the address bar stop being four opinions about where a thing lives.

**Why the table and not `path` on `SurfaceDefinition`:** the registry imports
React components and lucide icons, so a service can never read it. Authoring the
path beside the surface would therefore mean generating a second artifact and
keeping it fresh. Instead the table is authored once and a workbench test
enforces the coupling both ways: every route names a registered surface, and
every registered surface has exactly one route. That is what keeps it honest
rather than hand-synced — a new surface with no path fails the suite.

### 2. The server never resolves a path

The catch-all page checks the session and hands the raw path down. It does not
need to know what `/commerce/orders/:id` means, because sign-in preservation only
needs the path itself as `callbackURL`. Resolution happens in the browser, where
the registry lives. One source of truth, no server-side surface knowledge.

### 3. The site rides in the query, and switching is a navigation

`?site=<slug>` (id also accepted, so a rename doesn't kill a bookmark). On
arrival, a link naming a different site switches to it and reloads — and the link
survives the reload for free, because with the path form the link **is** the URL.
No sessionStorage handoff, which is what the `?open=` form would have needed.

### 4. The URL names the focused pane, never the layout

[docs/123](123-workbench.md) is right that the workbench is an application, not a
document — the URL must not track the arrangement. But it can track the **one
pane you are looking at**, which is what makes address-bar copy and refresh
behave. This lands inside the existing history bridge
([nav-history.tsx](../apps/workbench/lib/workbench/nav-history.tsx)), which
already pushes one entry per logical navigation; it currently pushes
`window.location.href` unchanged, and will instead push the focused pane's URL.
Back/forward then restores both focus and address together.

---

## Phases

### P0 — the table

- New `packages/links` (pure data, no deps). Wire per
  [new-workspace-package](../.claude/skills/new-workspace-package) conventions.
- Author a route for **all 233 registered surfaces**, path style mirroring the
  nav so the URL reads like the app: `/commerce/orders`,
  `/commerce/orders/:id`, `/crm/deals/:id`, `/settings/domains`,
  `/invoicing/invoices/:id`.
- `aliases` carry the four legacy paths (`/settings/billing`, `/finance/payouts`,
  `/chat/:id`, `/settings/domains`) so mail already in inboxes keeps working.
- Tests: surface↔route coverage both directions; `matchPath(buildPath(r)) === r`
  round-trip for every route; no duplicate path or alias.

### P1 — arrival

- `app/[...path]/page.tsx` — catch-all rendering the same shell as
  [app/page.tsx](../apps/workbench/app/page.tsx) with an added `initialPath`.
  Static routes (`/sign-in`, `/popout`, `/api/*`, `/accept-invite`, the OAuth and
  callback routes) win over it unchanged.
- Both entry points redirect a logged-out visitor to
  `/sign-in?callbackURL=<this path>` — closing gap 2 for the general case, not
  just the four hand-written routes.
- New `lib/workbench/deep-link.ts` owns capture → resolve → apply, and **both**
  [dock.tsx](../apps/workbench/lib/dock/dock.tsx) and
  [mobile-stack.tsx](../apps/workbench/components/mobile-stack.tsx) call it after
  hydrate. Closes gap 1.
- The 5-second retirement timer goes away. Re-application is idempotent
  (`controller.open` focuses rather than duplicates), and the case the timer
  guarded — a later site switch resurrecting the pane — is handled properly in P2
  by clearing the path on switch. Closes gap 8.
- `?open=` keeps working, unchanged, as the internal/legacy form.
- **Unmatched query params on a matched path become descriptor params.** This is
  what lets `/settings/billing?billing=success` reach the surface as
  `ctx.params.billing`; [surfaces/finance/subscription.tsx](../apps/workbench/surfaces/finance/subscription.tsx)
  currently reads `window.location.search` directly and mutates it, which breaks
  the instant P3 starts rewriting the URL. Convert it.

### P2 — the site dimension

- `buildPath` appends `?site=<slug>`; `matchPath` accepts slug or id.
- Arrival gate, once `useSites()` resolves:
  - no `site` → open on the active site (today's behaviour);
  - matches active → open;
  - names another reachable site → confirm if `hasUnsavedWork()`, POST
    `/api/active-site`, reload to the same URL;
  - names a site not in the list → the unresolved-link surface explains it
    (someone else's business, or access they don't have).
- A one-shot guard keyed to the target id prevents a switch loop when api-rest
  fails closed and the cookie doesn't take.
- `switchSite()` in [lib/api/shell-data.ts](../apps/workbench/lib/api/shell-data.ts)
  navigates to `/` before reloading — the focused record belongs to the site
  being left.

### P3 — the URL follows focus

- `urlForFocus()` derives the address from the focused pane's descriptor, falling
  back to `/` when nothing is focused or the surface has no route.
- [nav-history.tsx](../apps/workbench/lib/workbench/nav-history.tsx) pushes and
  replaces **that** URL instead of `window.location.href`. Base entry, boot
  collapse, ephemeral-dismissal collapse and popstate all keep their current
  semantics; only the third argument changes.
- Detached windows are already excluded (`role === 'detached'`), and `/popout`
  stays a fixed URL.
- Refresh on a record URL re-opens/focuses that pane over the restored layout —
  the same path as an inbound link, which is what keeps the two consistent.

### P4 — making a link

- "Copy link" in the tab context menu
  ([pane-tab.tsx](../apps/workbench/lib/dock/pane-tab.tsx)), above the close
  group; hidden when the surface has no route.
- The same action in the shared pane toolbar's overflow, so it is reachable
  without a right-click.
- Compact: a share control in the header beside the active pane's title —
  `navigator.share()` where available, clipboard otherwise.
- Always an absolute URL with `?site=`, because the destination is somebody
  else's browser. Toast confirms.

### P5 — every emitter, and the failure states

- `@sparx/links` `linkTo()` replaces hand-built strings in:
  [social-worker/notify.ts](../services/social-worker/src/notify.ts) (broken —
  fixes real dead links), [api-rest chat/notify.ts](../services/api-rest/src/lib/chat/notify.ts),
  [domain-worker/cron.ts](../services/domain-worker/src/cron.ts),
  [commerce market/payout.ts](../packages/commerce/src/services/market/payout.ts),
  [api-rest stripe-billing.ts](../services/api-rest/src/routes/v1/webhooks/stripe-billing.ts),
  [api-rest team.ts](../services/api-rest/src/routes/v1/team.ts).
- Env consolidation: `SPARX_DASHBOARD_URL`, `NEXT_PUBLIC_APP_URL` and
  `WORKBENCH_BASE_URL` are three names for one value. Settle on one, keep the
  others as fallbacks so nothing breaks mid-deploy.
- `destinationFor()` (notifications) becomes a lookup over `entity` — full
  coverage instead of one type. The schema deliberately has **no** href column
  ([86-notifications.prisma](../packages/db/prisma/schema/86-notifications.prisma));
  `entityType` + `entityId` are the mechanism, and this is what finally uses them.
- `RECORD_ROUTES` becomes a derived view over the table; the file goes.
- Delete the four redirect pages; their paths live on as aliases.
- **Failure states**, as a registered `platform.link.unresolved` surface so they
  arrive as a closable pane rather than a broken shell: unknown path, module not
  in this account (with a route to the modules surface), module not reachable by
  this person (no upsell), site not accessible. Missing record stays the detail
  surface's own error state.

### P6 — docs

Update [123-workbench.md](123-workbench.md) (the "single route" claim is now
"single application, addressable panes") and the brain node, and record the
`@sparx/links` contract.

## Deliberately not in this pass

**Sub-pane state.** A detail surface's active tab is not in the descriptor, so
`/commerce/products/:id` cannot yet mean "…on the inventory tab". `focusId`
exists in four surfaces as an ad-hoc precedent. Doing it properly is a sweep
across ~131 detail surfaces and is surface-internal state, not deep-linking
machinery — so it is its own pass.

The machinery for it is in place and that pass is now purely additive: `TAB_PARAM`
is reserved in `@sparx/links`, and the matcher already carries any query parameter
a route does not name through to `ctx.params`. What remains is teaching each
detail surface to read it and to write it back when its tab changes.

## What shipped

Everything in the phases above, plus five things the plan did not anticipate.

- **`switchSite()` now clears the address** (`window.location.replace('/')`)
  unless a deep-link switch asks it not to. That, not a timer, is what stops a
  site switch resurrecting a deep-linked pane — so the racy five-second
  retirement window is gone entirely rather than merely tuned.
- **The capture had to move to the outermost render.** The history bridge starts
  rewriting the bar with the focused pane's address as soon as the layout
  restores, so a link read any later than `WorkbenchShell`'s render body is a
  link already overwritten. `readDeepLink()` is idempotent and deliberately does
  NOT mark itself captured on the server, where there is no address to read.
- **The apply is gated per HOST, not per page load.** Idempotent is not the same
  as harmless: re-running on a background query refetch would yank focus back to
  the linked pane while somebody was working elsewhere.
- **Two extra emitter bugs surfaced.** `subscription.tsx` built its Stripe return
  URL from `window.location.href`, which stops meaning "this surface" the moment
  the bar tracks focus; and the invitation link's local fallback still said port
  **3001** — the removed dashboard's — so every invite generated on a laptop
  pointed at nothing. `appOrigin()` answers 3011 outside production.
- **`SPARX_APP_URL`** is the one canonical origin variable and is now set in all
  three environments. The four names that used to mean it still resolve, in a
  fixed order, in one place.

Verified: `@sparx/links` 26 tests pass; `check-surface-routes` reports 234
surfaces all addressed; workbench typecheck, lint and `next build` are clean, and
the built route tree shows `/[...path]` alongside `/` with every real page
(`/sign-in`, `/popout`, the OAuth and provider callbacks, every `/api` handler)
still winning as a static route. `@sparx/commerce` and `@sparx/api-rest` carry
pre-existing typecheck and lint failures in the in-flight product-types work
(`product-types-service.ts`, `blueprint-installer.ts`, `blueprint-updater.ts`) —
untouched by this change and confirmed absent from every file it edits.

## Risks

- **nav-history is subtle.** Its seq/collapse logic assumes the href never
  changes. P3 is the one phase that needs deliberate back/forward verification by
  hand rather than by typecheck.
- **233 paths is where typos hide.** The round-trip and coverage tests are not
  optional — they are the reason this is safe to author in bulk.
- **Slug renames** break old links; accepting the id as well as the slug is the
  mitigation, not a fix.
- **The catch-all swallows typos** (`/settings/domain`). Intended: they land on
  the unresolved-link surface rather than a Next 404, which is the friendlier
  answer for a non-technical owner who mistyped or clicked a mangled link.
