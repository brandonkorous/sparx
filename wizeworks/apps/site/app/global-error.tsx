'use client';

// Root error boundary (docs/50 §4). Only fires when the ROOT layout itself
// throws — at that point Next has replaced the whole document, so no layout, no
// theme and no stylesheet exist. That is why every rule below is written as an
// inline style: there is genuinely no token to reach for, and a class name here
// would resolve to nothing. It is the one file in this app where that is true.
//
// It reads as a stripped-down `error.tsx` on purpose, and carries the same two
// corrections:
//
//   no eyebrow — it opened with `SOMETHING WENT WRONG` in uppercase mono above
//       the heading (RULE #2).
//   not "the store" — it said "This store couldn't load" on a platform where a
//       publisher and a CRM-only team render the same file.
//
// The palette is the light one, hardcoded, because the tenant's theme died with
// the layout and there is nothing left to ask. A dark-mode reader gets a light
// card for the few seconds this is on screen.

import { useEffect } from 'react';

const INK = '#14142b';
const INK_QUIET = '#6b6b86';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

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
          color: INK,
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div style={{ maxWidth: '460px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 600, margin: '0 0 12px' }}>
            This website didn&rsquo;t load
          </h1>
          <p style={{ fontSize: '17px', lineHeight: 1.6, color: INK, margin: '0 0 24px' }}>
            Something went wrong at our end, not yours. Please try again in a moment.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: '#e04631',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 20px',
              fontSize: '16px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
          {error.digest ? (
            <p style={{ fontSize: '14px', color: INK_QUIET, margin: '24px 0 0' }}>
              If you let them know, quote{' '}
              <span style={{ fontFamily: 'monospace' }}>{error.digest}</span>.
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
