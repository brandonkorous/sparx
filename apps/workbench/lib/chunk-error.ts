// Detecting — and recovering from — a tab left open across a deploy.
//
// When a release ships, an open tab is still running the OLD bundle. The moment
// it tries to pull a JS/CSS chunk the new build purged, it throws. Two arrivals:
//
//   • As a window 'error' / 'unhandledrejection' — an async import, a
//     prefetch, a route the router lazy-loads. `ChunkReloadGuard` listens for
//     these at the root (components/chunk-reload-guard.tsx).
//   • As a THROW during React render — a lazily-mounted component whose chunk
//     404s, surfacing at the nearest error boundary instead of on `window`.
//     app/error.tsx and app/global-error.tsx catch these.
//
// Both paths recover the same way — a full reload fetches the current build —
// and both must respect ONE cooldown, or a genuinely broken build (one that
// still throws after reloading) traps the tab in a refresh loop. So the regex
// and the once-per-cooldown reload live here, shared, rather than copied into
// each caller and left to drift.
//
// (Framework glue, not design-library. Graduates to a shared `@sparx/app-kit`
// in the platform-wide rollout, alongside market's chunk guard.)

const CHUNK_ERROR_RE =
  /Loading chunk [\w-]+ failed|ChunkLoadError|Loading CSS chunk|error loading dynamically imported module|Failed to fetch dynamically imported module|Importing a module script failed/i;

const RELOAD_GUARD_KEY = 'sparx:chunk-reloaded-at';
const RELOAD_COOLDOWN_MS = 10_000;

/** Pull a message string out of whatever a listener or boundary was handed. */
function messageOf(input: unknown): string {
  if (input instanceof Error) return input.message;
  if (typeof input === 'string') return input;
  return '';
}

/** True when `input` looks like a chunk-load failure from a stale build. */
export function isChunkLoadError(input: unknown): boolean {
  const message = messageOf(input);
  return message.length > 0 && CHUNK_ERROR_RE.test(message);
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
