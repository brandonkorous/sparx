'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Pencil, Trash2 } from 'lucide-react';

import { Button } from '@wizeworks/silicaui-react';
import { toast, useConfirm } from '@sparx/ui';

import { syncSource, deleteSource } from '../../_lib/actions';
import { SourceForm } from '../../_components/source-form';
import type { SourceSummary } from './types';

// Header actions for a source's connection detail page: trigger a sync now, edit
// the connection config, or remove it. Remove navigates back to the sources list;
// sync/edit refresh in place. Reuses the shared surface-aware SourceForm (modal).

export function SourceDetailActions({ source }: { source: SourceSummary }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [editOpen, setEditOpen] = React.useState(false);
  const [syncing, startSync] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function triggerSync() {
    setError(null);
    startSync(async () => {
      const { error: err } = await syncSource(source.id);
      if (err) setError(err);
      else router.refresh();
    });
  }

  function onRemove() {
    void (async () => {
      const ok = await confirm({
        title: `Remove "${source.name}"?`,
        description:
          'This disconnects the source and stops future syncs. Existing stock levels and mappings are retained.',
        confirmLabel: 'Remove',
        tone: 'danger',
      });
      if (!ok) return;
      const { error: err } = await deleteSource(source.id);
      if (err) {
        toast.error(err);
        return;
      }
      toast.success('Source removed');
      router.push('/inventory/sources');
      router.refresh();
    })();
  }

  const editSource = {
    id: source.id,
    name: source.name,
    type: source.type,
    config: source.config ?? {},
    syncIntervalSec: source.syncIntervalSec,
    notes: source.notes,
  };

  return (
    <>
      <div className="flex flex-row flex-wrap items-center gap-2">
        {error ? <p className="text-danger text-xs">{error}</p> : null}
        {source.type !== 'agent' ? (
          <Button
            color="module"
            onClick={triggerSync}
            disabled={syncing}
            iconStart={<RefreshCw className="size-4" />}
          >
            {syncing ? 'Syncing…' : 'Sync now'}
          </Button>
        ) : null}
        <Button
          color="neutral"
          variant="soft"
          onClick={() => setEditOpen(true)}
          iconStart={<Pencil className="size-4" />}
        >
          Edit
        </Button>
        <Button
          color="danger"
          variant="ghost"
          onClick={onRemove}
          iconStart={<Trash2 className="size-4" />}
        >
          Remove
        </Button>
      </div>

      {editOpen ? (
        <SourceForm
          presentation="modal"
          source={editSource}
          open
          onOpenChange={(o) => !o && setEditOpen(false)}
        />
      ) : null}
    </>
  );
}
