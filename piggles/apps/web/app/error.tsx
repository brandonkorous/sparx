'use client';

// Every page below the root layout. Without it, a tab left open across a release
// met Next's bare "Application error" page instead of the site around it.
// A stale build reloads itself once; anything else offers Try again first.

import { useEffect } from 'react';
import { faTriangleExclamation } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PRODUCT } from '@piggles/config';
import { Button, Card, CardBody } from '@wizeworks/silicaui-react';
import { useStaleBuildRecovery } from '@wizeworks/app-kit';

function reload(): void {
  window.location.reload();
}

export default function SiteError({
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

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6 py-12">
      {reloading ? (
        <p className="text-base">Getting the latest version…</p>
      ) : (
        <Card className="w-full max-w-md">
          <CardBody className="flex flex-col items-center gap-4 text-center">
            <Icon glyph={faTriangleExclamation} className="text-warning size-7" aria-hidden />
            <Message stale={stale} />
            <div className="flex flex-wrap items-center justify-center gap-3">
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
      )}
    </div>
  );
}

// Says what a reload costs: saved work stays, unsent typing on this page goes.
function Message({ stale }: { stale: boolean }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold">
        {stale ? `A new version of ${PRODUCT.name} is ready` : 'Something went wrong'}
      </h1>
      <p className="mt-2 text-base">
        {stale
          ? 'This page was open while we shipped an update. Reload to pick it up. Anything you typed on this page needs to be filled in again.'
          : 'Try again first. If it keeps happening, reload the page. Nothing you have saved is affected.'}
      </p>
    </div>
  );
}
