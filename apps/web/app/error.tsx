'use client';

// Route-segment error boundary (docs/50 §4) for the marketing site. Catches
// render/runtime errors below the root layout so a broken page degrades to a
// recover-able message rather than a blank screen.

import { useEffect } from 'react';
import { Button, Link } from '@wizeworks/silicaui-react';
import { SparkMascot } from '@/components/marketing/spark-mascot';

export default function Error({
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
    <main className="flex min-h-[70vh] items-center justify-center px-6 py-12">
      <div className="border-base-300 max-w-[460px] rounded-xl border p-10 text-center">
        <div className="mb-5 flex justify-center">
          <SparkMascot expression="sad" tone="light" size={104} bob={false} />
        </div>
        <h1 className="text-h1 m-0 mb-2.5 font-semibold">This page hit an error</h1>
        <p className="text-body-sm text-ink-muted m-0 mb-6">
          Something unexpected happened. Try again, or head back to the homepage.
        </p>
        <div className="flex items-center justify-center gap-3.5">
          <Button type="button" color="primary" onClick={reset}>
            Try again
          </Button>
          <Link href="/" color="primary" className="text-small">
            Back to sparx
          </Link>
        </div>
        {error.digest ? (
          <p className="text-micro text-ink-subtle m-0 mt-6 font-mono">Reference: {error.digest}</p>
        ) : null}
      </div>
    </main>
  );
}
