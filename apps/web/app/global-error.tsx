'use client';

// Root error boundary (docs/50 §4) for the marketing site — fires only when the
// root layout itself throws, so it renders a complete self-contained document.

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
        {/*
         * The inline styles in this file are DELIBERATE and must stay (RULE #1's
         * only exception here). A global-error boundary renders its own <html>/
         * <body> and mounts when the root layout itself has thrown — globals.css
         * is not guaranteed to have loaded, so every utility class and every
         * --color-* token would resolve to nothing, leaving an unstyled white
         * page at the exact moment the fallback matters most. The literal hexes
         * and the system-ui stack are the correct implementation, not a miss.
         */}
        <div style={{ maxWidth: '460px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 600, margin: '0 0 10px' }}>
            sparx hit an error
          </h1>
          <p style={{ fontSize: '15px', lineHeight: 1.6, color: '#6b6b86', margin: '0 0 24px' }}>
            Something unexpected happened while loading the page. Please try again in a moment.
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
