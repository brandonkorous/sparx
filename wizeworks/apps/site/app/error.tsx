'use client';

// Route-segment error boundary (docs/50 §4). Catches render/runtime errors below
// the root layout so a single broken page degrades to a recover-able message
// instead of a blank screen. Theme-agnostic: it inherits the page text color so
// it reads correctly in both light and dark storefronts.

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to the console / server logs. A future error tracker hooks in here.
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center p-12">
      <div className="text-base-content bg-base-100 w-full max-w-md rounded-lg border p-10 text-center">
        <p className="text-primary mb-3 font-mono text-sm font-semibold tracking-widest uppercase">
          Something went wrong
        </p>
        <h1 className="mb-2 text-[24px] font-semibold">This page didn&apos;t load</h1>
        <p className="mb-6 text-[15px] leading-[1.6] opacity-70">
          An unexpected error stopped this page from loading. You can try again, or head back to the
          store.
        </p>

        <div className="flex items-center justify-center gap-3">
          <button type="button" onClick={reset} className="btn btn-primary">
            Try again
          </button>
          <a href="/" className="text-primary text-[14px] underline">
            Go to homepage
          </a>
        </div>

        {error.digest ? (
          <p className="mt-6 font-mono text-xs opacity-50">Reference: {error.digest}</p>
        ) : null}
      </div>
    </main>
  );
}
