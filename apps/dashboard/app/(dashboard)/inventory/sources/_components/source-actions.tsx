'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, RefreshCw, Pencil, Trash2 } from 'lucide-react';
import {
  Button,
  Text,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  toast,
  useConfirm,
} from '@sparx/ui';
import { syncSource, deleteSource } from '../_lib/actions';
import { SourceForm } from './source-form';

interface Source {
  id: string;
  name: string;
  type: string;
  config: Record<string, string>;
  syncIntervalSec: number;
  notes: string | null;
}

export function SourceActions({ source }: { source: Source }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [editOpen, setEditOpen] = useState(false);
  const [syncing, startSync] = useTransition();
  const [syncError, setSyncError] = useState<string | null>(null);

  function triggerSync() {
    setSyncError(null);
    startSync(async () => {
      const { error } = await syncSource(source.id);
      if (error) {
        setSyncError(error);
      } else {
        router.refresh();
      }
    });
  }

  function onRemove() {
    void (async () => {
      const ok = await confirm({
        title: `Remove "${source.name}"?`,
        description:
          'This will disconnect the source and stop future syncs. Existing stock levels are retained.',
        confirmLabel: 'Remove',
        tone: 'danger',
      });
      if (!ok) return;
      const { error } = await deleteSource(source.id);
      if (error) {
        toast.error(error);
        return;
      }
      toast.success('Source removed');
      router.refresh();
    })();
  }

  return (
    <>
      <div className="flex flex-col items-end gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button color="neutral" variant="ghost" size="sm">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={triggerSync} disabled={syncing}>
              <RefreshCw className="mr-2 size-4" />
              {syncing ? 'Syncing…' : 'Sync now'}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setEditOpen(true)}>
              <Pencil className="mr-2 size-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onRemove} className="text-[var(--color-danger)]">
              <Trash2 className="mr-2 size-4" />
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {syncError && (
          <Text size="xs" variant="danger" className="max-w-[200px] text-right">
            {syncError}
          </Text>
        )}
      </div>

      {editOpen ? (
        <SourceForm
          presentation="modal"
          source={source}
          open
          onOpenChange={(o) => !o && setEditOpen(false)}
        />
      ) : null}
    </>
  );
}
