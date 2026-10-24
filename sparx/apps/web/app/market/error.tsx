'use client';

// The marketplace's error boundary. Its pages throw when api-rest does not answer,
// so Next keeps the last good copy (lib/public-api); a page with no good copy yet
// lands here and says so, instead of a 404 or an empty catalog. A tab left open
// across a release reloads once instead, like the root boundary.

import { useEffect } from 'react';
import { Button, Link } from '@wizeworks/silicaui-react';
import { useStaleBuildRecovery } from '@wizeworks/app-kit';
import { SparkMascot } from '@/components/marketing/spark-mascot';

export default function MarketError({
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

  const title = stale
    ? 'A new version of sparx is ready'
    : 'The marketplace is temporarily unavailable';
  const body = stale
    ? 'This page was open while we shipped an update. Reload to pick it up.'
    : 'We could not load the catalog just now. Try again in a moment.';

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-6 py-12">
      <div className="border-base-300 max-w-[460px] rounded-xl border p-10 text-center">
        <div className="mb-5 flex justify-center">
          <SparkMascot expression="sad" tone="light" size={104} bob={false} />
        </div>
        <h1 className="m-0 mb-2.5 text-3xl font-semibold">{title}</h1>
        <p className="text-md m-0 mb-6">{reloading ? 'Getting the latest version…' : body}</p>
        <div className="flex items-center justify-center gap-3.5">
          <Button
            type="button"
            color="primary"
            onClick={stale ? () => window.location.reload() : reset}
          >
            {stale ? 'Reload' : 'Try again'}
          </Button>
          <Link href="/" color="primary" className="text-sm">
            Back to sparx
          </Link>
        </div>
      </div>
    </main>
  );
}
