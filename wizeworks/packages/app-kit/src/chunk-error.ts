// Detecting — and recovering from — a tab left open across a deploy.
//
// When a release ships, an open tab is still running the OLD bundle. The moment
// it tries to pull a JS/CSS chunk the new build purged, it throws. Two arrivals:
//
//   • As a window 'error' / 'unhandledrejection' — an async import, a
//     prefetch, a route the router lazy-loads. `ChunkReloadGuard` listens for
//     these at the root.
//   • As a THROW during React render — a lazily-mounted component whose chunk
//     404s, surfacing at the nearest error boundary instead of on `window`. An
//     app's error.tsx / global-error.tsx catch these.
//
// Both paths recover the same way — a full reload fetches the current build —
// and both must respect ONE cooldown, or a genuinely broken build (one that
// still throws after reloading) traps the tab in a refresh loop. So the
// detector and the once-per-cooldown reload live here, shared, rather than
// copied into each caller and left to drift.
//
// This module imports nothing. It is the entry a non-React caller (or a route
// handler) can reach for without pulling a component in: `@wizeworks/app-kit/chunk-error`.

// The wording is BUNDLER-specific, and getting it wrong is silent: an unmatched
// message doesn't fail loudly, it just routes a routine "we shipped" into an
// app's generic crash screen, whose Try again re-renders the same dead build. So
// every bundler this repo has ever produced a browser bundle with is listed:
//
//   Turbopack — `next build`'s default since Next 16 (next/dist/lib/bundler.js:
//     "The default is turbopack when nothing is configured"), i.e. what actually
//     ships today. Throws a plain Error — name 'Error', NOT 'ChunkLoadError' —
//     reading `Failed to load chunk <url> from module <id>`.
//   webpack — `next build --webpack`. `ChunkLoadError: Loading chunk 42 failed.`
//   native ESM (Vite/browser `import()`) — the last three, kept because a
//     bundler swap must never quietly re-break this.
//
// The Turbopack entry is the one that was MISSING, platform-wide, until
// 2026-07-27: the list was written against webpack, not one alternative matched
// Turbopack's sentence, and so every recovery path in every app had been dead
// since the Next 16 upgrade. Deleting an entry here is how that happens again.
const CHUNK_ERROR_RE =
  /Failed to load chunk|Loading chunk [\w-]+ failed|ChunkLoadError|Loading CSS chunk|error loading dynamically imported module|Failed to fetch dynamically imported module|Importing a module script failed/i;

const RELOAD_GUARD_KEY = 'sparx:chunk-reloaded-at';
const RELOAD_COOLDOWN_MS = 10_000;

/** How far to follow `cause` before giving up — a cycle must not hang the tab. */
const MAX_CAUSE_DEPTH = 5;

/**
 * Every string worth testing from whatever a listener or boundary was handed.
 *
 * `name` counts as well as `message`: webpack's ChunkLoadError carries the
 * signal in its name. And the chain is walked because Turbopack re-throws with
 * `{ cause }` when its backend rejected with a reason — the outer sentence
 * matches on its own today, but a wrapped chunk failure must not slip past.
 */
function signalsOf(input: unknown, depth = 0): string[] {
  if (typeof input === 'string') return [input];
  if (!(input instanceof Error)) return [];
  const own = [input.name, input.message];
  if (depth >= MAX_CAUSE_DEPTH) return own;
  return [...own, ...signalsOf(input.cause, depth + 1)];
}

/** True when `input` looks like a chunk-load failure from a stale build. */
export function isChunkLoadError(input: unknown): boolean {
  return signalsOf(input).some((signal) => signal.length > 0 && CHUNK_ERROR_RE.test(signal));
}

/**
 * Reload to fetch the current build — at most once per cooldown window.
 *
 * Returns `true` if it triggered a reload, `false` if the cooldown blocked it
 * (i.e. we already reloaded moments ago and the tab is STILL broken, which means
 * reloading again won't help — the caller should show a recover-able fallback
 * instead of looping). A user-initiated reload should bypass this and call
 * `window.location.reload()` directly.
 */
export function reloadOnceForStaleBuild(): boolean {
  let last = 0;
  try {
    last = Number(window.sessionStorage.getItem(RELOAD_GUARD_KEY) ?? '0');
  } catch {
    // sessionStorage can throw in hardened privacy modes — treat as "no prior
    // reload" and fall through to reload once.
  }
  if (Date.now() - last < RELOAD_COOLDOWN_MS) return false;

  try {
    window.sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
  } catch {
    /* best-effort guard; reload anyway */
  }
  window.location.reload();
  return true;
}
