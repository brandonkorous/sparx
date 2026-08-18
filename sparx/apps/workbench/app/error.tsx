'use client';

// Root error boundary for the workbench shell and every route segment under it.
//
// The per-PANE boundary (components/surface-mount.tsx) isolates one surface
// crashing to its own tab. This is the layer ABOVE that: it catches anything the
// pane boundary doesn't own — the shell chrome, the dock, the providers, a route
// segment — so a release that breaks any of them degrades to a recover-able
// screen instead of Next's bare "Application error" white page. Without this
// file, that white page WAS the hard crash on deploy.
//
// It renders inside app/layout.tsx, so globals.css and the silica plugin classes
// are loaded — hence real components and tokens, no inline styles. The sibling
// app/global-error.tsx handles the rarer case where the layout ITSELF threw and
// none of that is guaranteed.

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@wizeworks/silicaui-react';
import { isChunkLoadError, reloadOnceForStaleBuild } from '@wizeworks/app-kit';
import { reportCrash } from '../lib/analytics';

export default function WorkbenchError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // A stale-build error means a chunk this tab was built against is gone. It
  // reached us as a render throw, below where ChunkReloadGuard's window listener
  // would have caught it. reset() re-renders the same broken tree and can't
  // help; only a full reload fetches the new build.
  const stale = isChunkLoadError(error);
  const [reloading, setReloading] = useState(stale);

  useEffect(() => {
    console.error('[workbench] shell tree crashed', error);
    // The whole window is down, which is the crash that matters most and the one
    // least likely to be reported by hand — the operator's instinct is to reload,
    // and a reload leaves no trace. `digest` ties it to the server-side log when
    // the throw came from a server component.
    reportCrash(error, { boundary: 'route', ...(error.digest ? { digest: error.digest } : {}) });
    if (!stale) return;
    // Auto-reload once per cooldown (shared with ChunkReloadGuard). If the
    // cooldown blocks it — we already reloaded and the build is still broken —
    // fall back to the manual screen rather than looping.
    if (!reloadOnceForStaleBuild()) setReloading(false);
  }, [error, stale]);

  // The reload is navigating the tab away; don't flash the fallback behind it.
  if (reloading) {
    return (
      <div className="bg-base-300 flex h-dvh w-full items-center justify-center p-6">
        <p className="text-base">Updating to the latest version…</p>
      </div>
    );
  }

  return (
    <div className="bg-base-300 flex h-dvh w-full items-center justify-center p-6">
      <div className="bg-base-100 border-base-300 flex max-w-md flex-col items-center gap-4 rounded-xl border p-8 text-center">
        <AlertTriangle className="text-warning size-7" aria-hidden />
        <div>
          <h1 className="text-lg font-semibold">
            {stale ? 'A new version of sparx is ready' : 'The workbench hit a problem'}
          </h1>
          <p className="mt-2 text-base">
            {stale
              ? 'This tab was left open across an update. Reload to load the latest version — your panel arrangement comes back.'
              : 'Something unexpected happened. Try again, and if it keeps happening, reload to start fresh.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {stale ? (
            <Button color="primary" onClick={() => window.location.reload()}>
              Reload
            </Button>
          ) : (
            <>
              <Button color="primary" onClick={reset}>
                Try again
              </Button>
              <Button color="neutral" variant="outline" onClick={() => window.location.reload()}>
                Reload
              </Button>
            </>
          )}
        </div>
        {error.digest ? <p className="font-mono text-sm">Reference: {error.digest}</p> : null}
      </div>
    </div>
  );
}
