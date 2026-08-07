---
title: A workbench URL names a pane, not a page
node: architecture
type: rule
status: active
applies-to: [dashboard]
sources:
  - packages/links/src/routes.ts
  - packages/links/src/resolve.ts
  - packages/links/src/server.ts
  - apps/workbench/lib/workbench/deep-link.ts
  - apps/workbench/lib/workbench/address.ts
  - apps/workbench/app/[...path]/page.tsx
  - scripts/check-surface-routes.mjs
---

The workbench is an MDI, so an address names **one destination that opens as a pane on top of the operator's existing layout** — never a page that replaces it, and never the layout itself. `https://app.sparx.works/commerce/orders/8f2…?site=savory-donuts` opens that order beside whatever was already arranged.

**`@sparx/links` is the one address table.** Pure data, zero dependencies, no React — so a Node service, a Next server component and the browser bundle all read the same rows. Each row maps a readable `path` ⇄ a workbench `surface` key ⇄ (where the thing is indexed) an `entity` type, plus `aliases` for addresses already sitting in people's inboxes.

- **Everything resolves through it**: universal search, the notification bell, every emailed link, the browser address bar, and both copy-link controls. Before it there were two partial entity tables that disagreed (search knew 24 types, notifications knew 1) and four hand-written redirect pages.
- **`scripts/check-surface-routes.mjs` enforces the bijection** — every registered surface has exactly one address and every address names a real surface. CI-gated, so a new surface without an address fails the build rather than quietly being unlinkable.
- **The path parameter name must equal what the surface reads from `ctx.params`** (`:memberId`, `:productId`, `:key`). The matcher passes it straight through, so a mismatch opens an empty pane silently.
- **A query parameter the path does not name reaches the surface as a pane param.** That is how `/settings/billing?billing=success` works, and why a surface must never read `window.location` — the bar tracks the FOCUSED pane, so by the time a surface looks, the query may belong to something else.

**The server never resolves an address.** The catch-all `app/[...path]/page.tsx` checks the session and hands the raw path down; the browser resolves it against the surface registry (which imports React and 234 panes, so a service could never read it). Sign-in preservation needs only the path as `callbackURL`.

**A link carries its site.** `?site=<slug>` — a link is written to be read by SOMEONE ELSE, whose workbench is on whatever business they last used, and records belong to exactly one. Arriving on a mismatch switches workspaces and reloads onto the same address; a second attempt at the same site reports it unreachable instead of looping (api-rest fails the cookie closed under RLS).

**The address bar tracks the focused pane, never the arrangement.** `lib/workbench/nav-history.tsx` already pushed one history entry per logical navigation; each entry now carries that pane's address. Refresh, back/forward and copy-the-URL all work from the same mechanism, and the layout stays out of the URL entirely.

**Why:** deep linking was half-built and every gap was silent. Links never worked on compact at all (the resolver lived inside the dock's `onReady`), a signed-out click dropped the destination, social-worker emitted `?surface=` — a parameter the workbench has never read — and an unknown path, a disabled module or another business's record each opened nothing and said nothing. Nobody could produce a link either: the bar always read `/`.

**How to apply:** add a surface → add its row in `packages/links/src/routes.ts` (CI fails otherwise). Writing a link from a service → `appLink()` from `@sparx/links/server`, never a hand-built string and never a surface key. Needing the origin → `appOrigin()`, which reads the five variables that have ever meant it in one fixed order. Needing an address in the browser → `addressForPane` / `shareableAddressForPane` in `lib/workbench/address.ts`.

Related: [[modules-are-flags]], [[rls-multi-tenancy]]
