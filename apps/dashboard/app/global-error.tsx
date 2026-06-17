'use client';

// Root error boundary (docs/50 §4) for the dashboard — fires only when the root
// layout itself throws, so it renders a complete self-contained document with
// inline styles (it runs OUTSIDE every provider; no tokens/Tailwind guaranteed).
//
// Its most important job: catch the ChunkLoadError a stale tab throws after a
// deploy purged its JS/CSS chunks and recover with a single reload. The
// <ChunkReloadGuard> handles the window-event path; this handles the cases that
// bubble through React to the root.

import { useEffect } from 'react';

const CHUNK_ERROR_RE =
  /Loading chunk [\w-]+ failed|ChunkLoadError|Loading CSS chunk|dynamically imported module|Importing a module script failed/i;
const RELOAD_GUARD_KEY = 'sparx:chunk-reloaded-at';
const RELOAD_COOLDOWN_MS = 10_000;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunkError =
    error?.name === 'ChunkLoadError' || CHUNK_ERROR_RE.test(error?.message ?? '');

  useEffect(() => {
    if (!isChunkError) {
      console.error(error);
      return;
    }
    // Reload once per cooldown to fetch the current chunks, without looping if
    // the reload doesn't resolve it (a genuinely broken build).
    let last = 0;
    try {
      last = Number(window.sessionStorage.getItem(RELOAD_GUARD_KEY) ?? '0');
    } catch {
      /* privacy mode — fall through and reload once */
    }
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return;
    try {
      window.sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    window.location.reload();
  }, [error, isChunkError]);

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
          <h1 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 10px' }}>
            {isChunkError ? 'Updating to the latest version…' : 'The dashboard hit an error'}
          </h1>
          <p style={{ fontSize: '15px', lineHeight: 1.6, color: '#6b6b86', margin: '0 0 24px' }}>
            {isChunkError
              ? 'A new version of sparx was just released. Reloading to catch up — this only takes a moment.'
              : 'An unexpected error stopped the dashboard from loading. Please try again in a moment.'}
          </p>
          {isChunkError ? null : (
            <button
              type="button"
              onClick={reset}
              style={{
                background: '#6366F1',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 18px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          )}
          {error.digest ? (
            <p
              style={{
                fontFamily: 'monospace',
                fontSize: '11px',
                color: '#9a9ab5',
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
