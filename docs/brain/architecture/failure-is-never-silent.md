---
title: A failure the operator cannot see is the only unacceptable one
node: architecture
type: rule
status: active
applies-to: [workbench]
sources:
  - sparx/apps/workbench/components/surface-mount.tsx
  - sparx/apps/workbench/components/chrome-boundary.tsx
  - sparx/apps/workbench/components/root-boundary.tsx
  - sparx/apps/workbench/components/write-failure-reporter.tsx
  - sparx/apps/workbench/components/crash-listeners.tsx
  - sparx/apps/workbench/lib/api/write-failure.ts
  - sparx/apps/workbench/lib/api/write-meta.ts
  - sparx/apps/workbench/app/error.tsx
  - sparx/apps/workbench/app/global-error.tsx
  - wizeworks/packages/app-kit/src/chunk-error.ts
---

Five layers, and each exists because the one above it structurally cannot see what it catches.

- **Pane** (`components/surface-mount.tsx`) — one surface throwing costs one tab. Offers "Try again", because a pane is usually failing on one record and re-mounting is a real second chance.
- **Chrome, per region** (`components/chrome-boundary.tsx`) — toolbar, rail, module panel, billing banner, status bar, launcher. Per region, not one boundary around the chrome: a broken status bar must not also cost the site switcher. No retry — chrome renders the same global state every time, so a retry button is a button that fails again.
- **Route** (`app/error.tsx`) — the shell, the dock, a route segment.
- **Root providers** (`components/root-boundary.tsx`) — query client, analytics, toasts, confirm. They sit ABOVE `app/error.tsx` in the layout, so a throw in one used to land on `app/global-error.tsx`'s literal-hex replacement document. By then the layout's own JSX has rendered, so globals.css is loaded and a real screen is possible.
- **Layout** (`app/global-error.tsx`) — the layout itself threw; assume nothing, inline hexes, the one sanctioned RULE #1 exception.

**The panes hold the unsaved work, so nothing above them may take them down.** Pane LAYOUT is persisted and comes back; pane DRAFTS are in memory and do not (`lib/drafts.ts`). Before the chrome was isolated, a status-bar chip failing to render discarded a half-written invoice in a pane that was working perfectly — and both offered recoveries, `reset()` and Reload, discarded it again.

**Boundaries catch renders. Two whole classes of failure never reach one**, and they are covered separately:

- **A failed WRITE** (`components/write-failure-reporter.tsx`) rejects inside a promise. Every boundary stays green while the operator's change quietly did not happen — the worst failure the app has, because the screen still shows what they typed. One subscription to the mutation cache is the floor under all 132 call sites: always report, but announce only if the mutation has no `onError` of its own, since a call site that handles it says something better. Offline writes are NOT a failure — TanStack's default `networkMode: 'online'` pauses and resumes them, and the status bar already says so.
- **Everything reaching `window`** (`components/crash-listeners.tsx` → `ChunkReloadGuard`'s `onUnhandled`) — an unawaited rejection, a throw in a timer or listener. Stale-build chunk errors are excluded: they recover themselves and would bury real bugs under one entry per deploy per open tab.

**Every boundary RECOVERS, so every boundary must also REPORT** (`reportCrash` in `lib/analytics.ts`). A recovered crash produces no unhandled rejection and nothing autocapture sees — the better the recovery, the more invisible the bug. Reports carry which boundary and what it was showing; "the workbench threw" is true of all of them and useful about none.

**Failure copy names the CONSEQUENCE, never the component.** "The status bar ran into a problem" names a piece of our interface to someone who runs a business and has never called that strip anything; "Live updates have stopped showing" says what they lost. Order is consequence → reassurance → the one action, because the first question is always "did I just lose something?" `ChromeBoundary` therefore takes `whatStopped` (operator copy) and `region` (telemetry) as separate props, so the copy can be rewritten without splitting a region's telemetry in two. `lib/api/write-failure.ts` is the same rule for writes: checks ordered by BLAME, not by status code, and a 4xx passes api-rest's own message through because it was written for them.

**`meta: { housekeeping: true }` marks a write the operator did not ask for** (`lib/api/write-meta.ts`). It does not count as "saved" and its failure is not announced — but it is still reported. Without it the status bar read the recents visit-ping as a save and announced "Saved just now" within a second of boot, in the one place people look to check their work is safe. Related: [[never-present-absence-as-measurement]].

**How to apply:** new chrome region → wrap it in `ChromeBoundary` with a `whatStopped` sentence. New background write → `meta: { housekeeping: true }`. A write whose failure needs naming → `meta: { writing: 'your invoice' }`. A surface that can say something specific on failure should still use its own `onError`; the net exists so that the ones which don't are not silent.

Related: [[workbench-addresses]], [[modules-are-flags]]
