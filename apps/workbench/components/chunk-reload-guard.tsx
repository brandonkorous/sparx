'use client';

import { useEffect } from 'react';
import { isChunkLoadError, reloadOnceForStaleBuild } from '../lib/chunk-error';

// Catches the chunk-load failures a browser tab throws when it's left open
// across a deploy and then client-navigates to a route whose JS/CSS chunk the
// new build purged. Next surfaces these as window 'error' / 'unhandledrejection'
// events; the only real recovery is a full reload to fetch the current chunks.
// The render-time counterpart — the same failure thrown INSIDE React, which
// never reaches `window` — is caught by app/error.tsx + app/global-error.tsx.
// The detector and the once-per-cooldown reload are shared between all three
// (lib/chunk-error.ts) so a broken build can't loop.
//
// Renders nothing. Mount once near the app root. (Framework glue, not design-
// library — ported local because the workbench builds on silicaui directly and
// carries no @sparx/ui dependency; graduates to a shared `@sparx/app-kit` in the
// platform-wide rollout, alongside market's copy and the @sparx/ui original.)
//
// The workbench needs this more than any other app: a dock tab is left open for
// days, so it is the most likely surface to still be running a build the server
// no longer has chunks for.

export function ChunkReloadGuard(): null {
  useEffect(() => {
    function maybeReload(input: unknown): void {
      if (isChunkLoadError(input)) reloadOnceForStaleBuild();
    }

    function onError(event: ErrorEvent): void {
      maybeReload(event.error instanceof Error ? event.error : event.message);
    }

    function onRejection(event: PromiseRejectionEvent): void {
      maybeReload(event.reason);
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
