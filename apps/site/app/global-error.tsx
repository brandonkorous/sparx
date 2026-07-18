'use client';

// Root error boundary (docs/50 §4). Only fires when the ROOT layout itself
// throws — at that point no layout/theme chrome is available, so this renders a
// complete, self-contained <html> document with inline light styling.

import { useEffect } from 'react';

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
          color: '#14142b',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div style={{ maxWidth: '460px', textAlign: 'center' }}>
          <p
            style={{
              fontFamily: 'monospace',
              fontSize: '12px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#e04631',
              margin: '0 0 12px',
            }}
          >
            Something went wrong
          </p>
          <h1 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 10px' }}>
            This store couldn&apos;t load
          </h1>
          <p style={{ fontSize: '15px', lineHeight: 1.6, color: '#6b6b86', margin: '0 0 24px' }}>
            An unexpected error stopped the page from loading. Please try again in a moment.
          </p>
          <button
            type="button"
            onClick={reset}
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
            Try again
          </button>
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
