'use client';

import * as React from 'react';

// Catches the chunk-load failures a browser tab throws when it's left open
// across a deploy and then client-navigates to a route whose JS/CSS chunk the
// new build purged. Next surfaces these as window 'error' / 'unhandledrejection'
// events; the only real recovery is a full reload to fetch the current chunks.
//
// Renders nothing. Mount once near the app root. (Framework glue, not design-
// library — ported local to market when it dropped @sparx/ui; graduates to a
// shared `@sparx/app-kit` in the platform-wide rollout.)

const CHUNK_ERROR_RE =
  /Loading chunk [\w-]+ failed|ChunkLoadError|Loading CSS chunk|error loading dynamically imported module|Failed to fetch dynamically imported module|Importing a module script failed/i;

const RELOAD_GUARD_KEY = 'sparx:chunk-reloaded-at';
const RELOAD_COOLDOWN_MS = 10_000;

function isChunkError(message: string): boolean {
  return message.length > 0 && CHUNK_ERROR_RE.test(message);
}

export function ChunkReloadGuard(): null {
  React.useEffect(() => {
    function maybeReload(message: string): void {
      if (!isChunkError(message)) return;

      // One reload per cooldown window. A stale chunk that survives a reload
      // (a genuinely broken build) must not trap the tab in a refresh loop.
      let last = 0;
      try {
        last = Number(window.sessionStorage.getItem(RELOAD_GUARD_KEY) ?? '0');
      } catch {
        // sessionStorage can throw in hardened privacy modes — treat as "no
        // prior reload" and fall through to reload once.
      }
      if (Date.now() - last < RELOAD_COOLDOWN_MS) return;

      try {
        window.sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
      } catch {
        /* best-effort guard; reload anyway */
      }
      window.location.reload();
    }

    function onError(event: ErrorEvent): void {
      const message = event.message || (event.error instanceof Error ? event.error.message : '');
      maybeReload(message);
    }

    function onRejection(event: PromiseRejectionEvent): void {
      const reason: unknown = event.reason;
      const message =
        reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : '';
      maybeReload(message);
    }

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
