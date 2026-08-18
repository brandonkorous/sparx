'use client';

import * as React from 'react';
import { RefreshCw } from 'lucide-react';
import { Button, toast, useConfirm } from '@wizeworks/ui';
import { reindexTenantAction } from '../actions';

// Rebuild the tenant's search index. Confirmed first, then dispatches the
// support:act server action. The rebuild runs asynchronously in the
// commerce-indexer worker, so success means "queued" — the doc counts update as
// the worker processes. `dropStale` re-creates from scratch (drops orphaned docs)
// rather than a plain upsert.
export function ReindexButton({ tenantId }: { tenantId: string }) {
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();

  async function run() {
    const ok = await confirm({
      title: 'Rebuild this tenant’s search index?',
      description:
        'The commerce-indexer will re-project every product, customer, and order from the database into Typesense, dropping any stale documents. This runs in the background and is safe to trigger anytime.',
      confirmLabel: 'Rebuild index',
      color: 'module',
    });
    if (!ok) return;

    startTransition(async () => {
      const res = await reindexTenantAction(tenantId, { dropStale: true });
      if (res.ok) {
        toast.success(`Reindex queued (${res.result.runId}).`);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Button type="button" variant="soft" onClick={run} disabled={pending} loading={pending}>
      <RefreshCw className="mr-1.5 h-4 w-4" />
      Rebuild index
    </Button>
  );
}
