'use client';

// Last-resort boundary: fires only when the root layout (app/layout.tsx) itself
// throws, so it renders a complete, self-contained document. Everything below
// the layout is caught by app/error.tsx, which can use real components; this
// cannot assume globals.css or the silica plugin loaded, so the styles are
// inline literal hexes — the one sanctioned exception to RULE #1, exactly as in
// apps/web/app/global-error.tsx. An unstyled white page is the failure this
// exists to prevent.

import { useEffect } from 'react';
import { isChunkLoadError, reloadOnceForStaleBuild } from '@sparx/app-kit';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const stale = isChunkLoadError(error);

  useEffect(() => {
    console.error(error);
    // A release purged the chunk this tab was built against and it took the root
    // layout down with it — reset() re-runs the same dead build, so reload to
    // fetch the new one. Shared cooldown stops a broken build from looping.
    if (stale) reloadOnceForStaleBuild();
  }, [error, stale]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
          background: '#fbfbfd',
          color: '#14142b',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div style={{ maxWidth: '460px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 600, margin: '0 0 10px' }}>
            {stale ? 'A new version of sparx is ready' : 'The workbench hit an error'}
          </h1>
          <p style={{ fontSize: '15px', lineHeight: 1.6, color: '#4a4a63', margin: '0 0 24px' }}>
            {stale
              ? 'This tab was left open across an update. Reloading to load the latest version.'
              : 'Something unexpected happened while loading the workbench. Please try again in a moment.'}
          </p>
          <button
            type="button"
            onClick={stale ? () => window.location.reload() : reset}
            style={{
              background: '#e04631',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 18px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {stale ? 'Reload' : 'Try again'}
          </button>
          {error.digest ? (
            <p
              style={{
                fontFamily: 'monospace',
                fontSize: '11px',
                color: '#6b6b86',
                margin: '24px 0 0',
              }}
            >
              Reference: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
