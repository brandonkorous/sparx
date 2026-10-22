'use client';

// Route-segment error boundary (docs/50 §4) for the marketing site. Catches
// render/runtime errors below the root layout so a broken page degrades to a
// recover-able message rather than a blank screen. A tab left open across a
// release (a purged chunk, or a server action the new build no longer has)
// reloads once instead, through the budget shared with ChunkReloadGuard.

import { useEffect } from 'react';
import { Button, Link } from '@wizeworks/silicaui-react';
import { useStaleBuildRecovery } from '@wizeworks/app-kit';
import { SparkMascot } from '@/components/marketing/spark-mascot';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { stale, reloading } = useStaleBuildRecovery(error);

  useEffect(() => {
    console.error(error);
  }, [error]);

  if (reloading) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center px-6 py-12">
        <p className="text-md m-0">Getting the latest version…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-6 py-12">
      <div className="border-base-300 max-w-[460px] rounded-xl border p-10 text-center">
        <div className="mb-5 flex justify-center">
          <SparkMascot expression="sad" tone="light" size={104} bob={false} />
        </div>
        <h1 className="m-0 mb-2.5 text-3xl font-semibold">
          {stale ? 'A new version of sparx is ready' : 'This page hit an error'}
        </h1>
        <p className="text-md m-0 mb-6">
          {stale
            ? 'This page was open while we shipped an update. Reload to pick it up.'
            : 'Something unexpected happened. Try again, or head back to the homepage.'}
        </p>
        <div className="flex items-center justify-center gap-3.5">
          <Button
            type="button"
            color="primary"
            onClick={
              stale
                ? () => {
                    window.location.reload();
                  }
                : reset
            }
          >
            {stale ? 'Reload' : 'Try again'}
          </Button>
          <Link href="/" color="primary" className="text-sm">
            Back to sparx
          </Link>
        </div>
        {error.digest ? (
          <p className="m-0 mt-6 font-mono text-sm">Reference: {error.digest}</p>
        ) : null}
      </div>
    </main>
  );
}
