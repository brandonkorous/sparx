'use client';

// "Re-scan" — recomputes every entity's scorecard and refreshes the overview.
// A reindex can take a moment on a large catalog, so it shows a pending state.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@wizeworks/silicaui-react';
import { RefreshCw } from 'lucide-react';

import { reindexSeoAudits } from '@/components/seo/actions';

export function RescanButton({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);

  const run = async () => {
    setPending(true);
    setNote(null);
    const res = await reindexSeoAudits();
    setPending(false);
    if (!res.ok) {
      setNote(res.error ?? 'Re-scan failed.');
      return;
    }
    setNote(`Scanned ${res.reindexed ?? 0} page${res.reindexed === 1 ? '' : 's'}.`);
    router.refresh();
  };

  return (
    <div className="flex items-center gap-3">
      {note ? <span className="text-base-content text-xs">{note}</span> : null}
      <Button color="module" size={size} onClick={() => void run()} disabled={pending}>
        <RefreshCw className={`mr-1 h-3.5 w-3.5 ${pending ? 'animate-spin' : ''}`} />
        {pending ? 'Scanning…' : 'Re-scan site'}
      </Button>
    </div>
  );
}
