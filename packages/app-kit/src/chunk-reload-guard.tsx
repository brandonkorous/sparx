'use client';

import { useEffect } from 'react';
import { isChunkLoadError, reloadOnceForStaleBuild } from './chunk-error';

// Catches the chunk-load failures a browser tab throws when it's left open
// across a deploy and then client-navigates to a route whose JS/CSS chunk the
// new build purged. Next surfaces these as window 'error' / 'unhandledrejection'
// events; the only real recovery is a full reload to fetch the current chunks.
// The render-time counterpart — the same failure thrown INSIDE React, which
// never reaches `window` — belongs to the app's error boundaries, which import
// the same detector from ./chunk-error so a broken build can't loop past the
// one shared cooldown.
//
// Renders nothing. Mount once near the app root, ABOVE the app's own providers:
// a chunk error can strike before a shell ever renders, which is precisely when
// nothing else can recover it.

export function ChunkReloadGuard(): null {
  useEffect(() => {
    function onError(event: ErrorEvent): void {
      // Prefer the Error itself — it carries `name` and `cause`, which
      // `event.message` flattens away.
      maybeReload(event.error instanceof Error ? event.error : event.message);
    }

    function onRejection(event: PromiseRejectionEvent): void {
      maybeReload(event.reason);
    }

    function maybeReload(input: unknown): void {
      if (isChunkLoadError(input)) reloadOnceForStaleBuild();
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
