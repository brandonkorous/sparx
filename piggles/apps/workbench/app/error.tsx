'use client';

// The boundary for the console shell and every route segment under it.
//
// Three layers catch a crash here, and they do not overlap:
//   · components/surface-mount.tsx  — one PANEL crashing stays in its own tab.
//   · THIS                          — the shell, the dock, a route segment.
//   · components/root-boundary.tsx  — the providers, which sit ABOVE this file
//                                     and which this file therefore cannot see.
//
// Without this middle layer, anything the panel boundary does not own fell all
// the way through to Next's bare "Application error" document — no tokens, no
// stylesheet, no way back except the browser's reload button. That white page
// WAS the hard crash on deploy in the app this console forked from, which is
// exactly why that app has this file and why its absence here was a real gap.
//
// It renders inside app/layout.tsx, so globals.css and the silica classes are
// loaded — hence real components and tokens, and no inline styles.

import { useEffect, useState } from 'react';
import { faTriangleExclamation } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { Button } from '@wizeworks/silicaui-react';
import { isChunkLoadError, reloadOnceForStaleBuild } from '@sparx/app-kit';
import { reportCrash } from '@/lib/analytics';
import { productName } from '@/lib/product';

export default function ConsoleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // A stale-build error means a chunk this tab was built against is gone. It
  // reached us as a render throw, below where the crash listener's window
  // handler would have caught it. `reset()` re-renders the same broken tree and
  // cannot help; only a full reload fetches the new build.
  const stale = isChunkLoadError(error);
  const [reloading, setReloading] = useState(stale);

  useEffect(() => {
    console.error('[console] shell tree crashed', error);
    // The whole window is down — the crash that matters most and the one least
    // likely to be reported by hand, because the instinct is to reload and a
    // reload leaves no trace. `digest` ties it to the server-side log when the
    // throw came from a server component.
    reportCrash(error, { boundary: 'route', ...(error.digest ? { digest: error.digest } : {}) });
    if (!stale) return;
    // Auto-reload once per cooldown, shared with the crash listener. If the
    // cooldown blocks it — we already reloaded and the build is still broken —
    // fall back to the manual screen rather than looping.
    if (!reloadOnceForStaleBuild()) setReloading(false);
  }, [error, stale]);

  // The reload is navigating the tab away; don't flash the fallback behind it.
  if (reloading) {
    return (
      <div className="bg-base-300 flex h-dvh w-full items-center justify-center p-6">
        <p className="text-base">Getting the latest version…</p>
      </div>
    );
  }

  return (
    <div className="bg-base-300 flex h-dvh w-full items-center justify-center p-6">
      <div className="bg-base-100 border-base-300 flex max-w-md flex-col items-center gap-4 rounded-xl border p-8 text-center">
        <Icon glyph={faTriangleExclamation} className="text-warning size-7" aria-hidden />
        <div>
          <h1 className="text-lg font-semibold">
            {stale ? `A new version of ${productName()} is ready` : 'Something went wrong'}
          </h1>
          {/* Says what it costs. Panel arrangement is persisted and comes back;
              anything typed and not saved does not, and finding that out
              afterwards is how people stop trusting the app. */}
          <p className="mt-2 text-base">
            {stale
              ? 'This tab was open while we shipped an update. Reload to pick it up — your panels come back exactly as you left them.'
              : 'Try again first. If it keeps happening, reloading will clear it — your panels come back, though anything typed and not saved will not.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {stale ? (
            <Button
              color="primary"
              onClick={() => {
                window.location.reload();
              }}
            >
              Reload
            </Button>
          ) : (
            <>
              <Button color="primary" onClick={reset}>
                Try again
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  window.location.reload();
                }}
              >
                Reload
              </Button>
            </>
          )}
        </div>
        {/* The one string support will ask for. Kept selectable and monospaced
            so it can be read aloud or pasted without transcription errors. */}
        {error.digest ? <p className="font-mono text-sm">Reference: {error.digest}</p> : null}
      </div>
    </div>
  );
}
