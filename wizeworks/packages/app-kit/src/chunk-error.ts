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
// and both must draw on ONE budget, or a genuinely broken build (one that still
// throws after reloading) traps the tab in a refresh loop. So the detector and
// the budgeted reload live here, shared, rather than copied into each caller and
// left to drift.
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

const RELOAD_GUARD_KEY = 'sparx:chunk-reload';

// ── WHY THIS IS AN ATTEMPT BUDGET AND NOT A COOLDOWN ────────────────────────
//
// It was a cooldown: one timestamp in sessionStorage, reload only if the last
// reload was more than 10s ago. That is a RATE LIMIT, not a limit — every reload
// wrote a FRESH timestamp, so the window slid forward and the tab reloaded every
// 10 seconds, forever, on any error that kept matching. The header above promises
// the opposite ("or a genuinely broken build traps the tab in a refresh loop"),
// and the promise was never kept: nothing here ever counted attempts, so there
// was no number that could run out.
//
// What replaces it: a page that SURVIVES for `SETTLE_MS` has demonstrably loaded
// a working build, so a chunk error after that is a NEW deploy and earns a fresh
// budget. A second error inside that window is the SAME broken build throwing
// again, and reloading into it a third time cannot help — so the budget runs out
// and the caller shows its recover-able fallback instead.
const SETTLE_MS = 5 * 60_000;
const MAX_ATTEMPTS = 2;

/** The reload budget as it survives in sessionStorage (per tab, per origin). */
interface ReloadState {
  /** When the last reload was triggered. */
  at: number;
  /** Reloads triggered since the page last settled. */
  n: number;
}

function readState(): ReloadState {
  try {
    const raw = window.sessionStorage.getItem(RELOAD_GUARD_KEY);
    if (!raw) return { at: 0, n: 0 };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { at: 0, n: 0 };
    const { at, n } = parsed as Partial<ReloadState>;
    return { at: typeof at === 'number' ? at : 0, n: typeof n === 'number' ? n : 0 };
  } catch {
    // sessionStorage can throw in hardened privacy modes, and a hand-edited or
    // pre-format value can fail to parse. Both mean "no prior reload".
    return { at: 0, n: 0 };
  }
}

/** How far to follow `cause` before giving up — a cycle must not hang the tab. */
const MAX_CAUSE_DEPTH = 5;

// The one global this module reads, declared rather than typed in from
// `@types/node`. It is not a Node API here: every bundler that produces a
// browser build replaces this exact member expression with a string literal, so
// what ships is `'production' !== 'production'` and no `process` is ever
// touched. Pulling Node's global types into a package that only ever runs in a
// browser — to describe a value that does not survive the build — would say the
// opposite of what is true, and would undo "this module imports nothing".
declare const process: { env: { NODE_ENV?: string } };

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
 * Reload to fetch the current build — at most `MAX_ATTEMPTS` times per episode.
 *
 * Returns `true` if it triggered a reload, `false` if the budget blocked it —
 * i.e. we already reloaded and the tab is STILL broken, which means reloading
 * again won't help and the caller should show a recover-able fallback instead of
 * looping. A user-initiated reload should bypass this and call
 * `window.location.reload()` directly.
 *
 * **Refuses outright outside production.** A purged chunk is a DEPLOY artifact,
 * and there are no deploys in dev: there, every edit purges chunks by design and
 * the dev server's own client re-syncs the tab. Auto-reloading on top of that
 * turns routine HMR churn into a tab that reloads on a timer while someone is
 * trying to read the error that caused it. Returning `false` is also the honest
 * answer for a boundary — in dev the error screen is the useful outcome.
 */
export function reloadOnceForStaleBuild(): boolean {
  if (process.env.NODE_ENV !== 'production') return false;

  const now = Date.now();
  const prior = readState();
  // Settled = the page ran long enough to prove the build works, so an error now
  // belongs to a NEW stale build and starts its own budget.
  const attempts = now - prior.at > SETTLE_MS ? 0 : prior.n;
  if (attempts >= MAX_ATTEMPTS) return false;

  try {
    window.sessionStorage.setItem(RELOAD_GUARD_KEY, JSON.stringify({ at: now, n: attempts + 1 }));
  } catch {
    /* best-effort guard; reload anyway */
  }
  window.location.reload();
  return true;
}
