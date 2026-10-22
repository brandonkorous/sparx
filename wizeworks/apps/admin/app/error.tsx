'use client';

// Route-segment error boundary for the operator console. The console had none,
// so any crash below the root layout fell through to Next's bare "Application
// error" document. The commonest one is an operator's tab left open across a
// release: its server actions belong to the build before, and Next throws
// UnrecognizedActionError on the next click. That case reloads once on its own
// (the budget is shared with ChunkReloadGuard in ./providers); anything else
// offers Try again first.

import { useEffect } from 'react';
import { Button, Card, CardBody } from '@wizeworks/silicaui-react';
import { useStaleBuildRecovery } from '@wizeworks/app-kit';

function reload(): void {
  window.location.reload();
}

export default function ConsoleError({
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
      <div className="grid min-h-dvh place-items-center p-8">
        <p className="text-base">Getting the latest version…</p>
      </div>
    );
  }

  return (
    <div className="grid min-h-dvh place-items-center p-8">
      <Card className="w-full max-w-md">
        <CardBody className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold">
            {stale ? 'A new version of the console is ready' : 'This page hit an error'}
          </h1>
          <p className="text-base">
            {stale
              ? 'This tab was open while a release shipped. Reload to pick it up. Anything typed on this page and not saved needs to be entered again.'
              : 'Try again first. If it keeps happening, reload the page. Nothing already saved is affected.'}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button color="primary" onClick={stale ? reload : reset}>
              {stale ? 'Reload' : 'Try again'}
            </Button>
            {stale ? null : (
              <Button variant="outline" onClick={reload}>
                Reload
              </Button>
            )}
          </div>
          {error.digest ? <p className="font-mono text-sm">Reference: {error.digest}</p> : null}
        </CardBody>
      </Card>
    </div>
  );
}
